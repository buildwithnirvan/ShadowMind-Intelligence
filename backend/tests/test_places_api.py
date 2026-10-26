import pytest
import httpx
from fastapi.testclient import TestClient
from config import settings
from services.places_service import (
    CATEGORY_DEFINITIONS,
    haversine_distance_km,
    resolve_category,
    rate_limiter,
    places_cache,
    parse_osm_element,
    deduplicate_places,
    NearbyPlaceItem,
)

MOCK_OVERPASS_HOSPITALS = {
    "version": 0.6,
    "generator": "Overpass API",
    "elements": [
        {
            "type": "node",
            "id": 1001,
            "lat": 12.9716,
            "lon": 77.5946,
            "tags": {
                "name": "Bangalore Medical Center",
                "amenity": "hospital",
                "healthcare": "hospital",
                "phone": "+91 80 1234 5678",
                "website": "https://bmc.example.org",
                "addr:street": "MG Road",
                "addr:city": "Bengaluru",
            },
        },
        {
            "type": "way",
            "id": 2002,
            "center": {
                "lat": 12.9800,
                "lon": 77.6000,
            },
            "tags": {
                "name": "Cantonment General Clinic",
                "amenity": "clinic",
                "healthcare": "clinic",
                "addr:street": "Queens Road",
                "addr:city": "Bengaluru",
            },
        },
    ],
}

MOCK_NOMINATIM_GEOCODE = [
    {
        "place_id": 9991,
        "lat": "12.9715987",
        "lon": "77.5945627",
        "display_name": "Bengaluru, Bangalore North, Karnataka, 560001, India",
    }
]

MOCK_NOMINATIM_SPATIAL = [
    {
        "place_id": 8881,
        "osm_type": "node",
        "osm_id": 3003,
        "lat": "12.9720",
        "lon": "77.5950",
        "name": "Victoria Hospital",
        "display_name": "Victoria Hospital, Fort Road, Bengaluru, Karnataka, India",
        "type": "hospital",
    }
]

@pytest.fixture(autouse=True)
def reset_rate_limiter_and_cache():
    rate_limiter.history.clear()
    places_cache.cache.clear()
    yield
    rate_limiter.history.clear()
    places_cache.cache.clear()

def test_haversine_distance_calculation():
    # Distance between SF (37.7749, -122.4194) and Oakland (37.8044, -122.2712) is ~13.5 km
    dist = haversine_distance_km(37.7749, -122.4194, 37.8044, -122.2712)
    assert 12.0 < dist < 15.0

def test_resolve_categories_and_aliases():
    for cat in CATEGORY_DEFINITIONS.keys():
        assert resolve_category(cat) == cat

    assert resolve_category("therapist") == "counselling"
    assert resolve_category("psychiatrist") == "psychiatrists"
    assert resolve_category("gp") == "general_practitioners"
    assert resolve_category("mindfulness_coach") == "mental_health_clinics"
    assert resolve_category("emergency") == "hospitals"

    with pytest.raises(ValueError):
        resolve_category("astrology_cures")

def test_get_categories_endpoint(client):
    res = client.get("/api/doctors/categories")
    assert res.status_code == 200
    data = res.json()
    assert "categories" in data
    cat_ids = [c["id"] for c in data["categories"]]
    assert "hospitals" in cat_ids
    assert "mental_health_clinics" in cat_ids
    assert "psychiatrists" in cat_ids
    assert "psychologists" in cat_ids
    assert "counselling" in cat_ids
    assert "general_practitioners" in cat_ids

def test_nearby_requires_authentication(client):
    res = client.post("/api/doctors/nearby", json={
        "latitude": 12.9716,
        "longitude": 77.5946,
        "category": "hospitals",
        "radius": 5000,
    })
    assert res.status_code == 401

def test_nearby_works_without_google_maps_api_key(auth_client, monkeypatch):
    """Ensure no Google Maps API key is required to query nearby hospitals."""
    monkeypatch.setattr(settings, "GOOGLE_MAPS_API_KEY", "")

    async def mock_post(self, url, *args, **kwargs):
        return httpx.Response(200, json=MOCK_OVERPASS_HOSPITALS)

    monkeypatch.setattr(httpx.AsyncClient, "post", mock_post)

    res = auth_client.post("/api/doctors/nearby", json={
        "latitude": 12.9716,
        "longitude": 77.5946,
        "category": "hospitals",
        "radius": 5000,
    })
    assert res.status_code == 200
    data = res.json()
    assert data["count"] == 2
    assert "OpenStreetMap" in data["source"]
    assert "OpenStreetMap" in data["attribution"]

