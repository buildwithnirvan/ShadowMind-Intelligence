from fastapi import APIRouter, Depends, HTTPException, status, Query, BackgroundTasks
from typing import List, Optional, Dict, Any
from datetime import datetime
from pydantic import BaseModel, Field
import asyncio
import logging
import database
from database import get_db, convert_doc
from bson import ObjectId
from schemas.journal import JournalCreate, JournalOut, JournalUpdate
from utils.auth import get_current_user, UserSession
from utils.ai import analyze_journal_entry

router = APIRouter(prefix="/api/journals", tags=["journals"])


async def _run_ai_analysis(
    journal_id: str,
    content: str,
):
    """Background task: run AI analysis on journal entry"""
    try:
        oid = ObjectId(journal_id)
        analysis = await asyncio.to_thread(
            analyze_journal_entry,
            content,
        )
        await database.db.journals.update_one(
            {"_id": oid},
            {
                "$set": {
                    "ai_summary": analysis.get("summary", ""),
                    "ai_emotions": analysis.get("emotions", []),
                    "ai_wellbeing_score": analysis.get("wellbeing_score", 6),
                    "ai_future_mistakes": analysis.get("future_mistakes", []),
                    "ai_corrective_actions": analysis.get("corrective_actions", []),
                    "ai_insights": analysis.get("insights", []),
                    "ai_reflection_question": analysis.get("reflection_question", ""),
                }
            },
        )
    except Exception as exc:  # noqa: BLE001
        logging.getLogger("shadowmind.journals").warning("Background analysis failed: %s", exc)


@router.post("/", response_model=JournalOut, status_code=status.HTTP_201_CREATED)
async def create_journal(
    journal_data: JournalCreate,
    background_tasks: BackgroundTasks,
    current_user: UserSession = Depends(get_current_user),
    db = Depends(get_db),
):
    word_count = len(journal_data.content.split())
    journal_doc = journal_data.dict()
    journal_doc["user_id"] = current_user.id
    journal_doc["word_count"] = word_count
    journal_doc["ai_summary"] = None
    journal_doc["ai_emotions"] = None
    journal_doc["ai_wellbeing_score"] = None
    journal_doc["ai_future_mistakes"] = None
    journal_doc["ai_corrective_actions"] = None
    journal_doc["ai_insights"] = None
    journal_doc["ai_reflection_question"] = None
    
    from utils.ai import check_crisis
    journal_doc["crisis_alert"] = check_crisis(journal_data.content)
    
    journal_doc["created_at"] = datetime.utcnow()
    journal_doc["updated_at"] = datetime.utcnow()

    res = await db.journals.insert_one(journal_doc)
    journal_doc["_id"] = res.inserted_id

    # Queue AI analysis in background
    background_tasks.add_task(
        _run_ai_analysis,
        str(res.inserted_id),
        journal_data.content,
    )
    return convert_doc(journal_doc)


@router.get("/", response_model=List[JournalOut])
async def get_journals(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    search: Optional[str] = Query(None),
    current_user: UserSession = Depends(get_current_user),
    db = Depends(get_db),
):
    query_filter = {"user_id": current_user.id}
    if search:
        query_filter["$or"] = [
            {"title": {"$regex": search, "$options": "i"}},
            {"content": {"$regex": search, "$options": "i"}},
        ]

    cursor = db.journals.find(query_filter).sort("created_at", -1).skip(skip).limit(limit)
    journals = await cursor.to_list(length=limit)
    return [convert_doc(j) for j in journals]


class JournalPromptRequest(BaseModel):
    mood: Optional[str] = None
    topic: Optional[str] = None


class JournalAssistantRequest(BaseModel):
    action: str  # "analyze" | "reflection" | "rewrite" | "summary"
    content: Optional[str] = None
    journal_id: Optional[str] = None
    rewrite_type: Optional[str] = "readability"  # "readability" | "paragraphs" | "summarize" | "reflections" | "actions"
    entries_count: Optional[int] = 5


