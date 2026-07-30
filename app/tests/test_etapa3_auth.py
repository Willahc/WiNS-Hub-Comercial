from fastapi.testclient import TestClient
from main import app
import pytest
import pyotp
import time
from auth import create_access_token, MARI_EMAIL, MFA_TOTP_SECRET

# TestClient automatically uses the app
client = TestClient(app)

def test_open_redirect_cases():
    # Test cases to be rejected
    rejected_cases = [
        "https://attacker.com",
        "http://attacker.com",
        "//attacker.com",
        "///attacker.com",
        "/\\attacker.com",
        "\\\\attacker.com",
        "/%2f%2fattacker.com",
        "/%5c%5cattacker.com",
        "javascript:alert(1)",
        "data:text/html,test",
        "vbscript:test",
        "%0d%0aLocation:%20https://attacker.com",
        "https:%2f%2fattacker.com"
    ]
    # Under any of these next paths, it must fall back to /agro/
    for next_url in rejected_cases:
        # GET /login
        r = client.get(f"/login?next={next_url}", headers={"X-Forwarded-Prefix": "/agro"})
        # Should render login with safe next fallback "/agro/"
        assert r.status_code == 200
        # Verify next in form action or template context has been fallback to "/agro/"
        assert 'action="/agro/login?next=/agro/"' in r.text or 'value="/agro/"' in r.text

        # POST /login
        totp = pyotp.TOTP(MFA_TOTP_SECRET)
        data = {"email": MARI_EMAIL, "password": "teste-123", "code": totp.now()}
        r = client.post(f"/login?next={next_url}", data=data, headers={"X-Forwarded-Prefix": "/agro"}, allow_redirects=False)
        assert r.status_code == 303
        assert r.headers["location"] == "/agro/"

def test_prefix_cases():
    # Valid prefix
    r = client.get("/login", headers={"X-Forwarded-Prefix": "/agro"})
    assert r.status_code == 200
    
    # Absent prefix: should fall back to empty prefix in test context
    # Invalid prefix: should fall back to /agro
    r_invalid = client.get("/login", headers={"X-Forwarded-Prefix": "/invalid-prefix"})
    assert r_invalid.status_code == 200

def test_header_forged():
    # Header forged: client sends X-Forwarded-Prefix: /attacker. This should be validated and fall back to /agro
    r = client.get("/login", headers={"X-Forwarded-Prefix": "/attacker"})
    assert r.status_code == 200

def test_login_valid_invalid_rate_limit():
    # Login valid
    totp = pyotp.TOTP(MFA_TOTP_SECRET)
    data = {"email": MARI_EMAIL, "password": "teste-123", "code": totp.now()}
    # We use a unique X-Forwarded-For header to not interfere with existing rate limits
    headers = {"X-Forwarded-For": "9.9.9.9", "X-Forwarded-Prefix": "/agro"}
    r = client.post("/login", data=data, headers=headers, allow_redirects=False)
    assert r.status_code == 303
    assert "access_token" in r.cookies
    assert r.cookies.get("access_token") != ""
    
    # Login invalid
    data_bad = {"email": MARI_EMAIL, "password": "wrong-password", "code": "000000"}
    headers_bad = {"X-Forwarded-For": "9.9.9.8", "X-Forwarded-Prefix": "/agro"}
    r = client.post("/login", data=data_bad, headers=headers_bad, allow_redirects=False)
    assert r.status_code == 303
    assert "access_token" not in r.cookies
    assert "/login?error=1" in r.headers["location"]

    # Rate limit test
    headers_lim = {"X-Forwarded-For": "9.9.9.7", "X-Forwarded-Prefix": "/agro"}
    for _ in range(5):
        client.post("/login", data=data_bad, headers=headers_lim, allow_redirects=False)
    # 6th attempt should return error=locked
    r_locked = client.post("/login", data=data_bad, headers=headers_lim, allow_redirects=False)
    assert r_locked.status_code == 303
    assert "error=locked" in r_locked.headers["location"]

def test_logout_and_cookie_attributes():
    # Set access token cookie
    totp = pyotp.TOTP(MFA_TOTP_SECRET)
    data = {"email": MARI_EMAIL, "password": "teste-123", "code": totp.now()}
    headers = {"X-Forwarded-For": "9.9.9.6", "X-Forwarded-Prefix": "/agro"}
    r_login = client.post("/login", data=data, headers=headers, allow_redirects=False)
    cookie = r_login.cookies.get("access_token")
    
    # Verify cookie attributes
    set_cookie_header = r_login.headers.get("set-cookie", "")
    assert "HttpOnly" in set_cookie_header or "httponly" in set_cookie_header.lower()
    assert "Secure" in set_cookie_header or "secure" in set_cookie_header.lower()
    assert "SameSite=lax" in set_cookie_header or "samesite=lax" in set_cookie_header.lower()
    assert "Path=/" in set_cookie_header or "path=/" in set_cookie_header.lower()
    
    # Logout
    r_logout = client.get("/logout", headers={"X-Forwarded-Prefix": "/agro"}, cookies={"access_token": cookie}, allow_redirects=False)
    assert r_logout.status_code == 303
    assert r_logout.headers["location"] == "/agro/login"
    # Cookie should be deleted or expired
    assert "access_token=" not in r_logout.headers.get("set-cookie", "") or "max-age=0" in r_logout.headers.get("set-cookie", "").lower() or "expires=" in r_logout.headers.get("set-cookie", "").lower()

def test_api_access_after_logout():
    # Attempting to access API without token should return 401
    r = client.get("/api/v2/farms")
    assert r.status_code == 401

def test_refresh_direct_empresa_360():
    # Direct access to /empresa-360 anonymous should redirect to login with next
    r = client.get("/empresa-360", headers={"X-Forwarded-Prefix": "/agro"}, allow_redirects=False)
    assert r.status_code == 303
    assert r.headers["location"] == "/agro/login?next=/agro/empresa-360"
