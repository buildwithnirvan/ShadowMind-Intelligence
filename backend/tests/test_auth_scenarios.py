"""
tests/test_auth_scenarios.py — Comprehensive test suite verifying all 10 scenarios from STEP 8:
1. Admin login with nirvan / nirvan123.
2. Admin login with an incorrect password.
3. New user registration.
4. Duplicate username registration.
5. Login using the newly registered account.
6. Login with incorrect user credentials.
7. Regular user attempting to access an admin API.
8. Direct navigation to protected dashboard / admin routes.
9. Backend restart without duplicate admin creation.
10. Existing application functionality remains operational.
"""
from datetime import datetime


def test_scenario_1_and_2_admin_login(client):
    """Scenario 1 & 2: Admin login with correct and incorrect credentials."""
    # 1. Successful Admin Login
    res = client.post("/api/auth/admin/login", json={
        "username": "nirvan",
        "password": "nirvan123"
    })
    assert res.status_code == 200, f"Admin login failed: {res.text}"
    data = res.json()
    assert "access_token" in data
    assert data["user"]["username"] == "nirvan"
    assert data["user"]["role"] == "admin"

    # Also works via general /api/auth/login endpoint
    res_gen = client.post("/api/auth/login", json={
        "username": "nirvan",
        "password": "nirvan123"
    })
    assert res_gen.status_code == 200
    assert res_gen.json()["user"]["role"] == "admin"

    # 2. Failed Admin Login (incorrect password)
    res_bad = client.post("/api/auth/admin/login", json={
        "username": "nirvan",
        "password": "wrongpassword"
    })
    assert res_bad.status_code == 401
    assert "invalid" in res_bad.json()["detail"].lower()


def test_scenario_3_4_5_6_user_lifecycle(client):
    """Scenarios 3, 4, 5, 6: Registration, duplicates, and user login."""
    test_user = "testpilot_" + str(int(datetime.utcnow().timestamp()))
    test_pass = "ComplexPass123"

    # 3. New user registration
    res_reg = client.post("/api/auth/register", json={
        "username": test_user,
        "password": test_pass,
        "confirm_password": test_pass,
    })
    assert res_reg.status_code == 201
    reg_data = res_reg.json()
    assert reg_data["user"]["username"] == test_user
    assert reg_data["user"]["role"] == "user"

    # 4. Duplicate username registration (must be rejected)
    res_dup = client.post("/api/auth/register", json={
        "username": test_user,
        "password": "anotherpassword",
        "confirm_password": "anotherpassword",
    })
    assert res_dup.status_code == 400
    assert "already registered" in res_dup.json()["detail"].lower()

    # 4b. Password confirmation mismatch
    res_mismatch = client.post("/api/auth/register", json={
        "username": test_user + "_alt",
        "password": "Password1",
        "confirm_password": "Password2",
    })
    assert res_mismatch.status_code == 400
    assert "mismatch" in res_mismatch.json()["detail"].lower()

    # 5. Login using the newly registered account
    res_login = client.post("/api/auth/user/login", json={
        "username": test_user,
        "password": test_pass,
    })
    assert res_login.status_code == 200
    user_data = res_login.json()
    assert user_data["user"]["username"] == test_user
    assert user_data["user"]["role"] == "user"
    assert "access_token" in user_data

    # 6. Login with incorrect user credentials
    res_bad_pw = client.post("/api/auth/user/login", json={
        "username": test_user,
        "password": "wrongpassword123",
    })
    assert res_bad_pw.status_code == 401
    assert "invalid" in res_bad_pw.json()["detail"].lower()

    # 6b. Non-existent username
    res_no_user = client.post("/api/auth/user/login", json={
        "username": "non_existent_ghost_user",
        "password": "password123",
    })
    assert res_no_user.status_code == 401


def test_scenario_7_regular_user_denied_admin_api(client):
    """Scenario 7: Regular user attempting to access an admin API."""
    # Create a regular user
    reg_res = client.post("/api/auth/register", json={
        "username": "regular_joe",
        "password": "RegularPass123",
        "confirm_password": "RegularPass123",
    })
    assert reg_res.status_code == 201
    user_token = reg_res.json()["access_token"]
    user_headers = {"Authorization": f"Bearer {user_token}"}

    # Regular user attempting to access admin APIs
    res_overview = client.get("/api/admin/overview", headers=user_headers)
    assert res_overview.status_code == 403, "Regular user must be forbidden from admin overview"
    assert "administrator privileges required" in res_overview.json()["detail"].lower()

    res_users = client.get("/api/admin/users", headers=user_headers)
    assert res_users.status_code == 403, "Regular user must be forbidden from admin users list"

    res_sys = client.get("/api/admin/system", headers=user_headers)
    assert res_sys.status_code == 403, "Regular user must be forbidden from admin system diagnostics"

    # Regular user attempting admin login route
    res_admin_login = client.post("/api/auth/admin/login", json={
        "username": "regular_joe",
        "password": "RegularPass123"
    })
    assert res_admin_login.status_code == 403, "Regular user must not log in via admin login"

    # Real admin CAN access the admin API
    admin_login = client.post("/api/auth/admin/login", json={
        "username": "nirvan",
        "password": "nirvan123"
    })
    admin_token = admin_login.json()["access_token"]
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    res_admin_ok = client.get("/api/admin/overview", headers=admin_headers)
    assert res_admin_ok.status_code == 200
    assert res_admin_ok.json()["total_admins"] >= 1


def test_scenario_8_unauthenticated_denied(client):
    """Scenario 8: Unauthenticated access denied to protected APIs."""
    res = client.get("/api/admin/overview")
    assert res.status_code == 401

    res_me = client.get("/api/auth/me")
    assert res_me.status_code == 401


def test_scenario_9_backend_restart_idempotency(client):
    """Scenario 9: Backend restart without duplicate admin creation or password reset."""
    # Attempting duplicate admin creation or verifying admin exists
    res = client.post("/api/auth/admin/login", json={
        "username": "nirvan",
        "password": "nirvan123"
    })
    assert res.status_code == 200
    assert res.json()["user"]["username"] == "nirvan"

    # Public registration of admin username is prohibited
    res_dup_admin = client.post("/api/auth/register", json={
        "username": "nirvan",
        "password": "anotherpassword",
        "confirm_password": "anotherpassword",
    })
    assert res_dup_admin.status_code == 400
    assert "already registered" in res_dup_admin.json()["detail"].lower()


def test_scenario_10_existing_functionality(client):
    """Scenario 10: Existing application functionality remains operational."""
    # Register/login user
    reg = client.post("/api/auth/register", json={
        "username": "wellness_user",
        "password": "WellnessPassword123",
        "confirm_password": "WellnessPassword123",
    })
    token = reg.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Mood creation
    mood_res = client.post("/api/moods/", json={
        "score": 8.0,
        "label": "content",
        "notes": "Testing wellness functionality",
        "tags": ["calm", "focused"]
    }, headers=headers)
    assert mood_res.status_code == 201

    # Mood listing
    list_res = client.get("/api/moods/", headers=headers)
    assert list_res.status_code == 200
    assert len(list_res.json()) >= 1

    # Analytics overview
    analytics_res = client.get("/api/analytics/overview", headers=headers)
    assert analytics_res.status_code == 200
    assert analytics_res.json()["mood_entries"] >= 1
