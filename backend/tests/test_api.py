"""
tests/test_api.py — Integration tests for ShadowMind API.
Fixtures are provided by conftest.py.
Run: pytest tests/ -v
"""
import pytest


# ── Health ────────────────────────────────────────────────────────────────────

def test_health(client):
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json()["status"] == "healthy"


def test_root(client):
    r = client.get("/")
    assert r.status_code == 200
    assert r.json()["name"] == "ShadowMind API"


# ── Auth ──────────────────────────────────────────────────────────────────────

def test_register_success(client):
    r = client.post("/api/auth/register", json={
        "email": "newreg@shadow.ai",
        "username": "newreg",
        "password": "securepass123",
        "full_name": "New User",
    })
    assert r.status_code == 201
    data = r.json()
    assert "access_token" in data
    assert data["user"]["email"] == "newreg@shadow.ai"


def test_register_duplicate_email(client, registered_user):
    r = client.post("/api/auth/register", json={
        "email": "fixture@shadow.ai",
        "username": "differentuser",
        "password": "pass12345",
    })
    assert r.status_code == 400
    assert "already registered" in r.json()["detail"].lower()


def test_register_duplicate_username(client, registered_user):
    r = client.post("/api/auth/register", json={
        "email": "different@shadow.ai",
        "username": "fixtureuser",
        "password": "pass12345",
    })
    assert r.status_code == 400


def test_login_success(client, registered_user):
    r = client.post("/api/auth/login", json={
        "email": "fixture@shadow.ai",
        "password": "fixture123",
    })
    assert r.status_code == 200
    assert "access_token" in r.json()


def test_login_wrong_password(client, registered_user):
    r = client.post("/api/auth/login", json={
        "email": "fixture@shadow.ai",
        "password": "wrongpassword",
    })
    assert r.status_code == 401


def test_get_me(auth_client):
    r = auth_client.get("/api/auth/me")
    assert r.status_code == 200
    assert r.json()["username"] == "fixtureuser"


def test_update_me(auth_client):
    r = auth_client.put("/api/auth/me", json={"full_name": "Updated Name"})
    assert r.status_code == 200
    assert r.json()["full_name"] == "Updated Name"


def test_change_password(auth_client):
    r = auth_client.post("/api/auth/change-password", json={
        "current_password": "fixture123",
        "new_password": "newpassword456",
    })
    assert r.status_code == 200
    # Change back so other tests work
    auth_client.post("/api/auth/change-password", json={
        "current_password": "newpassword456",
        "new_password": "fixture123",
    })


def test_change_password_wrong_current(auth_client):
    r = auth_client.post("/api/auth/change-password", json={
        "current_password": "wrongpassword",
        "new_password": "newpassword456",
    })
    assert r.status_code == 400


def test_unauthorized_without_token(client):
    r = client.get("/api/auth/me")
    assert r.status_code == 401


# ── Moods ─────────────────────────────────────────────────────────────────────

def test_create_mood(auth_client):
    r = auth_client.post("/api/moods/", json={
        "score": 7.5,
        "label": "calm",
        "energy_level": 6.0,
        "stress_level": 3.0,
        "sleep_hours": 7.5,
        "notes": "Feeling balanced today.",
        "tags": ["morning", "meditation"],
    })
    assert r.status_code == 201
    data = r.json()
    assert data["score"] == 7.5
    assert data["label"] == "calm"
    assert "morning" in data["tags"]


def test_create_mood_invalid_score(auth_client):
    r = auth_client.post("/api/moods/", json={"score": 15, "label": "happy"})
    assert r.status_code == 422


def test_list_moods(auth_client):
    auth_client.post("/api/moods/", json={"score": 6.0, "label": "calm"})
    r = auth_client.get("/api/moods/")
    assert r.status_code == 200
    assert isinstance(r.json(), list)
    assert len(r.json()) >= 1


def test_list_moods_with_days_filter(auth_client):
    r = auth_client.get("/api/moods/?days=7")
    assert r.status_code == 200


