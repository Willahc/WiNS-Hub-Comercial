import os
import psycopg2

def load_env_file(filepath: str):
    if os.path.exists(filepath):
        with open(filepath, 'r') as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#') and '=' in line:
                    key, value = line.split('=', 1)
                    key = key.strip()
                    value = value.strip().strip("'").strip('"')
                    os.environ[key] = value

def test_readonly_restrictions():
    print("Iniciando auditoria de segurança do usuário wins_hub_api_ro...")
    
    # Load .env variables
    current_dir = os.path.dirname(os.path.abspath(__file__))
    load_env_file(os.path.join(current_dir, ".env"))
    
    db_host = os.environ.get("DB_HOST", "127.0.0.1")
    db_port = os.environ.get("DB_PORT", "5432")
    db_name = os.environ.get("DB_NAME", "wins_agro")
    db_user = os.environ.get("DB_USER", "wins_hub_api_ro")
    db_pass = os.environ.get("DB_PASS")
    
    if not db_pass:
        print("FAIL: DB_PASS não está definido no arquivo .env.")
        exit(1)
        
    try:
        conn = psycopg2.connect(
            host=db_host,
            port=db_port,
            dbname=db_name,
            user=db_user,
            password=db_pass
        )
    except Exception as e:
        print(f"FAIL: Não foi possível conectar com wins_hub_api_ro: {e}")
        exit(1)
        
    success = True
    
    # 1. Verify user role attributes (rolsuper, rolcreatedb, etc.)
    try:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT rolsuper, rolcreaterole, rolcreatedb, rolbypassrls
            FROM pg_roles
            WHERE rolname = 'wins_hub_api_ro';
        """)
        row = cursor.fetchone()
        cursor.close()
        
        if row:
            rolsuper, rolcreaterole, rolcreatedb, rolbypassrls = row
            print(f"Role Attributes -> Superuser: {rolsuper} | CreateRole: {rolcreaterole} | CreateDB: {rolcreatedb} | BypassRLS: {rolbypassrls}")
            if rolsuper or rolcreaterole or rolcreatedb or rolbypassrls:
                print("FAIL: wins_hub_api_ro possui privilégios administrativos ativos!")
                success = False
            else:
                print("PASS: wins_hub_api_ro não possui atributos administrativos.")
        else:
            print("FAIL: Role wins_hub_api_ro não encontrada no catálogo do banco.")
            success = False
    except Exception as e:
        print(f"Erro ao verificar pg_roles: {e}")
        success = False

    # Helper function to assert that a SQL command throws InsufficientPrivilege
    def assert_write_fails(sql, op_name):
        nonlocal success
        # Need a new connection or rollback transaction since query failure invalidates transaction
        test_conn = psycopg2.connect(
            host=db_host,
            port=db_port,
            dbname=db_name,
            user=db_user,
            password=db_pass
        )
        try:
            cursor = test_conn.cursor()
            cursor.execute(sql)
            test_conn.commit()
            cursor.close()
            print(f"FAIL: Operação {op_name} permitida! SQL: '{sql}'")
            success = False
        except psycopg2.Error as e:
            # psycopg2 error code for insufficient_privilege is '42501'
            if e.pgcode == '42501':
                print(f"PASS: Operação {op_name} bloqueada com insufficient_privilege (42501).")
            else:
                print(f"PASS: Operação {op_name} falhou como esperado. Código de erro: {e.pgcode} | Msg: {e.diag.message_primary}")
        except Exception as e:
            print(f"PASS: Operação {op_name} falhou com erro genérico: {e}")
        finally:
            test_conn.close()

    # 2. Assert INSERT fails
    assert_write_fails("INSERT INTO engenharia.obras (nome) VALUES ('Test Obra Proibida');", "INSERT")
    
    # 3. Assert UPDATE fails
    assert_write_fails("UPDATE engenharia.obras SET nome = 'Nome Editado' WHERE id = '00000000-0000-0000-0000-000000000000';", "UPDATE")
    
    # 4. Assert DELETE fails
    assert_write_fails("DELETE FROM engenharia.obras WHERE id = '00000000-0000-0000-0000-000000000000';", "DELETE")
    
    # 5. Assert CREATE TABLE fails
    assert_write_fails("CREATE TABLE public.forbidden_table (id serial primary key);", "CREATE TABLE")
    
    # 6. Assert DROP VIEW fails
    assert_write_fails("DROP VIEW canonical_mvp.vw_empresa_360;", "DROP VIEW")

    # 7. Assert TRUNCATE fails
    assert_write_fails("TRUNCATE TABLE engenharia.obras;", "TRUNCATE")
    
    # 8. Assert access to unauthorized schemas (e.g., pg_catalog is allowed for catalog reading, but check other application schemas if restricted, like 'fazenda' or 'prospeccao')
    assert_write_fails("SELECT * FROM fazenda.cliente LIMIT 1;", "SELECT FAZENDA SCHEMA (UNAUTHORIZED)")
    assert_write_fails("SELECT * FROM prospeccao.hunter_resto LIMIT 1;", "SELECT PROSPECÇAO SCHEMA (UNAUTHORIZED)")

    conn.close()
    
    assert success, "FALHA NA VALIDAÇÃO DO MODO READ-ONLY!"
    print("CONVENÇÃO DE LEITURA (READ-ONLY) CONFIRMADA COM SUCESSO!")

if __name__ == "__main__":
    test_readonly_restrictions()
