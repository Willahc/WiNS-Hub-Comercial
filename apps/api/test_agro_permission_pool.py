from pathlib import Path


API_DIR = Path(__file__).parent


def source(name: str) -> str:
    return (API_DIR / name).read_text(encoding="utf-8")


def test_legacy_agro_pool_is_read_only_general_role():
    database = source("database.py")
    assert '"agro_legacy": {"user": DB_USER, "pass": DB_PASS, "dbname": "wins_agro"}' in database
    assert "DB_WRITE_USER" not in database.split('"agro_legacy"', 1)[1].split("\n", 1)[0]


def test_only_regressed_repositories_use_legacy_pool():
    assert 'get_connection("agro_legacy")' in source("agro_canal_repository.py")
    assert 'release_connection(conn, "agro_legacy")' in source("agro_canal_repository.py")
    assert 'domain="agro_legacy"' in source("agro_holdings_repository.py")
    assert 'domain="agro_legacy"' in source("agro_people_repository.py")


def test_genetic_repository_keeps_segregated_agro_pool():
    repository = source("wave1_repository.py")
    genetic_slice = repository.split("def agro_genetica_resumo", 1)[1]
    assert 'domain="agro_legacy"' not in genetic_slice
    assert 'domain="agro"' in genetic_slice
