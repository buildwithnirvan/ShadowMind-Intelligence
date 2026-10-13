import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from config import settings
from datetime import datetime
from database import init_db, db
from utils.auth import get_password_hash
from middleware import RequestLoggingMiddleware, SecurityHeadersMiddleware
from fastapi.responses import JSONResponse
import traceback
from routers import (
    auth_router, moods_router, journals_router,
    chat_router, analytics_router,
    predictions_router, doctors_router,
    admin_router,
)
from routers.sentiment import router as sentiment_router
from routers.meditations import router as meditations_router
from routers.export import router as export_router

logging.basicConfig(level=logging.INFO, format="%(asctime)s  %(levelname)-8s  %(name)s — %(message)s", datefmt="%H:%M:%S")
logger = logging.getLogger("shadowmind")

async def init_admin_account():
    """Initialize default administrator account 'nirvan' safely without duplicating or resetting password on restart."""
    admin = await db.users.find_one({"username": "nirvan"})
    if not admin:
        admin_doc = {
            "username": "nirvan",
            "email": "nirvan@shadowmind.ai",
            "hashed_password": get_password_hash("nirvan123"),
            "role": "admin",
            "full_name": "System Administrator",
            "bio": "ShadowMind Master Administrator",
            "avatar_url": None,
            "is_active": True,
            "is_verified": True,
            "created_at": datetime.utcnow(),
        }
        await db.users.insert_one(admin_doc)
        logger.info("✅ Default administrator account initialized: nirvan")
    else:
        if admin.get("role") != "admin":
            await db.users.update_one({"_id": admin["_id"]}, {"$set": {"role": "admin"}})
        logger.info("ℹ️ Administrator account 'nirvan' verified (password preserved).")

@asynccontextmanager
async def lifespan(app: FastAPI):
    from ai.providers import warm_up_local_models_async, close_ai_providers_async

    logger.info("🌑 ShadowMind v4 starting up...")
    await init_db()
    await init_admin_account()
    logger.info("✅ Database ready")
    
    # Warm up local AI model before serving requests so model weights are resident in memory
    # This prevents the 20-30s model loading delay when the user sends their first message.
    await warm_up_local_models_async()

    yield
    logger.info("🌑 ShadowMind shutting down...")
    await close_ai_providers_async()

app = FastAPI(
    title="ShadowMind API", description="AI-powered mental wellness platform v4",
    version="4.0.0", lifespan=lifespan,
    docs_url="/api/docs", redoc_url="/api/redoc", openapi_url="/api/openapi.json",
)

app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(RequestLoggingMiddleware)
app.add_middleware(
    CORSMiddleware, allow_origins=settings.cors_origins_list,
    allow_credentials=True, allow_methods=["*"], allow_headers=["*"],
)

@app.exception_handler(Exception)
async def global_exception_handler(request, exc: Exception):
    error_msg = f"Unhandled exception: {str(exc)}"
    logger.error(error_msg)
    logger.debug(traceback.format_exc())
    return JSONResponse(
        status_code=500,
        content={"detail": "An internal server error occurred.", "error": str(exc)}
    )

for r in [auth_router, moods_router, journals_router, chat_router,
          analytics_router, predictions_router, doctors_router, sentiment_router, meditations_router, export_router, admin_router]:
    app.include_router(r)

@app.get("/", tags=["root"])
async def root():
    return {"name": "ShadowMind API", "version": "4.0.0", "status": "online", "docs": "/api/docs"}

@app.get("/health", tags=["root"])
async def health():
    return {"status": "healthy"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
