from fastapi import APIRouter, Depends, HTTPException, status
from datetime import datetime
from pydantic import BaseModel
from database import get_db, convert_doc
from bson import ObjectId
from schemas.user import UserCreate, UserLogin, UserOut, UserUpdate, Token, GoogleAuthRequest
from utils.auth import verify_password, get_password_hash, create_access_token, get_current_user, UserSession
import httpx
import re
import secrets

router = APIRouter(prefix="/api/auth", tags=["auth"])


class PasswordChange(BaseModel):
    current_password: str
    new_password: str


def user_to_out(user_doc: dict) -> UserOut:
    """Safely convert a MongoDB user document to UserOut schema."""
    converted = convert_doc(user_doc)
    converted.setdefault("role", user_doc.get("role", "user"))
    return UserOut(**converted)


@router.post("/register", response_model=Token, status_code=status.HTTP_201_CREATED)
async def register(user_data: UserCreate, db=Depends(get_db)):
    # 1. Required-field validation
    username = (user_data.username or "").strip()
    if not username:
        raise HTTPException(status_code=400, detail="Username is required")
    if not user_data.password:
        raise HTTPException(status_code=400, detail="Password is required")
    if len(username) < 3:
        raise HTTPException(status_code=400, detail="Username must be at least 3 characters")
    if len(user_data.password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")

    # 2. Password confirmation validation
    if user_data.confirm_password is not None and user_data.password != user_data.confirm_password:
        raise HTTPException(status_code=400, detail="Password confirmation mismatch")

    # 3. Username uniqueness validation (case-insensitive)
    existing_username = await db.users.find_one({
        "username": {"$regex": f"^{re.escape(username)}$", "$options": "i"}
    })
    if existing_username:
        raise HTTPException(status_code=400, detail="Username already registered")

    # 4. Email validation if provided
    email = user_data.email.strip().lower() if user_data.email and user_data.email.strip() else None
    if email:
        existing_email = await db.users.find_one({"email": email})
        if existing_email:
            raise HTTPException(status_code=400, detail="Email already registered")
    else:
        # Fallback email to ensure compatibility
        email = f"{username.lower()}@shadowmind.local"

    # 5. Strict role assignment: role="user" (prevent privilege escalation / mass assignment)
    user_doc = {
        "username": username,
        "email": email,
        "hashed_password": get_password_hash(user_data.password),
        "role": "user",
        "full_name": user_data.full_name or username,
        "bio": None,
        "avatar_url": None,
        "is_active": True,
        "is_verified": False,
        "created_at": datetime.utcnow(),
    }
    try:
        result = await db.users.insert_one(user_doc)
        user_doc["_id"] = result.inserted_id
    except Exception as e:
        if "duplicate" in str(e).lower() or "11000" in str(e):
            raise HTTPException(status_code=400, detail="Username already registered")
        raise HTTPException(status_code=500, detail="Registration failed due to a database error")

    token = create_access_token({"sub": str(user_doc["_id"]), "role": "user"})
    return Token(access_token=token, token_type="bearer", user=user_to_out(user_doc))


@router.post("/login", response_model=Token)
async def login(credentials: UserLogin, db=Depends(get_db)):
    """Authenticate either user or admin by username or email."""
    identifier = (credentials.username or credentials.email or "").strip()
    if not identifier or not credentials.password:
        raise HTTPException(status_code=400, detail="Username and password are required")

    user = await db.users.find_one({
        "$or": [
            {"username": {"$regex": f"^{re.escape(identifier)}$", "$options": "i"}},
            {"email": identifier.lower()}
        ]
    })
    if not user or not verify_password(credentials.password, user.get("hashed_password", "")):
        raise HTTPException(status_code=401, detail="Invalid username or password")
    if not user.get("is_active", True):
        raise HTTPException(status_code=403, detail="Account is deactivated")

    await db.users.update_one({"_id": user["_id"]}, {"$set": {"last_login": datetime.utcnow()}})
    user_role = user.get("role", "user")
    token = create_access_token({"sub": str(user["_id"]), "role": user_role})
    return Token(access_token=token, token_type="bearer", user=user_to_out(user))


@router.post("/user/login", response_model=Token)
async def user_login(credentials: UserLogin, db=Depends(get_db)):
    """Dedicated endpoint for user portal authentication."""
    return await login(credentials, db)


@router.post("/admin/login", response_model=Token)
async def admin_login(credentials: UserLogin, db=Depends(get_db)):
    """Dedicated endpoint for admin portal authentication with strict role check."""
    identifier = (credentials.username or credentials.email or "").strip()
    if not identifier or not credentials.password:
        raise HTTPException(status_code=400, detail="Username and password are required")

    user = await db.users.find_one({
        "$or": [
            {"username": {"$regex": f"^{re.escape(identifier)}$", "$options": "i"}},
            {"email": identifier.lower()}
        ]
    })
    if not user or not verify_password(credentials.password, user.get("hashed_password", "")):
        raise HTTPException(status_code=401, detail="Invalid administrator credentials")

    # Strictly verify admin role
    if user.get("role") != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: Account does not have administrator privileges"
        )
    if not user.get("is_active", True):
        raise HTTPException(status_code=403, detail="Account is deactivated")

    await db.users.update_one({"_id": user["_id"]}, {"$set": {"last_login": datetime.utcnow()}})
    token = create_access_token({"sub": str(user["_id"]), "role": "admin"})
    return Token(access_token=token, token_type="bearer", user=user_to_out(user))