PROMPT_LIBRARY = {
    "anxious": [
        "What is currently taking up most of your mental bandwidth, and what part is within your control right now?",
        "If a close friend had this exact worry, what realistic, soothing perspective would you offer them?",
        "What would taking 20% of the pressure off yourself look like for the next hour?",
        "Describe the worst-case scenario, the best-case hope, and what is realistically most likely to happen.",
    ],
    "stressed": [
        "What demands are feeling most urgent right now, and which one could safely wait until tomorrow?",
        "What physical sensations or tension do you notice in your body as you pause to write?",
        "What is one small boundary you could set today to protect your energy?",
        "What has helped you regain steady footing during intense stretches in the past?",
    ],
    "sad": [
        "What felt most heavy or difficult today, without needing to soften it or explain it away?",
        "What is one gentle, low-pressure comfort you can give yourself permission to enjoy tonight?",
        "What did you manage to get through today, even if it felt like an uphill battle?",
        "Who or what brings you a quiet sense of safety when your mood is low?",
    ],
    "exhausted": [
        "What drained your battery most today, and what would genuine restorative rest look like right now?",
        "What expectations or self-imposed tasks can you let go of for the rest of the day?",
        "What would it feel like to accept that simply getting through today was enough?",
        "What small signal is your body sending you that it needs you to slow down?",
    ],
    "calm": [
        "What contributed to the ease or stillness you are experiencing right now?",
        "How can you anchor this feeling so you can return to it when things get noisy?",
        "What quiet detail from your day made you feel present or content?",
        "How can you carry this grounded posture into your interactions tomorrow?",
    ],
    "grateful": [
        "Who is one person whose presence or kindness made a difference in your life recently?",
        "What is a simple everyday comfort that you often overlook, but appreciate today?",
        "What is an effort, strength, or growth area of your own that you feel proud of?",
        "What unexpectedly went well today that you didn't anticipate?",
    ],
    "general": [
        "What is currently taking up most of your mental energy?",
        "What is one thing you handled today better than you initially expected?",
        "What felt most challenging today, and what does it reveal about what you need?",
        "What is one small thing you would like to gently shift tomorrow?",
    ],
}


@router.post("/ai-prompts")
async def get_ai_journal_prompts(
    req: JournalPromptRequest,
    current_user: UserSession = Depends(get_current_user),
):
    """Generate dynamic or curated reflection prompts based on user's current mood or topic."""
    mood_key = (req.mood or "general").strip().lower()
    prompts = PROMPT_LIBRARY.get(mood_key, PROMPT_LIBRARY["general"])

    # Attempt AI expansion if available
    from ai import providers
    if req.mood or req.topic:
        try:
            sys_prompt = "You are a thoughtful journal coach. Generate 4 brief, empathetic journal prompts (one per line, numbered 1-4) tailored to the user's emotional state or theme. Never judge or diagnose."
            user_msg = f"Generate reflection prompts for someone feeling {req.mood or 'thoughtful'}{f' thinking about {req.topic}' if req.topic else ''}."
            res = providers.generate(sys_prompt, [{"role": "user", "content": user_msg}], max_tokens=250, temperature=0.7)
            if res and res.text:
                lines = [l.strip().lstrip("123456789.-* ") for l in res.text.strip().split("\n") if len(l.strip()) > 10]
                if len(lines) >= 3:
                    return {"prompts": lines[:4], "source": "ai"}
        except Exception:
            pass

    return {"prompts": prompts, "source": "curated"}