def test_mood_stats(auth_client):
    r = auth_client.get("/api/moods/stats?days=30")
    assert r.status_code == 200
    data = r.json()
    assert "total_entries" in data or "message" in data


def test_get_single_mood(auth_client):
    create_r = auth_client.post("/api/moods/", json={"score": 5.0, "label": "neutral"})
    mood_id = create_r.json()["id"]
    r = auth_client.get(f"/api/moods/{mood_id}")
    assert r.status_code == 200
    assert r.json()["id"] == mood_id


def test_delete_mood(auth_client):
    create_r = auth_client.post("/api/moods/", json={"score": 4.0, "label": "stressed"})
    mood_id = create_r.json()["id"]
    r = auth_client.delete(f"/api/moods/{mood_id}")
    assert r.status_code == 204


# ── Journals ──────────────────────────────────────────────────────────────────

def test_create_journal(auth_client):
    r = auth_client.post("/api/journals/", json={
        "title": "Test Journal Entry",
        "content": "This is my test journal entry. I feel good today and want to document this moment.",
        "tags": ["test", "positive"],
        "is_private": True,
    })
    assert r.status_code == 201
    data = r.json()
    assert data["title"] == "Test Journal Entry"
    assert data["word_count"] > 0


def test_list_journals(auth_client):
    r = auth_client.get("/api/journals/")
    assert r.status_code == 200
    assert isinstance(r.json(), list)


def test_search_journals(auth_client):
    r = auth_client.get("/api/journals/?search=test")
    assert r.status_code == 200


def test_get_single_journal(auth_client):
    create_r = auth_client.post("/api/journals/", json={"title": "Fetch Me", "content": "Some content here for testing."})
    jid = create_r.json()["id"]
    r = auth_client.get(f"/api/journals/{jid}")
    assert r.status_code == 200
    assert r.json()["id"] == jid


def test_update_journal(auth_client):
    create_r = auth_client.post("/api/journals/", json={"title": "Old Title", "content": "Old content here."})
    jid = create_r.json()["id"]
    r = auth_client.put(f"/api/journals/{jid}", json={"title": "New Title"})
    assert r.status_code == 200
    assert r.json()["title"] == "New Title"


def test_delete_journal(auth_client):
    create_r = auth_client.post("/api/journals/", json={"title": "Delete Me", "content": "This will be deleted soon."})
    jid = create_r.json()["id"]
    r = auth_client.delete(f"/api/journals/{jid}")
    assert r.status_code == 204


# ── Chat ──────────────────────────────────────────────────────────────────────

def test_create_chat_session(auth_client):
    r = auth_client.post("/api/chat/sessions", json={"session_type": "general", "title": "Test Session"})
    assert r.status_code == 201
    data = r.json()
    assert data["session_type"] == "general"


def test_list_chat_sessions(auth_client):
    r = auth_client.get("/api/chat/sessions")
    assert r.status_code == 200
    assert isinstance(r.json(), list)


def test_delete_chat_session(auth_client):
    create_r = auth_client.post("/api/chat/sessions", json={"session_type": "mindfulness"})
    sid = create_r.json()["id"]
    r = auth_client.delete(f"/api/chat/sessions/{sid}")
    assert r.status_code == 204


# ── Analytics ─────────────────────────────────────────────────────────────────

def test_analytics_overview(auth_client):
    r = auth_client.get("/api/analytics/overview?days=30")
    assert r.status_code == 200
    data = r.json()
    assert "mood_entries" in data
    assert "journal_entries" in data
    assert "current_streak_days" in data


def test_analytics_weekly_summary(auth_client):
    r = auth_client.get("/api/analytics/weekly-summary")
    assert r.status_code == 200
    assert "weekly_pattern" in r.json()


def test_analytics_heatmap(auth_client):
    r = auth_client.get("/api/analytics/mood-heatmap?days=30")
    assert r.status_code == 200
    assert "heatmap" in r.json()
