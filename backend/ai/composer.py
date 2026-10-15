"""
Offline composer. Produces considered, emotion-aware replies with no network
and no API keys. Used as the last-resort fallback and as the quality floor.
Replies are deterministic per (message, turn) but never repeat a recent line.
"""
import hashlib
import re
from typing import Dict, List, Optional

from .analyzer import TextAnalysis, analyze_text
from .resources import CRISIS_FOOTER

# ─────────────────────────────────────────────────────────────────────────────
# helpers
# ─────────────────────────────────────────────────────────────────────────────
def _seed(*parts: object) -> int:
    return int(hashlib.md5("|".join(map(str, parts)).encode()).hexdigest()[:8], 16)


def _pick(options: List[str], seed: int, recent: List[str]) -> str:
    """Pick deterministically, skipping anything already said recently."""
    blob = " ".join(recent).lower()
    for i in range(len(options)):
        cand = options[(seed + i) % len(options)]
        if cand[:38].lower() not in blob:
            return cand
    return options[seed % len(options)]


THEME_PHRASE = {
    "studies": "the pressure around studies and exams",
    "work": "the pressure at work",
    "sleep": "the lack of good sleep",
    "relationships": "what's happening in your relationship",
    "family": "things at home with your family",
    "friends": "what's going on with your friends",
    "health": "how your body and health have been",
    "money": "the money worries",
    "self-worth": "the harsh way you're judging yourself",
}

OPENERS: Dict[str, Dict[str, List[str]]] = {
    "Sadness": {
        "high": ["I'm really sorry it feels this heavy right now, and thank you for putting it into words.",
                 "That sounds genuinely painful, and you don't have to make it sound smaller than it is here.",
                 "I hear how low things are, and I'm here with you in it."],
        "low": ["It sounds like today has been weighing on you.", "That sounds like a rough stretch.",
                "I can hear the sadness in that."],
    },
    "Anxiety": {
        "high": ["That sounds like a lot of tension to carry, and it makes sense that you feel on edge.",
                 "It sounds like your mind and body are both on high alert right now."],
        "low": ["It sounds like something is keeping your mind busy.", "I can hear some worry in that."],
    },
    "Fear": {
        "high": ["That sounds frightening, and it took something to say it out loud rather than carry it silently."],
        "low": ["That sounds unsettling.", "It makes sense to feel uneasy about that."],
    },
    "Anger": {
        "high": ["I can hear how angry and worn down you are, and that reaction makes sense.",
                 "That sounds infuriating, and your frustration is valid."],
        "low": ["That sounds really frustrating.", "I can hear the irritation in that."],
    },
    "Guilt": {
        "high": ["It sounds like you're carrying a lot of guilt, and that weighs heavily."],
        "low": ["It sounds like this has been sitting on your conscience."],
    },
    "Shame": {
        "high": ["That sounds like a really painful way to see yourself, and I'm sorry you're in that place.",
                 "Thank you for trusting me with something that hurts this much."],
        "low": ["It sounds like you're being hard on yourself."],
    },
    "Loneliness": {
        "high": ["Feeling that alone is really hard, and it matters that you reached out here.",
                 "That sounds lonely, and I'm here with you right now."],
        "low": ["It sounds like you've been feeling disconnected."],
    },
    "Overwhelm": {
        "high": ["That sounds like too much for one person to hold at once.",
                 "It sounds like everything is landing on you at the same time."],
        "low": ["It sounds like your plate is very full."],
    },
    "Apathy": {
        "high": ["That flat, drained feeling is exhausting in its own way, and I'm sorry you're in it.",
                 "It sounds like you're running on empty."],
        "low": ["It sounds like your energy has been low."],
    },
}

INSIGHTS: Dict[str, List[str]] = {
    "Sadness": ["Low mood often brings a kind of fog: sleep, appetite and motivation shift, and everything costs more effort than it should.",
                "Sadness tends to tell us something matters; it isn't a sign that you're weak."],
    "Anxiety": ["Anxiety makes every possible outcome feel certain. Your body is treating a worry like an emergency.",
                "Worry usually eases a little once it's turned from a vague cloud into one specific problem."],
    "Fear": ["Fear shrinks our sense of what we can handle, but we usually cope better than we predict."],
    "Anger": ["Anger is often a signal that a boundary, value or need has been crossed."],
    "Guilt": ["Guilt shows you care about doing right, but it can turn into a harsher judge than you'd ever be to a friend."],
    "Shame": ["Guilt says 'I did something bad'; shame says 'I am bad'. The second one is the one that lies."],
    "Loneliness": ["Loneliness isn't a flaw. It's your mind signalling a need for connection."],
    "Overwhelm": ["When everything lands at once the mind can't rank it, and making things smaller usually helps more than pushing harder."],
    "Apathy": ["Feeling numb or flat is often what a worn-out mind does to protect itself. It doesn't mean something is wrong with you."],
}