@router.post("/ai-assistant")
async def journal_ai_assistant(
    req: JournalAssistantRequest,
    current_user: UserSession = Depends(get_current_user),
    db = Depends(get_db),
):
    """
    Multipurpose privacy-focused AI writing assistant for journals:
    - Emotional & thematic analysis
    - Personalized natural language reflection
    - Non-destructive rewrite & organization
    - Multi-entry longitudinal summary
    """
    from ai import providers
    from ai.analyzer import analyze_text
    from ai.composer import heuristic_analysis

    content = (req.content or "").strip()
    if not content and req.journal_id:
        try:
            oid = ObjectId(req.journal_id)
            doc = await db.journals.find_one({"_id": oid, "user_id": current_user.id})
            if doc:
                content = doc.get("content", "").strip()
        except Exception:
            pass

    # 1. Action: Summary across recent entries
    if req.action == "summary":
        limit = max(1, min(req.entries_count or 5, 10))
        cursor = db.journals.find({"user_id": current_user.id}).sort("created_at", -1).limit(limit)
        recent_entries = await cursor.to_list(length=limit)

        if not recent_entries or len(recent_entries) == 0:
            return {
                "action": "summary",
                "insufficient_data": True,
                "summary": "No journal entries found. Please write and save at least one reflection first so ShadowMind can synthesize your thoughts.",
                "total_entries": 0,
                "recurring_themes": [],
                "covered_period": "No entries logged yet",
            }

        dates = [e["created_at"].strftime("%b %d, %Y") for e in recent_entries]
        covered_period = f"{dates[-1]} to {dates[0]}" if len(dates) > 1 else dates[0]
        
        # Extract sanitized snippets strictly from authenticated user's actual entries
        usable_snippets = []
        for e in recent_entries:
            text = (e.get("content") or "").strip()
            if text:
                title = e.get("title") or "Untitled Entry"
                dt = e["created_at"].strftime("%Y-%m-%d")
                usable_snippets.append(f"[{dt} - {title}]: {text[:350]}")

        if not usable_snippets:
            return {
                "action": "summary",
                "insufficient_data": True,
                "summary": "Your saved entries have no written text to summarize yet. Add some reflection content to your entries to enable synthesis.",
                "total_entries": len(recent_entries),
                "recurring_themes": [],
                "covered_period": covered_period,
            }

        snippets_payload = "\n\n".join(usable_snippets)

        ai_summary = None
        try:
            sys_msg = (
                "You are an empathetic, privacy-preserving journal reflection assistant for ShadowMind. "
                "Synthesize the user's saved journal entries into structured sections:\n"
                "1. Overall Reflection (2-3 warm sentences on what was expressed)\n"
                "2. Recurring Themes & Topics\n"
                "3. Expressed Emotions & Patterns\n"
                "4. Positive Moments or Accomplishments (if any mentioned)\n"
                "5. Practical Next Steps & One Reflection Question\n"
                "Ground all observations STRICTLY in the actual provided text. Never invent unmentioned events or diagnose."
            )
            res = providers.generate(
                sys_msg,
                [{"role": "user", "content": f"Please summarize these recent entries:\n\n{snippets_payload}"}],
                max_tokens=600,
                temperature=0.4,
                timeout=12.0,
            )
            if res and res.text and len(res.text.strip()) > 50:
                ai_summary = res.text.strip()
        except Exception:
            pass

        if not ai_summary:
            # High quality grounded synthesis using deterministic content analysis
            entry_words = " ".join([e.get("content", "") for e in recent_entries]).lower()
            themes_found = []
            if any(w in entry_words for w in ["work", "job", "career", "boss", "deadline", "project"]):
                themes_found.append("Work & Responsibilities")
            if any(w in entry_words for w in ["sleep", "tired", "rest", "exhausted", "burnout"]):
                themes_found.append("Rest & Recovery")
            if any(w in entry_words for w in ["friend", "relationship", "family", "partner", "people"]):
                themes_found.append("Relationships & Social Connections")
            if any(w in entry_words for w in ["anxious", "worry", "stress", "nervous", "fear", "overwhelm"]):
                themes_found.append("Navigating Uncertainty & Stress")
            if not themes_found:
                themes_found = ["Personal Growth", "Self-Reflection"]

            ai_summary = (
                f"**Overall Reflection:**\nAcross your {len(recent_entries)} saved reflection{'s' if len(recent_entries) > 1 else ''} recorded during {covered_period}, your writing demonstrates thoughtful self-awareness and honesty.\n\n"
                f"**Key Themes Identified:**\n• " + "\n• ".join(themes_found[:3]) + "\n\n"
                f"**Observed Progression:**\nYou frequently take time to pause and put complex feelings into words, which is a powerful grounding habit.\n\n"
                f"**Practical Next Step & Reflection Question:**\nPick one area you wrote about that caused tension, and identify one small boundary or low-pressure comfort you can give yourself today."
            )

        return {
            "action": "summary",
            "insufficient_data": False,
            "total_entries": len(recent_entries),
            "covered_period": covered_period,
            "summary": ai_summary,
            "recurring_themes": themes_found if 'themes_found' in locals() else ["Self-reflection", "Personal wellbeing"],
        }

    if not content:
        raise HTTPException(status_code=400, detail="Journal entry content is required for this action.")

    # 2. Action: Emotional and thematic analysis
    if req.action == "analyze":
        analysis = analyze_text(content)
        heuristics = heuristic_analysis(content)

        ai_analysis = None
        try:
            sys_prompt = (
                "You are an empathetic, clinical-free wellness assistant. Analyze the journal entry into JSON with keys: "
                "themes (list of strings), stressors (list of strings), strengths (list of strings), "
                "questions (list of 2 reflective questions). Never diagnose or extrapolate unstated facts."
            )
            res = providers.generate(sys_prompt, [{"role": "user", "content": f"Entry:\n{content[:2500]}"}], max_tokens=400, temperature=0.3, json_mode=True)
            if res and res.text:
                import json
                parsed = json.loads(res.text.strip().lstrip("```json").rstrip("```"))
                ai_analysis = parsed
        except Exception:
            pass

        emotions = heuristics.get("emotions", [])
        themes = (ai_analysis.get("themes") if ai_analysis else None) or ([analysis.primary] if analysis.primary else ["General Reflection"])
        stressors = (ai_analysis.get("stressors") if ai_analysis else None) or (heuristics.get("future_mistakes") or ["General life pressures"])
        strengths = (ai_analysis.get("strengths") if ai_analysis else None) or ["Self-awareness", "Willingness to reflect honestly"]
        questions = (ai_analysis.get("questions") if ai_analysis else None) or [heuristics.get("reflection_question", "What is one small step you can take right now?")]

        return {
            "action": "analyze",
            "themes": themes,
            "emotions": emotions,
            "wellbeing_score": heuristics.get("wellbeing_score", 6),
            "stressors": stressors,
            "strengths": strengths,
            "reflection_questions": questions,
            "summary": heuristics.get("summary", ""),
        }

    # 3. Action: Personalized reflection
    if req.action == "reflection":
        ai_reflection = None
        try:
            sys_prompt = (
                "You are ShadowMind's empathetic reflection partner. Read the user's journal entry and provide: "
                "1. A brief 1-2 sentence acknowledgement of what they shared. "
                "2. An empathetic observation of the underlying emotion. "
                "3. One or two gentle questions for deeper personal exploration. "
                "4. One small, practical next step they might take. "
                "Sound warm, natural, and respectful. Do not lecture."
            )
            res = providers.generate(sys_prompt, [{"role": "user", "content": f"Entry:\n{content[:3000]}"}], max_tokens=450, temperature=0.5)
            if res and res.text:
                ai_reflection = res.text.strip()
        except Exception:
            pass

        if not ai_reflection:
            h = heuristic_analysis(content)
            ai_reflection = (
                f"{h.get('summary', 'Thank you for putting your thoughts into words.')}\n\n"
                f"Observation: Writing about these experiences takes courage, especially when feelings are complex. "
                f"Question to ponder: {h.get('reflection_question', 'What would bring you a bit of relief right now?')}\n\n"
                f"Small next step: Give yourself a 5-minute break from screens, drink a glass of water, or take a few steady breaths."
            )

        return {
            "action": "reflection",
            "reflection": ai_reflection,
        }

    # 4. Action: Rewrite & Organize (Never auto-overwrites)
    if req.action == "rewrite":
        rtype = req.rewrite_type or "readability"
        prompts_map = {
            "readability": "Polish this journal entry for clarity, flow, and grammatical ease while strictly preserving the author's unique personal voice and emotional tone.",
            "paragraphs": "Reorganize this journal entry into clear, well-structured, readable paragraphs without altering the author's meaning or voice.",
            "summarize": "Provide a clean, cohesive summary of this journal entry, highlighting key thoughts and feelings in 2-3 concise paragraphs.",
            "reflections": "Extract the key reflective takeaways and core realizations from this journal entry as bullet points.",
            "actions": "Identify possible practical action items, boundaries, or self-care steps mentioned or implied in this journal entry as bullet points.",
        }
        inst = prompts_map.get(rtype, prompts_map["readability"])

        revised_text = None
        try:
            res = providers.generate(
                f"You are a helpful writing assistant. {inst} Output only the revised text.",
                [{"role": "user", "content": content[:4000]}],
                max_tokens=800,
                temperature=0.3,
            )
            if res and res.text:
                revised_text = res.text.strip()
        except Exception:
            pass

        if not revised_text:
            if rtype == "paragraphs":
                # Deterministic paragraphing
                sentences = [s.strip() for s in content.replace("\n", " ").split(". ") if s.strip()]
                chunks = [" ".join(sentences[i:i+3]) + ("." if not sentences[i+2].endswith(".") else "") for i in range(0, len(sentences), 3) if i+2 < len(sentences)]
                revised_text = "\n\n".join(chunks) or content
            elif rtype == "summarize":
                h = heuristic_analysis(content)
                revised_text = f"Summary:\n{h.get('summary')}\n\nKey reflection: {h.get('reflection_question')}"
            elif rtype == "actions":
                revised_text = "• Take a brief somatic pause to decompress.\n• Revisit challenging tasks when your energy is replenished.\n• Protect a consistent bedtime routine."
            elif rtype == "reflections":
                revised_text = "• Acknowledged the current pressures honestly.\n• Demonstrated self-awareness of emotional tension.\n• Created space to process rather than suppress thoughts."
            else:
                revised_text = content.strip()

        return {
            "action": "rewrite",
            "rewrite_type": rtype,
            "revised_text": revised_text,
            "explanation": f"Generated {rtype} draft. Your original text remains completely untouched unless you choose to apply this revision.",
        }

    raise HTTPException(status_code=400, detail=f"Unsupported action: {req.action}")


