"""
Emotion lexicon. Each entry is (regex, weight). Patterns are matched on word
boundaries, so "die" can never fire inside "diet" or "studied".
"""
import re
from typing import Dict, List, Pattern, Tuple

POSITIVE = {"Joy", "Gratitude", "Hope", "Calm"}

_RAW: Dict[str, List[Tuple[str, float]]] = {
    "Sadness": [
        (r"depress\w*", 2.4), (r"despair\w*", 2.4), (r"devastat\w*", 2.2), (r"heartbr\w*", 2.2),
        (r"miserable", 2.0), (r"grie[fv]\w*", 2.0), (r"sad\w*", 1.6), (r"unhappy", 1.6),
        (r"cry(ing)?", 1.5), (r"cried", 1.4), (r"tears", 1.3), (r"sorrow\w*", 1.8), (r"gloom\w*", 1.5),
        (r"feel(ing)? (so )?(down|low|blue)", 1.6), (r"low mood", 1.8), (r"hurts?", 1.0),
        (r"not okay", 1.4), (r"not ok", 1.4), (r"not fine", 1.2), (r"broken", 1.5), (r"sucks?", 0.8),
        (r"(failed|flunked) (my|the|an?|in|at)\b", 1.5), (r"bad day", 1.2), (r"rough (day|week|time)", 1.3), (r"terrible", 1.3), (r"awful", 1.3),
    ],
    "Anxiety": [
        (r"anxi\w*", 2.0), (r"panic\w*", 2.2), (r"worr\w*", 1.5), (r"nervous\w*", 1.5),
        (r"stress\w*", 1.5), (r"tense", 1.3), (r"on edge", 1.6), (r"uneasy", 1.3), (r"restless", 1.2),
        (r"dread\w*", 1.8), (r"jitter\w*", 1.3), (r"overthink\w*", 1.6), (r"racing (thoughts|mind)", 1.8),
        (r"can'?t stop thinking", 1.6), (r"what if", 0.9), (r"heart (is )?(racing|pounding)", 1.8),
        (r"pressure", 1.0), (r"deadline\w*", 0.8),
        (r"(going to|gonna|will|gonna) (fail|flunk|mess (it )?up|get fired)", 1.8), (r"laugh at me", 1.4),
        (r"afraid of (failing|losing)", 1.8), (r"freak(ing)? out", 1.6), (r"(can'?t|cannot) relax", 1.4),
    ],
    "Fear": [
        (r"scar(ed|y)", 1.6), (r"afraid", 1.6), (r"terrif\w*", 2.0), (r"frighten\w*", 1.8),
        (r"fear\w*", 1.5), (r"phobi\w*", 1.5), (r"petrified", 2.0),
    ],
    "Anger": [
        (r"angr\w*", 1.8), (r"anger", 1.8), (r"mad", 1.4), (r"furious", 2.2), (r"rage\w*", 2.2),
        (r"irritat\w*", 1.4), (r"annoy\w*", 1.2), (r"frustrat\w*", 1.6), (r"resent\w*", 1.6),
        (r"hate\w*", 1.6), (r"pissed", 1.8), (r"livid", 2.2), (r"fed up", 1.6), (r"sick of", 1.4),
    ],
    "Guilt": [
        (r"guilt\w*", 2.0), (r"regret\w*", 1.6), (r"remorse\w*", 1.8), (r"my fault", 1.8),
        (r"blame (myself|me)", 1.8), (r"i (messed|screwed) up", 1.6), (r"let (them|everyone|him|her) down", 1.8),
    ],
    "Shame": [
        (r"asham\w*", 2.2), (r"shame\w*", 2.0), (r"embarrass\w*", 1.6), (r"humiliat\w*", 2.0),
        (r"worthless\w*", 2.4), (r"not good enough", 2.0), (r"(i'?m|im|i am) (a )?(failure|useless|pathetic|stupid)", 2.2),
        (r"hate myself", 2.4), (r"failure", 1.4), (r"useless", 1.6),
    ],
    "Loneliness": [
        (r"lonel\w*", 2.0), (r"isolat\w*", 1.6), (r"alone", 1.5), (r"left out", 1.5), (r"abandon\w*", 1.8),
        (r"no one (cares|understands|to talk|listens)", 2.0), (r"nobody (cares|understands|listens)", 2.0),
        (r"no friends", 1.8), (r"don'?t (have|got) anyone", 1.6),
    ],
    "Overwhelm": [
        (r"overwhelm\w*", 2.2), (r"too much", 1.4), (r"swamped", 1.6), (r"drowning", 2.0),
        (r"can'?t (cope|handle|take)", 2.0), (r"burn(ed|t)? ?out", 2.0), (r"burnout", 2.0),
        (r"falling apart", 2.0), (r"breaking down", 1.8), (r"exhaust\w*", 1.6), (r"at my limit", 1.8),
    ],
    "Apathy": [
        (r"numb\w*", 2.0), (r"empty", 1.8), (r"hollow", 1.8), (r"don'?t care", 1.4),
        (r"no (motivation|energy|interest)", 2.0), (r"unmotivat\w*", 1.8), (r"tired", 1.1),
        (r"fatigue\w*", 1.4), (r"drained", 1.6), (r"bored", 0.9), (r"nothing matters", 2.2),
        (r"can'?t be bothered", 1.6), (r"lost (all )?interest", 2.0), (r"can'?t (get|drag myself) out of bed", 2.4),
        (r"no (point|purpose)", 1.8), (r"stuck", 1.2), (r"flat", 1.0),
        (r"(can'?t|cannot|trouble|unable to|struggl\w* to) sleep\w*", 1.4), (r"not sleeping", 1.4), (r"insomnia", 1.4),
        (r"no appetite", 1.6), (r"not eating", 1.5), (r"sleeping (all day|too much)", 1.6),
    ],
    "Joy": [
        (r"happ(y|ier|iest|iness)", 1.8), (r"joy\w*", 1.8), (r"excit\w*", 1.6), (r"glad", 1.4),
        (r"great", 1.4), (r"wonderful", 1.8), (r"amazing", 1.8), (r"awesome", 1.6), (r"fantastic", 1.8),
        (r"cheerful", 1.6), (r"delight\w*", 1.8), (r"thrill\w*", 1.8), (r"good (day|news|mood)", 1.4),
        (r"feel(ing)? good", 1.4), (r"proud", 1.6), (r"elated", 2.0), (r"love (it|this|my)", 1.4),
        (r"promoted", 1.6), (r"passed", 1.0), (r"celebrat\w*", 1.6),
    ],
    "Gratitude": [
        (r"grateful", 2.0), (r"thankful", 2.0), (r"appreciat\w*", 1.4), (r"blessed", 1.6),
    ],
    "Hope": [
        (r"hopeful", 2.0), (r"optimistic", 1.8), (r"looking forward", 1.6), (r"getting better", 1.8),
        (r"feel(ing)? better", 1.6), (r"improv\w*", 1.2), (r"on the mend", 1.6), (r"motivated", 1.4),
    ],
    "Calm": [
        (r"calm\w*", 1.6), (r"peaceful", 1.8), (r"relax\w*", 1.4), (r"content", 1.4), (r"serene", 1.8),
        (r"at peace", 1.8), (r"relieved", 1.6), (r"settled", 1.2), (r"okay", 0.6), (r"fine", 0.4),
    ],
}