def test_nearby_successful_hospital_search_with_osm_mock(auth_client, monkeypatch):
    async def mock_post(self, url, *args, **kwargs):
        return httpx.Response(200, json=MOCK_OVERPASS_HOSPITALS)

    monkeypatch.setattr(httpx.AsyncClient, "post", mock_post)

    res = auth_client.post("/api/doctors/nearby", json={
        "latitude": 12.9716,
        "longitude": 77.5946,
        "category": "hospitals",
        "radius": 5000,
    })
    assert res.status_code == 200
    data = res.json()
    assert data["count"] == 2
    assert data["category"] == "hospitals"
    assert data["category_label"] == "Hospitals & Emergency"
    assert len(data["results"]) == 2

    first = data["results"][0]
    assert first["id"] == "node_1001"
    assert first["name"] == "Bangalore Medical Center"
    assert "MG Road" in first["address"]
    assert first["phone"] == "+91 80 1234 5678"
    assert first["website"] == "https://bmc.example.org"
    assert first["rating"] is None  # Never fabricate ratings
    assert first["distance_km"] is not None
    assert "google.com/maps/dir" in first["directions_uri"]
    assert "openstreetmap.org" in first["osm_url"]
    assert first["primary_type"] == "Hospital"

    # Second result omitted phone & website to verify no fabricated fields
    second = data["results"][1]
    assert second["id"] == "way_2002"
    assert second["name"] == "Cantonment General Clinic"
    assert second["phone"] is None
    assert second["website"] is None

def test_nearby_distance_sorting(auth_client, monkeypatch):
    """Verify places are sorted strictly by distance ascending (nearest first)."""
    # Create 3 points at different distances from (12.9716, 77.5946):
    # Point 1: very close (~0.1 km)
    # Point 2: medium distance (~2.5 km)
    # Point 3: further distance (~5.0 km)
    unordered_elements = [
        {
            "type": "node",
            "id": 1,
            "lat": 13.0100,  # ~4.3 km away
            "lon": 77.5946,
            "tags": {"name": "Far Hospital", "amenity": "hospital"},
        },
        {
            "type": "node",
            "id": 2,
            "lat": 12.9720,  # ~0.05 km away
            "lon": 77.5946,
            "tags": {"name": "Nearest Hospital", "amenity": "hospital"},
        },
        {
            "type": "node",
            "id": 3,
            "lat": 12.9850,  # ~1.5 km away
            "lon": 77.5946,
            "tags": {"name": "Mid Hospital", "amenity": "hospital"},
        },
    ]

    async def mock_post(self, url, *args, **kwargs):
        return httpx.Response(200, json={"elements": unordered_elements})

    monkeypatch.setattr(httpx.AsyncClient, "post", mock_post)

    res = auth_client.post("/api/doctors/nearby", json={
        "latitude": 12.9716,
        "longitude": 77.5946,
        "category": "hospitals",
        "radius": 10000,
    })
    assert res.status_code == 200
    results = res.json()["results"]
    assert len(results) == 3
    assert results[0]["name"] == "Nearest Hospital"
    assert results[1]["name"] == "Mid Hospital"
    assert results[2]["name"] == "Far Hospital"
    assert results[0]["distance_km"] < results[1]["distance_km"] < results[2]["distance_km"]

def test_nearby_empty_results(auth_client, monkeypatch):
    async def mock_post(self, url, *args, **kwargs):
        return httpx.Response(200, json={"elements": []})

    async def mock_get(self, url, *args, **kwargs):
        return httpx.Response(200, json=[])

    monkeypatch.setattr(httpx.AsyncClient, "post", mock_post)
    monkeypatch.setattr(httpx.AsyncClient, "get", mock_get)

    res = auth_client.post("/api/doctors/nearby", json={
        "latitude": 12.9716,
        "longitude": 77.5946,
        "category": "psychiatrists",
        "radius": 1000,
    })
    assert res.status_code == 200
    data = res.json()
    assert data["count"] == 0
    assert data["results"] == []

