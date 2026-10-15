"""
services/places_service.py — OpenStreetMap (Overpass API) healthcare directory service for ShadowMind.
Provides real nearby hospital and clinician discovery without requiring any API keys.
Supports automatic GPS coordinates, manual area search via Nominatim, multi-mirror Overpass querying,
deduplication, distance calculation, caching, and rate limiting.
"""
import time
import math
import logging
import urllib.parse
from typing import Dict, List, Optional, Tuple, Any
from collections import defaultdict
import httpx
from fastapi import HTTPException, status
from pydantic import BaseModel, Field, field_validator, model_validator
from config import settings

logger = logging.getLogger("shadowmind.places")

USER_AGENT = "ShadowMind-Intelligence/4.0 (mental-wellness-platform; contact@shadowmind.ai)"

# Supported directory categories with Overpass tag filters and Nominatim search keywords
CATEGORY_DEFINITIONS: Dict[str, Dict[str, Any]] = {
    "hospitals": {
        "label": "Hospitals & Emergency",
        "nominatim_keyword": "hospital",
        "crisis_relevant": True,
        "default_name": "Hospital / Medical Center",
        "overpass_body": """
  node["amenity"="hospital"](around:{radius},{lat},{lon});
  way["amenity"="hospital"](around:{radius},{lat},{lon});
  node["healthcare"="hospital"](around:{radius},{lat},{lon});
  way["healthcare"="hospital"](around:{radius},{lat},{lon});
  node["emergency"="yes"](around:{radius},{lat},{lon});
  way["emergency"="yes"](around:{radius},{lat},{lon});
""",
    },
    "mental_health_clinics": {
        "label": "Mental-Health Clinics",
        "nominatim_keyword": "mental health",
        "crisis_relevant": False,
        "default_name": "Mental Health Clinic",
        "overpass_body": """
  node["healthcare"="mental_health"](around:{radius},{lat},{lon});
  way["healthcare"="mental_health"](around:{radius},{lat},{lon});
  node["healthcare:speciality"~"mental_health|psychiatry|psychotherapy|psychology",i](around:{radius},{lat},{lon});
  way["healthcare:speciality"~"mental_health|psychiatry|psychotherapy|psychology",i](around:{radius},{lat},{lon});
  node["healthcare"~"psychotherapist|psychiatrist|psychologist"](around:{radius},{lat},{lon});
  way["healthcare"~"psychotherapist|psychiatrist|psychologist"](around:{radius},{lat},{lon});
  node["amenity"="clinic"]["name"~"mental|psych|cbt|wellness|behavioral|behavioural",i](around:{radius},{lat},{lon});
  way["amenity"="clinic"]["name"~"mental|psych|cbt|wellness|behavioral|behavioural",i](around:{radius},{lat},{lon});
""",
    },
    "psychiatrists": {
        "label": "Psychiatrists",
        "nominatim_keyword": "psychiatrist",
        "crisis_relevant": False,
        "default_name": "Psychiatric Clinic",
        "overpass_body": """
  node["healthcare"="psychiatrist"](around:{radius},{lat},{lon});
  way["healthcare"="psychiatrist"](around:{radius},{lat},{lon});
  node["healthcare:speciality"~"psychiatry",i](around:{radius},{lat},{lon});
  way["healthcare:speciality"~"psychiatry",i](around:{radius},{lat},{lon});
  node["amenity"="doctors"]["name"~"psychiatr",i](around:{radius},{lat},{lon});
  way["amenity"="doctors"]["name"~"psychiatr",i](around:{radius},{lat},{lon});
  node["amenity"="clinic"]["name"~"psychiatr",i](around:{radius},{lat},{lon});
  way["amenity"="clinic"]["name"~"psychiatr",i](around:{radius},{lat},{lon});
""",
    },
    "psychologists": {
        "label": "Psychologists",
        "nominatim_keyword": "psychologist",
        "crisis_relevant": False,
        "default_name": "Psychology Practice",
        "overpass_body": """
  node["healthcare"="psychologist"](around:{radius},{lat},{lon});
  way["healthcare"="psychologist"](around:{radius},{lat},{lon});
  node["healthcare:speciality"~"psychology",i](around:{radius},{lat},{lon});
  way["healthcare:speciality"~"psychology",i](around:{radius},{lat},{lon});
  node["amenity"="doctors"]["name"~"psychol",i](around:{radius},{lat},{lon});
  way["amenity"="doctors"]["name"~"psychol",i](around:{radius},{lat},{lon});
  node["amenity"="clinic"]["name"~"psychol",i](around:{radius},{lat},{lon});
  way["amenity"="clinic"]["name"~"psychol",i](around:{radius},{lat},{lon});
""",
    },
    "counselling": {
        "label": "Counselling & Therapy",
        "nominatim_keyword": "counselling",
        "crisis_relevant": False,
        "default_name": "Counselling & Therapy Center",
        "overpass_body": """
  node["healthcare"="psychotherapist"](around:{radius},{lat},{lon});
  way["healthcare"="psychotherapist"](around:{radius},{lat},{lon});
  node["healthcare"="counselling"](around:{radius},{lat},{lon});
  way["healthcare"="counselling"](around:{radius},{lat},{lon});
  node["healthcare:speciality"~"psychotherapy|counselling|counseling",i](around:{radius},{lat},{lon});
  way["healthcare:speciality"~"psychotherapy|counselling|counseling",i](around:{radius},{lat},{lon});
  node["amenity"="clinic"]["name"~"counsel|therapy|cbt|therapist",i](around:{radius},{lat},{lon});
  way["amenity"="clinic"]["name"~"counsel|therapy|cbt|therapist",i](around:{radius},{lat},{lon});
""",
    },
    "general_practitioners": {
        "label": "General Practitioners",
        "nominatim_keyword": "clinic",
        "crisis_relevant": False,
        "default_name": "Family Practice / Medical Clinic",
        "overpass_body": """
  node["amenity"="doctors"](around:{radius},{lat},{lon});
  way["amenity"="doctors"](around:{radius},{lat},{lon});
  node["healthcare"="doctor"](around:{radius},{lat},{lon});
  way["healthcare"="doctor"](around:{radius},{lat},{lon});
  node["healthcare:speciality"~"general|family",i](around:{radius},{lat},{lon});
  way["healthcare:speciality"~"general|family",i](around:{radius},{lat},{lon});
  node["amenity"="clinic"](around:{radius},{lat},{lon});
  way["amenity"="clinic"](around:{radius},{lat},{lon});
""",
    },
}

