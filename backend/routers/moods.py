from fastapi import APIRouter, Depends, HTTPException, status, Query
from typing import List, Optional
from datetime import datetime, timedelta
from database import get_db, convert_doc
from bson import ObjectId
from schemas.mood import MoodCreate, MoodOut, MoodUpdate
from utils.auth import get_current_user, UserSession

router = APIRouter(prefix="/api/moods", tags=["moods"])


@router.post("/", response_model=MoodOut, status_code=status.HTTP_201_CREATED)
async def create_mood(
    mood_data: MoodCreate,
    current_user: UserSession = Depends(get_current_user),
    db = Depends(get_db),
):
    mood_doc = mood_data.dict()
    mood_doc["user_id"] = current_user.id
    mood_doc["created_at"] = datetime.utcnow()
    res = await db.moods.insert_one(mood_doc)
    mood_doc["_id"] = res.inserted_id
    return convert_doc(mood_doc)


@router.get("/", response_model=List[MoodOut])
async def get_moods(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    days: Optional[int] = Query(None, description="Filter by last N days"),
    current_user: UserSession = Depends(get_current_user),
    db = Depends(get_db),
):
    query_filter = {"user_id": current_user.id}
    if days:
        since = datetime.utcnow() - timedelta(days=days)
        query_filter["created_at"] = {"$gte": since}

    cursor = db.moods.find(query_filter).sort("created_at", -1).skip(skip).limit(limit)
    moods = await cursor.to_list(length=limit)
    return [convert_doc(m) for m in moods]


@router.get("/stats")
async def get_mood_stats(
    days: int = Query(30, ge=7, le=365),
    current_user: UserSession = Depends(get_current_user),
    db = Depends(get_db),
):
    since = datetime.utcnow() - timedelta(days=days)
    query_filter = {"user_id": current_user.id, "created_at": {"$gte": since}}

    cursor = db.moods.find(query_filter).sort("created_at", 1)
    moods = await cursor.to_list(length=None)

    if not moods:
        return {"message": "No mood data in this period", "data": []}

    scores = [m["score"] for m in moods]
    avg_score = sum(scores) / len(scores)
    max_score = max(scores)
    min_score = min(scores)

    # Label frequency
    label_counts: dict = {}
    for m in moods:
        label = m["label"]
        label_counts[label] = label_counts.get(label, 0) + 1

    # Trend (last 7 vs previous 7)
    recent = [m["score"] for m in moods[-7:]]
    earlier = [m["score"] for m in moods[-14:-7]] if len(moods) >= 14 else []
    trend = "stable"
    if recent and earlier:
        if sum(recent) / len(recent) > sum(earlier) / len(earlier) + 0.5:
            trend = "improving"
        elif sum(recent) / len(recent) < sum(earlier) / len(earlier) - 0.5:
            trend = "declining"

    return {
        "total_entries": len(moods),
        "average_score": round(avg_score, 2),
        "max_score": max_score,
        "min_score": min_score,
        "trend": trend,
        "label_distribution": label_counts,
        "timeline": [
            {
                "date": m["created_at"].isoformat(),
                "score": m["score"],
                "label": m["label"],
                "energy_level": m.get("energy_level"),
                "stress_level": m.get("stress_level"),
                "sleep_hours": m.get("sleep_hours"),
            }
            for m in moods
        ],
    }