QUESTIONS: Dict[str, List[str]] = {
    "Sadness": ["What has been the heaviest part of it?", "When did you first start feeling this way?",
                "Is there something specific behind it, or does it feel more like a general weight?"],
    "Anxiety": ["What's the worry your mind keeps circling back to?", "Where do you feel it in your body right now?",
                "If you had to name the one thing you're most afraid will happen, what would it be?"],
    "Fear": ["What feels most frightening about it?", "What would help you feel even slightly safer right now?"],
    "Anger": ["What do you need most right now: to vent, to problem-solve, or simply to be heard?",
              "What part of this felt the most unfair?"],
    "Guilt": ["If a close friend had done the same thing, what would you say to them?",
              "What would making amends, or forgiving yourself, look like?"],
    "Shame": ["What's the harshest thing your mind is saying about you right now?",
              "Whose voice does that criticism sound like?"],
    "Loneliness": ["Is there one person, even a distant one, you'd feel okay messaging today?",
                   "When did you last feel properly connected to someone?"],
    "Overwhelm": ["If you could take just one thing off your plate today, what would it be?",
                  "What's the one thing that feels most urgent, and what could wait?"],
    "Apathy": ["When did things start to feel this flat?", "Is there anything, even something tiny, that still feels okay?"],
}

POSITIVE_REPLIES: Dict[str, List[str]] = {
    "Joy": ["That's really good to hear. What's been the best part?", "I love hearing that. What do you think made the difference?"],
    "Gratitude": ["That's a lovely thing to notice. What are you most thankful for right now?"],
    "Hope": ["It's good to hear things are lifting. What do you think has helped the most?"],
    "Calm": ["I'm glad you're feeling settled. What's helping you feel that way today?"],
}


# ─────────────────────────────────────────────────────────────────────────────
# chat composer
# ─────────────────────────────────────────────────────────────────────────────
def _theme_sentence(a: TextAnalysis) -> str:
    if a.themes and a.is_negative:
        ph = THEME_PHRASE.get(a.themes[0])
        if ph:
            return f"{ph[0].upper()}{ph[1:]} seems to be part of what's weighing on you."
    return ""


def _depressed_reply(recent: List[str], a: TextAnalysis, ctx: TextAnalysis) -> str:
    blob = " ".join(recent).lower()
    asked_before = "how long" in blob or "two weeks" in blob
    if not asked_before:
        return ("I'm really sorry it feels that heavy, and thank you for telling me. "
                "\"Depressed\" can mean different things for different people: a flat or empty mood, no energy, "
                "losing interest in things you usually enjoy, or just feeling stuck.\n\n"
                "What has it been like for you lately, and how long has it felt this way? "
                "Sleep, appetite and energy are good places to start.")
    lasted = re.search(r"\b(month|months|weeks|year|years|long time|ages|since)\b", a.text, re.I)
    lead = ("Thank you for sharing that. Since it has been going on for a while, " if lasted else "Thank you for sharing more. If it has lasted more than about two weeks, or ")
    if lasted:
        body = ("it's really worth talking to a doctor or counsellor. Depression is common and very treatable, and you deserve "
                "proper support rather than pushing through alone.")
    else:
        body = ("it's getting in the way of daily life, it's worth talking to a doctor or counsellor. Depression is common and treatable, "
                "and you deserve proper support.")
    return (f"{lead}{body}\n\nThe PHQ-9 check-in in this app can give you something concrete to bring to them. "
            "Would you like to try it, or keep talking first?")


