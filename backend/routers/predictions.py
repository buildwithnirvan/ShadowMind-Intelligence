from fastapi import APIRouter, Depends, HTTPException, Body
from typing import List, Dict, Optional
from datetime import datetime, timedelta
from utils.auth import get_current_user, UserSession
from database import get_db

router = APIRouter(prefix="/api/predictions", tags=["predictions"])

def _analyze_wellness_patterns(moods: List[Dict], journals: List[Dict]) -> Dict:
    if not moods and not journals:
        return {"has_data": False, "entry_count": 0}

    scores = [m.get("score", 5) for m in moods]
    avg = sum(scores) / len(scores) if scores else 5.0

    # Holt's Linear Trend Forecasting
    alpha, beta = 0.6, 0.4
    level = scores[-1] if scores else 5.0
    trend_val = (scores[-1] - scores[-2]) if len(scores) > 1 else 0.0
    for i in range(len(scores) - 2, -1, -1):
        last_level = level
        val = scores[i]
        level = alpha * val + (1 - alpha) * (last_level + trend_val)
        trend_val = beta * (level - last_level) + (1 - beta) * trend_val

    from collections import Counter
    labels = [m.get("label", "") for m in moods]
    stress_set = {"anxious", "stressed", "overwhelmed", "angry", "depressed", "numb"}
    stress_ratio = sum(1 for l in labels if l.lower() in stress_set) / len(labels) if labels else 0.0
    sleep_scores = [(m.get("sleep_hours", 0), m.get("score", 5)) for m in moods if m.get("sleep_hours")]

    journal_text = " ".join([j.get("content", "") + " " + j.get("title", "") for j in journals]).lower()

    return {
        "has_data": True,
        "avg": round(avg, 2),
        "trend": round(trend_val, 2),
        "stress_ratio": round(stress_ratio, 2),
        "dominant": Counter(labels).most_common(3),
        "sleep_scores": sleep_scores,
        "journal_text": journal_text,
        "count": len(moods) + len(journals),
    }

def _build_patterns_to_watch(p: Dict, dismissed_ids: set, feedback_map: Dict) -> List[Dict]:
    if not p.get("has_data"):
        return []

    avg, trend, stress = p["avg"], p["trend"], p["stress_ratio"]
    journal_text = p.get("journal_text", "")
    patterns = []

    # 1. Procrastination / Avoidance Pattern
    if "procrastinat" in journal_text or "avoid" in journal_text or "later" in journal_text or stress > 0.35:
        p_id = "procrastination_avoidance"
        if p_id not in dismissed_ids and feedback_map.get(p_id) != "not_accurate":
            patterns.append({
                "id": p_id,
                "concern": "Academic & Task Pressure",
                "pattern": "Avoidance when feeling overwhelmed",
                "possible_mistake": "One pattern to watch is postponing difficult tasks until urgent deadlines force stressful rush work.",
                "confidence": "Strong recurring pattern" if stress > 0.5 else "Emerging pattern",
                "reason": "When emotional stress or anxiety rises, the brain seeks instant relief by stepping away from complex tasks.",
                "warning_signs": [
                    "Saying 'I'll start in an hour' or 'I'll do it tomorrow'",
                    "Switching to low-priority tasks (cleaning, endless scrolling) when work starts",
                    "Feeling a pit in your stomach when looking at your schedule",
                ],
                "prevention_steps": [
                    "Commit to starting for just 10 minutes (the Micro-Start Rule)",
                    "Break the task into tiny, atomic steps (e.g., 'Open blank file')",
                    "Set a timer and remove phone notifications during focus blocks",
                    "Acknowledge the anxiety without judging yourself",
                ],
                "recommended_action": "Start a 10-minute micro-focus window right now.",
                "suggested_cbt": "Challenge the thought: 'If I can't do it perfectly, I shouldn't start.'",
                "color": "#e74c3c",
            })

    # 2. Emotional Overthinking / Catastrophizing Pattern
    if "fail" in journal_text or "worst" in journal_text or "anxious" in journal_text or (avg < 5.5 and trend < 0):
        p_id = "overthinking_loop"
        if p_id not in dismissed_ids and feedback_map.get(p_id) != "not_accurate":
            patterns.append({
                "id": p_id,
                "concern": "Uncertainty & Fear of Failure",
                "pattern": "Catastrophic overthinking during low-energy periods",
                "possible_mistake": "A pattern to watch is treating anxious thoughts as absolute facts rather than temporary mental signals.",
                "confidence": "Worth watching",
                "reason": "Lower emotional resilience can make negative assumptions feel overwhelmingly real.",
                "warning_signs": [
                    "Replaying past interactions repeatedly in your mind",
                    "Assuming the worst outcome will definitely happen",
                    "Feeling physical tension in your chest or shoulders while thinking",
                ],
                "prevention_steps": [
                    "Separate factual evidence from assumptions using a 2-column list",
                    "Practice 4-7-8 breathing to down-regulate nervous system arousal",
                    "Ask: 'Will this matter in 6 months?'",
                ],
                "recommended_action": "Complete a 3-step Thought Reframing exercise in CBT Coach.",
                "suggested_cbt": "Reframe: 'My thoughts are predictions, not guaranteed outcomes.'",
                "color": "#9b59b6",
            })

    # 3. Sleep Disruption & Energy Depletion
    bad_sleep = [s for sl, s in p.get("sleep_scores", []) if sl < 6.5]
    if bad_sleep and len(bad_sleep) / max(len(p.get("sleep_scores", [])), 1) > 0.3:
        p_id = "sleep_disruption_cycle"
        if p_id not in dismissed_ids and feedback_map.get(p_id) != "not_accurate":
            patterns.append({
                "id": p_id,
                "concern": "Sleep & Energy Cycles",
                "pattern": "Late-night overthinking leading to reduced sleep and lower daytime resilience",
                "possible_mistake": "A pattern to watch is staying up late to recover personal time ('revenge bedtime procrastination'), which increases stress tomorrow.",
                "confidence": "Emerging pattern",
                "reason": "Sleep under 6.5 hours increases emotional amygdala reactivity by up to 60%.",
                "warning_signs": [
                    "Reaching for screens in bed past midnight",
                    "Feeling exhausted in the morning but wired at night",
                    "Irritability over minor hiccups during the day",
                ],
                "prevention_steps": [
                    "Set a screen sunset 45 minutes before sleep",
                    "Try a 5-minute wind-down guided meditation in bed",
                    "Keep a fixed wake-up time to anchor your circadian rhythm",
                ],
                "recommended_action": "Try the 5-minute Sleep Wind-Down Meditation.",
                "suggested_cbt": "Reframe: 'I don't need to finish everything tonight to earn rest.'",
                "color": "#3498db",
            })

    # Default supportive pattern if list is empty
    if not patterns:
        patterns.append({
            "id": "healthy_momentum",
            "concern": "Emotional Equilibrium",
            "pattern": "Steady emotional stability",
            "possible_mistake": "One risk to watch for is dropping wellness routines once stress temporarily subsides.",
            "confidence": "Worth watching",
            "reason": "Consistency during quiet periods builds psychological reserves for future challenges.",
            "warning_signs": [
                "Skipping check-ins when feeling good",
                "Neglecting boundary setting when busy",
            ],
            "prevention_steps": [
                "Maintain 1 daily check-in",
                "Journal about positive wins once a week",
                "Celebrate consistency",
            ],
            "recommended_action": "Log a quick mood check-in to keep your streak active.",
            "suggested_cbt": "Reflect on what strengths helped you maintain balance.",
            "color": "#27ae60",
        })

    return patterns

