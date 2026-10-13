from fastapi import APIRouter, Depends, Query
from datetime import datetime, timedelta
import asyncio
from database import get_db
from utils.auth import get_current_user, UserSession
from utils.ai import generate_mood_insight

router = APIRouter(prefix="/api/analytics", tags=["analytics"])


@router.get("/overview")
async def get_overview(
    days: int = Query(30, ge=7, le=365),
    current_user: UserSession = Depends(get_current_user),
    db=Depends(get_db),
):
    since = datetime.utcnow() - timedelta(days=days)

    mood_count = await db.moods.count_documents(
        {"user_id": current_user.id, "created_at": {"$gte": since}}
    )

    avg_pipeline = [
        {"$match": {"user_id": current_user.id, "created_at": {"$gte": since}}},
        {"$group": {"_id": None, "avg_score": {"$avg": "$score"}}},
    ]
    avg_res = await db.moods.aggregate(avg_pipeline).to_list(1)
    avg_mood = avg_res[0]["avg_score"] if avg_res else None

    journal_count = await db.journals.count_documents(
        {"user_id": current_user.id, "created_at": {"$gte": since}}
    )
    chat_count = await db.chat_sessions.count_documents(
        {"user_id": current_user.id, "created_at": {"$gte": since}}
    )

    words_res = await db.journals.aggregate([
        {"$match": {"user_id": current_user.id, "created_at": {"$gte": since}}},
        {"$group": {"_id": None, "total_words": {"$sum": "$word_count"}}},
    ]).to_list(1)
    total_words = words_res[0]["total_words"] if words_res else 0

    # Streak: deduplicate by date first
    mood_dates_docs = await db.moods.find(
        {"user_id": current_user.id}, {"created_at": 1}
    ).sort("created_at", -1).to_list(None)
    unique_dates = sorted(
        {r["created_at"].date() for r in mood_dates_docs}, reverse=True
    )
    streak = 0
    today = datetime.utcnow().date()
    for i, d in enumerate(unique_dates):
        if d == today - timedelta(days=i):
            streak += 1
        else:
            break

    # Trend: compare last 7 days avg vs prior 7 days avg
    recent_moods = await db.moods.find(
        {"user_id": current_user.id, "created_at": {"$gte": datetime.utcnow() - timedelta(days=7)}}
    ).to_list(None)
    prior_moods = await db.moods.find({
        "user_id": current_user.id,
        "created_at": {
            "$gte": datetime.utcnow() - timedelta(days=14),
            "$lt": datetime.utcnow() - timedelta(days=7),
        }
    }).to_list(None)

    trend = "stable"
    if recent_moods and prior_moods:
        r_avg = sum(m["score"] for m in recent_moods) / len(recent_moods)
        p_avg = sum(m["score"] for m in prior_moods) / len(prior_moods)
        if r_avg > p_avg + 0.5:
            trend = "improving"
        elif r_avg < p_avg - 0.5:
            trend = "declining"

    return {
        "period_days": days,
        "mood_entries": mood_count,
        "average_mood": round(float(avg_mood), 2) if avg_mood else None,
        "journal_entries": journal_count,
        "chat_sessions": chat_count,
        "total_words_written": total_words,
        "current_streak_days": streak,
        "trend": trend,
    }


@router.get("/mood-heatmap")
async def get_mood_heatmap(
    days: int = Query(90, ge=30, le=365),
    current_user: UserSession = Depends(get_current_user),
    db=Depends(get_db),
):
    since = datetime.utcnow() - timedelta(days=days)
    moods = await db.moods.find(
        {"user_id": current_user.id, "created_at": {"$gte": since}}
    ).sort("created_at", 1).to_list(None)

    date_scores: dict = {}
    for m in moods:
        dk = m["created_at"].strftime("%Y-%m-%d")
        date_scores.setdefault(dk, []).append(m["score"])

    return {"heatmap": [
        {"date": d, "avg_score": round(sum(s)/len(s), 2), "count": len(s)}
        for d, s in date_scores.items()
    ]}


import time
from typing import Dict, Any
from config import settings

_ai_insight_cache: Dict[str, Dict[str, Any]] = {}
_ai_insight_locks: Dict[str, asyncio.Lock] = {}


