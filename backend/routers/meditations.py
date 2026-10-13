from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime
from utils.auth import get_current_user, UserSession
from utils.ai import get_ai_response
from database import get_db, convert_doc
import asyncio
import re

router = APIRouter(prefix="/api/meditations", tags=["meditations"])

class GenerateMeditationRequest(BaseModel):
    duration_minutes: int = Field(5, ge=1, le=30)
    focus_area: str = Field(..., min_length=2)
    experience_level: Optional[str] = "beginner"
    guidance_style: Optional[str] = "calm"

class MeditationResponse(BaseModel):
    title: str
    script: str
    duration: int
    focus_area: str
    stages: List[str]
    is_fallback: bool = False

class CompleteMeditationRequest(BaseModel):
    title: str
    duration_minutes: int
    focus_area: str
    elapsed_seconds: int

@router.post("/generate", response_model=MeditationResponse)
async def generate_meditation(
    req: GenerateMeditationRequest,
    current_user: UserSession = Depends(get_current_user)
):
    if not req.focus_area or not req.focus_area.strip():
        raise HTTPException(status_code=400, detail="Please select a meditation focus area.")

    prompt = (
        f"Generate a {req.duration_minutes}-minute guided meditation script focusing on {req.focus_area}. "
        f"Target audience: {req.experience_level or 'all levels'}. Tone: {req.guidance_style or 'calm and supportive'}. "
        "Provide a short title on the first line. The remaining lines should be the guided script with 4 to 6 distinct guidance stages separated by blank lines and pacing cues like [Pause 10 seconds]. "
        "Structure into opening breath awareness, somatic grounding, core reflection, and gentle closing. "
        "No intro or outro conversational filler, just the title on the first line, then blank line, then the script."
    )
    
    messages = [{"role": "user", "content": prompt}]
    
    ai_text = None
    is_fallback = False
    try:
        from ai import providers
        from ai.prompts import system_prompt_for
        res = await asyncio.to_thread(
            providers.generate,
            system_prompt_for("meditation_guide"),
            messages,
            max_tokens=600,
            temperature=0.7,
            timeout=12.0,
        )
        if res and res.text and len(res.text.strip()) > 40:
            ai_text = res.text.strip()
    except Exception:
        ai_text = None

    if not ai_text:
        from ai.composer import meditation_fallback
        fb = meditation_fallback(req.duration_minutes, req.focus_area)
        title = fb["title"]
        script = fb["script"]
        is_fallback = True
    else:
        parts = ai_text.strip().split("\n", 1)
        if len(parts) > 1 and len(parts[0].strip()) < 80:
            title = parts[0].strip().replace("**", "").replace("#", "").strip()
            script = parts[1].strip()
        else:
            title = f"Meditation for {req.focus_area.title()}"
            script = ai_text.strip()
        is_fallback = False

    # Split script into distinct guidance stages
    raw_paragraphs = [p.strip() for p in script.split("\n\n") if p.strip()]
    if not raw_paragraphs or len(raw_paragraphs) == 1:
        raw_paragraphs = [p.strip() for p in script.split("\n") if len(p.strip()) > 15]

    stages = []
    for p in raw_paragraphs:
        cleaned = re.sub(r"\[Pause[^\]]*\]", "", p).strip()
        if cleaned:
            stages.append(cleaned)
    if not stages:
        stages = [script or "Begin by taking a slow, steady breath in through your nose, and releasing it gently."]

    return {
        "title": title,
        "script": script,
        "duration": req.duration_minutes,
        "focus_area": req.focus_area,
        "stages": stages,
        "is_fallback": is_fallback,
    }

@router.post("/complete", status_code=status.HTTP_201_CREATED)
async def complete_meditation(
    req: CompleteMeditationRequest,
    current_user: UserSession = Depends(get_current_user),
    db = Depends(get_db),
):
    session_doc = {
        "user_id": current_user.id,
        "title": req.title,
        "duration_minutes": req.duration_minutes,
        "focus_area": req.focus_area,
        "elapsed_seconds": req.elapsed_seconds,
        "completed_at": datetime.utcnow(),
    }
    res = await db.meditation_sessions.insert_one(session_doc)
    session_doc["_id"] = res.inserted_id
    return convert_doc(session_doc)

