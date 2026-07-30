import os

def load_env_file(filepath: str):
    if os.path.exists(filepath):
        with open(filepath, 'r') as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#') and '=' in line:
                    key, value = line.split('=', 1)
                    key = key.strip()
                    value = value.strip().strip("'").strip('"')
                    if key not in os.environ:
                        os.environ[key] = value

# Load from local .env if present
current_dir = os.path.dirname(os.path.abspath(__file__))
load_env_file(os.path.join(current_dir, ".env"))

DB_HOST = os.environ.get("DB_HOST", "127.0.0.1")
DB_PORT = os.environ.get("DB_PORT", "5432")
DB_NAME = os.environ.get("DB_NAME", "wins_agro")
DB_USER = os.environ.get("DB_USER", "wins_hub_api_ro")
DB_PASS = os.environ.get("DB_PASS")

if not DB_PASS:
    raise ValueError("CRITICAL: DB_PASS environment variable or secret is not set!")

KEYCLOAK_URL = os.environ.get("KEYCLOAK_URL", "http://127.0.0.1:18080")
KEYCLOAK_ISSUER = os.environ.get("KEYCLOAK_ISSUER", KEYCLOAK_URL)
KEYCLOAK_REALM = os.environ.get("KEYCLOAK_REALM", "wins-hub")
KEYCLOAK_CLIENT = os.environ.get("KEYCLOAK_CLIENT", "wins-hub-spa")
WINS_FORCE_PROD_MODE = os.environ.get("WINS_FORCE_PROD_MODE", "false").lower() == "true"