def _help_seeking_reply(recent: List[str]) -> str:
    return ("That sounds like a really good step, and it shows how seriously you're taking your own wellbeing. "
            "A counsellor or doctor can offer things I can't, like a proper assessment and ongoing support. "
            "The Find a professional page lists options, and the PHQ-9 check-in can help you put what you've been feeling into words.\n\n"
            "What feels like the hardest part about reaching out?")


def _crisis_reply(a: TextAnalysis, recent: List[str]) -> str:
    said_before = any("are you thinking about ending your life" in r.lower() for r in recent)
    if a.crisis_level >= 2 and not said_before:
        return ("Thank you for telling me. That took courage, and I'm taking it seriously. You are not alone in this, "
                "and I'm here with you right now.\n\n"
                "Are you thinking about ending your life, and are you safe where you are at this moment? "
                "If someone you trust is nearby, please consider letting them know how you feel.\n\n" + CRISIS_FOOTER)
    if a.crisis_level >= 2:
        return ("I'm still here with you. Right now the most important thing is your safety. "
                "If there's anything nearby you could use to hurt yourself, could you put some distance between you and it, "
                "or move to a room where someone else is?\n\n"
                "Would you be willing to call or message one person right now, or contact a helpline so you're not alone with this? "
                "Is there someone I can help you think of?\n\n" + CRISIS_FOOTER)
    return ("It sounds like you're in a really dark place, and I'm taking that seriously. When things feel this hopeless, "
            "thoughts of not wanting to be here can come up. Have you had any thoughts of ending your life? "
            "You can be completely honest with me.\n\n"
            "If it ever feels like too much, Tele-MANAS (14416, free, 24/7) is there to talk.")


def _cbt_reply(user_turns: int, a: TextAnalysis, seed: int, recent: List[str]) -> str:
    empathy = ""
    if a.is_negative and a.primary in OPENERS:
        empathy = _pick(OPENERS[a.primary]["high" if a.primary_intensity >= 5.5 else "low"], seed, recent) + "\n\n"

    # If the user's message is very short or a greeting with no context yet, ask one clarifying question
    if a.word_count < 5 and user_turns <= 1 and not a.is_negative:
        return (
            "I'm here to work through whatever is on your mind. "
            "What is a recent situation or troubling thought that's been bothering you lately?"
        )

    # When context is provided (either in turn 1 with enough words, or in subsequent turns), provide structured CBT solutions!
    emotion = a.primary if a.primary else "distress"
    theme = a.themes[0] if a.themes else "this situation"

    # Plausible thinking trap detection based on text patterns
    lower_text = a.text.lower()
    if any(k in lower_text for k in ["always", "never", "ruined", "worthless", "complete failure"]):
        trap = "All-or-Nothing Thinking (viewing the outcome in black-and-white extremes)"
        alt_thought = "Even if parts of this did not go as hoped, it does not define the entire outcome or your worth."
    elif any(k in lower_text for k in ["they hate", "they think", "they ignored", "people think", "everybody thinks"]):
        trap = "Mind-Reading (assuming you know what others are thinking without direct evidence)"
        alt_thought = "People's reactions often stem from their own stress, distractions, or circumstances rather than a judgment about you."
    elif any(k in lower_text for k in ["worst", "disaster", "catastrophe", "doomed", "end of"]):
        trap = "Catastrophizing (anticipating the worst possible scenario)"
        alt_thought = "While this is uncomfortable and challenging, the most likely reality is manageable and survivable."
    elif any(k in lower_text for k in ["my fault", "blame myself", "i ruined", "i should have"]):
        trap = "Excessive Self-Blame (holding yourself solely responsible for factors beyond your control)"
        alt_thought = "Many factors influence situations; take responsibility only for what is truly yours to own, and release the rest."
    else:
        trap = "Overgeneralization or Negative Filtering (focusing predominantly on the painful aspect)"
        alt_thought = "This is a difficult moment, but it is one specific chapter, not the entire picture."

    response_parts = [
        f"{empathy}Let's break down this situation together using a structured, practical approach:\n",
        f"**1. Situation & Emotional Summary:**\n"
        f"You are experiencing understandable {emotion.lower()} regarding {theme}. It makes complete sense that this stirred up tension.",
        f"\n**2. Possible Trigger Points:**\n"
        f"The primary trigger appears to be the gap between what you expected and what occurred, compounded by the automatic thought that immediately followed.",
        f"\n**3. Thinking Pattern to Examine:**\n"
        f"Notice whether **{trap}** might be amplifying the distress here. You don't have to force yourself to change your feelings, but testing whether that thought is 0 to 100% true (or somewhere in between) can create breathing room.",
        f"\n**4. Alternative Perspective:**\n"
        f"Consider this balanced possibility: *\"{alt_thought}\"*",
        f"\n**5. Practical Solutions:**\n"
        f"• **Separate the facts from the assumptions:** Write down what was physically observed versus what your mind added.\n"
        f"• **Pause the urge to over-analyze:** Give yourself permission not to solve or predict the whole future right now.\n"
        f"• **Focus on what is in your direct control:** Direct your energy toward your next immediate task.",
        f"\n**6. One Immediate Action:**\n"
        f"Step away from the situation for 5 minutes, take three slow breaths (in for 4, out for 6), and drink a glass of water.",
        f"\n**7. Next Step:**\n"
        f"How does that alternative perspective land with you? Does it feel plausible, or does another part of the situation feel heavier?"
    ]
    return "\n".join(response_parts)


