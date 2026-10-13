"""
Tests for ShadowMind User Module Upgrades:
- Mood AI Insights & Multi-slider tracking
- Journal AI Assistant (Prompts, Analysis, Reflection, Rewrite, Multi-entry Summary)
- Meditation Generation & Session Completion
"""
import pytest


# ── Mood Upgrades ─────────────────────────────────────────────────────────────

def test_mood_insights_insufficient_data(auth_client):
    """When user has < 2 check-ins, return helpful empty state and no fabricated trends."""
    r = auth_client.get("/api/moods/ai-insights")
    assert r.status_code == 200
    data = r.json()
    assert data["insufficient_data"] is True
    assert data["trend"] == "insufficient_data"
    assert "fewer than 2 check-ins" in data["insights"]
    assert len(data["suggested_actions"]) >= 2


def test_mood_creation_with_anxiety_and_insights(auth_client):
    """Create entries with multi-slider attributes and generate grounded observations."""
    # Entry 1: Earlier check-in with higher stress
    r1 = auth_client.post("/api/moods/", json={
        "score": 5.0,
        "label": "stressed",
        "stress_level": 7.5,
        "anxiety_level": 7.0,
        "energy_level": 4.0,
        "sleep_hours": 5.5,
        "notes": "Intense work deadlines and lack of sleep",
        "tags": ["work", "tired"]
    })
    assert r1.status_code == 201
    assert r1.json()["anxiety_level"] == 7.0

    # Entry 2: Recent check-in with improved mood
    r2 = auth_client.post("/api/moods/", json={
        "score": 7.5,
        "label": "calm",
        "stress_level": 3.0,
        "anxiety_level": 2.5,
        "energy_level": 7.0,
        "sleep_hours": 8.0,
        "notes": "Good rest, peaceful day with family",
        "tags": ["family", "rest"]
    })
    assert r2.status_code == 201

    # Fetch AI Insights
    r_ins = auth_client.get("/api/moods/ai-insights")
    assert r_ins.status_code == 200
    ins_data = r_ins.json()
    assert ins_data["insufficient_data"] is False
    assert ins_data["total_entries"] == 2
    assert ins_data["average_score"] == 6.2 or ins_data["average_score"] == 6.3
    assert len(ins_data["suggested_actions"]) >= 2
    assert len(ins_data["insights"]) > 20


# ── Journal Upgrades ──────────────────────────────────────────────────────────

def test_journal_ai_prompts(auth_client):
    """Verify curated and dynamic reflection prompts."""
    r_anx = auth_client.post("/api/journals/ai-prompts", json={"mood": "anxious"})
    assert r_anx.status_code == 200
    data_anx = r_anx.json()
    assert len(data_anx["prompts"]) >= 3

    r_calm = auth_client.post("/api/journals/ai-prompts", json={"mood": "calm"})
    assert r_calm.status_code == 200
    assert len(r_calm.json()["prompts"]) >= 3


def test_journal_ai_assistant_analysis(auth_client):
    """Verify emotional and thematic analysis of journal text."""
    content = "Work has been demanding lately with back-to-back presentations, but I managed to stay composed and take a walk."
    r = auth_client.post("/api/journals/ai-assistant", json={
        "action": "analyze",
        "content": content
    })
    assert r.status_code == 200
    data = r.json()
    assert data["action"] == "analyze"
    assert "themes" in data
    assert "emotions" in data
    assert len(data["reflection_questions"]) >= 1


def test_journal_ai_assistant_reflection(auth_client):
    """Verify supportive reflection generation."""
    content = "I had a disagreement with a friend and felt misunderstood all afternoon."
    r = auth_client.post("/api/journals/ai-assistant", json={
        "action": "reflection",
        "content": content
    })
    assert r.status_code == 200
    data = r.json()
    assert "reflection" in data
    assert len(data["reflection"]) > 20


def test_journal_ai_assistant_rewrite(auth_client):
    """Verify non-destructive rewrite & organization options."""
    content = "Long rambling stream of thoughts without any paragraph breaks or structure because today was very overwhelming."
    for rtype in ["readability", "paragraphs", "summarize", "actions"]:
        r = auth_client.post("/api/journals/ai-assistant", json={
            "action": "rewrite",
            "content": content,
            "rewrite_type": rtype
        })
        assert r.status_code == 200
        data = r.json()
        assert data["action"] == "rewrite"
        assert "revised_text" in data
        assert len(data["revised_text"]) > 0


def test_journal_ai_assistant_summary_insufficient(auth_client):
    """Verify multi-entry summary when user has < 2 entries."""
    r = auth_client.post("/api/journals/ai-assistant", json={
        "action": "summary"
    })
    assert r.status_code == 200
    data = r.json()
    assert data["insufficient_data"] is True


def test_journal_ai_assistant_summary_sufficient(auth_client):
    """Verify multi-entry summary when user has >= 2 entries."""
    auth_client.post("/api/journals/", json={
        "title": "Entry One",
        "content": "Reflecting on early mornings and caffeine habits."
    })
    auth_client.post("/api/journals/", json={
        "title": "Entry Two",
        "content": "Enjoyed afternoon reading in the park and felt peaceful."
    })

    r = auth_client.post("/api/journals/ai-assistant", json={
        "action": "summary",
        "entries_count": 5
    })
    assert r.status_code == 200
    data = r.json()
    assert data["insufficient_data"] is False
    assert data["total_entries"] == 2
    assert "covered_period" in data
    assert len(data["summary"]) > 20


# ── Meditation Upgrades ───────────────────────────────────────────────────────

def test_meditation_generate_session(auth_client):
    """Verify meditation generation returns structured stages and title."""
    r = auth_client.post("/api/meditations/generate", json={
        "duration_minutes": 5,
        "focus_area": "Anxiety Relief",
        "experience_level": "Beginner",
        "guidance_style": "calm"
    })
    assert r.status_code == 200
    data = r.json()
    assert data["duration"] == 5
    assert data["focus_area"] == "Anxiety Relief"
    assert len(data["title"]) > 0
    assert len(data["stages"]) >= 1
    assert "script" in data


def test_meditation_complete_session(auth_client):
    """Verify recording of completed meditation session."""
    r = auth_client.post("/api/meditations/complete", json={
        "title": "A Moment for Calm",
        "duration_minutes": 5,
        "focus_area": "Anxiety Relief",
        "elapsed_seconds": 300
    })
    assert r.status_code == 201
    data = r.json()
    assert data["duration_minutes"] == 5
    assert data["elapsed_seconds"] == 300