# Category aliases for compatibility with recommendation specialist IDs
CATEGORY_ALIASES: Dict[str, str] = {
    "therapist": "counselling",
    "psychiatrist": "psychiatrists",
    "gp": "general_practitioners",
    "mindfulness_coach": "mental_health_clinics",
    "emergency": "hospitals",
    "hospital": "hospitals",
    "hospitals": "hospitals",
    "counseling": "counselling",
    "counselling": "counselling",
    "psychology": "psychologists",
    "psychologists": "psychologists",
    "psychiatrists": "psychiatrists",
    "general_practitioners": "general_practitioners",
    "mental_health_clinics": "mental_health_clinics",
}


def resolve_category(category_input: str) -> str:
    key = category_input.strip().lower()
    if key in CATEGORY_DEFINITIONS:
        return key
    if key in CATEGORY_ALIASES:
        return CATEGORY_ALIASES[key]
    raise ValueError(
        f"Unsupported category '{category_input}'. Supported categories: {', '.join(CATEGORY_DEFINITIONS.keys())}"
    )


def haversine_distance_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate great-circle distance between two coordinates in kilometers."""
    r = 6371.0  # Earth radius in km
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (
        math.sin(dlat / 2.0) ** 2
        + math.cos(math.radians(lat1))
        * math.cos(math.radians(lat2))
        * math.sin(dlon / 2.0) ** 2
    )
    a = min(1.0, max(0.0, a))
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return round(r * c, 2)


# In-memory sliding window rate limiter
class RateLimiter:
    def __init__(self, max_requests: int = 30, window_seconds: float = 60.0):
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self.history: Dict[str, List[float]] = defaultdict(list)

    def is_allowed(self, client_id: str) -> bool:
        now = time.time()
        cutoff = now - self.window_seconds
        timestamps = [t for t in self.history[client_id] if t > cutoff]
        if len(timestamps) >= self.max_requests:
            self.history[client_id] = timestamps
            return False
        timestamps.append(now)
        self.history[client_id] = timestamps
        return True


rate_limiter = RateLimiter(
    max_requests=getattr(settings, "PLACES_RATE_LIMIT_PER_MINUTE", 30),
    window_seconds=60.0,
)


# In-memory TTL cache to prevent repeated identical public queries
class SearchCache:
    def __init__(self, ttl_seconds: int = 300):
        self.ttl = ttl_seconds
        self.cache: Dict[Tuple, Tuple[float, Any]] = {}

    def get(self, key: Tuple) -> Optional[Any]:
        now = time.time()
        if key in self.cache:
            ts, val = self.cache[key]
            if now - ts <= self.ttl:
                return val
            del self.cache[key]
        return None

    def set(self, key: Tuple, value: Any):
        self.cache[key] = (time.time(), value)


places_cache = SearchCache(ttl_seconds=getattr(settings, "PLACES_CACHE_TTL_SECONDS", 300))


class NearbySearchRequest(BaseModel):
    latitude: Optional[float] = Field(None, ge=-90.0, le=90.0, description="Latitude between -90 and 90")
    longitude: Optional[float] = Field(None, ge=-180.0, le=180.0, description="Longitude between -180 and 180")
    radius: Optional[float] = Field(5000.0, ge=100.0, le=50000.0, description="Search radius in meters (100 to 50000)")
    category: str = Field(..., description="Category key or specialist alias")
    query: Optional[str] = Field(None, max_length=200, description="Optional manual area/city search query fallback")
    refresh: Optional[bool] = Field(False, description="Force bypass of in-memory cache for a fresh search")

    @field_validator("latitude", "longitude")
    @classmethod
    def validate_finite_coords(cls, v: Optional[float]) -> Optional[float]:
        if v is not None and (math.isnan(v) or math.isinf(v)):
            raise ValueError("Coordinates must be valid finite numbers.")
        return v

    @field_validator("category")
    @classmethod
    def validate_category_field(cls, v: str) -> str:
        return resolve_category(v)

    @model_validator(mode="after")
    def validate_location_or_query(self):
        has_coords = self.latitude is not None and self.longitude is not None
        has_query = bool(self.query and self.query.strip())
        if not has_coords and not has_query:
            raise ValueError(
                "Either geographic coordinates (latitude and longitude) or a manual area search query must be provided."
            )
        if (self.latitude is not None and self.longitude is None) or (self.latitude is None and self.longitude is not None):
            raise ValueError("Both latitude and longitude must be provided together.")
        return self


class NearbyPlaceItem(BaseModel):
    id: str
    name: str
    address: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    distance_km: Optional[float] = None
    phone: Optional[str] = None
    website: Optional[str] = None
    rating: Optional[float] = None  # None for OSM (no fabricated ratings)
    user_rating_count: Optional[int] = None
    open_now: Optional[bool] = None
    google_maps_uri: Optional[str] = None
    directions_uri: Optional[str] = None
    osm_url: Optional[str] = None
    primary_type: Optional[str] = None
    verified_provider: bool = False


class NearbySearchResponse(BaseModel):
    results: List[NearbyPlaceItem]
    count: int
    category: str
    category_label: str
    radius_meters: float
    search_center: Optional[Dict[str, float]] = None
    query_used: Optional[str] = None
    source: str = "OpenStreetMap (Overpass API)"
    attribution: str = "Data © OpenStreetMap contributors, ODbL 1.0"
    disclaimer: str = (
        "Directory results are sourced via OpenStreetMap for informational convenience. "
        "In a crisis or medical emergency, immediately contact emergency services or a crisis helpline (e.g. 988 or Tele-MANAS)."
    )


def extract_osm_address(tags: Dict[str, Any]) -> Optional[str]:
    """Assemble address from OSM tags cleanly."""
    if tags.get("addr:full"):
        return tags["addr:full"]
    parts = []
    street = tags.get("addr:street")
    housenumber = tags.get("addr:housenumber")
    if housenumber and street:
        parts.append(f"{housenumber} {street}")
    elif street:
        parts.append(street)
    elif housenumber:
        parts.append(housenumber)

    for k in ["addr:suburb", "addr:district", "addr:city", "addr:postcode"]:
        v = tags.get(k)
        if v and v not in parts:
            parts.append(v)

    if parts:
        return ", ".join(parts)
    return None


def parse_osm_element(el: Dict[str, Any], user_lat: Optional[float], user_lon: Optional[float], default_name: str) -> Optional[NearbyPlaceItem]:
    """Parse an OSM node, way, or relation into a normalized NearbyPlaceItem."""
    tags = el.get("tags") or {}
    osm_type = el.get("type", "node")
    osm_id = el.get("id")

    # Determine coordinates (node has lat/lon; way/relation has center)
    raw_lat = el.get("lat") or el.get("center", {}).get("lat")
    raw_lon = el.get("lon") or el.get("center", {}).get("lon")

    if raw_lat is None or raw_lon is None:
        return None

    try:
        p_lat = float(raw_lat)
        p_lon = float(raw_lon)
        if math.isnan(p_lat) or math.isnan(p_lon) or math.isinf(p_lat) or math.isinf(p_lon):
            return None
    except (ValueError, TypeError):
        return None

    name = tags.get("name") or tags.get("name:en") or tags.get("official_name") or tags.get("operator")
    if not name or not name.strip():
        name = default_name

    address = extract_osm_address(tags)

    phone = tags.get("phone") or tags.get("contact:phone") or tags.get("mobile") or tags.get("contact:mobile")
    website = tags.get("website") or tags.get("contact:website") or tags.get("url")

    distance_km = None
    if user_lat is not None and user_lon is not None:
        distance_km = haversine_distance_km(user_lat, user_lon, p_lat, p_lon)

    directions_uri = f"https://www.google.com/maps/dir/?api=1&destination={p_lat},{p_lon}"
    osm_url = f"https://www.openstreetmap.org/{osm_type}/{osm_id}"
    google_maps_uri = f"https://www.google.com/maps/search/?api=1&query={p_lat},{p_lon}"

    # Determine primary type label accurately
    primary_type = None
    amenity = tags.get("amenity")
    healthcare = tags.get("healthcare")
    speciality = tags.get("healthcare:speciality")

    if amenity == "hospital" or healthcare == "hospital":
        primary_type = "Hospital"
    elif tags.get("emergency") == "yes":
        primary_type = "Emergency Medical"
    elif healthcare == "psychiatrist" or (speciality and "psychiatr" in speciality.lower()):
        primary_type = "Psychiatrist"
    elif healthcare == "psychologist" or (speciality and "psychol" in speciality.lower()):
        primary_type = "Psychologist"
    elif healthcare in ("psychotherapist", "counselling") or (speciality and any(k in speciality.lower() for k in ["counsel", "therapy", "psychotherap"])):
        primary_type = "Counselling & Therapy"
    elif healthcare == "mental_health":
        primary_type = "Mental Health Clinic"
    elif amenity == "doctors" or healthcare == "doctor":
        primary_type = "Doctor / GP"
    elif amenity == "clinic" or healthcare == "clinic":
        primary_type = "Medical Clinic"
    elif speciality:
        primary_type = speciality.replace("_", " ").title()

    return NearbyPlaceItem(
        id=f"{osm_type}_{osm_id}",
        name=name.strip(),
        address=address,
        latitude=p_lat,
        longitude=p_lon,
        distance_km=distance_km,
        phone=phone,
        website=website,
        rating=None,  # No fabricated ratings
        user_rating_count=None,
        open_now=None,
        google_maps_uri=google_maps_uri,
        directions_uri=directions_uri,
        osm_url=osm_url,
        primary_type=primary_type,
        verified_provider=False,
    )


def deduplicate_places(items: List[NearbyPlaceItem]) -> List[NearbyPlaceItem]:
    """Deduplicate records by ID and by identical name within 100m proximity."""
    unique: List[NearbyPlaceItem] = []
    seen_ids = set()

    for item in items:
        if item.id in seen_ids:
            continue

        # Check proximity deduplication with existing unique items
        is_duplicate = False
        for existing in unique:
            if existing.name.lower() == item.name.lower():
                if existing.latitude and existing.longitude and item.latitude and item.longitude:
                    prox_km = haversine_distance_km(existing.latitude, existing.longitude, item.latitude, item.longitude)
                    if prox_km < 0.1:  # within 100m
                        is_duplicate = True
                        # If the new item has phone/website and existing doesn't, enrich it
                        if not existing.phone and item.phone:
                            existing.phone = item.phone
                        if not existing.website and item.website:
                            existing.website = item.website
                        if not existing.address and item.address:
                            existing.address = item.address
                        break

        seen_ids.add(item.id)
        if not is_duplicate:
            unique.append(item)

    return unique


async def geocode_area_nominatim(
    query_text: str,
    client: httpx.AsyncClient,
) -> Tuple[float, float, str]:
    """
    Resolve a city, postal code, or area into latitude and longitude via OpenStreetMap Nominatim.
    """
    nominatim_url = getattr(settings, "NOMINATIM_API_URL", "https://nominatim.openstreetmap.org/search")
    params = {
        "format": "json",
        "q": query_text,
        "limit": 1,
        "addressdetails": 1,
    }
    headers = {"User-Agent": USER_AGENT}

    try:
        resp = await client.get(nominatim_url, params=params, headers=headers)
        if resp.status_code == 200:
            data = resp.json()
            if data and len(data) > 0:
                first = data[0]
                lat = float(first["lat"])
                lon = float(first["lon"])
                display_name = first.get("display_name", query_text)
                return lat, lon, display_name
    except Exception as e:
        logger.warning("Nominatim geocoding error for '%s': %s", query_text, e)

    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail=f"Location '{query_text}' could not be resolved on OpenStreetMap. Please verify the spelling or try a nearby city name.",
    )


async def query_nominatim_spatial_fallback(
    keyword: str,
    lat: float,
    lon: float,
    radius_meters: float,
    client: httpx.AsyncClient,
) -> Optional[List[Dict[str, Any]]]:
    """
    Fallback spatial query using Nominatim bounded search when Overpass public mirrors are degraded.
    Returns elements list on success (may be empty), or None if the request failed.
    """
    nominatim_url = getattr(settings, "NOMINATIM_API_URL", "https://nominatim.openstreetmap.org/search")
    radius_km = radius_meters / 1000.0

    delta_lat = radius_km / 111.0
    cos_lat = math.cos(math.radians(lat))
    delta_lon = radius_km / (111.0 * (cos_lat if abs(cos_lat) > 0.001 else 1.0))

    viewbox = f"{lon - delta_lon},{lat + delta_lat},{lon + delta_lon},{lat - delta_lat}"
    params = {
        "format": "json",
        "q": keyword,
        "viewbox": viewbox,
        "bounded": 1,
        "addressdetails": 1,
        "limit": 50,
    }
    headers = {"User-Agent": USER_AGENT}

    try:
        resp = await client.get(nominatim_url, params=params, headers=headers)
        if resp.status_code == 200:
            raw_places = resp.json()
            elements = []
            for p in raw_places:
                elements.append({
                    "type": p.get("osm_type", "node"),
                    "id": p.get("osm_id", p.get("place_id")),
                    "lat": float(p["lat"]),
                    "lon": float(p["lon"]),
                    "tags": {
                        "name": p.get("name") or p.get("display_name", "").split(",")[0],
                        "addr:full": p.get("display_name"),
                        "amenity": p.get("type"),
                    },
                })
            return elements
        else:
            logger.warning("Nominatim spatial fallback returned status %d", resp.status_code)
            return None
    except Exception as e:
        logger.warning("Nominatim spatial fallback error: %s", e)
        return None


async def execute_nearby_search(
    req: NearbySearchRequest,
    client_id: str = "anonymous",
    custom_http_client: Optional[httpx.AsyncClient] = None,
) -> NearbySearchResponse:
    """
    Find nearby healthcare facilities using OpenStreetMap data via Overpass API with multi-mirror resilience.
    No Google Maps API key required.
    """
    # 1. Rate limiting check
    if not rate_limiter.is_allowed(client_id):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many directory requests. Please wait a moment before searching again.",
        )

    cat_info = CATEGORY_DEFINITIONS[req.category]
    cat_label = cat_info["label"]
    default_name = cat_info["default_name"]
    nominatim_kw = cat_info["nominatim_keyword"]

    timeout_seconds = getattr(settings, "PLACES_TIMEOUT_SECONDS", 12.0)
    client_to_use = custom_http_client or httpx.AsyncClient(timeout=timeout_seconds)
    should_close_client = custom_http_client is None

    try:
        search_lat = req.latitude
        search_lon = req.longitude
        resolved_area_name: Optional[str] = None

        # If GPS coordinates omitted, geocode manual area query first
        if (search_lat is None or search_lon is None) and req.query:
            search_lat, search_lon, resolved_area_name = await geocode_area_nominatim(
                req.query.strip(), client_to_use
            )

        if search_lat is None or search_lon is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No coordinates available for search. Please share location or enter a city name.",
            )

        radius = float(req.radius or 5000.0)

        # Check in-memory cache unless fresh search requested
        cache_key = (round(search_lat, 3), round(search_lon, 3), req.category, int(radius))
        if not req.refresh:
            cached = places_cache.get(cache_key)
            if cached:
                logger.info("Serving nearby places from cache for category=%s, radius=%.0fm", req.category, radius)
                return cached

        # Prepare Overpass QL query with body and center output
        overpass_query = f"""[out:json][timeout:15];