def _mindfulness_reply(user_turns: int) -> str:
    steps = [
        "Let's slow down together. Breathe in through your nose for 4, hold for 4, out through your mouth for 4, hold for 4. Repeat this four times, and let your shoulders drop as you go. What do you notice afterwards?",
        "Nice. Now let's anchor in your senses: name 5 things you can see, 4 you can feel, 3 you can hear, 2 you can smell and 1 you can taste. Take your time. Which was easiest to find?",
        "Let's scan your body. Start at your feet, and slowly move attention up through your legs, stomach, chest, shoulders and face. Wherever you find tension, breathe toward it. Where did you feel the most?",
    ]
    if user_turns <= len(steps):
        return steps[user_turns - 1]
    return "You're doing well. Compare how your body feels now with when we started. Even a small shift counts. Would you like to continue with another round, or talk about what's on your mind?"


KNOWLEDGE = [
    (re.compile(r"\b(sql|join|joins)\b", re.I),
     "In SQL, a JOIN clause is used to combine rows from two or more tables based on a related column between them.\n\n"
     "The 4 primary join types are:\n"
     "• INNER JOIN: Returns records that have matching values in both tables.\n"
     "• LEFT JOIN: Returns all records from the left table, and the matched records from the right table (NULL if no match).\n"
     "• RIGHT JOIN: Returns all records from the right table, and the matched records from the left table.\n"
     "• FULL OUTER JOIN: Returns all records when there is a match in either left or right table.",
     "Would you like an example SQL query showing how to write one of these joins?"),
    (re.compile(r"\b(importerror|import error|module not found|python import)\b", re.I),
     "An ImportError in Python occurs when Python cannot find or load the module or symbol you are attempting to import.\n\n"
     "Here are the most common causes and how to resolve them:\n"
     "1. Package not installed: Run `pip install <package_name>` in your terminal.\n"
     "2. Virtual environment mismatch: Ensure your active environment matches where the package was installed.\n"
     "3. Circular dependency: Check if module A imports module B while module B also imports module A.\n"
     "4. File name conflict: Ensure you don't have a local script named the same as an installed module.",
     "What is the exact import statement or traceback you are encountering?"),
    (re.compile(r"\b(anxi\w*|panic|worry|nervous)\b", re.I),
     "A quick way to calm anxiety in the moment is to lengthen your exhale: breathe in for 4 and out for 6 to 8, for about two minutes. "
     "That signals your body that the danger has passed. Longer term, turning the vague worry into one specific problem and one small next step usually shrinks it.",
     "Would you like me to guide you through a breathing round now, or talk about what's behind it?"),
    (re.compile(r"\b(sleep|insomnia|can'?t sleep)\b", re.I),
     "For sleep, a few things help most: a fixed wake-up time, no screens for the last 30 to 60 minutes, and a short 'brain dump' on paper so your mind isn't holding tomorrow's list. "
     "If you're awake for more than 20 minutes, get up and do something quiet until you feel sleepy.",
     "What does your night usually look like: trouble falling asleep, or waking up in the night?"),
    (re.compile(r"\b(depress\w*|low mood|sad)\b", re.I),
     "Low mood and depression are common and very treatable. Small anchors help: a regular sleep schedule, a short daily walk, contact with one person, and tiny goals you can actually finish. "
     "If it has lasted over two weeks or affects daily life, please do speak with a doctor or counsellor.",
     "What has felt hardest lately?"),
    (re.compile(r"\b(stress\w*|exam\w*|pressure|burn\w*)\b", re.I),
     "With stress, it helps to separate what's in your control from what isn't, then pick just one thing for the next 25 minutes. "
     "Short breaks and movement do more for focus than pushing through.",
     "What's the one thing causing the most pressure right now?"),
    (re.compile(r"\b(lonel\w*|friends|alone)\b", re.I),
     "Loneliness usually eases through small, low-stakes contact rather than big gestures: a message, a short call, a shared activity. "
     "It's also common, far more than people admit.",
     "Is there one person you'd feel okay reaching out to?"),
    (re.compile(r"\b(motivat\w*|procrastinat\w*|focus)\b", re.I),
     "Motivation usually follows action, not the other way round. Try a two-minute version of the task, and let momentum do the rest.",
     "What's the task you keep avoiding?"),
]


