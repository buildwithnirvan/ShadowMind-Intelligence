from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List
from datetime import datetime


class MoodCreate(BaseModel):
    score: float = Field(..., ge=1, le=10)
    label: str
    energy_level: Optional[float] = Field(None, ge=1, le=10)
    stress_level: Optional[float] = Field(None, ge=1, le=10)
    anxiety_level: Optional[float] = Field(None, ge=1, le=10)
    sleep_hours: Optional[float] = Field(None, ge=0, le=24)
    notes: Optional[str] = None
    tags: Optional[List[str]] = None
    triggers: Optional[List[str]] = None


class MoodUpdate(BaseModel):
    score: Optional[float] = Field(None, ge=1, le=10)
    label: Optional[str] = None
    energy_level: Optional[float] = Field(None, ge=1, le=10)
    stress_level: Optional[float] = Field(None, ge=1, le=10)
    anxiety_level: Optional[float] = Field(None, ge=1, le=10)
    sleep_hours: Optional[float] = None
    notes: Optional[str] = None
    tags: Optional[List[str]] = None
    triggers: Optional[List[str]] = None


class MoodOut(BaseModel):
    model_config = ConfigDict(from_attributes=True, extra='ignore')

    id: str
    user_id: str
    score: float
    label: str
    energy_level: Optional[float] = None
    stress_level: Optional[float] = None
    anxiety_level: Optional[float] = None
    sleep_hours: Optional[float] = None
    notes: Optional[str] = None
    tags: Optional[List[str]] = None
    triggers: Optional[List[str]] = None
    created_at: datetime
