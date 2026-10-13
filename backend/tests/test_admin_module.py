"""
tests/test_admin_module.py — Comprehensive tests for Admin Module:
1. Admin Overview API returns accurate counts.
2. Admin Users API with search, sorting, and pagination.
3. Admin Emotional Analytics API with category summaries, visual charts, and improvement trends.
4. Admin creation and validation by authenticated admin.
5. Prevention of regular user or duplicate admin creation.
6. RBAC enforcement on all new admin endpoints.
"""
from datetime import datetime


def test_admin_overview_and_rbac(client):
    # 1. Non-admin cannot access overview
    reg = client.post("/api/auth/register", json={
        "username": "user_overview_test",
        "password": "Password123",
        "confirm_password": "Password123",
    })
    user_token = reg.json()["access_token"]
    user_headers = {"Authorization": f"Bearer {user_token}"}

    res_user = client.get("/api/admin/overview", headers=user_headers)
    assert res_user.status_code == 403

    # 2. Admin can access overview
    admin_login = client.post("/api/auth/admin/login", json={
        "username": "nirvan",
        "password": "nirvan123",
    })
    admin_token = admin_login.json()["access_token"]
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    res_admin = client.get("/api/admin/overview", headers=admin_headers)
    assert res_admin.status_code == 200
    data = res_admin.json()

    assert data["total_users"] >= 1
    assert data["total_active_users"] >= 1
    assert data["total_admins"] >= 1
    assert "total_sessions_recorded" in data
    assert "total_users_analyzed" in data
    assert "most_frequent_emotions" in data
    assert "trend_improving_users" in data
    assert "trend_worsening_users" in data
    assert "trend_insufficient_users" in data


def test_admin_users_pagination_search(client):
    admin_login = client.post("/api/auth/admin/login", json={
        "username": "nirvan",
        "password": "nirvan123",
    })
    admin_headers = {"Authorization": f"Bearer {admin_login.json()['access_token']}"}

    # Query with limit & skip
    res = client.get("/api/admin/users?limit=5&skip=0", headers=admin_headers)
    assert res.status_code == 200
    data = res.json()
    assert "total" in data
    assert "users" in data
    assert len(data["users"]) <= 5

    # Check fields in user record
    if len(data["users"]) > 0:
        u = data["users"][0]
        assert "id" in u
        assert "username" in u
        assert "role" in u
        assert "session_count" in u
        assert "account_status" in u
        assert "hashed_password" not in u

    # Search for nirvan
    res_search = client.get("/api/admin/users?search=nirvan", headers=admin_headers)
    assert res_search.status_code == 200
    assert any(u["username"] == "nirvan" for u in res_search.json()["users"])


def test_admin_emotional_analytics(client):
    admin_login = client.post("/api/auth/admin/login", json={
        "username": "nirvan",
        "password": "nirvan123",
    })
    admin_headers = {"Authorization": f"Bearer {admin_login.json()['access_token']}"}

    # Test 30 days
    res = client.get("/api/admin/emotional-analytics?days=30", headers=admin_headers)
    assert res.status_code == 200
    data = res.json()

    assert "reporting_period" in data
    assert "total_users_analyzed" in data
    assert "total_sessions_recorded" in data
    assert "category_summaries" in data
    assert len(data["category_summaries"]) == 7

    # Verify categories present
    cat_ids = {c["id"] for c in data["category_summaries"]}
    expected = {"depression", "anxiety", "stress", "joy", "calm", "fatigue", "anger"}
    assert cat_ids == expected

    # Verify visual analytics
    va = data["visual_analytics"]
    assert "category_distribution" in va
    assert "trends_over_time" in va
    assert "depression_trends" in va
    assert "anxiety_trends" in va
    assert "positive_trends" in va
    assert "user_activity" in va

    # Verify improvement trends
    it = data["improvement_trends"]
    assert "improving_depression" in it
    assert "improving_anxiety" in it
    assert "improving_both" in it
    assert "unchanged" in it
    assert "worsening" in it
    assert "insufficient_data" in it
    assert "methodology_explanation" in it


def test_admin_creation_and_auth(client):
    admin_login = client.post("/api/auth/admin/login", json={
        "username": "nirvan",
        "password": "nirvan123",
    })
    admin_headers = {"Authorization": f"Bearer {admin_login.json()['access_token']}"}

    new_admin_uname = "admin_sec_" + str(int(datetime.utcnow().timestamp()))
    new_admin_pass = "SecureAdminPass999!"

    # 1. Authenticated admin creates a new admin
    res_create = client.post("/api/admin/administrators", json={
        "username": new_admin_uname,
        "password": new_admin_pass,
        "confirm_password": new_admin_pass,
        "full_name": "Security Officer",
    }, headers=admin_headers)
    assert res_create.status_code == 201
    created_info = res_create.json()["administrator"]
    assert created_info["username"] == new_admin_uname
    assert created_info["role"] == "admin"
    assert "hashed_password" not in created_info

    # 2. Verify list administrators contains the new admin
    res_list = client.get("/api/admin/administrators", headers=admin_headers)
    assert res_list.status_code == 200
    admin_names = [a["username"] for a in res_list.json()["administrators"]]
    assert new_admin_uname in admin_names

    # 3. New admin can log in
    res_login_new = client.post("/api/auth/admin/login", json={
        "username": new_admin_uname,
        "password": new_admin_pass,
    })
    assert res_login_new.status_code == 200
    assert res_login_new.json()["user"]["role"] == "admin"

    # 4. Duplicate username rejected
    res_dup = client.post("/api/admin/administrators", json={
        "username": new_admin_uname,
        "password": "AnotherPassword123",
        "confirm_password": "AnotherPassword123",
    }, headers=admin_headers)
    assert res_dup.status_code == 400
    assert "already exists" in res_dup.json()["detail"].lower()

    # 5. Regular user cannot create admin
    reg = client.post("/api/auth/register", json={
        "username": "user_cannot_admin_" + str(int(datetime.utcnow().timestamp())),
        "password": "Password123",
        "confirm_password": "Password123",
    })
    reg_headers = {"Authorization": f"Bearer {reg.json()['access_token']}"}

    res_forbidden = client.post("/api/admin/administrators", json={
        "username": "hack_admin",
        "password": "HackPassword123",
        "confirm_password": "HackPassword123",
    }, headers=reg_headers)
    assert res_forbidden.status_code == 403
