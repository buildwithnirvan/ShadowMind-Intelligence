from fastapi import APIRouter, Depends
from datetime import datetime, timedelta
from utils.auth import get_current_user, UserSession
from database import get_db

router = APIRouter(prefix="/api/doctors", tags=["doctors"])

SPECIALISTS = [
    {"id":"therapist","specialty":"Psychotherapist / Counsellor","icon":"🧠",
     "mood_triggers":["anxious","depressed","overwhelmed","sad","angry","numb"],"score_threshold":6.5,
     "why_template":"Based on your {dominant} patterns and avg mood of {avg}/10, talking therapy could build lasting coping tools.",
     "helps_with":["Depression & low mood","Anxiety & worry","Life transitions","Relationship difficulties","Grief & loss","Trauma"],
     "prepare":["Write down 3 things you want the therapist to understand","Note when symptoms are worst","Be honest — no wrong answers","It's OK if the first therapist isn't the right fit"],
     "modalities":"CBT, DBT, ACT, Person-centred","urgency":"Within 2–4 weeks","color":"#4488ff"},
    {"id":"psychiatrist","specialty":"Psychiatrist","icon":"⚕️",
     "mood_triggers":["depressed"],"score_threshold":3.5,
     "why_template":"Sustained low scores ({avg}/10) suggest a medical evaluation may be beneficial alongside therapy.",
     "helps_with":["Severe depression","Bipolar disorder","Medication management","ADHD","OCD"],
     "prepare":["List all current medications","Note sleep patterns and appetite changes","Bring a trusted person if possible","Prepare a symptom timeline"],
     "modalities":"Medication + therapy combination","urgency":"Within 1–2 weeks","color":"#e74c3c"},
    {"id":"gp","specialty":"General Practitioner (GP)","icon":"🩺",
     "mood_triggers":["stressed","exhausted","anxious"],"score_threshold":7.0,
     "why_template":"Chronic stress at {avg}/10 average can manifest physically. A GP can rule out thyroid, hormonal, and medical causes.",
     "helps_with":["Ruling out physical causes","Sleep disorders","Stress-related illness","Referral coordination"],
     "prepare":["Note physical symptoms alongside mood","List your current sleep schedule","Mention duration of symptoms"],
     "modalities":"Assessment, referral, basic treatment","urgency":"Within 1–2 weeks","color":"#27ae60"},
    {"id":"mindfulness_coach","specialty":"Mindfulness / Wellness Coach","icon":"🧘",
     "mood_triggers":["stressed","overwhelmed","anxious"],"score_threshold":10.0,
     "why_template":"Structured mindfulness has strong evidence for reducing stress up to 40%. A coach provides accountability.",
     "helps_with":["Stress management","Emotional regulation","Focus & productivity","Burnout prevention"],
     "prepare":["Try 5 min of breathing today","Note your biggest stress triggers","Set a realistic time commitment"],
     "modalities":"MBSR, guided meditation, breathwork, somatic practices","urgency":"Whenever ready","color":"#f39c12"},
]

@router.get("/")
async def get_recommendations(current_user: UserSession = Depends(get_current_user), db=Depends(get_db)):
    since = datetime.utcnow() - timedelta(days=30)
    cursor = db.moods.find({"user_id": current_user.id, "created_at": {"$gte": since}}).sort("created_at",-1).limit(50)
    moods = [m async for m in cursor]
    scores = [m.get("score",5) for m in moods]
    avg = sum(scores)/len(scores) if scores else 7.0
    from collections import Counter
    labels = [m.get("label","") for m in moods]
    dominant = [d[0] for d in Counter(labels).most_common(3)]
    recs = []
    for s in SPECIALISTS:
        if any(t in labels for t in s["mood_triggers"]) or avg <= s["score_threshold"]:
            why = s["why_template"].format(avg=round(avg,1), dominant=dominant[0] if dominant else "mixed")
            recs.append({**s,"why":why,"match_strength":"Strong" if avg<s["score_threshold"] else "Suggested"})
    if not any(r["id"]=="mindfulness_coach" for r in recs):
        s=next(x for x in SPECIALISTS if x["id"]=="mindfulness_coach")
        recs.append({**s,"why":s["why_template"].format(avg=round(avg,1),dominant=dominant[0] if dominant else "wellness"),"match_strength":"Suggested"})
    return {"recommendations":recs,"avg_mood":round(avg,2),"based_on":len(moods),
            "disclaimer":"ShadowMind recommends medical specialties, not individual doctors. Always consult a qualified healthcare professional."}


from services.places_service import (
    CATEGORY_DEFINITIONS,
    NearbySearchRequest,
    NearbySearchResponse,
    execute_nearby_search,
)


@router.get("/categories")
async def get_categories():
    """Return supported directory search categories."""
    return {
        "categories": [
            {
                "id": k,
                "label": v["label"],
                "crisis_relevant": v["crisis_relevant"],
            }
            for k, v in CATEGORY_DEFINITIONS.items()
        ]
    }


@router.post("/nearby", response_model=NearbySearchResponse)
async def find_nearby_doctors(
    payload: NearbySearchRequest,
    current_user: UserSession = Depends(get_current_user),
):
    """
    Search for nearby clinical facilities and practitioners using OpenStreetMap data (Overpass API & Nominatim).
    No API key required. Accepts latitude, longitude, search radius, validated category, or manual query fallback.
    """
    return await execute_nearby_search(payload, client_id=str(current_user.id))