(
{cat_info["overpass_body"].format(radius=radius, lat=search_lat, lon=search_lon)}
);
out body center;
"""

        # Endpoints to query: primary + fallbacks
        endpoints = [getattr(settings, "OVERPASS_API_URL", "https://overpass-api.de/api/interpreter")]
        fallbacks = getattr(settings, "overpass_fallback_urls_list", [])
        for fb in fallbacks:
            if fb not in endpoints:
                endpoints.append(fb)

        raw_elements: Optional[List[Dict[str, Any]]] = None
        headers = {"User-Agent": USER_AGENT}
        had_timeout = False
        had_provider_error = False

        # Query Overpass endpoints with configured timeout
        for ep in endpoints[:3]:
            try:
                resp = await client_to_use.post(
                    ep, data={"data": overpass_query}, headers=headers, timeout=timeout_seconds
                )
                if resp.status_code == 200:
                    data = resp.json()
                    elements = data.get("elements", [])
                    raw_elements = elements
                    logger.info("Successfully fetched %d OSM elements from %s", len(raw_elements), ep)
                    break
                elif resp.status_code == 429:
                    logger.warning("Overpass endpoint %s rate limited (429)", ep)
                    had_provider_error = True
                else:
                    logger.warning("Overpass endpoint %s returned status %d", ep, resp.status_code)
                    had_provider_error = True
            except (httpx.TimeoutException, TimeoutError) as ex:
                logger.warning("Overpass mirror %s timed out: %s", ep, ex)
                had_timeout = True
            except (httpx.RequestError, Exception) as ex:
                logger.warning("Overpass mirror %s error: %s", ep, ex)
                had_provider_error = True

        # If Overpass mirrors timed out or failed, attempt Nominatim spatial bounded search
        if raw_elements is None or len(raw_elements) == 0:
            logger.info("Checking Nominatim spatial fallback for %s near (%.4f, %.4f)", nominatim_kw, search_lat, search_lon)
            nominatim_results = await query_nominatim_spatial_fallback(
                nominatim_kw, search_lat, search_lon, radius, client_to_use
            )
            if nominatim_results is not None:
                if raw_elements is None or len(nominatim_results) > 0:
                    raw_elements = nominatim_results
            else:
                if raw_elements is None:
                    if had_timeout:
                        raise HTTPException(
                            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
                            detail="Healthcare map service timed out while querying public servers. Please retry in a few moments.",
                        )
                    raise HTTPException(
                        status_code=status.HTTP_502_BAD_GATEWAY,
                        detail="External healthcare directory service is currently unavailable. Please check your connection or retry.",
                    )

        if raw_elements is None:
            raw_elements = []

        # Parse & normalize place records
        parsed_items: List[NearbyPlaceItem] = []
        for el in raw_elements:
            try:
                item = parse_osm_element(el, search_lat, search_lon, default_name)
                if item:
                    parsed_items.append(item)
            except Exception as pe:
                logger.warning("Error parsing OSM record: %s", pe)

        # Deduplicate
        unique_items = deduplicate_places(parsed_items)

        # Strict distance filtering by selected radius in km (+ 50m tolerance for boundary precision)
        radius_km = radius / 1000.0
        filtered_items = [
            item for item in unique_items
            if item.distance_km is None or item.distance_km <= radius_km + 0.05
        ]

        # Sort strictly by distance (nearest first)
        filtered_items.sort(
            key=lambda x: (x.distance_km is None, x.distance_km if x.distance_km is not None else float("inf"))
        )

        response = NearbySearchResponse(
            results=filtered_items,
            count=len(filtered_items),
            category=req.category,
            category_label=cat_label,
            radius_meters=radius,
            search_center={"latitude": search_lat, "longitude": search_lon},
            query_used=resolved_area_name or req.query,
            source="OpenStreetMap (Overpass API)",
            attribution="Data © OpenStreetMap contributors, ODbL 1.0",
        )

        # Cache only when places were successfully found to prevent caching transient 0-result states
        if len(filtered_items) > 0:
            places_cache.set(cache_key, response)

        return response

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Unhandled error in nearby search: %s", e)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Error retrieving healthcare facility records from OpenStreetMap services.",
        )
    finally:
        if should_close_client:
            await client_to_use.aclose()