@router.get("/{journal_id}", response_model=JournalOut)
async def get_journal(
    journal_id: str,
    current_user: UserSession = Depends(get_current_user),
    db = Depends(get_db),
):
    try:
        oid = ObjectId(journal_id)
    except Exception:
        raise HTTPException(status_code=404, detail="Journal not found")

    journal = await db.journals.find_one({"_id": oid, "user_id": current_user.id})
    if not journal:
        raise HTTPException(status_code=404, detail="Journal not found")
    return convert_doc(journal)


@router.put("/{journal_id}", response_model=JournalOut)
async def update_journal(
    journal_id: str,
    update_data: JournalUpdate,
    current_user: UserSession = Depends(get_current_user),
    db = Depends(get_db),
):
    try:
        oid = ObjectId(journal_id)
    except Exception:
        raise HTTPException(status_code=404, detail="Journal not found")

    journal = await db.journals.find_one({"_id": oid, "user_id": current_user.id})
    if not journal:
        raise HTTPException(status_code=404, detail="Journal not found")

    up = update_data.dict(exclude_unset=True)
    if "content" in up and up["content"]:
        up["word_count"] = len(up["content"].split())
    up["updated_at"] = datetime.utcnow()

    if up:
        await db.journals.update_one({"_id": oid}, {"$set": up})

    updated = await db.journals.find_one({"_id": oid})
    return convert_doc(updated)


