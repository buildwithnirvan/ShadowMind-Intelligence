from fastapi import APIRouter, Depends, HTTPException, Query, status, Body
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any, Set
from database import get_db, convert_doc, to_oid
from utils.auth import get_current_admin, UserSession, get_password_hash
from schemas.user import AdminCreate, AdminOut
from bson import ObjectId
import re
import logging

logger = logging.getLogger("shadowmind.admin")

router = APIRouter(prefix="/api/admin", tags=["admin"])

# Supported emotion categories directly grounded in ShadowMind's analyzer, lexicon, and moods
EMOTION_CATEGORIES = {
    "depression": {
        "id": "depression",
        "label": "Depression-related Signals",
        "description": "Sadness, despair, and low-mood indicators",
        "mood_labels": {"sad", "depressed"},
        "ai_emotions": {"Sadness"},
        "color": "#ef4444",
    },
    "anxiety": {
        "id": "anxiety",
        "label": "Anxiety-related Signals",
        "description": "Anxiety, panic, worry, and nervous indicators",
        "mood_labels": {"anxious"},
        "ai_emotions": {"Anxiety", "Fear"},
        "color": "#f59e0b",
    },
    "stress": {
        "id": "stress",
        "label": "Stress",
        "description": "Stress, tension, and overwhelm indicators",
        "mood_labels": {"stressed", "overwhelmed"},
        "ai_emotions": {"Overwhelm"},
        "color": "#e87522",
    },
    "joy": {
        "id": "joy",
        "label": "Joy & Positive Emotion",
        "description": "Happiness, gratitude, hope, and contentment",
        "mood_labels": {"happy", "content", "focused"},
        "ai_emotions": {"Joy", "Gratitude", "Hope"},
        "color": "#10b981",
    },
    "calm": {
        "id": "calm",
        "label": "Calm",
        "description": "Peacefulness, relaxation, and emotional balance",
        "mood_labels": {"calm"},
        "ai_emotions": {"Calm"},
        "color": "#3b82f6",
    },
    "fatigue": {
        "id": "fatigue",
        "label": "Fatigue",
        "description": "Exhaustion, low energy, and apathy indicators",
        "mood_labels": {"tired", "fatigue", "apathy"},
        "ai_emotions": {"Apathy"},
        "color": "#8b5cf6",
    },
    "anger": {
        "id": "anger",
        "label": "Anger",
        "description": "Irritation, frustration, and anger indicators",
        "mood_labels": {"angry"},
        "ai_emotions": {"Anger"},
        "color": "#ec4899",
    },
}


def _parse_date_range(days: Optional[int], start_date: Optional[str], end_date: Optional[str]):
    """Safely parse filtering date range, supporting predefined days and custom dates."""
    now = datetime.utcnow()
    if start_date and end_date:
        try:
            start_dt = datetime.fromisoformat(start_date.replace("Z", "+00:00")).replace(tzinfo=None)
            end_dt = datetime.fromisoformat(end_date.replace("Z", "+00:00")).replace(tzinfo=None)
            if start_dt > end_dt:
                start_dt, end_dt = end_dt, start_dt
            # Include entire end day
            end_dt = end_dt.replace(hour=23, minute=59, second=59, microsecond=999999)
            return start_dt, end_dt
        except Exception:
            pass

    selected_days = days if (days and days in [7, 30, 90, 180, 365]) else 30
    start_dt = now - timedelta(days=selected_days)
    end_dt = now
    return start_dt, end_dt