EMOTION_PATTERNS: Dict[str, List[Tuple[Pattern[str], float]]] = {
    name: [(re.compile(rf"\b(?:{p})\b", re.I), w) for p, w in pats] for name, pats in _RAW.items()
}

# ── modifiers ────────────────────────────────────────────────────────────────
INTENSIFIERS = {
    "very", "so", "really", "extremely", "super", "deeply", "completely", "totally", "incredibly",
    "utterly", "absolutely", "truly", "terribly", "too", "quite", "just", "all",
}
DAMPENERS = {"slightly", "bit", "little", "somewhat", "kinda", "kind", "sort", "mildly", "abit"}
NEGATORS = {
    "not", "no", "never", "isn't", "isnt", "wasn't", "wasnt", "don't", "dont", "doesn't", "doesnt",
    "didn't", "didnt", "can't", "cant", "cannot", "won't", "wont", "hardly", "barely", "aren't", "arent",
    "haven't", "havent", "without", "ain't", "aint",
}
# "can't stop crying" / "can't help feeling anxious" are NOT negations of the emotion.
NEGATION_BREAKERS = {"stop", "help", "ignore", "avoid", "stopped"}

# ── crisis ───────────────────────────────────────────────────────────────────
# Level 2 = explicit suicidal ideation / self-harm intent. Level 1 = hopelessness.
CRISIS_ACUTE = [re.compile(p, re.I) for p in [
    r"\bsuicid\w*", r"\bkill(ing)? (my ?self|me)\b", r"\bend(ing)? (my (own )?life|it all)\b",
    r"\b(want|wanted|wanna|going|plan(ning)?|thinking of) (to )?(die|be dead|disappear forever)\b",
    r"\bwish (i|that i) (was|were|could)( not)? (dead|die|never (been )?born)\b",
    r"\bbetter off dead\b", r"\b(everyone|they|family|world) (would be|is|are) better off without me\b",
    r"\bdon'?t want to (live|be here|be alive|exist|wake up)\b", r"\bno reason to (live|go on)\b",
    r"\btake my (own )?life\b", r"\b(hurt|harm|cut|cutting|burn(ing)?) (my ?self)\b", r"\bself[- ]?harm\w*\b",
    r"\bkms\b", r"\boverdos\w*\b", r"\bnot wake up\b", r"\bend it (all|tonight|today)\b",
    r"\b(jump|hang|shoot) (off|myself)\b", r"\brather be dead\b",
]]
CRISIS_ELEVATED = [re.compile(p, re.I) for p in [
    r"\bhopeless\w*", r"\bno (point|purpose) (in|to) (living|life|anything|going on)\b",
    r"\bwhat'?s the point\b", r"\bcan'?t go on\b", r"\bgive up on (life|everything)\b",
    r"\b(a )?burden (to|on) (everyone|others|my family|people)\b", r"\bnobody would (care|miss)\b",
    r"\bcan'?t (take|do) (it|this) anymore\b", r"\btired of (living|life|being alive|everything)\b",
    r"\bnothing (will|is going to) (ever )?(get|change)\b", r"\bnothing matters\b", r"\bno way out\b",
    r"\btrapped\b",
]]
# If these words sit shortly before an acute match, it is negated ("I'm not suicidal").
CRISIS_NEGATION = re.compile(r"\b(not|never|no longer|don'?t (think|feel)|isn'?t|am not|i'?m not|wouldn'?t|would never)\b[^.!?]{0,25}$", re.I)

