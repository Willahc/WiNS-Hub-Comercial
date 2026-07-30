from db import query


_TIMEOUT = 30


def _validar_cnpj_dv(cnpj: str) -> bool:
    if not cnpj.isdigit() or len(cnpj) != 14:
        return False
    pesos_1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
    pesos_2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
    soma_1 = sum(int(cnpj[i]) * pesos_1[i] for i in range(12))
    dv1 = 11 - (soma_1 % 11)
    if dv1 >= 10:
        dv1 = 0
    if int(cnpj[12]) != dv1:
        return False
    soma_2 = sum(int(cnpj[i]) * pesos_2[i] for i in range(13))
    dv2 = 11 - (soma_2 % 11)
    if dv2 >= 10:
        dv2 = 0
    return int(cnpj[13]) == dv2


class Empresa360Repository:
    def buscar_por_cnpj(self, cnpj: str):
        cnpj_clean = cnpj.replace(".", "").replace("/", "").replace("-", "")
        if not _validar_cnpj_dv(cnpj_clean):
            return None
        rows = query(
            "SELECT * FROM canonical_mvp.vw_empresa_360 WHERE cnpj = %(cnpj)s",
            {"cnpj": cnpj_clean},
            timeout_s=_TIMEOUT,
        )
        return rows[0] if rows else None

    def buscar_por_id(self, entidade_id: str):
        rows = query(
            "SELECT * FROM canonical_mvp.vw_empresa_360 WHERE id = %(id)s::uuid",
            {"id": entidade_id},
            timeout_s=_TIMEOUT,
        )
        return rows[0] if rows else None

    def listar(self, *, vertical=None, uf=None, multi_vertical=None,
               situacao=None, q=None, limit=50, offset=0):
        if vertical:
            return self._listar_com_join_vertical(
                vertical, uf=uf, multi_vertical=multi_vertical,
                situacao=situacao, q=q, limit=limit, offset=offset,
            )

        conditions = []
        params = {}

        if uf:
            conditions.append("ee.uf = %(uf)s")
            params["uf"] = uf.upper()

        if situacao:
            conditions.append("ee.situacao_cadastral = %(situacao)s")
            params["situacao"] = situacao

        if q:
            conditions.append(
                "(ee.razao_social ILIKE %(q)s OR ee.nome_fantasia ILIKE %(q)s OR ee.cnpj LIKE %(q)s)"
            )
            params["q"] = f"%{q}%"

        if multi_vertical is not None:
            base_where_mv = (" AND " if conditions else "").join(conditions)
            base_where_mv = base_where_mv or "TRUE"
            return self._listar_com_multi_vertical(
                multi_vertical, base_where_mv, params, limit, offset
            )

        base_where = " AND ".join(conditions) if conditions else "TRUE"

        count_rows = query(
            f"SELECT count(*) AS total FROM canonical_mvp.entidade_empresa ee WHERE {base_where}",
            params,
            timeout_s=_TIMEOUT,
        )
        total = count_rows[0]["total"] if count_rows else 0

        id_rows = query(
            f"SELECT ee.id FROM canonical_mvp.entidade_empresa ee WHERE {base_where} "
            "ORDER BY ee.razao_social LIMIT %(limit)s OFFSET %(offset)s",
            {**params, "limit": limit, "offset": offset},
            timeout_s=_TIMEOUT,
        )
        ids = [r["id"] for r in id_rows]

        if not ids:
            return {"items": [], "total": total, "limit": limit, "offset": offset}

        placeholders = ", ".join(f"%(id_{i})s" for i in range(len(ids)))
        id_params = {f"id_{i}": str(ids[i]) for i in range(len(ids))}

        rows = query(
            f"SELECT * FROM canonical_mvp.vw_empresa_360 WHERE id IN ({placeholders}) "
            "ORDER BY razao_social",
            id_params,
            timeout_s=_TIMEOUT,
        )

        return {"items": rows, "total": total, "limit": limit, "offset": offset}

    def _listar_com_join_vertical(self, vertical, **kwargs):
        limit = kwargs["limit"]
        offset = kwargs["offset"]
        params = {"vertical": vertical.upper(), "limit": limit, "offset": offset}

        conditions = ["pv.vertical = %(vertical)s", "pv.ativo = true"]

        if kwargs.get("uf"):
            conditions.append("ee.uf = %(uf)s")
            params["uf"] = kwargs["uf"].upper()

        if kwargs.get("situacao"):
            conditions.append("ee.situacao_cadastral = %(situacao)s")
            params["situacao"] = kwargs["situacao"]

        if kwargs.get("q"):
            conditions.append(
                "(ee.razao_social ILIKE %(q)s OR ee.nome_fantasia ILIKE %(q)s OR ee.cnpj LIKE %(q)s)"
            )
            params["q"] = f"%{kwargs['q']}%"

        base_where = " AND ".join(conditions)

        count_sql = f"""
            SELECT count(DISTINCT ee.id)
            FROM canonical_mvp.entidade_empresa ee
            JOIN canonical_mvp.papel_vertical pv ON pv.entidade_id = ee.id
            WHERE {base_where}
        """
        total_rows = query(count_sql, params, timeout_s=_TIMEOUT)
        total = total_rows[0]["count"] if total_rows else 0

        ids_sql = f"""
            SELECT ee.id, ee.razao_social
            FROM canonical_mvp.entidade_empresa ee
            JOIN canonical_mvp.papel_vertical pv ON pv.entidade_id = ee.id
            WHERE {base_where}
            GROUP BY ee.id, ee.razao_social
            ORDER BY ee.razao_social
            LIMIT %(limit)s OFFSET %(offset)s
        """
        id_rows = query(ids_sql, params, timeout_s=_TIMEOUT)
        ids = [r["id"] for r in id_rows]

        if not ids:
            return {"items": [], "total": total, "limit": limit, "offset": offset}

        placeholders = ", ".join(f"%(id_{i})s" for i in range(len(ids)))
        id_params = {f"id_{i}": str(ids[i]) for i in range(len(ids))}

        rows = query(
            f"SELECT * FROM canonical_mvp.vw_empresa_360 WHERE id IN ({placeholders}) "
            "ORDER BY razao_social",
            id_params,
            timeout_s=_TIMEOUT,
        )

        return {"items": rows, "total": total, "limit": limit, "offset": offset}

    def _listar_com_multi_vertical(self, multi_vertical, base_where, params, limit, offset):
        having = "HAVING count(DISTINCT pv.vertical) > 1" if multi_vertical is True else "HAVING count(DISTINCT pv.vertical) = 1"

        count_sql = f"""
            SELECT count(*) FROM (
                SELECT ee.id
                FROM canonical_mvp.entidade_empresa ee
                JOIN canonical_mvp.papel_vertical pv ON pv.entidade_id = ee.id AND pv.ativo = true
                WHERE {base_where}
                GROUP BY ee.id
                {having}
            ) sub
        """
        total_rows = query(count_sql, params, timeout_s=_TIMEOUT)
        total = total_rows[0]["count"] if total_rows else 0

        ids_sql = f"""
            SELECT ee.id
            FROM canonical_mvp.entidade_empresa ee
            JOIN canonical_mvp.papel_vertical pv ON pv.entidade_id = ee.id AND pv.ativo = true
            WHERE {base_where}
            GROUP BY ee.id
            {having}
            ORDER BY MIN(ee.razao_social)
            LIMIT %(limit)s OFFSET %(offset)s
        """
        id_rows = query(ids_sql, {**params, "limit": limit, "offset": offset},
                        timeout_s=_TIMEOUT)
        ids = [r["id"] for r in id_rows]

        if not ids:
            return {"items": [], "total": total, "limit": limit, "offset": offset}

        placeholders = ", ".join(f"%(id_{i})s" for i in range(len(ids)))
        id_params = {f"id_{i}": str(ids[i]) for i in range(len(ids))}

        rows = query(
            f"SELECT * FROM canonical_mvp.vw_empresa_360 WHERE id IN ({placeholders}) "
            "ORDER BY razao_social",
            id_params,
            timeout_s=_TIMEOUT,
        )
        return {"items": rows, "total": total, "limit": limit, "offset": offset}

    def listar_fontes(self, entidade_id: str):
        rows = query(
            """SELECT DISTINCT af.fonte, af.vertical, af.tabela_original, af.confianca, af.data_importacao
               FROM canonical_mvp.atributo_fonte af
               WHERE af.entidade_id = %(id)s::uuid AND af.status = 'ativo'
               ORDER BY af.fonte""",
            {"id": entidade_id},
            timeout_s=_TIMEOUT,
        )
        return rows

    def listar_papeis(self, entidade_id: str):
        rows = query(
            """SELECT pv.vertical, pv.tipo, pv.confianca, pv.fonte, pv.data_atribuicao, pv.ativo
               FROM canonical_mvp.papel_vertical pv
               WHERE pv.entidade_id = %(id)s::uuid
               ORDER BY pv.vertical, pv.tipo""",
            {"id": entidade_id},
            timeout_s=_TIMEOUT,
        )
        return rows

    def listar_conflitos_geograficos(self, entidade_id: str):
        rows = query(
            """SELECT eg.geografia_id, eg.uf, eg.municipio, eg.codigo_ibge, eg.cep,
                      eg.fonte_detalhe, eg.nivel_confianca, eg.status_validacao,
                      eg.indicador_conflito, eg.motivo_conflito
               FROM canonical_mvp.empresa_geografia eg
               WHERE eg.entidade_id = %(id)s::uuid
                 AND eg.indicador_conflito <> 'SEM_CONFLITO'
               ORDER BY eg.indicador_conflito""",
            {"id": entidade_id},
            timeout_s=_TIMEOUT,
        )
        return rows

    def listar_todas_geografias(self, entidade_id: str):
        rows = query(
            """SELECT eg.geografia_id, eg.uf, eg.municipio, eg.codigo_ibge, eg.cep,
                      eg.fonte_detalhe, eg.nivel_confianca, eg.status_validacao,
                      eg.indicador_conflito, eg.data_fonte
               FROM canonical_mvp.empresa_geografia eg
               WHERE eg.entidade_id = %(id)s::uuid
               ORDER BY eg.nivel_confianca, eg.data_fonte DESC NULLS LAST""",
            {"id": entidade_id},
            timeout_s=_TIMEOUT,
        )
        return rows

    def estatisticas(self):
        rows = query("""
            SELECT
                (SELECT count(*) FROM canonical_mvp.entidade_empresa) AS total_empresas,
                (SELECT count(*) FROM canonical_mvp.entidade_empresa WHERE vivo = true) AS ativas,
                (SELECT count(*) FROM canonical_mvp.entidade_empresa WHERE vivo = false) AS inativas,
                (SELECT count(DISTINCT pv.vertical) FROM canonical_mvp.papel_vertical pv WHERE pv.ativo = true) AS total_verticais
        """, timeout_s=_TIMEOUT)
        rows2 = query("""
            SELECT
                count(DISTINCT entidade_id) AS total_com_geo,
                count(*) FILTER (WHERE indicador_conflito <> 'SEM_CONFLITO') AS registros_conflito
            FROM canonical_mvp.empresa_geografia
        """, timeout_s=_TIMEOUT)
        return {**rows[0], **rows2[0]}