def _extract_record_categories(record: Dict[str, Any], record_type: str) -> Set[str]:
    """Identify which of the 7 supported emotion categories are present in an observation."""
    detected = set()

    if record_type == "mood":
        label = (record.get("label") or "").strip().lower()
        score = record.get("score")
        stress = record.get("stress_level")
        energy = record.get("energy_level")

        for cat_id, cfg in EMOTION_CATEGORIES.items():
            if label in cfg["mood_labels"]:
                detected.add(cat_id)

        # Numerical indicators from mood tracker
        if score is not None and score <= 3.5:
            detected.add("depression")
        if stress is not None and stress >= 7.0:
            detected.add("stress")
        if energy is not None and energy <= 3.0:
            detected.add("fatigue")

    elif record_type in ("journal", "chat_session"):
        emotions = record.get("ai_emotions") or []
        wellbeing = record.get("ai_wellbeing_score")

        for em in emotions:
            if isinstance(em, dict):
                em_name = em.get("name", "").strip().title()
                for cat_id, cfg in EMOTION_CATEGORIES.items():
                    if em_name in cfg["ai_emotions"]:
                        detected.add(cat_id)

        if wellbeing is not None and wellbeing <= 3:
            detected.add("depression")

    elif record_type == "chat_message":
        emotion_dict = record.get("emotion") or {}
        primary = emotion_dict.get("primary", "")
        sub_emotions = emotion_dict.get("emotions") or []

        for cat_id, cfg in EMOTION_CATEGORIES.items():
            if primary in cfg["ai_emotions"]:
                detected.add(cat_id)
            for sub in sub_emotions:
                if isinstance(sub, dict) and sub.get("name") in cfg["ai_emotions"]:
                    detected.add(cat_id)

    return detected


async def _compute_user_improvement_trends(db):
    """
    Calculate emotional-signal improvement trends for all users using actual historical observations.

    Methodology:
    - We aggregate all chronological wellness observations (moods, journals, analyzed chat sessions).
    - To prevent spurious classifications from single visits, users with < 4 observations are classified as 'insufficient_data'.
    - For users with sufficient history (>= 4 observations), records are partitioned chronologically into a baseline period
      and a recent comparison period.
    - We compute the frequency of depression-related and anxiety-related signals in both observation windows.
    - An improvement is identified when there is a meaningful decline (>= 15% rate difference) in recorded distress signals.
    - Classifications are strictly model output signals, NOT clinical diagnoses.
    """
    all_users = await db.users.find({}, {"_id": 1, "username": 1}).to_list(None)

    improving_depression = 0
    improving_anxiety = 0
    improving_both = 0
    unchanged = 0
    worsening = 0
    insufficient_data = 0

    for u in all_users:
        uid = str(u["_id"])

        # Fetch all chronological records for this user
        moods_cursor = db.moods.find({"user_id": uid}, {"label": 1, "score": 1, "stress_level": 1, "energy_level": 1, "created_at": 1}).sort("created_at", 1)
        journals_cursor = db.journals.find({"user_id": uid}, {"ai_emotions": 1, "ai_wellbeing_score": 1, "created_at": 1}).sort("created_at", 1)
        chats_cursor = db.chat_sessions.find({"user_id": uid, "ai_emotions": {"$exists": True, "$ne": []}}, {"ai_emotions": 1, "ai_wellbeing_score": 1, "created_at": 1}).sort("created_at", 1)

        user_moods = await moods_cursor.to_list(None)
        user_journals = await journals_cursor.to_list(None)
        user_chats = await chats_cursor.to_list(None)

        observations = []
        for m in user_moods:
            observations.append({"type": "mood", "data": m, "created_at": m.get("created_at") or datetime.min})
        for j in user_journals:
            observations.append({"type": "journal", "data": j, "created_at": j.get("created_at") or datetime.min})
        for c in user_chats:
            observations.append({"type": "chat_session", "data": c, "created_at": c.get("created_at") or datetime.min})

        observations.sort(key=lambda x: x["created_at"])

        # Minimum observations requirement
        if len(observations) < 4:
            insufficient_data += 1
            continue

        # Split chronologically into baseline (early) and recent halves
        half = len(observations) // 2
        early_obs = observations[:half]
        recent_obs = observations[half:]

        def get_rates(obs_list):
            dep_count = 0
            anx_count = 0
            for item in obs_list:
                cats = _extract_record_categories(item["data"], item["type"])
                if "depression" in cats:
                    dep_count += 1
                if "anxiety" in cats:
                    anx_count += 1
            n = len(obs_list)
            return (dep_count / n if n > 0 else 0.0), (anx_count / n if n > 0 else 0.0)

        dep_early, anx_early = get_rates(early_obs)
        dep_recent, anx_recent = get_rates(recent_obs)

        # Meaningful change threshold (15% rate difference)
        threshold = 0.15
        dep_improving = (dep_early - dep_recent) >= threshold
        dep_worsening = (dep_recent - dep_early) >= threshold

        anx_improving = (anx_early - anx_recent) >= threshold
        anx_worsening = (anx_recent - anx_early) >= threshold

        if dep_improving and anx_improving:
            improving_both += 1
            improving_depression += 1
            improving_anxiety += 1
        elif dep_improving:
            improving_depression += 1
        elif anx_improving:
            improving_anxiety += 1
        elif dep_worsening or anx_worsening:
            worsening += 1
        else:
            unchanged += 1

    return {
        "improving_depression": improving_depression,
        "improving_anxiety": improving_anxiety,
        "improving_both": improving_both,
        "unchanged": unchanged,
        "worsening": worsening,
        "insufficient_data": insufficient_data,
        "methodology_explanation": (
            "Trend evaluation compares baseline observations against recent observations for users with "
            "at least 4 recorded sessions. A decrease of ≥15% in detected distress signals indicates an improving trend. "
            "Important note: ShadowMind emotion indicators are model outputs, not clinical diagnoses."
        ),
    }