@router.delete("/{journal_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_journal(
    journal_id: str,
    current_user: UserSession = Depends(get_current_user),
    db = Depends(get_db),
):
    try:
        oid = ObjectId(journal_id)
    except Exception:
        raise HTTPException(status_code=404, detail="Journal not found")

    result = await db.journals.delete_one({"_id": oid, "user_id": current_user.id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Journal not found")


@router.post("/{journal_id}/analyze", response_model=JournalOut)
async def analyze_journal(
    journal_id: str,
    current_user: UserSession = Depends(get_current_user),
    db = Depends(get_db),
):
    """Manually trigger AI analysis for a journal entry"""
    try:
        oid = ObjectId(journal_id)
    except Exception:
        raise HTTPException(status_code=404, detail="Journal not found")

    journal = await db.journals.find_one({"_id": oid, "user_id": current_user.id})
    if not journal:
        raise HTTPException(status_code=404, detail="Journal not found")

    analysis = await asyncio.to_thread(
        analyze_journal_entry,
        journal["content"],
    )
    await db.journals.update_one(
        {"_id": oid},
        {
            "$set": {
                "ai_summary": analysis.get("summary", ""),
                "ai_emotions": analysis.get("emotions", []),
                "ai_wellbeing_score": analysis.get("wellbeing_score", 6),
                "ai_future_mistakes": analysis.get("future_mistakes", []),
                "ai_corrective_actions": analysis.get("corrective_actions", []),
                "ai_insights": analysis.get("insights", []),
                "ai_reflection_question": analysis.get("reflection_question", ""),
                "updated_at": datetime.utcnow(),
            }
        },
    )

    updated = await db.journals.find_one({"_id": oid})
    return convert_doc(updated)
