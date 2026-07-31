import pytest
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

def test_auth_session_missing_header_returns_401():
    response = client.get("/api/v1/auth/session")
    assert response.status_code == 401
    assert response.json()["detail"] == "Authentication required: Missing trusted user identity header"

def test_auth_session_empty_header_returns_401():
    response = client.get("/api/v1/auth/session", headers={"X-WiNS-Authenticated-User": "   "})
    assert response.status_code == 401

def test_auth_session_valid_header_returns_200():
    response = client.get("/api/v1/auth/session", headers={"X-WiNS-Authenticated-User": "maintenance_admin"})
    assert response.status_code == 200
    data = response.json()
    assert data["authenticated"] is True
    assert data["username"] == "maintenance_admin"
    assert data["auth_mode"] == "maintenance"
    assert "admin" in data["roles"]
    assert "engenharia" in data["permissions"]

def test_auth_session_invalid_username_characters_returns_400():
    response = client.get("/api/v1/auth/session", headers={"X-WiNS-Authenticated-User": "user<script>alert(1)</script>"})
    assert response.status_code == 400
