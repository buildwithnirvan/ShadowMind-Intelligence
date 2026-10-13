from pydantic import BaseModel, ConfigDict, Field
from typing import Optional, List, Dict, Any, Literal
from datetime import datetime


class ChatMessageCreate(BaseModel):
    content: str
    role: str = "user"


class ChatMessageOut(BaseModel):
    model_config = ConfigDict(from_attributes=True, extra='ignore')

    id: str
    session_id: str
    role: str
    content: str
    created_at: datetime
    emotion: Optional[Dict[str, Any]] = None   # detected emotion on user messages
    meta: Optional[Dict[str, Any]] = None      # provider / suggestions / crisis level on assistant messages


class ChatSessionCreate(BaseModel):
    title: Optional[str] = None
    session_type: str = "general"


class ChatSessionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True, extra='ignore')

    id: str
    user_id: str
    title: Optional[str] = None
    session_type: str
    is_active: bool
    created_at: datetime
    messages: List[ChatMessageOut] = []
    ai_emotions: Optional[List[Dict[str, Any]]] = None
    ai_wellbeing_score: Optional[int] = None
    ai_future_mistakes: Optional[List[str]] = None
    ai_corrective_actions: Optional[List[str]] = None
    ai_summary: Optional[str] = None
    ai_insights: Optional[List[str]] = None
    ai_reflection_question: Optional[str] = None
    last_crisis_level: Optional[int] = 0


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=4000)
    session_id: Optional[str] = None
    session_type: Literal["general", "cbt", "mindfulness", "crisis"] = "general"