def _exercise_reply(a: TextAnalysis) -> str:
    if a.primary in {"Anxiety", "Fear", "Overwhelm"}:
        return ("Let's ground you. Look around and name 5 things you can see, 4 you can touch, 3 you can hear, 2 you can smell and 1 you can taste. "
                "Then breathe in for 4 and out slowly for 6. Tell me how your body feels afterwards.")
    return ("Try box breathing with me: in for 4, hold for 4, out for 4, hold for 4. Do four rounds and let your shoulders drop. "
            "There's also a guided breathing pacer in the app. How do you feel afterwards?")


def compose_chat_reply(
    messages: List[Dict[str, str]],
    mode: str = "general",
    analysis: Optional[TextAnalysis] = None,
    recent_assistant: Optional[List[str]] = None,
    context: Optional[TextAnalysis] = None,
) -> str:
    last_user = next((m["content"] for m in reversed(messages) if m.get("role") == "user"), "")
    a = analysis or analyze_text(last_user)
    ctx = context or a
    user_turns = sum(1 for m in messages if m.get("role") == "user")
    recent = recent_assistant if recent_assistant is not None else [m["content"] for m in messages if m.get("role") == "assistant"][-4:]
    seed = _seed(last_user, user_turns)

    # 1. safety always wins, regardless of mode
    if a.crisis_level >= 1:
        return _crisis_reply(a, recent)

    # 2. structured modes
    if mode == "cbt" and a.intent not in {"greeting", "thanks", "farewell"}:
        return _cbt_reply(user_turns, a, seed, recent)
    if mode == "mindfulness" and a.intent not in {"thanks", "farewell"}:
        return _mindfulness_reply(user_turns)
    if mode == "crisis":
        return ("I'm here with you. You don't have to figure anything out right now. "
                "Let's slow things down: breathe in for 4 and out for 6, and feel your feet on the floor.\n\n"
                "Can you tell me what's happening, and whether you're safe right now?\n\n" + CRISIS_FOOTER)

    # 3. conversational intents
    if a.intent == "greeting":
        return _pick([
            "Hi, I'm Shadow. I'm here to listen, with no judgement. How are you feeling today? A single word is fine.",
            "Hello. It's good to have you here. How are you doing right now, honestly?",
        ], seed, recent)
    if a.intent == "thanks":
        return "You're welcome. I'm here whenever you want to talk. Is there anything else on your mind?"
    if a.intent == "farewell":
        return "Take care of yourself. Come back any time, and if things ever get heavy, the Help page is one click away."
    if a.intent == "exercise_request":
        return _exercise_reply(a)

    if a.intent == "help_seeking":
        return _help_seeking_reply(recent)

    # 4. depression disclosure (or a follow-up to one)
    blob = " ".join(recent).lower()
    if a.depressed or (ctx.depressed and ("how long" in blob or "two weeks" in blob) and "phq-9" not in blob
                       and not a.is_positive and a.intent not in {"question", "greeting"}):
        return _depressed_reply(recent, a, ctx)

    # carry the emotional thread: a bare follow-up ("ok", "I don't know") inherits the conversation's emotion
    if not a.emotions and ctx.is_negative and ctx.emotions and a.intent in {"statement", "venting"}:
        a = TextAnalysis(**{**a.__dict__, "emotions": ctx.emotions, "primary": ctx.primary,
                            "primary_intensity": min(ctx.primary_intensity, 6.0), "valence": ctx.valence,
                            "wellbeing": ctx.wellbeing, "intent": "venting"})

    # 5. information questions
    if a.intent == "question":
        for pat, answer, follow in KNOWLEDGE:
            if pat.search(last_user):
                lead = _pick(OPENERS[a.primary]["low"], seed, recent) + " " if a.is_negative and a.primary in OPENERS else ""
                return f"{lead}{answer}\n\n{follow}"

    if a.intent == "help_request" and not a.emotions:
        return "I'm here to help. Tell me a little about what's going on, and what you'd most like to be different. We can go at your pace."

    # 6. positive
    if a.is_positive and a.primary in POSITIVE_REPLIES:
        return _pick(POSITIVE_REPLIES[a.primary], seed, recent)

    # 7. negative emotion: opener + (theme) + insight + question
    if a.is_negative and a.primary in OPENERS:
        tier = "high" if a.primary_intensity >= 5.5 else "low"
        parts = [_pick(OPENERS[a.primary][tier], seed, recent)]
        theme = _theme_sentence(a)
        if theme:
            parts.append(theme)
        if a.word_count > 3 or user_turns > 1:
            parts.append(_pick(INSIGHTS[a.primary], seed + 1, recent))
        body = " ".join(parts)
        question = _pick(QUESTIONS[a.primary], seed + 2, recent)
        if a.primary in {"Anxiety", "Overwhelm", "Fear"} and user_turns >= 2 and "breath" not in " ".join(recent).lower():
            question = "Would it help to try a slow breathing round together, or would you rather talk through what's behind it?"
        return f"{body}\n\n{question}"

    # 8. mixed / neutral
    return _pick([
        "Thanks for sharing that. Tell me more: how has it been sitting with you?",
        "I'm listening. What feels most important to say about it?",
        "I'd like to understand this better. What's been on your mind most about it?",
    ], seed, recent)


