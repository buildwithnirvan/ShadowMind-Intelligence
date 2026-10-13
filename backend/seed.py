"""
seed.py — Populate the database with sample data for demos/testing.
Usage: python seed.py
"""
import sys, os
import asyncio
sys.path.insert(0, os.path.dirname(__file__))

from database import db, init_db
from utils.auth import get_password_hash
from datetime import datetime, timedelta
import random

MOOD_LABELS = ['anxious', 'calm', 'happy', 'sad', 'stressed', 'neutral', 'content', 'focused']


async def seed():
    await init_db()

    # Clean existing demo user
    existing = await db.users.find_one({"email": "demo@shadowmind.ai"})
    if existing:
        user_id_str = str(existing["_id"])
        await db.users.delete_one({"_id": existing["_id"]})
        await db.moods.delete_many({"user_id": user_id_str})
        await db.journals.delete_many({"user_id": user_id_str})
        await db.chat_sessions.delete_many({"user_id": user_id_str})
        await db.chat_messages.delete_many({"session_id": {"$regex": ".*"}})

    # Create demo user
    user_doc = {
        "email": "demo@shadowmind.ai",
        "username": "shadow_demo",
        "hashed_password": get_password_hash("demo1234"),
        "full_name": "Demo Operator",
        "bio": "This is a demo account for ShadowMind v3.",
        "is_active": True,
        "is_verified": False,
        "created_at": datetime.utcnow(),
    }
    res = await db.users.insert_one(user_doc)
    user_id = str(res.inserted_id)

    # Create 30 days of mood entries
    moods_to_insert = []
    for i in range(30):
        day = datetime.utcnow() - timedelta(days=30 - i)
        n = random.randint(1, 3)
        for _ in range(n):
            moods_to_insert.append({
                "user_id": user_id,
                "score": round(random.uniform(3.0, 9.5), 1),
                "label": random.choice(MOOD_LABELS),
                "energy_level": round(random.uniform(2.0, 9.0), 1),
                "stress_level": round(random.uniform(1.0, 8.0), 1),
                "sleep_hours": round(random.uniform(4.0, 9.0), 1),
                "notes": "Auto-generated demo entry.",
                "tags": random.sample(['work', 'family', 'health', 'exercise', 'sleep'], k=2),
                "created_at": day,
            })
    if moods_to_insert:
        await db.moods.insert_many(moods_to_insert)

    # Create 5 journal entries
    JOURNAL_SAMPLES = [
        ("Reflection on progress", "Today I took time to reflect on how far I've come. The journey hasn't been easy, but I'm starting to see small improvements in how I handle stress."),
        ("Morning thoughts", "Woke up early and felt unusually calm. Tried the box breathing exercise and it really helped center me before the day began."),
        ("Difficult day", "Today was hard. Work was overwhelming and I felt like I couldn't keep up. I need to remember to take breaks and not let the pressure build up."),
        ("Gratitude entry", "Three things I'm grateful for today: the morning coffee, a good conversation with a friend, and the fact that I'm actively working on myself."),
        ("Week review", "Looking back at this week — I logged my mood every day, which I'm proud of. I noticed I feel best on mornings I exercise."),
    ]
    journals_to_insert = []
    for title, content in JOURNAL_SAMPLES:
        journals_to_insert.append({
            "user_id": user_id,
            "title": title,
            "content": content,
            "word_count": len(content.split()),
            "tags": ['demo', 'reflection'],
            "is_private": True,
            "created_at": datetime.utcnow() - timedelta(days=random.randint(1, 25)),
            "updated_at": datetime.utcnow(),
        })
    if journals_to_insert:
        await db.journals.insert_many(journals_to_insert)

    # Create a sample chat session
    session_doc = {
        "user_id": user_id,
        "title": "First session with Shadow",
        "session_type": "general",
        "is_active": True,
        "created_at": datetime.utcnow() - timedelta(days=3),
        "updated_at": datetime.utcnow() - timedelta(days=3),
    }
    sess_res = await db.chat_sessions.insert_one(session_doc)
    session_id = str(sess_res.inserted_id)

    msgs = [
        ("user", "Hi Shadow, I've been feeling really anxious lately."),
        ("assistant", "I hear you, and I'm glad you reached out. Anxiety can feel overwhelming, but you're not alone in this. Can you tell me a bit more about what's been triggering these feelings?"),
        ("user", "Mostly work stress. Deadlines are piling up and I can't seem to switch off."),
        ("assistant", "That sounds exhausting — when your mind can't find an off switch, it takes a real toll. Let's try something together: can you take one slow breath in for 4 counts, hold for 4, and out for 4? That's a start toward giving your nervous system a moment of calm."),
    ]
    msgs_to_insert = []
    for role, content in msgs:
        msgs_to_insert.append({
            "session_id": session_id,
            "role": role,
            "content": content,
            "created_at": datetime.utcnow() - timedelta(days=3, minutes=random.randint(0, 30))
        })
    if msgs_to_insert:
        await db.chat_messages.insert_many(msgs_to_insert)

    print("[OK] Seed complete!")
    print("   Email: demo@shadowmind.ai")
    print("   Password: demo1234")

if __name__ == "__main__":
    asyncio.run(seed())
