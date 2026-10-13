import bcrypt
from datetime import datetime, timedelta
from typing import Optional
from jose import JWTError, jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from database import get_db
from config import settings
from bson import ObjectId

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")


class UserSession:
    def __init__(self, doc: dict):
        self.id = str(doc["_id"])
        self.email = doc.get("email") or ""
        self.username = doc.get("username", "")
        self.role = doc.get("role", "user")
        self.hashed_password = doc.get("hashed_password", "")
        self.full_name = doc.get("full_name")
        self.bio = doc.get("bio")
        self.avatar_url = doc.get("avatar_url")
        self.is_active = doc.get("is_active", True)
        self.is_verified = doc.get("is_verified", False)
        self.created_at = doc.get("created_at")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))
    except Exception:
        return False


def get_password_hash(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + (
        expires_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db = Depends(get_db),
):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    try:
        oid = ObjectId(user_id)
    except Exception:
        raise credentials_exception

    user_doc = await db.users.find_one({"_id": oid})
    if user_doc is None or not user_doc.get("is_active", True):
        raise credentials_exception
    return UserSession(user_doc)


async def get_current_admin(
    current_user: UserSession = Depends(get_current_user),
    db = Depends(get_db),
) -> UserSession:
    """Strictly verify administrator privileges against the database."""
    try:
        oid = ObjectId(current_user.id)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
        )
    user_doc = await db.users.find_one({"_id": oid})
    if not user_doc or user_doc.get("role") != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: Administrator privileges required",
        )
    return current_user
