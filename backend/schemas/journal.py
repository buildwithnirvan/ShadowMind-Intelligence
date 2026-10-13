from pydantic import BaseModel, ConfigDict
from typing import Optional, List, Dict, Any
from datetime import datetime


class JournalCreate(BaseModel):
    title: str
    content: str
    mood_score: Optional[int] = None
    tags: Optional[List[str]] = None
    is_private: bool = True


class JournalUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    mood_score: Optional[int] = None
    tags: Optional[List[str]] = None
    is_private: Optional[bool] = None


class JournalOut(BaseModel):
    model_config = ConfigDict(from_attributes=True, extra='ignore')

    id: str
    user_id: str
    title: str
    content: str
    mood_score: Optional[int] = None
    tags: Optional[List[str]] = None
    is_private: bool
    ai_summary: Optional[str] = None
    ai_emotions: Optional[List[Dict[str, Any]]] = None
    ai_wellbeing_score: Optional[int] = None
    ai_future_mistakes: Optional[List[str]] = None
    ai_corrective_actions: Optional[List[str]] = None
    ai_insights: Optional[List[str]] = None
    ai_reflection_question: Optional[str] = None
    crisis_alert: Optional[bool] = False
    word_count: int
    created_at: datetime
    updated_at: Optional[datetime] = None