# ─────────────────────────────────────────────────────────────────────────────
# journal / session analysis (heuristic)
# ─────────────────────────────────────────────────────────────────────────────
ANALYSIS_LIBRARY: Dict[str, Dict] = {
    "Sadness": {
        "mistakes": ["Withdrawing from people to avoid feeling like a burden.", "Letting sleep, meals and movement slip, which deepens low mood."],
        "actions": ["Message one person today, even a short text.", "Take a 10-minute walk outside or open a window and stretch."],
        "insight": "Sadness is asking for care, not for you to push through it.",
        "question": "What does the heavier part of you need most right now: rest, expression or company?",
    },
    "Anxiety": {
        "mistakes": ["Catastrophising: treating the worst case as certain.", "Avoiding the thing you're worried about, which keeps the worry alive."],
        "actions": ["Write the worry as one sentence, then one tiny step you can take on it.", "Do 4-7-8 breathing for two minutes before your next task."],
        "insight": "Anxiety shrinks once the vague cloud becomes one concrete problem.",
        "question": "What is one thing within your control that you can do about this today?",
    },
    "Fear": {
        "mistakes": ["Predicting outcomes with more certainty than the evidence supports."],
        "actions": ["List what you know versus what you're imagining.", "Tell someone you trust what you're afraid of."],
        "insight": "You usually cope better than you predict you will.",
        "question": "What would you do if you knew you could handle whatever happens?",
    },
    "Anger": {
        "mistakes": ["Replying in the heat of the moment and regretting the words later.", "Bottling frustration until it spills onto unrelated things."],
        "actions": ["Take a 10-minute pause before responding.", "Write an unsent letter with everything you want to say."],
        "insight": "Anger often guards something important, like a boundary or a value.",
        "question": "Which boundary of yours was crossed, and how could you state it calmly?",
    },
    "Guilt": {
        "mistakes": ["Taking responsibility for things that aren't yours.", "Replaying the event instead of deciding on repair."],
        "actions": ["List what was in your control and what wasn't.", "Decide on one concrete way to make amends, then let the rest go."],
        "insight": "Guilt is useful when it leads to repair and harmful when it becomes punishment.",
        "question": "What would you say to a friend who did the same thing?",
    },
    "Shame": {
        "mistakes": ["Turning one event into a verdict on your whole self.", "Hiding, which stops kindness from reaching you."],
        "actions": ["Write three facts about you that contradict the harsh thought.", "Tell one safe person what you're feeling."],
        "insight": "Shame says 'I am bad'. The accurate statement is usually 'I did something I wish I'd done differently'.",
        "question": "Whose voice does that inner critic sound like?",
    },
    "Loneliness": {
        "mistakes": ["Waiting for others to reach out first.", "Assuming that reaching out will bother people."],
        "actions": ["Send one low-pressure message to someone today.", "Plan one small shared activity this week."],
        "insight": "Loneliness is a signal for connection, not a flaw.",
        "question": "Who felt easy to be around the last time you were with them?",
    },
    "Overwhelm": {
        "mistakes": ["Trying to solve everything at once.", "Saying yes to more while already stretched."],
        "actions": ["Write every task down, then circle only the three that matter today.", "Take a 5-minute break away from screens."],
        "insight": "Overwhelm eases when the list gets smaller, not when you push harder.",
        "question": "What could realistically wait until next week?",
    },
    "Apathy": {
        "mistakes": ["Assuming this flat state is permanent.", "Isolating and scrolling, which deepens numbness."],
        "actions": ["Pick one tiny task (a glass of water, a shower) and do only that.", "Change your environment for 5 minutes."],
        "insight": "Motivation often follows action, not the other way round.",
        "question": "When did you last feel even a flicker of interest in something?",
    },
    "Joy": {
        "mistakes": ["Overcommitting while energy is high.", "Ignoring early signs of fatigue."],
        "actions": ["Note what created this good state so you can return to it.", "Share the good news with someone."],
        "insight": "Good moments are worth savouring on purpose.",
        "question": "What exactly made today feel good, and how can you repeat it?",
    },
    "Gratitude": {
        "mistakes": ["Forgetting this perspective when a hard day arrives."],
        "actions": ["Write down three specific things you're grateful for today."],
        "insight": "Noticing what's good builds resilience for harder days.",
        "question": "Who would you like to thank, and what would you say?",
    },
    "Hope": {
        "mistakes": ["Expecting progress to be a straight line."],
        "actions": ["Write down what helped so you can repeat it on harder days."],
        "insight": "Improvement tends to come in waves, and setbacks don't erase it.",
        "question": "What's one thing that has been helping lately?",
    },
    "Calm": {
        "mistakes": ["Taking stability for granted and dropping the habits that created it."],
        "actions": ["Write down two habits keeping you steady."],
        "insight": "Calm is worth protecting with small routines.",
        "question": "Which habits are keeping you grounded right now?",
    },
}


