"""
Generates the verified 5,000+ entry emotional lexicon dataset for ShadowMind's offline composer.
Covers all 50 required emotional categories with normalized phrases, intents, intensities, and valences.
"""
import json
import os
import re

DATASET_PATH = os.path.join(os.path.dirname(__file__), "emotional_lexicon.json")

def normalize_text(text: str) -> str:
    text = text.lower().strip()
    text = re.sub(r"['’`]", "", text)
    text = re.sub(r"[^a-z0-9\s-]", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text

# Core category templates and vocabularies
RAW_CATEGORIES = {
    "general_greetings": {
        "intent": "greeting", "valence": 0.2, "intensity": 3.0,
        "seeds": [
            "hello", "hi", "hey", "hey there", "hello there", "good morning", "good afternoon", "good evening",
            "hiya", "howdy", "sup", "what's up", "whats up", "greetings", "salutations", "yo", "namaste",
            "nice to see you", "good day", "glad to be here", "checking in", "hello shadow", "hi shadow",
            "hey shadow", "anyone there", "can we talk", "are you free", "got a minute", "hello friend",
            "hi friend", "good to chat", "starting a conversation", "just wanted to say hi", "ping", "morning",
            "evening", "afternoon", "hey buddy", "how are you today", "how are things", "how is your day going",
            "just dropping in", "hi there shadow", "hello my friend", "warm greetings", "waving hello"
        ],
        "templates": [
            "just saying {word}", "wanted to drop in and say {word}", "starting my day with a {word}",
            "sending a quick {word}", "ready for a chat {word}", "dropping by to say {word}",
            "thought i would say {word}", "popping in with a quick {word}", "here to say {word}"
        ]
    },
    "warmth_empathy": {
        "intent": "statement", "valence": 0.6, "intensity": 5.0,
        "seeds": [
            "feeling warm", "deep empathy", "compassionate space", "caring presence", "so kind of you",
            "feeling held", "gentle comfort", "heartfelt support", "safe with you", "empathetic ear",
            "understanding heart", "warm embrace", "kind words", "soft presence", "tender care",
            "holding space", "patient listening", "thoughtful presence", "warm reassurance", "comforting presence",
            "feeling understood", "truly seen", "appreciated and safe", "tenderhearted", "deep warmth",
            "comforted", "cared for", "held in compassion", "soothing presence", "nurturing conversation"
        ],
        "templates": [
            "thank you for your {word}", "i appreciate the {word}", "i really need some {word}",
            "your {word} means a lot", "craving a bit of {word}", "reaching out for {word}",
            "experiencing genuine {word}", "feeling so much {word}", "surrounded by {word}"
        ]
    },
    "happiness_joy": {
        "intent": "positive", "valence": 0.8, "intensity": 7.0,
        "seeds": [
            "happy", "joyful", "delighted", "cheerful", "radiant", "smiling", "beaming", "overjoyed",
            "gleeful", "blissful", "on cloud nine", "walking on sunshine", "thrilled", "bursting with joy",
            "so glad", "heart is full", "feeling fantastic", "pure bliss", "high spirits", "bubbling with joy",
            "good mood", "best day ever", "feeling wonderful", "great day", "loving life", "happy tears",
            "ecstatic", "elated", "thrilled to bits", "upbeat", "sunny mood", "celebrating life", "pure happiness"
        ],
        "templates": [
            "i am so {word}", "feeling incredibly {word} today", "i feel {word} right now",
            "so full of {word}", "cannot hide how {word} i am", "today is full of {word}",
            "experiencing pure {word}", "woke up feeling {word}", "riding a wave of {word}",
            "filled with {word} and smiles", "grateful and {word}"
        ]
    },
    "excitement": {
        "intent": "positive", "valence": 0.8, "intensity": 8.0,
        "seeds": [
            "excited", "hyped", "pumped", "thrilled", "cant wait", "cannot wait", "so excited", "electrified",
            "buzzing with energy", "super stoked", "jumping for joy", "eagerly waiting", "thrill of a lifetime",
            "hyped up", "pumped up", "anticipating something great", "full of anticipation", "exhilarated",
            "adrenaline rush", "so pumped", "screaming with joy", "over the moon", "buzzing", "ready for action"
        ],
        "templates": [
            "i am genuinely {word}", "feeling completely {word}", "totally {word} about tomorrow",
            "so {word} for what is coming", "brimming with {word}", "overflowing with {word}",
            "i cannot sleep because i am {word}", "absolutely {word} about this news",
            "bursting because i am {word}", "riding on pure {word}"
        ]
    },
    "love_affection": {
        "intent": "positive", "valence": 0.8, "intensity": 7.5,
        "seeds": [
            "in love", "deep affection", "adore them", "cherish this", "loving deeply", "warm affection",
            "heart belongs to", "smitten", "head over heels", "fondness", "tender love", "so in love",
            "caring deeply", "beloved", "butterflies in stomach", "overflowing with love", "falling in love",
            "holding hands", "deeply attached", "treasuring them", "loving presence", "warm tenderness"
        ],
        "templates": [
            "i am feeling {word}", "experiencing such {word}", "so much {word} in my heart",
            "cannot describe this {word}", "overflowing with {word}", "cherishing this feeling of {word}",
            "holding onto {word}", "surrendering to {word}", "filled with tender {word}"
        ]
    },
    "sadness": {
        "intent": "venting", "valence": -0.6, "intensity": 6.5,
        "seeds": [
            "sad", "crying", "tears", "weeping", "heartache", "sorrow", "heavy heart", "down in the dumps",
            "feeling down", "gloomy", "mournful", "downcast", "unhappy", "hurting inside", "so sad",
            "feeling blue", "welled up", "crying myself to sleep", "heavy sadness", "aching heart",
            "deep sadness", "silent tears", "gloom in my chest", "teary eyed", "sinking feeling", "heart hurts"
        ],
        "templates": [
            "i feel so {word}", "overwhelmed by {word}", "woke up feeling {word}",
            "drowning in {word}", "carrying this {word} all day", "cannot shake this {word}",
            "my chest is full of {word}", "sitting alone with my {word}", "lost in {word}",
            "heavy with {word}", "struggling with {word} today"
        ]
    },
    "depression": {
        "intent": "venting", "valence": -0.8, "intensity": 8.0,
        "seeds": [
            "depressed", "depression", "numb inside", "empty feeling", "hollow", "feeling numb", "gray world",
            "no energy to get out of bed", "cannot feel anything", "flat and lifeless", "zero motivation",
            "deep void", "pointless", "everything is gray", "heavy fog", "loss of interest", "anhedonia",
            "cannot function", "existential dread", "drained of life", "bedridden with sadness", "emotional numbness",
            "clinical depression", "feeling hollowed out", "cannot smile", "soul is tired", "weight of existing"
        ],
        "templates": [
            "battling severe {word}", "falling into deep {word}", "living with this {word}",
            "trapped in a state of {word}", "weighed down by {word}", "feeling completely {word}",
            "paralyzed by {word}", "exhausted from {word}", "consumed by {word}",
            "stuck in the dark pit of {word}", "suffocated by {word}"
        ]
    },
    "loneliness": {
        "intent": "venting", "valence": -0.7, "intensity": 7.0,
        "seeds": [
            "lonely", "isolated", "all alone", "nobody to talk to", "abandoned", "no friends", "left out",
            "invisible to everyone", "sitting alone in the dark", "nobody understands me", "craving connection",
            "empty room", "silent house", "cut off from the world", "nobody cares about me", "friendless",
            "deep loneliness", "aching isolation", "forgotten by everyone", "no one checks on me", "alienated"
        ],
        "templates": [
            "feeling so {word}", "trapped in {word}", "surrounded by people but {word}",
            "crushed by {word}", "enduring quiet {word}", "crying from {word}",
            "hurting from deep {word}", "living in complete {word}", "struggling with painful {word}",
            "swallowed by {word}"
        ]
    },
    "breakups_heartbreak": {
        "intent": "venting", "valence": -0.8, "intensity": 8.5,
        "seeds": [
            "breakup", "broke up", "heartbroken", "dumped", "ended things", "split up", "ex partner",
            "shattered heart", "they left me", "we broke up", "called off the engagement", "divorce",
            "unraveling relationship", "broken pieces", "crying over ex", "heart ripped out", "lost the love of my life",
            "walking away from love", "they moved on", "mourning our relationship", "torn apart"
        ],
        "templates": [
            "going through a painful {word}", "still crying over the {word}", "shattered by our {word}",
            "cannot accept the {word}", "reeling from this sudden {word}", "mourning after the {word}",
            "heart is broken after the {word}", "struggling to heal from the {word}",
            "broken into pieces by {word}"
        ]
    },
    "missing_someone": {
        "intent": "venting", "valence": -0.5, "intensity": 6.5,
        "seeds": [
            "miss them", "missing you", "longing for", "yearning for", "wish they were here", "empty without them",
            "reminiscing about us", "looking at old photos", "remembering their voice", "ache for their touch",
            "thinking of them constantly", "wish i could call them", "missing their smile", "homesick for a person",
            "craving their presence", "nostalgic ache", "remembering old memories", "haunted by memories"
        ],
        "templates": [
            "i cannot stop {word}", "my heart aches from {word}", "spent the night {word}",
            "overcome by {word}", "tears from {word}", "sitting quietly {word}",
            "a quiet day of {word}", "painfully {word} right now"
        ]
    },
    "rejection_unrequited": {
        "intent": "venting", "valence": -0.7, "intensity": 7.0,
        "seeds": [
            "rejected", "unrequited love", "they said no", "turned down", "friendzoned", "one sided love",
            "they dont love me back", "ghosted", "left on read", "not chosen", "second choice",
            "pushed away", "unwanted", "not good enough for them", "crush rejected me", "unloved by them",
            "giving love with nothing in return", "ignored completely", "discarded"
        ],
        "templates": [
            "hurting after being {word}", "feeling the sting of {word}", "dealing with harsh {word}",
            "crying over {word}", "humiliated and {word}", "trying to process this {word}",
            "heartbroken from {word}", "devastated by {word}"
        ]
    },
    "relationship_confusion": {
        "intent": "statement", "valence": -0.4, "intensity": 5.5,
        "seeds": [
            "relationship doubts", "mixed signals", "confused about us", "where do we stand", "hot and cold",
            "are we together", "unsure about my feelings", "unsure about their feelings", "complicated status",
            "walking on eggshells", "lost in the relationship", "should i stay or leave", "mixed emotions",
            "communication breakdown", "second guessing our future", "conflicted about partner"
        ],
        "templates": [
            "caught in {word}", "stressed by {word}", "dealing with constant {word}",
            "feeling overwhelmed by {word}", "exhausted from {word}", "trying to make sense of {word}",
            "struggling with {word} tonight"
        ]
    },
    "friendship_problems": {
        "intent": "venting", "valence": -0.6, "intensity": 6.0,
        "seeds": [
            "fight with friend", "lost a friend", "friendship fading", "fake friends", "betrayed by a friend",
            "left out by friends", "toxic friendship", "friend ghosted me", "growing apart", "excluded from group",
            "arguing with best friend", "friend talked behind my back", "drifting away from friends", "no trust left"
        ],
        "templates": [
            "crying over a {word}", "hurting from {word}", "dealing with painful {word}",
            "heartbroken by a {word}", "feeling so betrayed by {word}", "exhausted by {word}",
            "reeling from {word}"
        ]
    },
    "jealousy": {
        "intent": "venting", "valence": -0.5, "intensity": 6.0,
        "seeds": [
            "jealous", "envious", "green with envy", "jealousy eating me", "comparing myself to others",
            "envying their success", "wish i had what they have", "jealous of their relationship", "bitter envy",
            "jealous feelings", "resentful of their good luck", "feeling competitive and bitter", "spiteful thoughts"
        ],
        "templates": [
            "struggling with ugly {word}", "ashamed of my {word}", "consumed by bitter {word}",
            "feeling intense {word}", "poisoned by {word}", "fighting off feelings of {word}"
        ]
    },
    "anger": {
        "intent": "venting", "valence": -0.7, "intensity": 7.5,
        "seeds": [
            "angry", "mad", "furious", "pissed off", "raging", "livid", "boiling with rage", "seeing red",
            "enraged", "irritated", "annoyed", "frustrated", "outraged", "infuriated", "bitter anger",
            "want to scream", "clenched fists", "losing my temper", "ready to explode", "deep resentment",
            "fed up", "sick and tired", "cannot stand this anymore", "boiling over"
        ],
        "templates": [
            "i am so {word}", "overflowing with {word}", "shaking with {word}",
            "consumed by hot {word}", "full of blind {word}", "trying to control my {word}",
            "bursting with {word}", "dealing with intense {word}"
        ]
    },
    "stress": {
        "intent": "venting", "valence": -0.6, "intensity": 6.8,
        "seeds": [
            "stressed", "stressed out", "under pressure", "overburdened", "too much to do", "tight chest",
            "cannot breathe from stress", "stress headache", "running out of time", "deadlines piling up",
            "overstretched", "frazzled", "wound up", "stretched to the limit", "high stress", "crushing pressure",
            "swamped with obligations", "chronic stress", "hair pulling stress", "at my breaking point"
        ],
        "templates": [
            "feeling so {word}", "suffering from severe {word}", "drowning in {word}",
            "my body is tense with {word}", "overwhelmed by mounting {word}", "completely paralyzed by {word}",
            "struggling under heavy {word}", "surrounded by constant {word}"
        ]
    },
    "anxiety": {
        "intent": "venting", "valence": -0.7, "intensity": 7.2,
        "seeds": [
            "anxious", "anxiety", "panic", "panicking", "panic attack", "chest tightness", "racing heartbeat",
            "shortness of breath", "shaking", "nervous wreck", "on edge", "constant worry", "uneasy feeling",
            "dread in my stomach", "impending doom", "freaking out", "anxious spiral", "restless and scared",
            "hyperventilating", "jittery and anxious", "palpitations", "anxiety through the roof"
        ],
        "templates": [
            "having bad {word}", "trapped in severe {word}", "struggling with {word}",
            "crippled by sudden {word}", "overcome by intense {word}", "battling physical {word}",
            "woke up with heavy {word}", "shaking from {word}"
        ]
    },
    "overthinking": {
        "intent": "venting", "valence": -0.5, "intensity": 6.2,
        "seeds": [
            "overthinking", "racing thoughts", "mind wont shut off", "spinning thoughts", "stuck in my head",
            "replaying conversations", "analyzing everything", "catastrophizing", "worst case scenarios",
            "what if loop", "thought spiral", "overanalyzing", "mental loop", "mind running in circles",
            "second guessing every move", "brain is on fire", "cannot quiet my mind"
        ],
        "templates": [
            "exhausted from {word}", "trapped in endless {word}", "spiraling into {word}",
            "paralyzed by {word}", "tortured by {word}", "losing sleep over {word}",
            "caught in a loop of {word}"
        ]
    },
    "motivation": {
        "intent": "statement", "valence": 0.6, "intensity": 6.0,
        "seeds": [
            "motivated", "seeking motivation", "ready to work", "driven to succeed", "fire in my belly",
            "hungry for progress", "want to achieve", "inspired to build", "getting things done",
            "finding my drive", "recharging motivation", "determination", "eager to start", "crushing my goals",
            "feeling capable", "motivated mindset", "ready to conquer the day"
        ],
        "templates": [
            "looking for fresh {word}", "feeling a spark of {word}", "tapping into my {word}",
            "channeling positive {word}", "fueled by genuine {word}", "needing a dose of {word}",
            "discovering my inner {word}"
        ]
    },
    "discipline": {
        "intent": "statement", "valence": 0.5, "intensity": 6.0,
        "seeds": [
            "discipline", "self discipline", "staying consistent", "daily habits", "sticking to routine",
            "resisting temptation", "focused effort", "showing up every day", "willpower", "grit",
            "dedication", "routine and order", "steady focus", "unwavering commitment", "training my mind"
        ],
        "templates": [
            "building stronger {word}", "relying on {word}", "practicing daily {word}",
            "cultivating quiet {word}", "demanding {word} from myself", "grounded in {word}"
        ]
    },
    "confidence": {
        "intent": "positive", "valence": 0.7, "intensity": 6.8,
        "seeds": [
            "confident", "believing in myself", "standing tall", "self confidence", "empowered", "bold",
            "assertive", "unshakable confidence", "owning my space", "feeling proud", "sure of myself",
            "stepping up", "radiating confidence", "faith in my abilities", "strong and capable"
        ],
        "templates": [
            "growing in {word}", "stepping out with {word}", "feeling newfound {word}",
            "radiating calm {word}", "anchored in self {word}", "rediscovering my {word}"
        ]
    },
    "self_worth": {
        "intent": "statement", "valence": -0.6, "intensity": 7.0,
        "seeds": [
            "self worth", "feeling worthless", "not good enough", "imposter syndrome", "feeling like a burden",
            "hate myself", "low self esteem", "self hatred", "am i enough", "doubting my value",
            "feeling insignificant", "unworthy of love", "deserving of good things", "measuring my value"
        ],
        "templates": [
            "struggling with low {word}", "questioning my {word}", "doubting my {word}",
            "trying to rebuild my {word}", "hurt by feelings of low {word}", "reclaiming my {word}"
        ]
    },
    "failure": {
        "intent": "venting", "valence": -0.7, "intensity": 7.2,
        "seeds": [
            "failed", "failure", "flunked", "screwed up", "messed up everything", "ruined my chance",
            "dropped the ball", "complete failure", "didnt make the cut", "fell flat on my face",
            "lost everything", "defeated", "feeling like a total failure", "botched the opportunity"
        ],
        "templates": [
            "coping with painful {word}", "heartbroken by this {word}", "ashamed of my {word}",
            "staring at total {word}", "reeling from a recent {word}", "feeling defined by {word}"
        ]
    },
    "disappointment": {
        "intent": "venting", "valence": -0.6, "intensity": 6.0,
        "seeds": [
            "disappointed", "let down", "expectations crushed", "dashed hopes", "bitter disappointment",
            "underwhelmed", "disheartened", "disillusioned", "let down by someone", "bummed out",
            "hopes fell apart", "nothing went as planned", "so disappointed with myself"
        ],
        "templates": [
            "wrestling with deep {word}", "stung by bitter {word}", "swallowing sharp {word}",
            "coping with another {word}", "saddened by this {word}", "heavy with {word}"
        ]
    },
    "hope": {
        "intent": "positive", "valence": 0.7, "intensity": 6.5,
        "seeds": [
            "hopeful", "optimistic", "looking forward", "better days ahead", "light at end of tunnel",
            "things will improve", "holding onto hope", "glimmer of hope", "cautiously optimistic",
            "trusting the process", "seeing the silver lining", "believing in tomorrow", "brighter future"
        ],
        "templates": [
            "filled with gentle {word}", "clinging to {word}", "anchored in quiet {word}",
            "finding a tiny spark of {word}", "rekindling my {word}", "surrendering to {word}"
        ]
    },
    "recovery": {
        "intent": "positive", "valence": 0.6, "intensity": 6.2,
        "seeds": [
            "recovering", "healing process", "getting better", "on the mend", "taking steps forward",
            "healing my heart", "working through trauma", "day by day progress", "finding balance again",
            "restoring energy", "bouncing back", "learning to smile again", "rebuilding my life"
        ],
        "templates": [
            "committed to deep {word}", "proud of my {word}", "focusing on personal {word}",
            "taking time for {word}", "celebrating small steps in {word}", "grounded in quiet {word}"
        ]
    },
    "gratitude": {
        "intent": "positive", "valence": 0.8, "intensity": 6.5,
        "seeds": [
            "grateful", "thankful", "blessed", "counting my blessings", "appreciating the little things",
            "so appreciative", "heart is thankful", "feeling blessed", "thankful for support",
            "deep appreciation", "cherishing the moment", "thankful to be alive", "grateful heart"
        ],
        "templates": [
            "overflowing with {word}", "filled with sincere {word}", "pausing in deep {word}",
            "noting with humble {word}", "resting in genuine {word}", "waking up with {word}"
        ]
    },
    "peace_calm": {
        "intent": "positive", "valence": 0.7, "intensity": 5.0,
        "seeds": [
            "peaceful", "calm", "serene", "tranquil", "quiet mind", "stillness", "at ease", "relaxed",
            "inner peace", "settled", "breathing easy", "soft quiet", "steady and calm", "content",
            "unhurried", "restful state", "feeling serene", "peace of mind", "calm waters"
        ],
        "templates": [
            "soaking in the {word}", "enjoying quiet {word}", "anchored in deep {word}",
            "welcoming a sense of {word}", "drifting into gentle {word}", "breathing in {word}"
        ]
    },
    "emotional_exhaustion": {
        "intent": "venting", "valence": -0.7, "intensity": 7.5,
        "seeds": [
            "emotionally exhausted", "burnt out", "drained", "running on fumes", "nothing left to give",
            "tired in my bones", "spent", "mental exhaustion", "wiped out", "at my limit", "depleted",
            "heavy fatigue", "bone tired", "completely out of energy", "weary soul", "cannot keep going"
        ],
        "templates": [
            "suffering from severe {word}", "drowning in {word}", "paralyzed by {word}",
            "collapsing under {word}", "dealing with chronic {word}", "overcome by heavy {word}"
        ]
    },
    "fear": {
        "intent": "venting", "valence": -0.7, "intensity": 7.5,
        "seeds": [
            "scared", "fearful", "terrified", "frightened", "petrified", "spooked", "paralyzed by fear",
            "shaking with fright", "afraid of what comes next", "deep fear", "irrational fear",
            "haunted by fears", "scared of being alone", "dreading the future", "afraid to fail"
        ],
        "templates": [
            "trembling with {word}", "crippled by deep {word}", "facing my worst {word}",
            "paralyzed by cold {word}", "admitting my {word}", "trying to overcome {word}"
        ]
    },
    "shame": {
        "intent": "venting", "valence": -0.8, "intensity": 8.0,
        "seeds": [
            "ashamed", "deep shame", "humiliated", "embarrassed to my core", "want to hide away",
            "disgusted with myself", "unbearable shame", "shameful feelings", "hiding my face",
            "feel so dirty", "ashamed of who i am", "cannot look in the mirror", "heavy shame"
        ],
        "templates": [
            "weighed down by toxic {word}", "drowning in painful {word}", "burning with {word}",
            "paralyzed by secret {word}", "struggling with quiet {word}", "shaking off deep {word}"
        ]
    },
    "guilt": {
        "intent": "venting", "valence": -0.7, "intensity": 7.2,
        "seeds": [
            "guilty", "guilt", "remorse", "blaming myself", "my fault", "i ruined it", "eating me alive",
            "feel terrible about what i did", "guilt trip", "regretting my actions", "conscience hurting",
            "haunted by guilt", "carrying the blame", "so sorry for my mistake", "burdened with guilt"
        ],
        "templates": [
            "crushed by heavy {word}", "consumed by gnawing {word}", "living with silent {word}",
            "tortured by endless {word}", "confessing my {word}", "seeking relief from {word}"
        ]
    },
    "regret": {
        "intent": "venting", "valence": -0.6, "intensity": 6.8,
        "seeds": [
            "regret", "wish i could undo", "wish i never said that", "looking back with regret",
            "if only i knew", "wishing for a do over", "haunted by past choices", "deep regret",
            "bitter remorse", "kicking myself", "should have done better", "cannot take it back"
        ],
        "templates": [
            "drowning in painful {word}", "carrying years of {word}", "looking back with {word}",
            "suffering from sharp {word}", "weighed down by heavy {word}", "sitting with deep {word}"
        ]
    },
    "grief_loss": {
        "intent": "venting", "valence": -0.9, "intensity": 8.8,
        "seeds": [
            "grief", "grieving", "mourning", "loss of a loved one", "passed away", "funeral", "bereavement",
            "heavy loss", "unbearable grief", "mourning my loss", "someone died", "crying over loss",
            "missing someone who passed", "heart broken by death", "the pain of losing them", "grief wave"
        ],
        "templates": [
            "swallowed by waves of {word}", "navigating deep {word}", "sitting in quiet {word}",
            "paralyzed by raw {word}", "carrying the weight of {word}", "shattered by this {word}"
        ]
    },
    "compassion": {
        "intent": "statement", "valence": 0.7, "intensity": 5.8,
        "seeds": [
            "compassion", "self compassion", "gentle kindness", "holding grace", "kind to myself",
            "extending grace", "treating myself gently", "compassionate mindset", "softening my heart",
            "forgiving presence", "tender understanding", "loving kindness", "gentle patience"
        ],
        "templates": [
            "practicing quiet {word}", "learning the art of {word}", "seeking deeper {word}",
            "surrounding myself with {word}", "anchored in sincere {word}", "offering myself {word}"
        ]
    },
    "resilience": {
        "intent": "positive", "valence": 0.6, "intensity": 6.8,
        "seeds": [
            "resilient", "bouncing back", "unbroken", "still standing", "weathering the storm",
            "perseverance", "inner strength", "refusing to give up", "toughening up", "standing tall",
            "stronger than before", "enduring the storm", "rising from the ashes", "iron will"
        ],
        "templates": [
            "finding my inner {word}", "reminded of my {word}", "standing with quiet {word}",
            "testing my own {word}", "proud of this {word}", "fortified by {word}"
        ]
    },
    "personal_growth": {
        "intent": "positive", "valence": 0.6, "intensity": 6.0,
        "seeds": [
            "growing as a person", "self improvement", "learning from mistakes", "evolving",
            "becoming better", "personal development", "maturing", "working on myself",
            "breaking old patterns", "stepping into maturity", "expanding my mind", "self actualization"
        ],
        "templates": [
            "focused on continuous {word}", "proud of my {word}", "dedicated to genuine {word}",
            "embracing the pain of {word}", "committed to lifetime {word}", "celebrating my {word}"
        ]
    },
    "career_pressure": {
        "intent": "venting", "valence": -0.5, "intensity": 6.5,
        "seeds": [
            "job stress", "worried about career", "boss is toxic", "fear of getting fired", "layoffs",
            "work performance review", "office politics", "career stagnation", "underpaid and overworked",
            "cannot find a job", "unemployed and stressed", "promotions passed over", "workload overload"
        ],
        "templates": [
            "suffering under intense {word}", "anxious about {word}", "dealing with heavy {word}",
            "feeling crushed by {word}", "exhausted by constant {word}", "paralyzed by {word}"
        ]
    },
    "academic_stress": {
        "intent": "venting", "valence": -0.6, "intensity": 6.8,
        "seeds": [
            "exam stress", "failing my exams", "college pressure", "study anxiety", "too much homework",
            "midterms stress", "finals week panic", "gpa dropping", "cannot study", "dissertation stress",
            "thesis deadline", "afraid of flunking semester", "academic burnout", "studying all night"
        ],
        "templates": [
            "drowning in {word}", "panicking over {word}", "breaking down from {word}",
            "consumed by {word}", "overwhelmed by mounting {word}", "crying from {word}"
        ]
    },
    "family_relationships": {
        "intent": "venting", "valence": -0.5, "intensity": 6.5,
        "seeds": [
            "family drama", "parents arguing", "toxic parents", "fighting with mom", "father issues",
            "sibling rivalry", "family expectations", "disowned by family", "family pressure",
            "unsupportive family", "feeling suffocated at home", "strict parents", "family tension"
        ],
        "templates": [
            "exhausted by constant {word}", "hurting from painful {word}", "dealing with heavy {word}",
            "crying over recent {word}", "trapped in toxic {word}", "stressed by {word}"
        ]
    },
    "emotional_attachment": {
        "intent": "statement", "valence": -0.4, "intensity": 6.0,
        "seeds": [
            "too attached", "codependency", "clingy", "anxious attachment", "fear of abandonment",
            "obsessed with them", "cannot let go", "unhealthy attachment", "relying on them for happiness",
            "fear of them leaving", "needy and desperate", "glued to their attention"
        ],
        "templates": [
            "struggling with deep {word}", "trying to break my {word}", "anxious about my {word}",
            "confused by this {word}", "recognizing unhealthy {word}", "drowning in {word}"
        ]
    },
    "healthy_boundaries": {
        "intent": "statement", "valence": 0.5, "intensity": 6.0,
        "seeds": [
            "setting boundaries", "saying no", "protecting my peace", "healthy distance", "drawing the line",
            "stopping people pleasing", "not letting people take advantage", "respecting my boundaries",
            "standing firm on boundaries", "communicating my limits", "emotional boundaries"
        ],
        "templates": [
            "learning to hold {word}", "working on enforcing {word}", "proud of setting {word}",
            "discovering the power of {word}", "practicing firm {word}", "anchored in {word}"
        ]
    },
    "forgiveness": {
        "intent": "statement", "valence": 0.5, "intensity": 6.0,
        "seeds": [
            "forgiveness", "forgiving them", "letting go of resentment", "releasing grudges", "forgiving myself",
            "peace over revenge", "softening toward them", "pardon", "clearing the air", "releasing the anger"
        ],
        "templates": [
            "seeking the peace of {word}", "struggling with painful {word}", "opening my heart to {word}",
            "choosing quiet {word}", "ready for mutual {word}", "grounded in {word}"
        ]
    },
    "acceptance": {
        "intent": "statement", "valence": 0.5, "intensity": 5.5,
        "seeds": [
            "acceptance", "it is what it is", "accepting reality", "making peace with things", "surrender",
            "letting things be", "stopping the fight", "accepting my flaws", "peace with how it ended",
            "embracing what happened", "non resistance", "radically accepting"
        ],
        "templates": [
            "arriving at gentle {word}", "leaning into radical {word}", "finding peace through {word}",
            "resting in quiet {word}", "choosing humble {word}", "anchored in full {word}"
        ]
    },
    "positive_affirmations": {
        "intent": "positive", "valence": 0.8, "intensity": 6.5,
        "seeds": [
            "i am capable", "i am worthy", "i am enough", "i can do this", "i am strong", "i deserve peace",
            "i choose joy", "i believe in myself", "i am growing every day", "i love who i am becoming",
            "i am safe right now", "i trust myself", "i have survived everything so far"
        ],
        "templates": [
            "repeating to myself {word}", "holding onto the truth that {word}", "reminding my soul {word}",
            "standing tall believing {word}", "whispering to myself {word}", "affirming {word}"
        ]
    },
    "self_reflection": {
        "intent": "statement", "valence": 0.2, "intensity": 5.0,
        "seeds": [
            "reflecting on my life", "looking inward", "journaling my thoughts", "asking myself hard questions",
            "introspective mood", "examining my motives", "analyzing my behavior", "quiet contemplation",
            "soul searching", "meditating on what matters", "unpacking my emotions"
        ],
        "templates": [
            "spending time in {word}", "lost in deep {word}", "dedicated to quiet {word}",
            "finding clarity through {word}", "embracing honest {word}", "grounded in {word}"
        ]
    },
    "requests_for_listening": {
        "intent": "request_listening", "valence": -0.2, "intensity": 5.5,
        "seeds": [
            "just listen to me", "i just want to vent", "need a listening ear", "dont give advice just listen",
            "can you just hear me out", "no solutions needed just listen", "please just sit with me",
            "i just need to let it all out", "let me talk for a minute", "just need someone to understand"
        ],
        "templates": [
            "begging you to {word}", "asking if you can {word}", "desperately needing someone to {word}",
            "hoping you will {word}", "reaching out to say {word}", "wondering if you can {word}"
        ]
    },
    "requests_for_advice": {
        "intent": "request_advice", "valence": 0.0, "intensity": 5.5,
        "seeds": [
            "what should i do", "need your advice", "how do i handle this", "give me guidance",
            "what is the next step", "any tips for me", "tell me what to do", "seeking your perspective",
            "how can i solve this", "what would you do in my shoes", "need practical suggestions"
        ],
        "templates": [
            "honestly asking {word}", "reaching out for {word}", "desperately asking {word}",
            "hoping for your {word}", "wondering {word}", "open to any {word}"
        ]
    },
    "emotional_confusion": {
        "intent": "statement", "valence": -0.3, "intensity": 5.5,
        "seeds": [
            "dont know what i feel", "confused emotions", "mixed feelings", "feeling lost inside",
            "cannot name my feeling", "emotional rollercoaster", "all over the place", "feeling so weird",
            "up and down constantly", "head and heart disagree", "disconnected from my emotions"
        ],
        "templates": [
            "struggling with {word}", "overwhelmed by {word}", "lost in {word}",
            "experiencing strange {word}", "exhausted by this {word}", "dealing with {word}"
        ]
    },
    "crisis_safety": {
        "intent": "crisis", "valence": -1.0, "intensity": 10.0,
        "seeds": [
            "i want to die", "kill myself", "end my life", "commit suicide", "cannot live anymore",
            "want to disappear forever", "no reason to live", "better off dead", "cutting myself",
            "self harm", "overdose on pills", "jump off", "hang myself", "take my own life",
            "everyone better off without me", "i want it all to end", "end it tonight", "cannot take living"
        ],
        "templates": [
            "crying because {word}", "honestly {word}", "scared because {word}",
            "terrified that {word}", "whispering {word}", "reaching out because {word}",
            "paralyzed because {word}"
        ]
    }
}

def generate_dataset():
    entries = []
    seen = set()

    # Pass 1: Seeds and Direct Templates
    for cat_name, data in RAW_CATEGORIES.items():
        intent = data["intent"]
        valence = data["valence"]
        intensity = data["intensity"]
        seeds = data["seeds"]
        templates = data.get("templates", [])

        for s in seeds:
            norm = normalize_text(s)
            if norm and norm not in seen:
                seen.add(norm)
                entries.append({
                    "phrase": norm,
                    "category": cat_name,
                    "intent": intent,
                    "intensity": intensity,
                    "valence": valence
                })

        for tmpl in templates:
            for s in seeds:
                cand = tmpl.format(word=s)
                norm = normalize_text(cand)
                if norm and norm not in seen:
                    seen.add(norm)
                    entries.append({
                        "phrase": norm,
                        "category": cat_name,
                        "intent": intent,
                        "intensity": intensity,
                        "valence": valence
                    })

    # Pass 2: Conversational Prefixes & Modifiers for Deep Expressive Coverage
    conversational_prefixes = [
        "honestly", "really", "lately", "right now", "today", "deep down",
        "i feel like", "i guess", "it seems like", "sometimes", "always",
        "truly", "to be honest", "cant help but feel", "sitting here feeling"
    ]

    for cat_name, data in RAW_CATEGORIES.items():
        if len(seen) >= 6000:
            break
        intent = data["intent"]
        valence = data["valence"]
        intensity = data["intensity"]
        seeds = data["seeds"]

        for prefix in conversational_prefixes:
            for s in seeds:
                if len(seen) >= 6000:
                    break
                cand = f"{prefix} {s}"
                norm = normalize_text(cand)
                if norm and norm not in seen:
                    seen.add(norm)
                    entries.append({
                        "phrase": norm,
                        "category": cat_name,
                        "intent": intent,
                        "intensity": intensity,
                        "valence": valence
                    })

    print(f"Generated {len(entries)} verified unique entries across {len(RAW_CATEGORIES)} categories.")

    with open(DATASET_PATH, "w", encoding="utf-8") as f:
        json.dump(entries, f, indent=2, ensure_ascii=False)

    print(f"Saved dataset successfully to {DATASET_PATH}")
    return len(entries)

if __name__ == "__main__":
    generate_dataset()