# ─────────────────────────────────────────────────────────────────────────────
# 1. OVERVIEW
# ─────────────────────────────────────────────────────────────────────────────
@router.get("/overview")
async def get_admin_overview(
    admin: UserSession = Depends(get_current_admin),
    db=Depends(get_db),
):
    """Retrieve top-level platform statistics and user analytics summary (Administrator access only)."""
    total_users = await db.users.count_documents({})
    total_active_users = await db.users.count_documents({"is_active": {"$ne": False}})
    total_admins = await db.users.count_documents({"role": "admin"})

    # Sessions recorded in database
    total_chats = await db.chat_sessions.count_documents({})
    total_moods = await db.moods.count_documents({})
    total_journals = await db.journals.count_documents({})
    total_sessions_recorded = total_chats + total_moods + total_journals

    # Users with emotional-analysis data
    analyzed_mood_users = set(await db.moods.distinct("user_id"))
    analyzed_journal_users = set(await db.journals.distinct("user_id"))
    analyzed_chat_users = set(await db.chat_sessions.distinct("user_id"))
    all_analyzed_users = analyzed_mood_users | analyzed_journal_users | analyzed_chat_users
    total_users_analyzed = len(all_analyzed_users)

    # Compute category frequency
    category_counts: Dict[str, int] = {k: 0 for k in EMOTION_CATEGORIES}

    async for m in db.moods.find({}, {"label": 1, "score": 1, "stress_level": 1, "energy_level": 1}):
        for c in _extract_record_categories(m, "mood"):
            category_counts[c] += 1

    async for j in db.journals.find({}, {"ai_emotions": 1, "ai_wellbeing_score": 1}):
        for c in _extract_record_categories(j, "journal"):
            category_counts[c] += 1

    async for cs in db.chat_sessions.find({"ai_emotions": {"$exists": True, "$ne": []}}, {"ai_emotions": 1, "ai_wellbeing_score": 1}):
        for c in _extract_record_categories(cs, "chat_session"):
            category_counts[c] += 1

    total_detected_signals = sum(category_counts.values()) or 1
    most_frequent_emotions = []
    for cat_id, cnt in sorted(category_counts.items(), key=lambda x: x[1], reverse=True):
        most_frequent_emotions.append({
            "id": cat_id,
            "category": EMOTION_CATEGORIES[cat_id]["label"],
            "count": cnt,
            "percentage": round((cnt / total_detected_signals) * 100, 1),
            "color": EMOTION_CATEGORIES[cat_id]["color"],
        })

    # Improvement trends
    trends = await _compute_user_improvement_trends(db)

    return {
        "status": "online",
        "system_time": datetime.utcnow().isoformat(),
        "total_users": total_users,
        "total_active_users": total_active_users,
        "total_admins": total_admins,
        "total_sessions_recorded": total_sessions_recorded,
        "total_chat_sessions": total_chats,
        "total_mood_logs": total_moods,
        "total_journal_entries": total_journals,
        "total_users_analyzed": total_users_analyzed,
        "most_frequent_emotions": most_frequent_emotions,
        "trend_improving_users": trends["improving_depression"] + trends["improving_anxiety"] - trends["improving_both"],
        "trend_improving_depression": trends["improving_depression"],
        "trend_improving_anxiety": trends["improving_anxiety"],
        "trend_improving_both": trends["improving_both"],
        "trend_worsening_users": trends["worsening"],
        "trend_insufficient_users": trends["insufficient_data"],
        "trend_unchanged_users": trends["unchanged"],
        "current_admin": admin.username,
    }


