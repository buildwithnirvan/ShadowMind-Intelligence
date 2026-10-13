from .auth import router as auth_router
from .moods import router as moods_router
from .journals import router as journals_router
from .chat import router as chat_router
from .analytics import router as analytics_router
from .predictions import router as predictions_router
from .doctors import router as doctors_router
from .admin import router as admin_router

__all__ = [
    "auth_router", "moods_router", "journals_router",
    "chat_router", "analytics_router",
    "predictions_router", "doctors_router",
    "admin_router",
]
