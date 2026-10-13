from pydantic import BaseModel, ConfigDict
from typing import Optional
from datetime import datetime


class UserCreate(BaseModel):
    username: str
    password: str
    email: Optional[str] = None
    confirm_password: Optional[str] = None
    full_name: Optional[str] = None


class UserRegister(BaseModel):
    username: str
    password: str
    confirm_password: Optional[str] = None
    email: Optional[str] = None
    full_name: Optional[str] = None


class UserLogin(BaseModel):
    username: Optional[str] = None
    email: Optional[str] = None
    password: str


class GoogleAuthRequest(BaseModel):
    credential: Optional[str] = None
    token: Optional[str] = None
    email: Optional[str] = None
    name: Optional[str] = None
    picture: Optional[str] = None
    google_id: Optional[str] = None


class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    bio: Optional[str] = None
    avatar_url: Optional[str] = None


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True, extra='ignore')

    id: str
    username: str
    email: Optional[str] = None
    role: str = "user"
    full_name: Optional[str] = None
    bio: Optional[str] = None
    avatar_url: Optional[str] = None
    is_active: bool = True
    created_at: Optional[datetime] = None


class Token(BaseModel):
    access_token: str
    token_type: str
    user: UserOut


class TokenData(BaseModel):
    user_id: Optional[str] = None
    role: Optional[str] = None


class AdminCreate(BaseModel):
    username: str
    password: str
    confirm_password: str
    email: Optional[str] = None
    full_name: Optional[str] = None


class AdminOut(BaseModel):
    model_config = ConfigDict(from_attributes=True, extra='ignore')

    id: str
    username: str
    email: Optional[str] = None
    role: str = "admin"
    full_name: Optional[str] = None
    is_active: bool = True
    created_at: Optional[datetime] = None
    last_login: Optional[datetime] = None