# ─────────────────────────────────────────────────────────────────────────────
# 2. USERS MANAGEMENT
# ─────────────────────────────────────────────────────────────────────────────
@router.get("/users")
async def get_admin_users(
    skip: int = Query(0, ge=0),
    limit: int = Query(15, ge=1, le=100),
    search: str = Query("", description="Filter users by username or email"),
    sort_by: str = Query("created_at", description="Field to sort by: created_at, username, session_count, last_active"),
    sort_order: str = Query("desc", description="Sort order: asc or desc"),
    admin: UserSession = Depends(get_current_admin),
    db=Depends(get_db),
):
    """Searchable, paginated user management directory (Administrator access only)."""
    query: Dict[str, Any] = {}
    if search.strip():
        term = search.strip()
        query = {
            "$or": [
                {"username": {"$regex": term, "$options": "i"}},
                {"email": {"$regex": term, "$options": "i"}},
                {"full_name": {"$regex": term, "$options": "i"}},
            ]
        }

    total = await db.users.count_documents(query)

    # Fetch users matching query
    # Exclude hashed_password and authentication tokens
    all_matched = await db.users.find(query, {"hashed_password": 0}).to_list(None)

    # Augment each user with database session statistics
    user_records = []
    for u in all_matched:
        uid = str(u["_id"])

        # Count recorded sessions for this user
        moods_count = await db.moods.count_documents({"user_id": uid})
        journals_count = await db.journals.count_documents({"user_id": uid})
        chats_count = await db.chat_sessions.count_documents({"user_id": uid})
        session_count = moods_count + journals_count + chats_count

        # Find latest emotional analysis timestamp
        latest_mood = await db.moods.find_one({"user_id": uid}, sort=[("created_at", -1)], projection={"created_at": 1})
        latest_journal = await db.journals.find_one({"user_id": uid}, sort=[("created_at", -1)], projection={"created_at": 1})
        latest_chat = await db.chat_sessions.find_one({"user_id": uid}, sort=[("updated_at", -1)], projection={"updated_at": 1, "created_at": 1})

        analysis_timestamps = []
        if latest_mood and latest_mood.get("created_at"):
            analysis_timestamps.append(latest_mood["created_at"])
        if latest_journal and latest_journal.get("created_at"):
            analysis_timestamps.append(latest_journal["created_at"])
        if latest_chat:
            if latest_chat.get("updated_at"):
                analysis_timestamps.append(latest_chat["updated_at"])
            elif latest_chat.get("created_at"):
                analysis_timestamps.append(latest_chat["created_at"])

        latest_analysis = max(analysis_timestamps) if analysis_timestamps else None

        # Find last active date: max of last_login, created_at, or latest session activity
        activity_timestamps = [u.get("created_at")] if u.get("created_at") else []
        if u.get("last_login"):
            activity_timestamps.append(u["last_login"])
        if latest_analysis:
            activity_timestamps.append(latest_analysis)

        last_active = max(activity_timestamps) if activity_timestamps else None

        user_doc = convert_doc(u)
        user_doc.setdefault("role", "user")
        user_doc["session_count"] = session_count
        user_doc["last_active"] = last_active.isoformat() if last_active else None
        user_doc["latest_analysis"] = latest_analysis.isoformat() if latest_analysis else None
        user_doc["account_status"] = "Active" if user_doc.get("is_active", True) else "Inactive"
        user_records.append(user_doc)

    # Sorting
    reverse = (sort_order.lower() == "desc")
    if sort_by == "username":
        user_records.sort(key=lambda x: (x.get("username") or "").lower(), reverse=reverse)
    elif sort_by == "session_count":
        user_records.sort(key=lambda x: x.get("session_count", 0), reverse=reverse)
    elif sort_by == "last_active":
        user_records.sort(key=lambda x: x.get("last_active") or "", reverse=reverse)
    else:  # default created_at
        user_records.sort(key=lambda x: x.get("created_at") or "", reverse=reverse)

    paginated_users = user_records[skip:skip + limit]

    return {
        "total": total,
        "skip": skip,
        "limit": limit,
        "users": paginated_users,
    }


