from typing import List, Dict
from fastapi import APIRouter
from pydantic import BaseModel
from ai.analyzer import analyze_text

router = APIRouter(prefix="/api/sentiment", tags=["sentiment"])

_sentiment_cache: Dict[str, Dict] = {}


class SentimentRequest(BaseModel):
    text: str


class SentimentResponse(BaseModel):
    score: float                 # -1 (very negative) … +1 (very positive)
    primary_emotion: str
    intensity: float = 0.0
    crisis_level: int = 0
    emotions: List[Dict] = []


@router.post("/analyze", response_model=SentimentResponse)
async def analyze_sentiment(req: SentimentRequest):
    cleaned = (req.text or "").strip()
    if not cleaned:
        return {
            "score": 0.0,
            "primary_emotion": "Neutral",
            "intensity": 0.0,
            "crisis_level": 0,
            "emotions": [],
        }

    # In-memory fast-path lookup
    if cleaned in _sentiment_cache:
        return _sentiment_cache[cleaned]

    a = analyze_text(cleaned)
    res = {
        "score": a.valence,
        "primary_emotion": a.primary,
        "intensity": a.primary_intensity,
        "crisis_level": a.crisis_level,
        "emotions": a.emotions[:4],
    }

    if len(_sentiment_cache) > 1000:
        _sentiment_cache.clear()
    _sentiment_cache[cleaned] = res

    return res