def test_nearby_missing_facility_names_fallback():
    """Missing or empty name tags fall back to category default name without fabricating."""
    el = {
        "type": "node",
        "id": 555,
        "lat": 12.97,
        "lon": 77.59,
        "tags": {"amenity": "hospital"},
    }
    parsed = parse_osm_element(el, 12.97, 77.59, default_name="Hospital / Medical Center")
    assert parsed is not None
    assert parsed.name == "Hospital / Medical Center"
    assert parsed.id == "node_555"

def test_nearby_duplicate_records_deduplicated():
    """Ensure identical IDs and co-located facilities within 100m are deduplicated."""
    item1 = NearbyPlaceItem(
        id="node_101",
        name="Apollo Clinic",
        latitude=12.9716,
        longitude=77.5946,
        distance_km=0.1,
    )
    # Exact same ID
    item1_dup = NearbyPlaceItem(
        id="node_101",
        name="Apollo Clinic",
        latitude=12.9716,
        longitude=77.5946,
        distance_km=0.1,
    )
    # Different ID, but same name and co-located within 30 meters
    item2 = NearbyPlaceItem(
        id="way_202",
        name="Apollo Clinic",
        latitude=12.9717,
        longitude=77.5947,
        distance_km=0.12,
        phone="+91 80 9999 8888",
    )
    # Completely distinct clinic
    item3 = NearbyPlaceItem(
        id="node_303",
        name="Fortis Hospital",
        latitude=12.9800,
        longitude=77.6000,
        distance_km=1.5,
    )

    deduped = deduplicate_places([item1, item1_dup, item2, item3])
    assert len(deduped) == 2
    names = [d.name for d in deduped]
    assert names == ["Apollo Clinic", "Fortis Hospital"]
    # Ensure enriched phone was preserved on Apollo Clinic
    assert deduped[0].phone == "+91 80 9999 8888"

def test_nearby_manual_query_geocoding_success(auth_client, monkeypatch):
    """When coordinates are omitted, manual area search geocodes query via Nominatim."""
    async def mock_get(self, url, *args, **kwargs):
        return httpx.Response(200, json=MOCK_NOMINATIM_GEOCODE)

    async def mock_post(self, url, *args, **kwargs):
        return httpx.Response(200, json=MOCK_OVERPASS_HOSPITALS)

    monkeypatch.setattr(httpx.AsyncClient, "get", mock_get)
    monkeypatch.setattr(httpx.AsyncClient, "post", mock_post)

    res = auth_client.post("/api/doctors/nearby", json={
        "category": "hospitals",
        "query": "Bengaluru",
        "radius": 5000,
    })
    assert res.status_code == 200
    data = res.json()
    assert data["count"] == 2
    assert "Bengaluru" in data["query_used"]
    assert data["search_center"]["latitude"] == pytest.approx(12.9715987, 0.001)

def test_nearby_manual_query_geocoding_failure_404(auth_client, monkeypatch):
    """When a manual area name cannot be resolved, return a clean 404 with helpful message."""
    async def mock_get(self, url, *args, **kwargs):
        return httpx.Response(200, json=[])

    monkeypatch.setattr(httpx.AsyncClient, "get", mock_get)

    res = auth_client.post("/api/doctors/nearby", json={
        "category": "hospitals",
        "query": "NonExistentPlaceXYZ12345678",
        "radius": 5000,
    })
    assert res.status_code == 404
    assert "could not be resolved" in res.json()["detail"].lower()

def test_nearby_overpass_timeout_falls_back_to_nominatim(auth_client, monkeypatch):
    """If Overpass mirrors timeout, service falls back to Nominatim bounded search."""
    async def mock_post_timeout(self, url, *args, **kwargs):
        raise httpx.TimeoutException("Overpass mirror gateway timeout")

    async def mock_get_spatial(self, url, *args, **kwargs):
        return httpx.Response(200, json=MOCK_NOMINATIM_SPATIAL)

    monkeypatch.setattr(httpx.AsyncClient, "post", mock_post_timeout)
    monkeypatch.setattr(httpx.AsyncClient, "get", mock_get_spatial)

    res = auth_client.post("/api/doctors/nearby", json={
        "latitude": 12.9716,
        "longitude": 77.5946,
        "category": "hospitals",
        "radius": 5000,
    })
    assert res.status_code == 200
    data = res.json()
    assert data["count"] == 1
    assert data["results"][0]["name"] == "Victoria Hospital"