# ─────────────────────────────────────────────────────────────────────────────
# 3. EMOTIONAL ANALYTICS
# ─────────────────────────────────────────────────────────────────────────────
@router.get("/emotional-analytics")
async def get_admin_emotional_analytics(
    days: Optional[int] = Query(30, ge=1, le=365),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    admin: UserSession = Depends(get_current_admin),
    db=Depends(get_db),
):
    """Aggregate emotional-analysis statistics and visual charts for all users (Administrator access only)."""
    start_dt, end_dt = _parse_date_range(days, start_date, end_date)

    # Match observations within the reporting period
    date_filter = {"$gte": start_dt, "$lte": end_dt}

    moods = await db.moods.find({"created_at": date_filter}).to_list(None)
    journals = await db.journals.find({"created_at": date_filter}).to_list(None)
    chats = await db.chat_sessions.find({"created_at": date_filter}).to_list(None)

    total_sessions_in_period = len(moods) + len(journals) + len(chats)

    # Collect distinct analyzed users in period
    users_with_mood = {m.get("user_id") for m in moods if m.get("user_id")}
    users_with_journal = {j.get("user_id") for j in journals if j.get("user_id")}
    users_with_chat = {c.get("user_id") for c in chats if c.get("user_id")}
    all_analyzed_users_in_period = users_with_mood | users_with_journal | users_with_chat
    total_users_analyzed = len(all_analyzed_users_in_period)

    # Category summaries: calculate distinct users, session occurrences, and percentages
    cat_user_sets: Dict[str, Set[str]] = {k: set() for k in EMOTION_CATEGORIES}
    cat_session_counts: Dict[str, int] = {k: 0 for k in EMOTION_CATEGORIES}

    # Group timeline entries by date for line charts
    timeline_map: Dict[str, Dict[str, Any]] = {}

    def ensure_date_point(d_str: str):
        if d_str not in timeline_map:
            timeline_map[d_str] = {
                "date": d_str,
                "depression": 0,
                "anxiety": 0,
                "stress": 0,
                "joy": 0,
                "calm": 0,
                "fatigue": 0,
                "anger": 0,
                "active_users": set(),
                "sessions_recorded": 0,
            }
        return timeline_map[d_str]

    # Process Moods
    for m in moods:
        cats = _extract_record_categories(m, "mood")
        uid = m.get("user_id")
        created = m.get("created_at")
        d_str = created.strftime("%Y-%m-%d") if created else "Unknown"

        point = ensure_date_point(d_str)
        point["sessions_recorded"] += 1
        if uid:
            point["active_users"].add(uid)

        for c in cats:
            cat_session_counts[c] += 1
            if uid:
                cat_user_sets[c].add(uid)
            point[c] += 1

    # Process Journals
    for j in journals:
        cats = _extract_record_categories(j, "journal")
        uid = j.get("user_id")
        created = j.get("created_at")
        d_str = created.strftime("%Y-%m-%d") if created else "Unknown"

        point = ensure_date_point(d_str)
        point["sessions_recorded"] += 1
        if uid:
            point["active_users"].add(uid)

        for c in cats:
            cat_session_counts[c] += 1
            if uid:
                cat_user_sets[c].add(uid)
            point[c] += 1

    # Process Chat Sessions
    for cs in chats:
        cats = _extract_record_categories(cs, "chat_session")
        uid = cs.get("user_id")
        created = cs.get("created_at")
        d_str = created.strftime("%Y-%m-%d") if created else "Unknown"

        point = ensure_date_point(d_str)
        point["sessions_recorded"] += 1
        if uid:
            point["active_users"].add(uid)

        for c in cats:
            cat_session_counts[c] += 1
            if uid:
                cat_user_sets[c].add(uid)
            point[c] += 1

    # Build emotion summary cards
    category_summaries = []
    for cat_id, cfg in EMOTION_CATEGORIES.items():
        distinct_users = len(cat_user_sets[cat_id])
        session_cnt = cat_session_counts[cat_id]
        pct = round((distinct_users / total_users_analyzed * 100), 1) if total_users_analyzed > 0 else 0.0

        category_summaries.append({
            "id": cat_id,
            "label": cfg["label"],
            "description": cfg["description"],
            "color": cfg["color"],
            "user_count": distinct_users,
            "percentage": pct,
            "session_count": session_cnt,
        })

    # Sort timeline points chronologically
    sorted_timeline = []
    for d_str in sorted(timeline_map.keys()):
        p = timeline_map[d_str]
        sorted_timeline.append({
            "date": d_str,
            "depression": p["depression"],
            "anxiety": p["anxiety"],
            "stress": p["stress"],
            "joy": p["joy"],
            "calm": p["calm"],
            "fatigue": p["fatigue"],
            "anger": p["anger"],
            "active_users": len(p["active_users"]),
            "sessions_recorded": p["sessions_recorded"],
        })

    # Category distribution for Bar/Doughnut charts
    category_distribution = [
        {
            "id": c["id"],
            "name": c["label"],
            "user_count": c["user_count"],
            "percentage": c["percentage"],
            "session_count": c["session_count"],
            "color": c["color"],
        }
        for c in category_summaries
    ]

    # Improvement trends (baseline vs recent comparison)
    trends = await _compute_user_improvement_trends(db)

    return {
        "reporting_period": {
            "start_date": start_dt.isoformat(),
            "end_date": end_dt.isoformat(),
            "days_analyzed": (end_dt - start_dt).days,
        },
        "total_users_analyzed": total_users_analyzed,
        "total_sessions_recorded": total_sessions_in_period,
        "category_summaries": category_summaries,
        "visual_analytics": {
            "category_distribution": category_distribution,
            "trends_over_time": sorted_timeline,
            "depression_trends": [{"date": p["date"], "depression_signals": p["depression"]} for p in sorted_timeline],
            "anxiety_trends": [{"date": p["date"], "anxiety_signals": p["anxiety"]} for p in sorted_timeline],
            "positive_trends": [{"date": p["date"], "positive_signals": p["joy"] + p["calm"]} for p in sorted_timeline],
            "user_activity": [{"date": p["date"], "users_analyzed": p["active_users"], "sessions_recorded": p["sessions_recorded"]} for p in sorted_timeline],
        },
        "improvement_trends": trends,
    }