def heuristic_analysis(text: str) -> Dict:
    a = analyze_text(text)
    primary = a.primary if a.primary in ANALYSIS_LIBRARY else "Calm"
    lib = ANALYSIS_LIBRARY[primary]
    emotions = a.emotions or [{"name": "Calm", "intensity": 4.0}]

    names = [e["name"].lower() for e in emotions[:3]]
    if not a.emotions:
        summary = "There isn't a strong emotional signal in this entry, which can simply mean a steady or reflective moment."
    else:
        rest = f", with traces of {' and '.join(names[1:])}" if len(names) > 1 else ""
        summary = f"This entry carries mostly {names[0]} (about {emotions[0]['intensity']}/10){rest}."
        theme = _theme_sentence(a)
        if theme:
            summary += " " + theme
        if a.is_negative:
            summary += " Noticing and writing it down is already a healthy step."

    insights = [lib["insight"]]
    if a.depressed:
        insights.append("If low mood has lasted more than two weeks, consider talking with a doctor or counsellor; the PHQ-9 in this app can help you prepare.")
    if a.crisis_level >= 1:
        insights.append("Some of these words suggest hopelessness. You deserve support: Tele-MANAS (14416, free, 24/7) is there any time.")

    return {
        "summary": summary,
        "emotions": emotions,
        "wellbeing_score": a.wellbeing,
        "future_mistakes": lib["mistakes"],
        "corrective_actions": lib["actions"],
        "insights": insights,
        "reflection_question": lib["question"],
        "crisis_level": a.crisis_level,
    }