@router.get("/ai-insight")
async def get_ai_mood_insight(
    current_user: UserSession = Depends(get_current_user),
    db=Depends(get_db),
):
    """
    Returns AI-synthesized mood observation.
    Optimized with server-side caching (TTL=3600s or on data mutation)
    and per-user concurrency deduplication to prevent 45s stalls.
    """
    moods = await db.moods.find(
        {"user_id": current_user.id}
    ).sort("created_at", -1).limit(14).to_list(14)

    if not moods:
        return {"insight": "No mood data yet. Log a few check-ins and I'll start spotting patterns for you."}

    # Deterministic fingerprint of recent mood data
    fingerprint = f"{len(moods)}:" + ",".join(
        f"{str(m.get('_id'))}_{m.get('score', 0)}" for m in moods[:7]
    )

    ttl = getattr(settings, "ANALYTICS_CACHE_TTL_SECONDS", 3600)
    now = time.time()

    # Fast-path: Check server-side cache
    cached = _ai_insight_cache.get(current_user.id)
    if cached and cached.get("fingerprint") == fingerprint and (now - cached.get("timestamp", 0)) < ttl:
        return {"insight": cached["insight"]}

    # Acquire per-user lock to deduplicate concurrent requests
    if current_user.id not in _ai_insight_locks:
        _ai_insight_locks[current_user.id] = asyncio.Lock()

    async with _ai_insight_locks[current_user.id]:
        # Re-check cache inside critical section
        cached = _ai_insight_cache.get(current_user.id)
        if cached and cached.get("fingerprint") == fingerprint and (now - cached.get("timestamp", 0)) < ttl:
            return {"insight": cached["insight"]}

        mood_data = [
            {"score": m["score"], "label": m.get("label", "Neutral"), "date": m["created_at"].strftime("%Y-%m-%d")}
            for m in moods
        ]

        # Generate insight in bounded worker thread
        insight = await asyncio.to_thread(generate_mood_insight, mood_data)

        # Cache valid result
        _ai_insight_cache[current_user.id] = {
            "insight": insight,
            "fingerprint": fingerprint,
            "timestamp": time.time(),
        }
        return {"insight": insight}


@router.get("/weekly-summary")
async def get_weekly_summary(
    current_user: UserSession = Depends(get_current_user),
    db=Depends(get_db),
):
    since = datetime.utcnow() - timedelta(days=90)
    moods = await db.moods.find(
        {"user_id": current_user.id, "created_at": {"$gte": since}}
    ).to_list(None)

    days_data: dict = {i: [] for i in range(7)}
    for m in moods:
        days_data[m["created_at"].weekday()].append(m["score"])

    day_names = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
    return {"weekly_pattern": [
        {
            "day": day_names[i],
            "avg_score": round(sum(s)/len(s), 2) if s else None,
            "entries": len(s),
        }
        for i, s in days_data.items()
    ]}


@router.get("/emotional-insights")
async def get_emotional_insights(
    days: int = Query(30, ge=7, le=365),
    current_user: UserSession = Depends(get_current_user),
    db=Depends(get_db),
):
    since = datetime.utcnow() - timedelta(days=days)
    journals = await db.journals.find(
        {"user_id": current_user.id, "created_at": {"$gte": since}}
    ).to_list(None)
    sessions = await db.chat_sessions.find(
        {"user_id": current_user.id, "created_at": {"$gte": since}}
    ).to_list(None)

    emotion_totals: dict = {}
    emotion_counts: dict = {}
    wellbeing_scores = []
    active_mistakes: list = []
    corrective_actions: list = []
    timeline: list = []

    for src, t in [(journals, "journal"), (sessions, "chat")]:
        for item in src:
            for emo in (item.get("ai_emotions") or []):
                n, v = emo.get("name"), emo.get("intensity", 0.0)
                if n:
                    emotion_totals[n] = emotion_totals.get(n, 0.0) + v
                    emotion_counts[n] = emotion_counts.get(n, 0) + 1
            if (wb := item.get("ai_wellbeing_score")) is not None:
                wellbeing_scores.append(wb)
                timeline.append({"date": item["created_at"].strftime("%Y-%m-%d"), "wellbeing": wb, "type": t})
            for m in (item.get("ai_future_mistakes") or []):
                if m not in active_mistakes:
                    active_mistakes.append(m)
            for a in (item.get("ai_corrective_actions") or []):
                if a not in corrective_actions:
                    corrective_actions.append(a)

    avg_emotions = sorted(
        [{"name": n, "intensity": round(emotion_totals[n]/emotion_counts[n], 1)} for n in emotion_totals],
        key=lambda x: x["intensity"], reverse=True
    )
    timeline.sort(key=lambda x: x["date"])
    return {
        "average_wellbeing": round(sum(wellbeing_scores)/len(wellbeing_scores), 1) if wellbeing_scores else 6.0,
        "emotions": avg_emotions,
        "future_mistakes": active_mistakes[:6],
        "corrective_actions": corrective_actions[:6],
        "timeline": timeline,
    }