@router.post("/google", response_model=Token)
async def google_auth(req: GoogleAuthRequest, db=Depends(get_db)):
    """Authenticate with Google OAuth & automatically sync user's full name and picture from Google."""
    email = req.email
    full_name = req.name
    picture = req.picture
    google_id = req.google_id

    # If Google credential / ID token is provided, verify against Google tokeninfo endpoint
    if req.credential:
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                res = await client.get(f"https://oauth2.googleapis.com/tokeninfo?id_token={req.credential}")
                if res.status_code == 200:
                    info = res.json()
                    email = info.get("email") or email
                    full_name = info.get("name") or full_name
                    picture = info.get("picture") or picture
                    google_id = info.get("sub") or google_id
        except Exception:
            pass

    # If Google access token is provided, verify against Google userinfo endpoint
    elif req.token:
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                res = await client.get("https://www.googleapis.com/oauth2/v3/userinfo", headers={"Authorization": f"Bearer {req.token}"})
                if res.status_code == 200:
                    info = res.json()
                    email = info.get("email") or email
                    full_name = info.get("name") or full_name
                    picture = info.get("picture") or picture
                    google_id = info.get("sub") or google_id
        except Exception:
            pass

    if not email:
        raise HTTPException(status_code=400, detail="Google authentication did not provide a valid email address.")

    user = await db.users.find_one({"email": email})
    now = datetime.utcnow()

    if user:
        update_fields = {"last_login": now}
        # Update user's name from Google if available and not already customized
        if full_name and not user.get("full_name"):
            update_fields["full_name"] = full_name
        elif full_name and user.get("full_name") == user.get("username"):
            update_fields["full_name"] = full_name
        if picture and not user.get("avatar_url"):
            update_fields["avatar_url"] = picture
        if google_id:
            update_fields["google_id"] = google_id

        await db.users.update_one({"_id": user["_id"]}, {"$set": update_fields})
        user = await db.users.find_one({"_id": user["_id"]})
    else:
        # Generate clean unique username from email/name
        base_username = re.sub(r'[^a-zA-Z0-9_]', '', (email.split('@')[0] if email else 'operator')).lower()
        if not base_username:
            base_username = "operator"
        username = base_username
        suffix = 1
        while await db.users.find_one({"username": username}):
            username = f"{base_username}_{suffix}"
            suffix += 1

        random_pw = secrets.token_urlsafe(24)
        user_doc = {
            "email": email,
            "username": username,
            "full_name": full_name or username.title(),
            "hashed_password": get_password_hash(random_pw),
            "avatar_url": picture,
            "google_id": google_id,
            "bio": "ShadowMind Operator authenticated via Google.",
            "is_active": True,
            "is_verified": True,
            "created_at": now,
            "last_login": now,
        }
        res = await db.users.insert_one(user_doc)
        user_doc["_id"] = res.inserted_id
        user = user_doc

    token = create_access_token({"sub": str(user["_id"])})
    return Token(access_token=token, token_type="bearer", user=user_to_out(user))


@router.get("/me", response_model=UserOut)
async def get_me(current_user: UserSession = Depends(get_current_user), db=Depends(get_db)):
    # Re-fetch from DB to get freshest data
    doc = await db.users.find_one({"_id": ObjectId(current_user.id)})
    if not doc:
        raise HTTPException(status_code=404, detail="User not found")
    return user_to_out(doc)


@router.put("/me", response_model=UserOut)
async def update_me(
    update_data: UserUpdate,
    current_user: UserSession = Depends(get_current_user),
    db=Depends(get_db),
):
    update_dict = update_data.dict(exclude_unset=True)
    if update_dict:
        await db.users.update_one({"_id": ObjectId(current_user.id)}, {"$set": update_dict})
    doc = await db.users.find_one({"_id": ObjectId(current_user.id)})
    return user_to_out(doc)


@router.post("/change-password")
async def change_password(
    data: PasswordChange,
    current_user: UserSession = Depends(get_current_user),
    db=Depends(get_db),
):
    if not verify_password(data.current_password, current_user.hashed_password):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    if len(data.new_password) < 8:
        raise HTTPException(status_code=400, detail="Password must be >= 8 characters")
    await db.users.update_one(
        {"_id": ObjectId(current_user.id)},
        {"$set": {"hashed_password": get_password_hash(data.new_password)}},
    )
    return {"message": "Password updated successfully"}


@router.delete("/me", status_code=status.HTTP_204_NO_CONTENT)
async def delete_account(current_user: UserSession = Depends(get_current_user), db=Depends(get_db)):
    oid = ObjectId(current_user.id)
    await db.moods.delete_many({"user_id": current_user.id})
    await db.journals.delete_many({"user_id": current_user.id})
    sessions = await db.chat_sessions.find({"user_id": current_user.id}, {"_id": 1}).to_list(None)
    if sessions:
        session_ids = [str(s["_id"]) for s in sessions]
        await db.chat_messages.delete_many({"session_id": {"$in": session_ids}})
    await db.chat_sessions.delete_many({"user_id": current_user.id})
    await db.users.delete_one({"_id": oid})