@router.get("/")
async def get_predictions(current_user: UserSession = Depends(get_current_user), db=Depends(get_db)):
    since = datetime.utcnow() - timedelta(days=30)
    mood_cursor = db.moods.find({"user_id": current_user.id, "created_at": {"$gte": since}}).sort("created_at", -1).limit(60)
    journal_cursor = db.journals.find({"user_id": current_user.id, "created_at": {"$gte": since}}).sort("created_at", -1).limit(20)

    moods = [m async for m in mood_cursor]
    journals = [j async for j in journal_cursor]

    # Fetch user dismissals & feedback from DB user settings or predictions collection
    user_settings = await db.users.find_one({"_id": current_user.id}) or {}
    dismissed = set(user_settings.get("dismissed_predictions", []))
    feedback = user_settings.get("prediction_feedback", {})

    p_data = _analyze_wellness_patterns(moods, journals)
    patterns = _build_patterns_to_watch(p_data, dismissed, feedback)

    return {
        "predictions": patterns,
        "based_on_entries": p_data.get("count", 0),
        "avg_mood": p_data.get("avg"),
        "generated_at": datetime.utcnow().isoformat(),
    }

@router.get("/{pattern_id}")
async def get_prediction_detail(pattern_id: str, current_user: UserSession = Depends(get_current_user), db=Depends(get_db)):
    all_preds = (await get_predictions(current_user=current_user, db=db))["predictions"]
    found = next((p for p in all_preds if p["id"] == pattern_id), None)
    if not found:
        raise HTTPException(status_code=404, detail="Pattern not found")
    return found

@router.get("/{pattern_id}/prevention-plan")
async def get_prevention_plan(pattern_id: str, current_user: UserSession = Depends(get_current_user), db=Depends(get_db)):
    pattern = await get_prediction_detail(pattern_id, current_user=current_user, db=db)
    return {
        "pattern_id": pattern["id"],
        "concern": pattern["concern"],
        "possible_mistake": pattern["possible_mistake"],
        "why": pattern["reason"],
        "warning_signs": pattern["warning_signs"],
        "prevention_steps": pattern["prevention_steps"],
        "cbt_reframing": pattern.get("suggested_cbt"),
        "recommended_action": pattern["recommended_action"],
    }

@router.post("/{pattern_id}/feedback")
async def save_prediction_feedback(
    pattern_id: str,
    feedback: Dict = Body(...),
    current_user: UserSession = Depends(get_current_user),
    db=Depends(get_db),
):
    rating = feedback.get("rating", "accurate")  # accurate | somewhat | not_accurate
    await db.users.update_one(
        {"_id": current_user.id},
        {"$set": {f"prediction_feedback.{pattern_id}": rating}},
        upsert=True
    )
    return {"status": "success", "pattern_id": pattern_id, "rating": rating}

@router.post("/{pattern_id}/dismiss")
async def dismiss_prediction(
    pattern_id: str,
    current_user: UserSession = Depends(get_current_user),
    db=Depends(get_db),
):
    await db.users.update_one(
        {"_id": current_user.id},
        {"$addToSet": {"dismissed_predictions": pattern_id}},
        upsert=True
    )
    return {"status": "dismissed", "pattern_id": pattern_id}