# ── themes ───────────────────────────────────────────────────────────────────
THEMES: Dict[str, List[str]] = {
    "studies": [r"exam\w*", r"assignment\w*", r"semester", r"viva", r"marks", r"grades?", r"college", r"placement\w*", r"study\w*", r"backlog\w*", r"professor", r"lecture\w*"],
    "work": [r"work\w*", r"job", r"boss", r"manager", r"office", r"intern\w*", r"deadline\w*", r"career", r"interview\w*", r"colleague\w*", r"project"],
    "sleep": [r"sleep\w*", r"insomnia", r"can'?t sleep", r"awake", r"nightmare\w*", r"3 ?am"],
    "relationships": [r"breakup", r"broke up", r"girlfriend", r"boyfriend", r"partner", r"relationship", r"crush", r"ex\b", r"divorce", r"dating"],
    "family": [r"mom", r"mother", r"dad", r"father", r"parents?", r"brother", r"sister", r"family", r"home"],
    "friends": [r"friends?", r"friendship", r"roommate\w*", r"classmate\w*"],
    "health": [r"sick", r"illness", r"pain", r"headache", r"doctor", r"hospital", r"medicine", r"diagnos\w*"],
    "money": [r"money", r"fees?", r"loan\w*", r"debt", r"salary", r"rent", r"broke"],
    "self-worth": [r"worthless", r"failure", r"not good enough", r"hate myself", r"useless", r"compare\w*"],
}
THEME_PATTERNS = {k: [re.compile(rf"\b(?:{p})\b", re.I) for p in v] for k, v in THEMES.items()}