def test_nearby_all_upstreams_fail_returns_502(auth_client, monkeypatch):
    """When both Overpass and Nominatim fail, return 502 without leaking tracebacks."""
    async def mock_post_err(self, url, *args, **kwargs):
        raise httpx.ConnectError("Network unreachable")

    async def mock_get_err(self, url, *args, **kwargs):
        raise httpx.ConnectError("Network unreachable")

    monkeypatch.setattr(httpx.AsyncClient, "post", mock_post_err)
    monkeypatch.setattr(httpx.AsyncClient, "get", mock_get_err)

    res = auth_client.post("/api/doctors/nearby", json={
        "latitude": 12.9716,
        "longitude": 77.5946,
        "category": "hospitals",
        "radius": 5000,
    })
    assert res.status_code == 502
    assert "unavailable" in res.json()["detail"].lower()

def test_nearby_timeout_returns_504(auth_client, monkeypatch):
    """When upstream map servers time out, return 504 Gateway Timeout."""
    async def mock_post_timeout(self, url, *args, **kwargs):
        raise httpx.TimeoutException("Overpass gateway timeout")

    async def mock_get_timeout(self, url, *args, **kwargs):
        raise httpx.TimeoutException("Nominatim timeout")

    monkeypatch.setattr(httpx.AsyncClient, "post", mock_post_timeout)
    monkeypatch.setattr(httpx.AsyncClient, "get", mock_get_timeout)

    res = auth_client.post("/api/doctors/nearby", json={
        "latitude": 12.9716,
        "longitude": 77.5946,
        "category": "hospitals",
        "radius": 5000,
    })
    assert res.status_code == 504
    assert "timed out" in res.json()["detail"].lower()

def test_nearby_5km_subset_of_10km_search(auth_client, monkeypatch):
    """Verify that results within 5 km are strictly included in a 10 km search when origin and data source are identical."""
    multi_distance_elements = [
        {
            "type": "node",
            "id": 101,
            "lat": 12.9750,  # ~0.5 km away
            "lon": 77.5946,
            "tags": {"name": "Close Clinic", "amenity": "hospital"},
        },
        {
            "type": "node",
            "id": 102,
            "lat": 12.9950,  # ~2.6 km away
            "lon": 77.5946,
            "tags": {"name": "Midway Hospital", "amenity": "hospital"},
        },
        {
            "type": "node",
            "id": 103,
            "lat": 13.0350,  # ~7.0 km away
            "lon": 77.5946,
            "tags": {"name": "Far Hospital", "amenity": "hospital"},
        },
    ]

    async def mock_post(self, url, *args, **kwargs):
        return httpx.Response(200, json={"elements": multi_distance_elements})

    monkeypatch.setattr(httpx.AsyncClient, "post", mock_post)

    # Search at 5 km
    res_5k = auth_client.post("/api/doctors/nearby", json={
        "latitude": 12.9716,
        "longitude": 77.5946,
        "category": "hospitals",
        "radius": 5000,
    })
    assert res_5k.status_code == 200
    ids_5k = [item["id"] for item in res_5k.json()["results"]]
    assert "node_101" in ids_5k
    assert "node_102" in ids_5k
    assert "node_103" not in ids_5k  # 7.0 km must be excluded from 5 km

    # Search at 10 km
    res_10k = auth_client.post("/api/doctors/nearby", json={
        "latitude": 12.9716,
        "longitude": 77.5946,
        "category": "hospitals",
        "radius": 10000,
    })
    assert res_10k.status_code == 200
    ids_10k = [item["id"] for item in res_10k.json()["results"]]

    # Every item from 5 km MUST be in 10 km
    for id_5k in ids_5k:
        assert id_5k in ids_10k
    assert "node_103" in ids_10k