# ─────────────────────────────────────────────────────────────────────────────
# mood insight (heuristic)
# ─────────────────────────────────────────────────────────────────────────────
def mood_insight_fallback(moods: List[Dict]) -> str:
    scores = [m["score"] for m in moods if isinstance(m.get("score"), (int, float))]
    if not scores:
        return "No mood data yet. Log a few check-ins and I'll start spotting patterns for you."
    avg = sum(scores) / len(scores)
    half = max(1, len(scores) // 2)
    first, second = scores[:half], scores[half:] or scores[:half]
    delta = (sum(second) / len(second)) - (sum(first) / len(first))
    labels = [str(m.get("label", "")).lower() for m in moods if m.get("label")]
    common = max(set(labels), key=labels.count) if labels else None
    trend = "has been trending up" if delta > 0.7 else "has been slipping" if delta < -0.7 else "has been fairly steady"
    parts = [f"Across your last {len(scores)} check-ins, your mood averages {avg:.1f}/10 and {trend}."]
    if common:
        parts.append(f"'{common}' shows up most often.")
    if avg < 4.5:
        parts.append("This has been a demanding stretch. Keep your days small and kind, lean on someone you trust, and consider talking to a professional if it persists beyond two weeks.")
    elif delta < -0.7:
        parts.append("It may help to look at what changed recently, such as sleep, workload or people, and protect one routine that normally steadies you.")
    else:
        parts.append("Notice what your better days have in common, such as sleep, movement or company, and try to repeat one of them this week.")
    return " ".join(parts)


# ─────────────────────────────────────────────────────────────────────────────
# guided meditation (offline)
# ─────────────────────────────────────────────────────────────────────────────
_FOCUS = {
    "sleep": ("Drifting Into Rest", "Imagine the day slowly dimming, like light leaving a quiet room. Each thought is a cloud passing, and you don't need to follow any of them. Your body is heavy, supported, and safe."),
    "anxiety": ("Steady Ground", "Feel the weight of your body against the chair or floor. Whatever is worrying you can wait a few minutes; right now you only need this breath and this moment. You are safe here."),
    "stress": ("Setting Down the Load", "Picture everything you've been carrying placed gently on the ground beside you. You can pick it up again later. For now, your only job is to breathe."),
    "focus": ("A Clear Mind", "Choose one point of attention: the feeling of air at your nostrils. When your mind wanders, which is what minds do, simply notice and return. Each return is a repetition that strengthens focus."),
    "gratitude": ("Quiet Thanks", "Bring to mind one person, one moment or one small comfort from today. Let yourself feel warmth toward it, even if it's faint."),
    "self-compassion": ("Kindness Inward", "Place a hand over your heart. Say silently: this is a hard moment, and I'm allowed to be gentle with myself. Many people feel this way, and you are not alone in it."),
}


def meditation_fallback(duration_minutes: int, focus_area: str) -> Dict[str, str]:
    focus = (focus_area or "").lower()
    key = next((k for k in _FOCUS if k in focus), None)
    title, core = _FOCUS.get(key, (f"A Moment for {focus_area.title() or 'Calm'}", "Let your attention rest on the natural rhythm of your breathing. There is nothing to fix or achieve. You are simply here."))
    minutes = max(1, min(int(duration_minutes or 5), 30))
    reps = max(1, minutes // 3)
    lines = [
        "Find a comfortable position and let your eyes close, or rest your gaze softly on the floor. [Pause 5 seconds]",
        "Take a slow breath in through your nose, and let it out gently through your mouth. [Pause 6 seconds]",
        "Again: in, and out. Let your shoulders drop and your jaw soften. [Pause 8 seconds]",
    ]
    lines.append(core + " [Pause 15 seconds]")
    for i in range(reps):
        lines.append("Scan slowly from your feet up through your legs, stomach, chest and hands. Wherever you find tension, breathe toward it and let it soften. [Pause 20 seconds]")
        lines.append("Breathe in for four, and out for six. Notice the small pause at the end of each exhale. [Pause 15 seconds]")
        if i < reps - 1:
            lines.append(core.split(". ")[0] + ". [Pause 20 seconds]")
    lines += [
        "Begin to deepen your breath. Wiggle your fingers and toes, and notice the room around you. [Pause 8 seconds]",
        "When you're ready, open your eyes. Carry this steadiness with you for the rest of your day.",
    ]
    return {"title": title, "script": "\n\n".join(lines)}
