"""
ShadowMind AI package.

    analyzer   – emotion / crisis / theme detection (deterministic, no network)
    prompts    – system prompts + few-shot examples
    providers  – Claude, Groq and Ollama clients
    guard      – tone + safety validation of model replies
    composer   – high-quality offline replies (used when no model is reachable)
    engine     – orchestration: analyze → generate → validate → retry → fallback
    resources  – crisis helplines and in-app suggestion catalogue
"""
from .analyzer import analyze_text, TextAnalysis
from .engine import generate_chat_reply, ChatReply

__all__ = ["analyze_text", "TextAnalysis", "generate_chat_reply", "ChatReply"]
