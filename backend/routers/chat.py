from fastapi import APIRouter, Depends, HTTPException, status, Query
from fastapi.responses import StreamingResponse
from typing import Dict, List, Optional
from datetime import datetime
import asyncio
import time
import json
import logging
from database import get_db, convert_doc
from bson import ObjectId
from schemas.chat import ChatSessionCreate, ChatSessionOut, ChatMessageOut, ChatRequest
from utils.auth import get_current_user, UserSession
from utils.ai import get_chat_reply, generate_chat_reply_stream_async, analyze_chat_session
from ai import providers

logger = logging.getLogger("shadowmind.perf")

router = APIRouter(prefix="/api/chat", tags=["chat"])


@router.get("/status")
async def ai_status(current_user: UserSession = Depends(get_current_user)):
    """Which AI engines are configured/reachable (used by the chat header badge)."""
    st = await asyncio.to_thread(providers.status)
    st["fallback"] = "offline"
    return st


@router.post("/sessions", response_model=ChatSessionOut, status_code=status.HTTP_201_CREATED)
async def create_session(
    session_data: ChatSessionCreate,
    current_user: UserSession = Depends(get_current_user),
    db = Depends(get_db),
):
    session_doc = {
        "user_id": current_user.id,
        "title": session_data.title or f"Session {session_data.session_type.title()}",
        "session_type": session_data.session_type,
        "is_active": True,
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow(),
    }
    res = await db.chat_sessions.insert_one(session_doc)
    session_doc["_id"] = res.inserted_id
    session_doc["messages"] = []
    return convert_doc(session_doc)


@router.get("/sessions", response_model=List[ChatSessionOut])
async def get_sessions(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    current_user: UserSession = Depends(get_current_user),
    db = Depends(get_db),
):
    cursor = (
        db.chat_sessions.find({"user_id": current_user.id})
        .sort([("updated_at", -1), ("created_at", -1)])
        .skip(skip)
        .limit(limit)
    )
    sessions = await cursor.to_list(length=limit)

    for s in sessions:
        session_id_str = str(s["_id"])
        msg_cursor = db.chat_messages.find({"session_id": session_id_str}).sort("created_at", 1)
        s["messages"] = [convert_doc(m) for m in await msg_cursor.to_list(length=None)]

    return [convert_doc(s) for s in sessions]


@router.get("/sessions/{session_id}", response_model=ChatSessionOut)
async def get_session(
    session_id: str,
    current_user: UserSession = Depends(get_current_user),
    db = Depends(get_db),
):
    try:
        oid = ObjectId(session_id)
    except Exception:
        raise HTTPException(status_code=404, detail="Session not found")

    session = await db.chat_sessions.find_one({"_id": oid, "user_id": current_user.id})
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    session_id_str = str(session["_id"])
    msg_cursor = db.chat_messages.find({"session_id": session_id_str}).sort("created_at", 1)
    session["messages"] = [convert_doc(m) for m in await msg_cursor.to_list(length=None)]

    return convert_doc(session)


@router.delete("/sessions/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_session(
    session_id: str,
    current_user: UserSession = Depends(get_current_user),
    db = Depends(get_db),
):
    try:
        oid = ObjectId(session_id)
    except Exception:
        raise HTTPException(status_code=404, detail="Session not found")

    session = await db.chat_sessions.find_one({"_id": oid, "user_id": current_user.id})
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    await db.chat_sessions.delete_one({"_id": oid})
    await db.chat_messages.delete_many({"session_id": session_id})