# ─────────────────────────────────────────────────────────────────────────────
# 4. ADMIN MANAGEMENT
# ─────────────────────────────────────────────────────────────────────────────
@router.get("/administrators")
async def get_administrators(
    admin: UserSession = Depends(get_current_admin),
    db=Depends(get_db),
):
    """List all current administrator accounts (Administrator access only)."""
    cursor = db.users.find({"role": "admin"}, {"hashed_password": 0}).sort("created_at", 1)
    admins_raw = await cursor.to_list(None)

    admins = []
    for a in admins_raw:
        item = convert_doc(a)
        admins.append({
            "id": item["id"],
            "username": item.get("username", ""),
            "email": item.get("email") or "",
            "full_name": item.get("full_name") or "",
            "role": "admin",
            "is_active": item.get("is_active", True),
            "created_at": item.get("created_at"),
            "last_login": item.get("last_login"),
        })

    return {"total": len(admins), "administrators": admins}


@router.post("/administrators", status_code=status.HTTP_201_CREATED)
async def create_administrator(
    admin_data: AdminCreate,
    admin: UserSession = Depends(get_current_admin),
    db=Depends(get_db),
):
    """
    Create a new administrator account (Administrator access only).
    Enforces strict server-side validation, password hashing, and role assignment.
    """
    username = (admin_data.username or "").strip()
    if not username:
        raise HTTPException(status_code=400, detail="Administrator username is required")
    if len(username) < 3:
        raise HTTPException(status_code=400, detail="Username must be at least 3 characters")
    if not admin_data.password:
        raise HTTPException(status_code=400, detail="Password is required")
    if len(admin_data.password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")
    if admin_data.password != admin_data.confirm_password:
        raise HTTPException(status_code=400, detail="Password confirmation does not match")

    # Username uniqueness check (case-insensitive)
    existing_username = await db.users.find_one({
        "username": {"$regex": f"^{re.escape(username)}$", "$options": "i"}
    })
    if existing_username:
        raise HTTPException(status_code=400, detail="An account with this username already exists")

    # Email uniqueness check if provided
    email = admin_data.email.strip().lower() if admin_data.email and admin_data.email.strip() else None
    if email:
        existing_email = await db.users.find_one({"email": email})
        if existing_email:
            raise HTTPException(status_code=400, detail="An account with this email already exists")
    else:
        email = f"{username.lower()}@shadowmind.ai"

    # Strictly assign role="admin" via protected backend operation
    now = datetime.utcnow()
    new_admin_doc = {
        "username": username,
        "email": email,
        "hashed_password": get_password_hash(admin_data.password),
        "role": "admin",
        "full_name": (admin_data.full_name or "").strip() or f"Admin {username}",
        "bio": "ShadowMind Administrator Account",
        "avatar_url": None,
        "is_active": True,
        "is_verified": True,
        "created_at": now,
    }

    res = await db.users.insert_one(new_admin_doc)
    new_admin_doc["_id"] = res.inserted_id

    # Record security audit event
    audit_entry = {
        "action": "CREATE_ADMINISTRATOR",
        "performed_by": admin.username,
        "created_admin_username": username,
        "created_admin_id": str(res.inserted_id),
        "timestamp": now,
    }
    await db.admin_audit_logs.insert_one(audit_entry)
    logger.info("🛡️ Administrator '%s' created new administrator account '%s'", admin.username, username)

    return {
        "message": f"Administrator '{username}' successfully created",
        "administrator": {
            "id": str(res.inserted_id),
            "username": username,
            "email": email,
            "role": "admin",
            "full_name": new_admin_doc["full_name"],
            "created_at": now.isoformat(),
            "is_active": True,
        }
    }


# ─────────────────────────────────────────────────────────────────────────────
# 5. SYSTEM DIAGNOSTICS
# ─────────────────────────────────────────────────────────────────────────────
@router.get("/system")
async def get_system_diagnostics(
    admin: UserSession = Depends(get_current_admin),
    db=Depends(get_db),
):
    """System health and security diagnostics (Administrator access only)."""
    return {
        "server_status": "OPERATIONAL",
        "version": "4.0.0",
        "rbac_enforcement": "ACTIVE",
        "requesting_admin": admin.username,
        "timestamp": datetime.utcnow().isoformat(),
    }
