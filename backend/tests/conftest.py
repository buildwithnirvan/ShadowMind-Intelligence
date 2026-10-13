import pytest
import asyncio
from fastapi.testclient import TestClient
from main import app
import motor.motor_asyncio
from config import settings
import database
from database import get_db

TEST_DB_NAME = "shadowmind_test"


async def override_get_db():
    # Lazily create motor client within the running ASGI event loop
    client = motor.motor_asyncio.AsyncIOMotorClient(settings.DATABASE_URL)
    test_db = client[TEST_DB_NAME]
    database.client = client
    database.db = test_db
    yield test_db


app.dependency_overrides[get_db] = override_get_db


@pytest.fixture(scope="function", autouse=True)
def clean_db(request):
    """Wipes all documents in test collections before every test run.
    Tests marked `no_db` (pure logic, e.g. the AI engine) skip the database entirely."""
    if request.node.get_closest_marker("no_db"):
        yield
        return
    try:
        loop = asyncio.get_event_loop()
    except RuntimeError:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)

    # Use a client bound to this thread's loop for cleaning
    client = motor.motor_asyncio.AsyncIOMotorClient(settings.DATABASE_URL)
    test_db = client[TEST_DB_NAME]

    from utils.auth import get_password_hash
    from datetime import datetime

    async def delete():
        for name in ["users", "moods", "journals", "chat_sessions", "chat_messages"]:
            await test_db[name].delete_many({})
        # Initialize default admin account in test database
        admin_doc = {
            "username": "nirvan",
            "email": "nirvan@shadowmind.ai",
            "hashed_password": get_password_hash("nirvan123"),
            "role": "admin",
            "full_name": "System Administrator",
            "is_active": True,
            "is_verified": True,
            "created_at": datetime.utcnow(),
        }
        await test_db.users.insert_one(admin_doc)

    loop.run_until_complete(delete())
    yield


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture
def registered_user(clean_db, client):
    """Creates and returns a registered user dict."""
    res = client.post("/api/auth/register", json={
        "email": "fixture@shadow.ai",
        "username": "fixtureuser",
        "password": "fixture123",
        "full_name": "Fixture User",
    })
    return res.json()


@pytest.fixture
def auth_headers(registered_user):
    """Returns Authorization headers for the fixture user."""
    token = registered_user.get("access_token", "")
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def auth_client(client, auth_headers):
    """TestClient pre-loaded with auth headers."""
    client.headers.update(auth_headers)
    yield client
    client.headers.clear()