@router.post("/message")
async def send_message(
    chat_req: ChatRequest,
    current_user: UserSession = Depends(get_current_user),
    db = Depends(get_db),
):
    t_recv = time.time()
    logger.info("[PERF] Chat request started")
    message_text = chat_req.message.strip()
    if not message_text:
        raise HTTPException(status_code=422, detail="Message cannot be empty")

    # Fetch recent mood & session concurrently
    if chat_req.session_id:
        try:
            oid = ObjectId(chat_req.session_id)
        except Exception:
            raise HTTPException(status_code=404, detail="Session not found")
        mood_task = db.moods.find_one({"user_id": current_user.id}, projection={"score": 1, "label": 1}, sort=[("created_at", -1)])
        sess_task = db.chat_sessions.find_one({"_id": oid, "user_id": current_user.id})
        recent_mood_doc, session = await asyncio.gather(mood_task, sess_task)
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")
    else:
        recent_mood_doc = await db.moods.find_one({"user_id": current_user.id}, projection={"score": 1, "label": 1}, sort=[("created_at", -1)])
        session = {
            "user_id": current_user.id,
            "title": message_text[:50] + ("..." if len(message_text) > 50 else ""),
            "session_type": chat_req.session_type,
            "is_active": True,
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow(),
        }
        res = await db.chat_sessions.insert_one(session)
        session["_id"] = res.inserted_id

    wellness_ctx = {}
    if recent_mood_doc:
        wellness_ctx["recent_mood"] = {"score": recent_mood_doc.get("score"), "label": recent_mood_doc.get("label")}

    session_id_str = str(session["_id"])
    session_type = chat_req.session_type or session.get("session_type", "general")

    user_msg = {
        "session_id": session_id_str,
        "role": "user",
        "content": message_text,
        "created_at": datetime.utcnow(),
    }
    msg_res = await db.chat_messages.insert_one(user_msg)
    user_msg["_id"] = msg_res.inserted_id

    history_cursor = db.chat_messages.find({"session_id": session_id_str}, projection={"role": 1, "content": 1}).sort("created_at", -1).limit(20)
    history = await history_cursor.to_list(length=20)
    history.reverse()
    ai_messages = [{"role": m["role"], "content": m["content"]} for m in history]

    t_llm_start = time.time()
    reply = await asyncio.to_thread(get_chat_reply, ai_messages, session_type, 1024)
    t_llm_end = time.time()

    emotion = reply.analysis.to_public()
    ai_msg = {
        "session_id": session_id_str,
        "role": "assistant",
        "content": reply.text,
        "meta": reply.meta(),
        "created_at": datetime.utcnow(),
    }
    ai_res = await db.chat_messages.insert_one(ai_msg)
    ai_msg["_id"] = ai_res.inserted_id

    # Background async updates
    async def post_process():
        await db.chat_messages.update_one({"_id": user_msg["_id"]}, {"$set": {"emotion": emotion}})
        await db.chat_sessions.update_one(
            {"_id": session["_id"]},
            {"$set": {"updated_at": datetime.utcnow(), "last_crisis_level": max(reply.crisis_level, session.get("last_crisis_level", 0) or 0)}},
        )

    asyncio.create_task(post_process())

    t_total_ms = int((time.time() - t_recv) * 1000)
    logger.info("[PERF] Total chat time: %d ms", t_total_ms)

    return {
        "session_id": session_id_str,
        "user_message": {"id": str(user_msg["_id"]), "emotion": emotion},
        "message": {
            "id": str(ai_msg["_id"]),
            "role": "assistant",
            "content": reply.text,
            "created_at": ai_msg["created_at"].isoformat(),
            "meta": reply.meta(),
        },
        "crisis_alert": reply.crisis_level >= 2,
        "crisis_level": reply.crisis_level,
        "suggestions": reply.suggestions,
        "provider": reply.provider,
    }


@router.post("/message/stream")
async def send_message_stream(
    chat_req: ChatRequest,
    current_user: UserSession = Depends(get_current_user),
    db = Depends(get_db),
):
    t_recv = time.time()
    logger.info("[PERF] Chat request started")
    message_text = chat_req.message.strip()
    if not message_text:
        raise HTTPException(status_code=422, detail="Message cannot be empty")

    if chat_req.session_id:
        try:
            oid = ObjectId(chat_req.session_id)
        except Exception:
            raise HTTPException(status_code=404, detail="Session not found")
        mood_task = db.moods.find_one({"user_id": current_user.id}, projection={"score": 1, "label": 1}, sort=[("created_at", -1)])
        sess_task = db.chat_sessions.find_one({"_id": oid, "user_id": current_user.id})
        recent_mood_doc, session = await asyncio.gather(mood_task, sess_task)
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")
    else:
        recent_mood_doc = await db.moods.find_one({"user_id": current_user.id}, projection={"score": 1, "label": 1}, sort=[("created_at", -1)])
        session = {
            "user_id": current_user.id,
            "title": message_text[:50] + ("..." if len(message_text) > 50 else ""),
            "session_type": chat_req.session_type,
            "is_active": True,
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow(),
        }
        res = await db.chat_sessions.insert_one(session)
        session["_id"] = res.inserted_id

    wellness_ctx = {}
    if recent_mood_doc:
        wellness_ctx["recent_mood"] = {"score": recent_mood_doc.get("score"), "label": recent_mood_doc.get("label")}

    session_id_str = str(session["_id"])
    session_type = chat_req.session_type or session.get("session_type", "general")

    user_msg = {
        "session_id": session_id_str,
        "role": "user",
        "content": message_text,
        "created_at": datetime.utcnow(),
    }
    msg_res = await db.chat_messages.insert_one(user_msg)
    user_msg_id = str(msg_res.inserted_id)

    history_cursor = db.chat_messages.find({"session_id": session_id_str}, projection={"role": 1, "content": 1}).sort("created_at", -1).limit(10)
    history = await history_cursor.to_list(length=10)
    history.reverse()
    ai_messages = [{"role": m["role"], "content": m["content"]} for m in history]

    async def event_generator():
        t0 = time.time()
        final_meta = {}
        final_text = ""

        async for event in generate_chat_reply_stream_async(ai_messages, session_type, 1024, wellness_ctx):
            if event["type"] == "start":
                yield f"data: {json.dumps({'type': 'start', 'session_id': session_id_str, 'user_message_id': user_msg_id, 'meta': event['meta']})}\n\n"
            elif event["type"] == "delta":
                yield f"data: {json.dumps({'type': 'delta', 'text': event['text']})}\n\n"
            elif event["type"] == "done":
                final_text = event["text"]
                final_meta = event["meta"]
                total_time = int((time.time() - t_recv) * 1000)
                logger.info("[PERF] Total chat time: %d ms", total_time)

                ai_msg = {
                    "session_id": session_id_str,
                    "role": "assistant",
                    "content": final_text,
                    "meta": final_meta,
                    "created_at": datetime.utcnow(),
                }
                ai_res = await db.chat_messages.insert_one(ai_msg)
                
                async def post_stream_updates():
                    await db.chat_messages.update_one({"_id": msg_res.inserted_id}, {"$set": {"emotion": final_meta.get("emotion")}})
                    await db.chat_sessions.update_one(
                        {"_id": session["_id"]},
                        {"$set": {"updated_at": datetime.utcnow(), "last_crisis_level": max(final_meta.get("crisis_level", 0), session.get("last_crisis_level", 0) or 0)}},
                    )
                asyncio.create_task(post_stream_updates())

                yield f"data: {json.dumps({'type': 'done', 'session_id': session_id_str, 'message_id': str(ai_res.inserted_id), 'text': final_text, 'meta': final_meta, 'crisis_alert': final_meta.get('crisis_level', 0) >= 2, 'suggestions': final_meta.get('suggestions', [])})}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        }
    )



