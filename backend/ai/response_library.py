"""
Structured Response Template Library for ShadowMind's Offline Emotional Engine.
Provides varied, supportive, and practical offline templates for all 50 emotional categories.
"""
from typing import Dict, List

TEMPLATES: Dict[str, List[str]] = {
    "general_greetings": [
        "Hello! I am here and glad to chat with you today. How are you feeling right now?",
        "Hey there. Welcome to ShadowMind. I'm here to listen and help however I can. What's on your mind?",
        "Hi! Good to see you. How is your day treating you so far?",
        "Hello my friend. I'm right here with you. Feel free to share whatever you're experiencing today."
    ],
    "warmth_empathy": [
        "Thank you for sharing that with me. It is completely safe to express yourself here, and you are heard.",
        "I really appreciate you trusting me with your thoughts. I am right here with you, without any judgment.",
        "Your feelings are completely valid, and you don't have to carry them alone tonight."
    ],
    "happiness_joy": [
        "That is wonderful to hear! Moments of genuine joy and lightness are precious—soak in every bit of it.",
        "I am so glad you're feeling this good! What has been the best part of today?",
        "Seeing you in such high spirits is truly uplifting. Celebrate this feeling—you deserve it!"
    ],
    "excitement": [
        "That energy is contagious! It sounds like something truly exciting is in the air. What are you looking forward to most?",
        "I love hearing that excitement in your words! Tell me all about it—what's making your heart race with joy?",
        "Ride that wave of excitement! It's such a vibrant feeling to have."
    ],
    "love_affection": [
        "Having deep love and warmth in your life is a beautiful gift. Cherish that connection and let it fill your cup.",
        "It sounds like your heart is full of genuine affection. Holding onto care and love makes the world a kinder place.",
        "That tenderness is really touching. What does that connection mean to you?"
    ],
    "sadness": [
        "I'm really sorry you're feeling this low today. It takes courage to put sorrow into words, and I'm sitting right here with you.",
        "That heavy sadness is real, and it makes sense that you feel drained. You don't have to force a smile or pretend everything is fine here.",
        "I hear the pain in your words. When sadness is heavy, taking things one breath and one moment at a time is enough. What feels most tender right now?"
    ],
    "depression": [
        "I'm really sorry it feels this heavy and hollow right now, and thank you for trusting me with it. Depression can make even getting through the day feel exhausting.\n\nYou do not have to carry this alone. If it has been this way for more than a couple of weeks, speaking with a doctor, counsellor, or taking a gentle check-in can help give you solid ground. What has daily energy felt like today?",
        "I am so sorry things feel this dark. Feeling numb or drained is deeply tiring, but you are not alone in this. Please remember that your current state is not a permanent verdict on who you are. Would you like to take a quiet breath together, or just talk through what today was like?"
    ],
    "loneliness": [
        "Feeling that isolated is a truly painful ache, and I want you to know you are not invisible here. I am right here listening to you.",
        "Loneliness has a way of convincing us that nobody cares, but that feeling lies. Is there one person you could send a tiny, low-pressure message to today?",
        "It is really hard when the silence feels too loud. Thank you for reaching out here—you are never a burden."
    ],
    "breakups_heartbreak": [
        "Heartbreak shakes your entire foundation, and the grief of losing that bond is profound. Allow yourself to mourn without judging how long it takes.",
        "I'm so sorry your heart is hurting like this. When a relationship ends, your whole daily routine has to rewire itself. Be exceedingly gentle with yourself today.",
        "The ache of a breakup is real physical and emotional pain. Take it one day at a time—you will rebuild your peace, step by step."
    ],
    "missing_someone": [
        "Missing someone deeply is a reflection of how meaningful their presence was to you. It's completely natural that their absence leaves an empty space.",
        "The longing for someone who isn't there can hit in sudden waves. Give yourself permission to feel that ache without rushing to push it away.",
        "Old memories have a way of echoing. When you miss them, what memory brings you the most warmth?"
    ],
    "rejection_unrequited": [
        "Rejection stings deeply, but remember: someone not choosing you or seeing your value is never a measure of your worth as a human being.",
        "It hurts when your feelings aren't reciprocated. It takes bravery to be vulnerable, and you should be proud of having a heart that dares to care.",
        "That sting of being turned down takes time to heal. You deserve relationships where you are chosen with enthusiasm, not hesitation."
    ],
    "relationship_confusion": [
        "Mixed signals and uncertainty in a relationship are exhausting to navigate. You deserve clarity and emotional safety.",
        "When you're caught in relationship doubt, checking in with your core needs often helps: what is one boundary or clear conversation that would give you peace?",
        "Walking on eggshells or second-guessing someone's intentions drains your energy. What does your gut tell you about the situation?"
    ],
    "friendship_problems": [
        "Friendship hurts cut just as deep as romantic ones, especially when trust is tested. Your feelings of betrayal or distance are completely valid.",
        "It's really painful when friendships drift or fracture. Give yourself space to assess whether this relationship honors who you are today.",
        "Losing or arguing with a friend can feel deeply disorienting. Would it help to talk through what happened?"
    ],
    "jealousy": [
        "Jealousy is a very human emotion—it often simply points to an unmet desire or a fear of not being enough. Acknowledge it without beating yourself up.",
        "Comparing your chapter to someone else's highlight reel will always feel unfair. What is something in your own life that you want to cultivate more of?",
        "Jealousy often asks: 'What do I feel I am missing?' Looking at the root behind the envy can turn it into clarity."
    ],
    "anger": [
        "I hear how furious and fed up you are. Anger is often a protective signal that a boundary or core value was violated—your frustration is completely valid.",
        "Take a slow, deep breath with me. You have every right to feel mad, but let's make sure that anger doesn't end up hurting you or draining your peace.",
        "It sounds infuriating. What feels like the most unfair part of what happened?"
    ],
    "stress": [
        "When stress piles up, everything feels urgent all at once. Let's hit pause for just sixty seconds and let your shoulders drop.",
        "High pressure can make your mind spin in overdrive. What is the single most important thing on your plate today, and what can wait until tomorrow?",
        "Your nervous system is working in overdrive. Step back from the screen, take a slow sip of water, and lengthen your exhale. We can tackle this together."
    ],
    "anxiety": [
        "I hear the anxiety, and it makes complete sense that your body is on high alert. Let's ground right here: feel your feet planted firmly on the floor.",
        "Anxiety tries to treat every potential worry like an immediate crisis. Breathe in for 4 seconds, hold for 4, and exhale slowly for 6. You are safe in this moment.",
        "When the anxious loop starts spinning, bring your attention back to your senses: name 3 things you can touch near you. How does your chest feel now?"
    ],
    "overthinking": [
        "When your mind is caught in an endless loop, analyzing more rarely solves it. Thinking harder about a worry doesn't create safety—action and rest do.",
        "Let's break the spiral: write the worry down in one sentence on a piece of paper, and put it aside for the next thirty minutes. Give your mind permission to rest.",
        "Overthinking makes possibilities feel like certainties. What is one concrete fact you know for sure right now?"
    ],
    "motivation": [
        "Motivation usually follows small action rather than waiting for inspiration. Pick the tiniest 2-minute step you can do right now, and let momentum take over.",
        "You have the capability to make progress today. Focus on consistency over perfection—one small win builds the next.",
        "That drive is your superpower. What is the one goal you are most eager to advance today?"
    ],
    "discipline": [
        "Discipline is about choosing what you want most over what you want right now. Celebrate showing up, even on the days you don't feel like it.",
        "Small daily habits compound into massive life transformations. Stick to your baseline routine today—you've got this.",
        "Quiet consistency beats loud motivation every single time. What habit are you keeping steady today?"
    ],
    "confidence": [
        "Own your strength and trust your experience. You have handled hard challenges before, and you are fully equipped for what's ahead.",
        "Confidence grows every time you keep a promise to yourself. Stand tall and trust the voice inside you.",
        "You bring unique value to the table. Don't shrink to fit spaces you have outgrown."
    ],
    "self_worth": [
        "Please remember: your worth is inherent. It is not determined by your productivity, your mistakes, or other people's approval.",
        "When the inner critic gets loud, ask yourself: would you speak to a friend the way you're speaking to yourself right now? Give yourself that same grace.",
        "You are enough, exactly as you are in this moment. You don't have to earn the right to exist and be cared for."
    ],
    "failure": [
        "One setback or failed attempt is an event—it is not an identity. Every meaningful achievement is paved with trials that didn't go as planned.",
        "It's painful when things don't work out after trying so hard. Give yourself credit for stepping into the arena. What is the one lesson you take from this?",
        "Failure is simply feedback on an approach, not a verdict on your potential. Take a breath, dust off, and we can plan your next step."
    ],
    "disappointment": [
        "It really hurts when high hopes collapse into disappointment. Allow yourself to feel that sting without judging yourself for hoping in the first place.",
        "Disappointment is the gap between expectation and reality. When you're ready, let's look at what pieces we can pick up from here.",
        "I'm sorry things didn't turn out the way you deserved. I am right here with you."
    ],
    "hope": [
        "Holding onto hope is an act of profound resilience. Even a tiny glimmer of light is enough to guide your next step forward.",
        "It is heartening to feel things beginning to lift. Nurture that optimism—you have walked through dark valleys to get here.",
        "Believing in tomorrow gives today its strength. What are you most hopeful for?"
    ],
    "recovery": [
        "Healing is not a straight line, but every small day of care and recovery adds up. Celebrate how far you've come from the darkest moments.",
        "Taking time to mend and rest is essential work. Honor your pace—there is no need to rush your healing.",
        "You are rebuilding yourself with greater wisdom and strength. I am proud of your progress."
    ],
    "gratitude": [
        "Noticing what is good grounds your heart in abundance. Cultivating thankfulness changes how you experience the day.",
        "That is such a beautiful thing to notice. What is one small detail from today that brought you a smile?",
        "Gratitude turns what we have into enough. Keep that warmth close to your heart."
    ],
    "peace_calm": [
        "Enjoy this quiet serenity. Stillness is where your body repairs and your mind finds its natural balance.",
        "There is nothing you need to fix or achieve in this moment. Breathe gently and let this peacefulness settle into your chest.",
        "Hold onto this steady calm as you move through your day."
    ],
    "emotional_exhaustion": [
        "You are running on empty because you have been carrying too much for too long. Put the heavy load down—your only job right now is to rest.",
        "Deep emotional fatigue requires genuine recovery, not pushing through. Cancel non-essential demands and give your mind permission to be offline.",
        "I hear how tired your spirit is. Rest is not something you have to earn—it is an absolute necessity. How can you nurture yourself tonight?"
    ],
    "fear": [
        "Fear shrinks our sense of what we can handle, but you are more resilient than your anxiety predicts. Take one slow breath—you are safe here.",
        "It's completely normal to feel afraid when facing the unknown. What would help you feel even ten percent safer right now?",
        "I'm here with you in the dark. We don't have to face the whole future right now—just this single moment."
    ],
    "shame": [
        "Shame tells you 'I am bad', while guilt says 'I did something I regret'. The first one is a lie. You are a human being learning and evolving.",
        "Shame thrives in silence and secrecy. By speaking it out loud here, you are already breaking its power. You deserve compassion, not condemnation.",
        "Treat yourself with gentleness. Mistakes are part of being human—they do not corrupt your core worth."
    ],
    "guilt": [
        "Guilt shows that you have a functioning conscience, but replaying an event endlessly only becomes self-punishment. Focus on repair over regret.",
        "If an honest apology or amends can be made, plan that step. If not, forgive yourself for what you didn't know then.",
        "Holding onto guilt won't change yesterday. What is one small, kind action you can take today instead?"
    ],
    "regret": [
        "Looking back with regret means you have grown wiser since that moment. Honor that growth rather than torturing yourself with what-ifs.",
        "We always make decisions with the awareness and emotional capacity we had at the time. Give your past self some grace.",
        "You cannot rewrite the first chapter, but you hold the pen for the next one. What direction do you want to choose now?"
    ],
    "grief_loss": [
        "Grief is love with nowhere to go. It arrives in unpredictable waves, and there is no timeline or 'right way' to grieve. I am here with you.",
        "I am so deeply sorry for your loss. When the waves feel overwhelming, just focus on the next breath. You don't have to be strong right now.",
        "Honoring someone you lost means honoring the love you shared. Carry that memory with gentleness."
    ],
    "compassion": [
        "Extending warmth to yourself is the foundation for everything else. Keep treating yourself like someone you deeply care about.",
        "Compassion isn't weakness—it is the strength to meet pain with softness instead of judgment.",
        "Hold yourself with kindness today. You are doing the best you can with what you have."
    ],
    "resilience": [
        "Look at everything you have weathered. You are still here, still standing, and still moving forward. That is true inner strength.",
        "Storms may shake the branches, but your roots are deep. Trust your ability to endure and adapt.",
        "You have overcome every difficult day you've ever faced so far. You can handle this one too."
    ],
    "personal_growth": [
        "Growing and evolving is challenging work, but you are becoming a wiser, more grounded version of yourself with every lesson.",
        "Celebrate the self-awareness it takes to examine your habits and choose growth. That takes real maturity.",
        "Growth is often quiet and gradual. Notice how differently you respond to things today compared to last year."
    ],
    "career_pressure": [
        "Career and workplace stress can consume so much mental energy. Remember that your job is what you do—it is not who you are.",
        "Separate what is in your direct control from office politics or broader market conditions. What is one practical step you can take today for your career?",
        "Don't let workplace demands sacrifice your health or peace. Protect your boundaries and know that your skills have real value."
    ],
    "academic_stress": [
        "Exams and coursework can make it feel like your entire future is on the line, but one grade or semester does not define your life.",
        "Break the study load into 25-minute focused sprints with real 5-minute screen-free breaks. You absorb more when your brain isn't exhausted.",
        "Take a deep breath. You prepared for this, and your intelligence is far greater than any single exam paper."
    ],
    "family_relationships": [
        "Family dynamics can be some of the most emotionally complex relationships to navigate. You are allowed to protect your emotional boundaries.",
        "You cannot control how family members react or treat you, but you can choose how much access they have to your peace.",
        "Family tension hurts deeply. Give yourself permission to step back and breathe when things get heated."
    ],
    "emotional_attachment": [
        "Notice when healthy connection turns into anxious attachment. Your sense of security starts from within yourself, not in someone else's validation.",
        "Holding onto someone too tightly often comes from a fear of abandonment. Remind yourself: you are whole and capable on your own.",
        "Healthy love gives room to breathe. Practice anchoring your peace in your own daily routines."
    ],
    "healthy_boundaries": [
        "Setting boundaries isn't selfish—it is how you preserve your relationships and your sanity. Saying 'no' to others is often saying 'yes' to your peace.",
        "People who benefit from you having no boundaries will often resist when you set them. Stand firm anyway; your well-being matters.",
        "A clear boundary spoken kindly is an act of self-respect. What is one limit you are proud of honoring?"
    ],
    "forgiveness": [
        "Forgiveness is not about saying what happened was acceptable—it is about deciding that resentment will no longer occupy space in your mind.",
        "Forgiving yourself is often the hardest part. You did the best you could with the awareness you had back then. Let the burden go.",
        "Releasing bitterness frees your own energy, not the other person's. Choose freedom today."
    ],
    "acceptance": [
        "There is deep peace in radical acceptance: 'It is what it is, and I choose to meet it with a calm mind.'",
        "Fighting reality only multiplies suffering. Once you accept where things stand, your energy can shift to: 'What is my next best step?'",
        "Breathe into this moment of acceptance. You don't have to like what happened to make peace with where you are now."
    ],
    "positive_affirmations": [
        "Yes! Claim that truth: You are capable, you are worthy, and you are building a life of purpose and peace.",
        "Hold onto those positive words when doubt whispers. Let your affirmations be your steady anchor.",
        "You are strong, you are learning, and you are worthy of every good thing. Keep shining!"
    ],
    "self_reflection": [
        "Taking time to reflect and understand yourself is a mark of genuine wisdom. What has this period of your life been teaching you?",
        "When you pause to listen to your inner voice, clarity emerges from the noise. Trust what you discover.",
        "Journaling and self-reflection help turn raw emotion into insight. What feels most important to notice today?"
    ],
    "requests_for_listening": [
        "I am right here, and I am listening with complete presence. You don't need to filter your thoughts or look for advice—let it all out.",
        "I am holding space for you without any judgment or unsolicited tips. Speak freely, I am listening.",
        "Take all the time you need. I am here to hear you out completely."
    ],
    "requests_for_advice": [
        "Let's look at this practically together. When facing a complex challenge, breaking it down into manageable options is the best way forward.\n\n1. What is the most immediate priority right now?\n2. What is within your direct control vs outside of it?\n\nWhich of these would you like to explore first?",
        "Here is a grounded perspective: Identify the single next step that creates the most relief or clarity, and do that first. What feels like the natural next move?"
    ],
    "emotional_confusion": [
        "It's completely okay not to know exactly how you feel. Emotions don't always come with neat labels, and feeling mixed up is part of processing.",
        "When feelings are tangled, trying to force an answer can add more tension. Just sit with the sensations in your body for a moment without judging them.",
        "You don't have to figure it all out today. Allow yourself to be in-between—clarity will come in its own time."
    ],
    "crisis_safety": [
        "I hear how much pain you are carrying right now, and I want you to know you are not alone. Your life and safety matter deeply.\n\nPlease connect with someone who can support you right now:\n\n• Tele-MANAS (India, Free 24/7): 14416 or 1800-891-4416\n• Emergency Services: 112\n• Suicide & Crisis Lifeline (US / Canada): 988\n\nYou are not alone, and there are people ready to support you right now."
    ]
}


def get_response_for_category(category: str, turn: int = 1, intent: str = "statement") -> str:
    category_key = category if category in TEMPLATES else "peace_calm"
    options = TEMPLATES[category_key]
    idx = (turn - 1) % len(options)
    return options[idx]
