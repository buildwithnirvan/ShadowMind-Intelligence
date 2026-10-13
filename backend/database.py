import motor.motor_asyncio
from config import settings
from bson import ObjectId

# Create MongoDB client
client = motor.motor_asyncio.AsyncIOMotorClient(settings.DATABASE_URL)
# Extract the default database from the connection URL
db = client.get_default_database()


async def get_db():
    yield db


async def init_db():
    # Setup indexes for users, moods, journals, chat sessions, and messages
    try:
        indexes = await db.users.index_information()
        if "email_1" in indexes and not indexes["email_1"].get("sparse"):
            await db.users.drop_index("email_1")
    except Exception:
        pass
    await db.users.create_index("email", unique=True, sparse=True)
    await db.users.create_index("username", unique=True)
    await db.moods.create_index("user_id")
    await db.moods.create_index("created_at")
    await db.journals.create_index("user_id")
    await db.journals.create_index("created_at")
    await db.chat_sessions.create_index("user_id")
    await db.chat_sessions.create_index("updated_at")
    await db.chat_messages.create_index("session_id")
    await db.chat_messages.create_index("created_at")


def convert_doc(doc):
    """Convert MongoDB _id (ObjectId) and other ObjectIds into string 'id' for serialization."""
    if not doc:
        return None
    # Shallow copy to avoid modifying the original database document directly
    doc = dict(doc)
    if "_id" in doc:
        doc["id"] = str(doc.pop("_id"))
    # Convert any remaining ObjectId values in fields to strings (e.g. user_id, session_id)
    for key, val in doc.items():
        if isinstance(val, ObjectId):
            doc[key] = str(val)
    return doc


def to_oid(id_val):
    """Safely convert a string representation of ObjectId to an ObjectId instance."""
    if not id_val:
        return None
    if isinstance(id_val, ObjectId):
        return id_val
    try:
        return ObjectId(str(id_val))
    except Exception:
        return None