@router.post("/sessions/{session_id}/analyze", response_model=ChatSessionOut)
async def analyze_chat(
    session_id: str,
    current_user: UserSession = Depends(get_current_user),
    db = Depends(get_db),
):
    """Run wellness analysis on a chat session. Idempotent: re-running updates the
    auto-created mood + journal entries instead of duplicating them."""
    try:
        oid = ObjectId(session_id)
    except Exception:
        raise HTTPException(status_code=404, detail="Session not found")

    session = await db.chat_sessions.find_one({"_id": oid, "user_id": current_user.id})
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    msg_cursor = db.chat_messages.find({"session_id": session_id}).sort("created_at", 1)
    history = await msg_cursor.to_list(length=None)
    user_msgs = [m for m in history if m.get("role") == "user"]
    if not user_msgs:
        session["messages"] = [convert_doc(m) for m in history]
        return convert_doc(session)

    analysis = await asyncio.to_thread(analyze_chat_session, history)
    now = datetime.utcnow()
    wellbeing = analysis.get("wellbeing_score", 6)
    emotions = analysis.get("emotions", [])
    primary_emotion = emotions[0]["name"] if emotions else "Neutral"
    title = session.get("title", "Session")
    session_type = session.get("session_type", "general")

    await db.chat_sessions.update_one({"_id": oid}, {"$set": {
        "ai_emotions": emotions,
        "ai_wellbeing_score": wellbeing,
        "ai_future_mistakes": analysis.get("future_mistakes", []),
        "ai_corrective_actions": analysis.get("corrective_actions", []),
        "ai_summary": analysis.get("summary", ""),
        "ai_insights": analysis.get("insights", []),
        "ai_reflection_question": analysis.get("reflection_question", ""),
        "analyzed_at": now,
        "updated_at": now,
    }})

    mood_fields = {
        "score": wellbeing, "label": primary_emotion.lower(),
        "tags": ["chat-session", session_type], "updated_at": now,
        "notes": f"Auto-logged from chat: {title}",
    }
    word_count = sum(len(m.get("content", "").split()) for m in user_msgs)
    journal_fields = {
        "title": f"Chat reflection: {title}",
        "content": (analysis.get("summary") or "") + "\n\nReflection: " + (analysis.get("reflection_question") or ""),
        "mood_score": wellbeing, "tags": ["chat-log", session_type], "is_private": True, "word_count": word_count,
        "ai_summary": analysis.get("summary", ""), "ai_emotions": emotions, "ai_wellbeing_score": wellbeing,
        "ai_future_mistakes": analysis.get("future_mistakes", []),
        "ai_corrective_actions": analysis.get("corrective_actions", []),
        "ai_insights": analysis.get("insights", []),
        "ai_reflection_question": analysis.get("reflection_question", ""),
        "updated_at": now,
    }

    async def upsert(collection, id_field: str, base: Dict):
        existing_id = session.get(id_field)
        if existing_id:
            res = await collection.update_one({"_id": existing_id, "user_id": current_user.id}, {"$set": base})
            if res.matched_count:
                return existing_id
        doc = {**base, "user_id": current_user.id, "created_at": now}
        if collection.name == "moods":
            doc.update(energy_level=5.0, stress_level=5.0, sleep_hours=None)
        return (await collection.insert_one(doc)).inserted_id

    mood_id = await upsert(db.moods, "auto_mood_id", mood_fields)
    journal_id = await upsert(db.journals, "auto_journal_id", journal_fields)
    await db.chat_sessions.update_one({"_id": oid}, {"$set": {"auto_mood_id": mood_id, "auto_journal_id": journal_id}})

    updated_session = await db.chat_sessions.find_one({"_id": oid})
    updated_session["messages"] = [convert_doc(m) for m in history]
    return convert_doc(updated_session)