def test_nearby_refresh_flag_bypasses_cache(auth_client, monkeypatch):
    """When refresh=True, bypass in-memory cache and re-query."""
    call_count = 0

    async def mock_post(self, url, *args, **kwargs):
        nonlocal call_count
        call_count += 1
        return httpx.Response(200, json=MOCK_OVERPASS_HOSPITALS)

    monkeypatch.setattr(httpx.AsyncClient, "post", mock_post)

    payload = {
        "latitude": 12.9716,
        "longitude": 77.5946,
        "category": "hospitals",
        "radius": 5000,
    }

    # Initial query
    res1 = auth_client.post("/api/doctors/nearby", json=payload)
    assert res1.status_code == 200
    assert call_count == 1

    # Second query without refresh -> cache hit
    res2 = auth_client.post("/api/doctors/nearby", json=payload)
    assert res2.status_code == 200
    assert call_count == 1

    # Third query with refresh=True -> cache bypassed
    res3 = auth_client.post("/api/doctors/nearby", json={**payload, "refresh": True})
    assert res3.status_code == 200
    assert call_count == 2

def test_nearby_invalid_coordinates(auth_client):
    # Latitude > 90
    res = auth_client.post("/api/doctors/nearby", json={
        "latitude": 95.0,
        "longitude": 77.5946,
        "category": "hospitals",
    })
    assert res.status_code == 422

    # Longitude < -180
    res = auth_client.post("/api/doctors/nearby", json={
        "latitude": 12.9716,
        "longitude": -190.0,
        "category": "hospitals",
    })
    assert res.status_code == 422

def test_nearby_only_one_coordinate_provided(auth_client):
    res = auth_client.post("/api/doctors/nearby", json={
        "latitude": 12.9716,
        "category": "hospitals",
    })
    assert res.status_code == 422

def test_nearby_neither_coords_nor_query_provided(auth_client):
    res = auth_client.post("/api/doctors/nearby", json={
        "category": "hospitals",
    })
    assert res.status_code == 422

def test_nearby_invalid_radius(auth_client):
    # Radius too small (< 100m)
    res = auth_client.post("/api/doctors/nearby", json={
        "latitude": 12.9716,
        "longitude": 77.5946,
        "category": "hospitals",
        "radius": 50,
    })
    assert res.status_code == 422

    # Radius too large (> 50000m)
    res = auth_client.post("/api/doctors/nearby", json={
        "latitude": 12.9716,
        "longitude": 77.5946,
        "category": "hospitals",
        "radius": 75000,
    })
    assert res.status_code == 422

def test_nearby_invalid_category(auth_client):
    res = auth_client.post("/api/doctors/nearby", json={
        "latitude": 12.9716,
        "longitude": 77.5946,
        "category": "fortune_telling",
    })
    assert res.status_code == 422

def test_nearby_rate_limiting(auth_client, monkeypatch):
    async def mock_post_ok(self, url, *args, **kwargs):
        return httpx.Response(200, json={"elements": []})

    monkeypatch.setattr(httpx.AsyncClient, "post", mock_post_ok)

    # Exhaust rate limit
    for _ in range(rate_limiter.max_requests):
        r = auth_client.post("/api/doctors/nearby", json={
            "latitude": 12.9716,
            "longitude": 77.5946,
            "category": "hospitals",
        })
        assert r.status_code == 200

    # Next request should be rate-limited
    r_blocked = auth_client.post("/api/doctors/nearby", json={
        "latitude": 12.9716,
        "longitude": 77.5946,
        "category": "hospitals",
    })
    assert r_blocked.status_code == 429
    assert "too many" in r_blocked.json()["detail"].lower()

def test_nearby_in_memory_cache(auth_client, monkeypatch):
    """Subsequent identical requests return from in-memory cache without repeating network calls."""
    call_count = 0

    async def mock_post_count(self, url, *args, **kwargs):
        nonlocal call_count
        call_count += 1
        return httpx.Response(200, json=MOCK_OVERPASS_HOSPITALS)

    monkeypatch.setattr(httpx.AsyncClient, "post", mock_post_count)

    req_payload = {
        "latitude": 12.9716,
        "longitude": 77.5946,
        "category": "hospitals",
        "radius": 5000,
    }

    # First request: cache miss -> network call
    res1 = auth_client.post("/api/doctors/nearby", json=req_payload)
    assert res1.status_code == 200
    assert call_count == 1

    # Second request: cache hit -> no network call
    res2 = auth_client.post("/api/doctors/nearby", json=req_payload)
    assert res2.status_code == 200
    assert call_count == 1
    assert res1.json() == res2.json()
