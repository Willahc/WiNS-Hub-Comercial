import os
import uuid
import datetime
import psycopg2
from psycopg2.extras import RealDictCursor

DB_HOST = os.environ.get("DB_HOST", "127.0.0.1")
DB_PORT = int(os.environ.get("DB_PORT", "5432"))
DB_NAME = os.environ.get("DB_NAME", "wins_agro")
DB_USER = os.environ.get("DB_WRITE_USER", "postgres")
DB_PASS = os.environ.get("DB_WRITE_PASS", "sfKszP6x5PQOdQkSwPfQK9ieUxpNDKY9")

def materialize():
    run_id = f"run_rel_{datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%d_%H%M%S')}_{uuid.uuid4().hex[:6]}"
    print(f"=== INICIANDO PIPELINE DE MATERIALIZAÇÃO DE RELACIONAMENTOS (Run ID: {run_id}) ===")

    conn = psycopg2.connect(host=DB_HOST, port=DB_PORT, dbname=DB_NAME, user=DB_USER, password=DB_PASS)
    cur = conn.cursor(cursor_factory=RealDictCursor)

    counts_by_source = {
        "obra_empresa": 0,
        "obra_prestador": 0,
        "obra_decisor": 0
    }

    edges_to_insert = []

    # 1. Fonte: Obra -> Empresa Responsável (CONFIRMADO)
    print("1. Buscando Obras -> Empresa Responsável...")
    cur.execute("""
        SELECT id::text as obra_id, nome, empresa, cnpj, setor, municipio, uf, valor_estimado, fonte, criado_em
        FROM engenharia.obras
        WHERE visivel IS TRUE AND cnpj IS NOT NULL AND cnpj != '';
    """)
    obras = cur.fetchall()
    for w in obras:
        rel_id = f"rel_obra_empresa_{w['obra_id']}"
        source_id = f"work_{w['obra_id']}"
        target_id = f"company_{w['cnpj']}"
        evidence = f"Empresa {w.get('empresa') or w['cnpj']} declarada como titular responsável pela obra no registro oficial BNDES/Receita Federal."
        edges_to_insert.append((
            rel_id, source_id, target_id, "Obra", "Empresa",
            "Empresa Responsável / Titular", "CONFIRMADO", 99.00,
            w.get("fonte") or "BNDES Financiamento", "OFICIAL",
            evidence, "v2.4.0-vinculo-documental",
            w.get("criado_em") or datetime.datetime.now(datetime.timezone.utc),
            w.get("criado_em") or datetime.datetime.now(datetime.timezone.utc),
            "Nenhuma (Vínculo Documental Oficial)", "pendente", run_id
        ))
        counts_by_source["obra_empresa"] += 1

    # 2. Fonte: Obra -> Decisor Societário (CONFIRMADO / PROVÁVEL)
    print("2. Buscando Obras -> Decisores Societários...")
    cur.execute("""
        SELECT id::text as decisor_id, obra_id::text, nome, cargo, fonte, tipo_evidencia, confianca_match, registrado_em, verificado_em
        FROM engenharia.decisores_obra
        WHERE excluido_em IS NULL;
    """)
    decisores = cur.fetchall()
    for d in decisores:
        rel_id = f"rel_decisor_{d['decisor_id']}"
        source_id = f"work_{d['obra_id']}"
        target_id = f"decisor_{d['decisor_id']}"
        classif = "CONFIRMADO" if d.get('tipo_evidencia') == 'REGISTRO_EMPRESARIAL_QSA' else "PROVÁVEL"
        score_val = float(d.get('confianca_match') or 75.0)
        evidence = f"Decisor {d.get('nome')} registrado como {d.get('cargo') or 'Diretor'} no QSA/Receita Federal."
        edges_to_insert.append((
            rel_id, source_id, target_id, "Obra", "Decisor",
            f"Decisor Responsável ({d.get('cargo') or 'Diretor'})", classif, score_val,
            d.get("fonte") or "BrasilAPI QSA / Receita Federal", "OFICIAL",
            evidence, "v2.4.0-qsa-societario",
            d.get("registrado_em") or datetime.datetime.now(datetime.timezone.utc),
            d.get("verificado_em") or datetime.datetime.now(datetime.timezone.utc),
            "Contato verificado via QSA público", "pendente", run_id
        ))
        counts_by_source["obra_decisor"] += 1

    # 3. Fonte: Obra -> Prestador Compatível (PROVÁVEL / POTENCIAL)
    print("3. Buscando Obras -> Prestadores Compatíveis...")
    cur.execute("""
        SELECT m.id::text as match_id, m.obra_id::text, m.cnpj, m.ranking, m.nivel_proximidade, m.score, m.gerado_em, e.razao_social, e.municipio, e.uf
        FROM engenharia.matches_obra_prestador m
        INNER JOIN engenharia.obras o ON o.id = m.obra_id
        LEFT JOIN core.empresa e ON e.cnpj = m.cnpj
        WHERE o.visivel IS TRUE AND m.ranking <= 10
        LIMIT 5000;
    """)
    matches = cur.fetchall()
    for m in matches:
        rel_id = f"rel_match_{m['match_id']}"
        source_id = f"work_{m['obra_id']}"
        target_id = f"company_{m['cnpj']}"
        score_val = float(m['score'])
        classif = "PROVÁVEL" if score_val >= 80.0 else "POTENCIAL"
        evidence = f"Compatibilidade técnica e territorial em nível {m.get('nivel_proximidade') or 'estadual'} com score {score_val}%."
        edges_to_insert.append((
            rel_id, source_id, target_id, "Obra", "Empresa",
            "Prestador Compatível", classif, score_val,
            "engenharia.matches_obra_prestador", "ALGORÍTMICA",
            evidence, "v2.4.0-score-match",
            m.get("gerado_em") or datetime.datetime.now(datetime.timezone.utc),
            m.get("gerado_em") or datetime.datetime.now(datetime.timezone.utc),
            "Não possui contrato público registrado", "pendente", run_id
        ))
        counts_by_source["obra_prestador"] += 1

    print(f"4. Gravando {len(edges_to_insert)} arestas em public.relationship_edges...")
    insert_sql = """
        INSERT INTO public.relationship_edges (
            relationship_id, source_id, target_id, source_type, target_type,
            tipo_relacao, classificacao, score, fonte, tipo_fonte,
            evidencia, versao_regra, calculado_em, verificado_em,
            limitacoes, status_revisao, run_id
        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        ON CONFLICT (relationship_id) DO UPDATE SET
            classificacao = EXCLUDED.classificacao,
            score = EXCLUDED.score,
            evidencia = EXCLUDED.evidencia,
            verificado_em = EXCLUDED.verificado_em,
            run_id = EXCLUDED.run_id,
            updated_at = NOW();
    """

    psycopg2.extras.execute_batch(cur, insert_sql, edges_to_insert, page_size=1000)
    conn.commit()

    print(f"\n=== MATERIALIZAÇÃO CONCLUÍDA COM SUCESSO ===")
    print(f"Run ID: {run_id}")
    print(f"Total Arestas Inseridas/Atualizadas: {len(edges_to_insert)}")
    print(f"Contagens por Origem: {counts_by_source}")

    conn.close()
    return run_id, len(edges_to_insert), counts_by_source

if __name__ == "__main__":
    materialize()
