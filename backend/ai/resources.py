"""Crisis helplines and the in-app actions the assistant can suggest."""
from typing import Dict, List

# Verified helplines (India first, then international).
HELPLINES: List[Dict[str, str]] = [
    {"region": "IN", "name": "Tele-MANAS (Govt. of India, 24/7, free)", "contact": "14416", "alt": "1800-891-4416"},
    {"region": "IN", "name": "Vandrevala Foundation (24/7)", "contact": "+91 9999 666 555", "alt": ""},
    {"region": "IN", "name": "iCall – TISS (Mon–Sat, 10am–8pm)", "contact": "+91 9152987821", "alt": ""},
    {"region": "IN", "name": "Emergency services", "contact": "112", "alt": ""},
    {"region": "US", "name": "988 Suicide & Crisis Lifeline", "contact": "988", "alt": "Text HOME to 741741"},
]

CRISIS_FOOTER = (
    "If you might act on these thoughts, please contact someone right now:\n"
    "• Tele-MANAS (India, free, 24/7): 14416 or 1800-891-4416\n"
    "• Vandrevala Foundation (24/7): +91 9999 666 555\n"
    "• Emergency: 112   •   US: call or text 988"
)

# Actions the UI renders as buttons under an assistant reply.
ACTIONS: Dict[str, Dict[str, str]] = {
    "breathe":    {"label": "Guided breathing",      "route": "/breathe",    "icon": "wind"},
    "grounding":  {"label": "Grounding exercise",    "route": "/meditation", "icon": "anchor"},
    "journal":    {"label": "Write it down",         "route": "/journal",    "icon": "book"},
    "mood":       {"label": "Log your mood",         "route": "/mood",       "icon": "activity"},
    "cbt":        {"label": "Challenge the thought", "route": "/cbt",        "icon": "brain"},
    "assessment": {"label": "PHQ-9 / GAD-7 check-in", "route": "/assessment", "icon": "clipboard"},
    "safety":     {"label": "My safety plan",        "route": "/safety",     "icon": "shield"},
    "doctors":    {"label": "Find a professional",   "route": "/doctors",    "icon": "stethoscope"},
    "help":       {"label": "Crisis help now",       "route": "/help",       "icon": "life-buoy"},
}


def actions_for(primary: str, crisis_level: int, depressed: bool) -> List[Dict[str, str]]:
    """Return up to three relevant in-app actions for the detected state."""
    if crisis_level >= 2:
        keys = ["help", "safety", "doctors"]
    elif crisis_level == 1 or depressed:
        keys = ["assessment", "doctors", "journal"] if depressed else ["safety", "journal", "doctors"]
    else:
        keys = {
            "Anxiety":   ["breathe", "grounding", "cbt"],
            "Fear":      ["breathe", "grounding", "cbt"],
            "Overwhelm": ["breathe", "journal", "grounding"],
            "Sadness":   ["journal", "mood", "assessment"],
            "Apathy":    ["mood", "journal", "assessment"],
            "Loneliness": ["journal", "doctors", "mood"],
            "Anger":     ["breathe", "cbt", "journal"],
            "Guilt":     ["cbt", "journal", "mood"],
            "Shame":     ["cbt", "journal", "mood"],
            "Joy":       ["mood", "journal"],
            "Gratitude": ["journal", "mood"],
            "Hope":      ["journal", "mood"],
            "Calm":      ["mood", "journal"],
        }.get(primary, [])
    return [{"key": k, **ACTIONS[k]} for k in keys]