@router.get("/ai-insights")
async def get_mood_ai_insights(
    current_user: UserSession = Depends(get_current_user),
    db = Depends(get_db),
):
    """Generate grounded, AI-assisted mood observations based strictly on authenticated user's actual records."""
    cursor = db.moods.find({"user_id": current_user.id}).sort("created_at", -1).limit(30)
    moods = await cursor.to_list(length=30)

    if len(moods) < 2:
        return {
            "insights": "You currently have fewer than 2 check-ins logged. ShadowMind needs at least 2 check-ins to detect genuine patterns across your mood, energy, and stress.",
            "trend": "insufficient_data",
            "insufficient_data": True,
            "total_entries": len(moods),
            "correlations": [],
            "themes": [],
            "suggested_actions": [
                {
                    "title": "Guided Resonance Breathing",
                    "description": "Center yourself with a quick 2-minute rhythmic breathing exercise.",
                    "link": "/breathe",
                    "badge": "Breathing",
                },
                {
                    "title": "Start a Quick Journal Reflection",
                    "description": "Spend 2 minutes jotting down whatever is currently occupying your mind.",
                    "link": "/journal",
                    "badge": "Journal",
                },
                {
                    "title": "Chat with Shadow",
                    "description": "Have a private, supportive conversation to unpack your day.",
                    "link": "/chat",
                    "badge": "Chat",
                },
            ],
        }

    # Compute actual metrics
    scores = [m["score"] for m in moods if isinstance(m.get("score"), (int, float))]
    avg_score = sum(scores) / len(scores) if scores else 5.0
    half = max(1, len(scores) // 2)
    recent_scores = scores[:half]
    earlier_scores = scores[half:]
    avg_recent = sum(recent_scores) / len(recent_scores)
    avg_earlier = sum(earlier_scores) / len(earlier_scores)
    delta = avg_recent - avg_earlier

    if delta > 0.5:
        trend = "improving"
        trend_desc = "Your recorded mood has been improving compared to earlier check-ins."
    elif delta < -0.5:
        trend = "declining"
        trend_desc = "Your recent check-ins show your mood has been dipping slightly compared to earlier entries."
    else:
        trend = "stable"
        trend_desc = "Your mood has remained relatively stable across recent check-ins."

    # Stress & Energy metrics
    stress_vals = [m["stress_level"] for m in moods if isinstance(m.get("stress_level"), (int, float))]
    avg_stress = (sum(stress_vals) / len(stress_vals)) if stress_vals else None

    energy_vals = [m["energy_level"] for m in moods if isinstance(m.get("energy_level"), (int, float))]
    avg_energy = (sum(energy_vals) / len(energy_vals)) if energy_vals else None

    anxiety_vals = [m["anxiety_level"] for m in moods if isinstance(m.get("anxiety_level"), (int, float))]
    avg_anxiety = (sum(anxiety_vals) / len(anxiety_vals)) if anxiety_vals else None

    # Correlations
    correlations = []
    if avg_stress is not None and avg_stress >= 6.5:
        correlations.append(f"Elevated stress levels (averaging {avg_stress:.1f}/10) appear during your lower mood periods.")
    elif avg_stress is not None and avg_stress <= 4.0:
        correlations.append(f"Low reported stress ({avg_stress:.1f}/10) strongly correlates with your higher emotional balance.")

    if avg_energy is not None:
        if avg_energy >= 6.0 and avg_score >= 6.5:
            correlations.append(f"High energy ({avg_energy:.1f}/10) pairs directly with your most upbeat check-ins.")
        elif avg_energy <= 4.0:
            correlations.append("Low energy reports frequently accompany your more reflective or subdued days.")

    # Notes theme detection
    notes_corpus = " ".join([str(m.get("notes", "")) for m in moods if m.get("notes")]).lower()
    themes = []
    keyword_map = {
        "work": "Work & workload commitments",
        "job": "Work & career tasks",
        "sleep": "Sleep duration and quality",
        "tired": "Fatigue and recovery",
        "family": "Family interactions",
        "friend": "Social life & friendships",
        "study": "Studies & academic prep",
        "exam": "Exams & deadlines",
        "health": "Physical health & wellness",
        "exercise": "Physical exercise & movement",
        "anxious": "Uncertainty and worry",
    }
    for kw, theme_label in keyword_map.items():
        if kw in notes_corpus and theme_label not in themes:
            themes.append(theme_label)
            if len(themes) >= 3:
                break

    # Suggested actions tailored to mood state
    suggested_actions = []
    if (avg_stress is not None and avg_stress >= 6.0) or (avg_anxiety is not None and avg_anxiety >= 6.0):
        suggested_actions.append({
            "title": "4-7-8 Somatic Rest Breathing",
            "description": "Vagal nerve stimulation to down-regulate nervous system arousal.",
            "link": "/breathe",
            "badge": "Breathing",
        })
        suggested_actions.append({
            "title": "Anxiety Relief Guided Meditation",
            "description": "A 5-minute somatic grounding session to release mental tension.",
            "link": "/meditation",
            "badge": "Meditation",
        })
    elif trend == "declining" or avg_score < 5.0:
        suggested_actions.append({
            "title": "Self-Compassion Meditation",
            "description": "Gentle, non-judgmental guidance to give yourself permission to rest.",
            "link": "/meditation",
            "badge": "Meditation",
        })
        suggested_actions.append({
            "title": "Reflective Journaling",
            "description": "Unload recurring thoughts and process what felt most challenging today.",
            "link": "/journal",
            "badge": "Journal",
        })
    else:
        suggested_actions.append({
            "title": "Coherent Resonance Breathing",
            "description": "Maintain your steady balance with equal 5-second breath cycles.",
            "link": "/breathe",
            "badge": "Breathing",
        })
        suggested_actions.append({
            "title": "Gratitude & Win Journal",
            "description": "Anchor your positive momentum by noting one thing that went smoothly.",
            "link": "/journal",
            "badge": "Journal",
        })

    suggested_actions.append({
        "title": "Chat with Shadow",
        "description": "Explore practical steps and unpack emotions in an empathetic private chat.",
        "link": "/chat",
        "badge": "AI Companion",
    })

    # AI synthesis via provider or deterministic grounded template
    from ai import providers
    from ai.prompts import system_prompt_for

    prompt_summary = (
        f"User check-in data: {len(moods)} entries. Average score: {avg_score:.1f}/10. "
        f"Trend: {trend} (recent avg {avg_recent:.1f} vs earlier avg {avg_earlier:.1f}). "
        f"{f'Average stress: {avg_stress:.1f}/10. ' if avg_stress else ''}"
        f"{f'Average energy: {avg_energy:.1f}/10. ' if avg_energy else ''}"
        f"{f'Correlations: {'; '.join(correlations)}. ' if correlations else ''}"
        f"{f'Themes noted: {', '.join(themes)}. ' if themes else ''}"
    )

    ai_generated_text = None
    is_fallback = False
    try:
        res = providers.generate(
            system="You are an empathetic, non-judgmental AI wellness companion for ShadowMind. Synthesize the user's mood statistics into 2-3 warm, grounded sentences. Explain their trend, any connection between stress, energy and mood, and suggest one kind, small action. Never make clinical diagnoses or invent unmentioned events.",
            messages=[{"role": "user", "content": f"Please synthesize these mood records into supportive insights:\n{prompt_summary}"}],
            max_tokens=300,
            temperature=0.6,
            timeout=10.0,
        )
        if res and res.text and len(res.text.strip()) > 30:
            ai_generated_text = res.text.strip()
    except Exception:
        pass

    if not ai_generated_text:
        is_fallback = True
        # High quality grounded synthesis
        parts = [f"Across your last {len(moods)} check-ins, your mood averages {avg_score:.1f}/10 and {trend_desc.lower()}"]
        if themes:
            parts.append(f"Recurring themes in your reflections highlight {', '.join(themes[:2]).lower()}.")
        if correlations:
            parts.append(correlations[0])
        if trend == "declining" or avg_score < 5.0:
            parts.append("Consider taking a short pause between demanding tasks today and practicing self-compassion.")
        else:
            parts.append("Notice what your better days have in common and protect those nourishing habits.")
        ai_generated_text = " ".join(parts)

    return {
        "insights": ai_generated_text,
        "trend": trend,
        "trend_desc": trend_desc,
        "average_score": round(avg_score, 1),
        "average_stress": round(avg_stress, 1) if avg_stress is not None else None,
        "average_energy": round(avg_energy, 1) if avg_energy is not None else None,
        "average_anxiety": round(avg_anxiety, 1) if avg_anxiety is not None else None,
        "total_entries": len(moods),
        "themes": themes,
        "correlations": correlations,
        "suggested_actions": suggested_actions,
        "insufficient_data": False,
        "is_fallback": is_fallback,
    }


@router.get("/{mood_id}", response_model=MoodOut)
async def get_mood(
    mood_id: str,
    current_user: UserSession = Depends(get_current_user),
    db = Depends(get_db),
):
    try:
        oid = ObjectId(mood_id)
    except Exception:
        raise HTTPException(status_code=404, detail="Mood entry not found")

    mood = await db.moods.find_one({"_id": oid, "user_id": current_user.id})
    if not mood:
        raise HTTPException(status_code=404, detail="Mood entry not found")
    return convert_doc(mood)


@router.put("/{mood_id}", response_model=MoodOut)
async def update_mood(
    mood_id: str,
    update_data: MoodUpdate,
    current_user: UserSession = Depends(get_current_user),
    db = Depends(get_db),
):
    try:
        oid = ObjectId(mood_id)
    except Exception:
        raise HTTPException(status_code=404, detail="Mood entry not found")

    mood = await db.moods.find_one({"_id": oid, "user_id": current_user.id})
    if not mood:
        raise HTTPException(status_code=404, detail="Mood entry not found")

    up = update_data.dict(exclude_unset=True)
    if up:
        await db.moods.update_one({"_id": oid}, {"$set": up})

    updated = await db.moods.find_one({"_id": oid})
    return convert_doc(updated)


@router.delete("/{mood_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_mood(
    mood_id: str,
    current_user: UserSession = Depends(get_current_user),
    db = Depends(get_db),
):
    try:
        oid = ObjectId(mood_id)
    except Exception:
        raise HTTPException(status_code=404, detail="Mood entry not found")

    result = await db.moods.delete_one({"_id": oid, "user_id": current_user.id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Mood entry not found")
