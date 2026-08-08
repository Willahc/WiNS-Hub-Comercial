"""Catálogo SICAR/CAR e contexto municipal, sempre em consultas read-only separadas."""

import logging
import math
from typing import Any, Optional

import psycopg2
from psycopg2.extras import RealDictCursor

from database import get_connection, release_connection

logger = logging.getLogger("wins_hub_api.agro_properties")
SOURCE_OBJECT = "prospeccao.imovel_rural"
TERRITORIAL_OBJECT = "prospeccao.v_white_space_pecuaria"
BRAZIL_BOUNDS = (-33.75, 5.27, -73.99, -34.79)


def _query(domain: str, sql: str, params: list[Any] | None = None, timeout_ms: int = 120000) -> list[dict]:
    conn = get_connection(domain)
    try:
        conn.set_session(readonly=True, autocommit=False)
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("SET LOCAL statement_timeout = %s", (timeout_ms,))
            cur.execute(sql, params or [])
            rows = [dict(row) for row in cur.fetchall()]
        conn.rollback()
        return rows
    finally:
        release_connection(conn, domain)


def _geographic_quality(latitude: Any, longitude: Any) -> str:
    if latitude is None or longitude is None: return "MISSING"
    try: lat, lon = float(latitude), float(longitude)
    except (TypeError, ValueError): return "INVALID"
    if lat == 0 and lon == 0: return "INVALID"
    if not (BRAZIL_BOUNDS[0] <= lat <= BRAZIL_BOUNDS[1] and BRAZIL_BOUNDS[2] <= lon <= BRAZIL_BOUNDS[3]):
        return "INVALID"
    return "PROPERTY_COORDINATE"


def _base_item(row: dict) -> dict:
    quality = _geographic_quality(row.get("latitude"), row.get("longitude"))
    return {
        "detail_id": row["detail_id"], "detail_available": True,
        "identifier": row.get("codigo_car"), "codigo_car": row.get("codigo_car"),
        "municipio": row.get("municipio"), "uf": row.get("uf"), "codigo_ibge": row.get("codigo_ibge"),
        "area_ha": row.get("area_ha"), "area_unit": "ha", "area_semantics": "DECLARED_IN_CAR",
        "latitude": row.get("latitude") if quality == "PROPERTY_COORDINATE" else None,
        "longitude": row.get("longitude") if quality == "PROPERTY_COORDINATE" else None,
        "geographic_quality": quality, "coordinate_scope": "PROPERTY" if quality == "PROPERTY_COORDINATE" else None,
        "registration_status": None, "registration_status_status": "NOT_AVAILABLE",
        "source": "SICAR/CAR", "source_object": SOURCE_OBJECT, "updated_at": row.get("updated_at"),
        "record_semantics": "RURAL_PROPERTY_REGISTRATION",
        "limitations": ["Registro declaratório SICAR/CAR; não comprova atividade produtiva, titularidade ou disponibilidade comercial."],
    }


def _territorial_by_codes(codes: list[str]) -> tuple[dict[str, dict], dict]:
    if not codes: return {}, {"status": "AVAILABLE", "source": TERRITORIAL_OBJECT}
    try:
        rows = _query("agro_legacy", """SELECT codigo_ibge::text codigo_ibge, nome municipio, uf,
          bovinos::bigint rebanho_municipal, tecnicos_75km::int presenca_tecnica_conhecida_75km,
          carga_regional::bigint carga_regional, replace(classificacao_vet,' ','_') classificacao_veterinaria,
          latitude::float latitude_municipal, longitude::float longitude_municipal
          FROM prospeccao.v_white_space_pecuaria WHERE codigo_ibge::text=ANY(%s::text[])""", [codes])
        by_code = {}
        for row in rows:
            row.update({"scope": "MUNICIPAL", "link_quality": "IBGE_CODE_EXACT",
                        "source": "Contexto territorial municipal", "source_object": TERRITORIAL_OBJECT,
                        "limitations": ["Classificação e rebanho são municipais; não descrevem o imóvel individual."]})
            by_code[str(row["codigo_ibge"])] = row
        return by_code, {"status": "AVAILABLE", "source": TERRITORIAL_OBJECT, "link_quality": "IBGE_CODE_EXACT"}
    except psycopg2.errors.InsufficientPrivilege as exc:
        logger.error("Permission denied no contexto municipal de propriedades: %s", exc)
        return {}, {"status": "UNAVAILABLE", "reason": "SOURCE_NOT_ACCESSIBLE", "source": TERRITORIAL_OBJECT}
    except Exception as exc:
        logger.error("Falha no contexto municipal de propriedades: %s", exc)
        return {}, {"status": "UNAVAILABLE", "reason": "QUERY_FAILED", "source": TERRITORIAL_OBJECT}


class AgroPropertiesRepository:
    @staticmethod
    def summary():
        # Contagens que permanecem abaixo da meta; métricas de varredura integral
        # ficam explicitamente não calculáveis, nunca zero.
        row = _query("agro", "SELECT count(*)::bigint total FROM prospeccao.imovel_rural WHERE fonte_principal='SICAR'")[0]
        municipal = _query("agro", """SELECT count(DISTINCT codigo_ibge_mun)::int municipios
          FROM prospeccao.imovel_rural WHERE fonte_principal='SICAR'""")[0]
        stats = _query("agro", """SELECT attname,n_distinct::int n_distinct,null_frac
          FROM pg_stats WHERE schemaname='prospeccao' AND tablename='imovel_rural'
          AND attname=ANY(%s::text[])""", [["uf","codigo_ibge_mun"]])
        by_name={r["attname"]:r for r in stats}
        ibge_null=float(by_name.get("codigo_ibge_mun",{}).get("null_frac") or 0)
        return {"status": "AVAILABLE", "total": int(row["total"]),
                "ufs": int(by_name["uf"]["n_distinct"]) if by_name.get("uf") else None,
                "municipios": int(municipal["municipios"]),
                "com_codigo_ibge": round(int(row["total"])*(1-ibge_null)), "com_codigo_ibge_precision":"POSTGRES_CATALOG_ESTIMATE",
                "com_coordenada_valida": None, "com_coordenada_valida_status": "NOT_CALCULABLE_WITHIN_PERFORMANCE_TARGET",
                "area_conhecida": None, "area_conhecida_status": "NOT_CALCULABLE_WITHIN_PERFORMANCE_TARGET",
                "source": "SICAR/CAR", "source_object": SOURCE_OBJECT,
                "updated_from": None, "updated_to": None, "updated_range_status":"NOT_CALCULABLE_WITHIN_PERFORMANCE_TARGET",
                "limitations": ["Contagens de coordenadas válidas e área conhecida exigem varredura nacional acima da meta; não são publicadas como zero."]}

    @staticmethod
    def list(page=1, page_size=25, sort="identifier", order="asc", **filters):
        size = page_size if page_size in (25, 50, 100) else 25
        safe_page = max(1, min(int(page), 1000)); offset = (safe_page - 1) * size
        where, params = ["i.fonte_principal='SICAR'"], []
        if filters.get("q"):
            where.append("(i.codigo_car ILIKE %s OR i.nome_imovel ILIKE %s OR i.municipio ILIKE %s)")
            params.extend([f"%{filters['q']}%"] * 3)
        if filters.get("uf"): where.append("i.uf=%s"); params.append(filters["uf"].upper())
        if filters.get("municipio"): where.append("i.municipio ILIKE %s"); params.append(filters["municipio"])
        if filters.get("area_min") is not None: where.append("i.area_total_ha >= %s"); params.append(filters["area_min"])
        if filters.get("area_max") is not None: where.append("i.area_total_ha <= %s"); params.append(filters["area_max"])
        geo = filters.get("geographic_quality")
        valid = "i.latitude BETWEEN -33.75 AND 5.27 AND i.longitude BETWEEN -73.99 AND -34.79 AND NOT(i.latitude=0 AND i.longitude=0)"
        if geo == "PROPERTY_COORDINATE": where.append(valid)
        elif geo == "MISSING": where.append("(i.latitude IS NULL OR i.longitude IS NULL)")
        elif geo == "INVALID": where.append(f"i.latitude IS NOT NULL AND i.longitude IS NOT NULL AND NOT({valid})")
        coverage = filters.get("cobertura_veterinaria")
        if coverage:
            try:
                code_rows = _query("agro_legacy", """SELECT codigo_ibge::text codigo_ibge
                  FROM prospeccao.v_white_space_pecuaria WHERE replace(classificacao_vet,' ','_')=%s""", [coverage])
            except Exception:
                raise
            codes = [r["codigo_ibge"] for r in code_rows]
            where.append("i.codigo_ibge_mun::text=ANY(%s::text[])"); params.append(codes)
        clause = " AND ".join(where)
        count = _query("agro", f"SELECT count(*)::bigint total FROM prospeccao.imovel_rural i WHERE {clause}", params)[0]
        sort_col = {"identifier":"i.codigo_car", "municipio":"i.municipio", "uf":"i.uf",
                    "area":"i.area_total_ha", "updated_at":"i.coletado_em"}.get(sort, "i.codigo_car")
        direction = "DESC" if str(order).lower() == "desc" else "ASC"
        rows = _query("agro", f"""SELECT i.id::text detail_id, i.codigo_car, i.municipio, i.uf,
          i.codigo_ibge_mun codigo_ibge, i.area_total_ha::float area_ha,
          i.latitude::float latitude, i.longitude::float longitude,
          i.coletado_em::text updated_at FROM prospeccao.imovel_rural i
          WHERE {clause} ORDER BY {sort_col} {direction} NULLS LAST, i.id LIMIT %s OFFSET %s""", params + [size, offset])
        items = [_base_item(r) for r in rows]
        by_code, enrichment = _territorial_by_codes(sorted({str(x["codigo_ibge"]) for x in items if x.get("codigo_ibge")}))
        for item in items: item["municipal_context"] = by_code.get(str(item.get("codigo_ibge")))
        total = int(count["total"])
        return {"items": items, "total": total, "page": safe_page, "page_size": size,
                "total_pages": math.ceil(total/size) if total else 0, "status": "AVAILABLE",
                "enrichment": enrichment, "source": "SICAR/CAR", "source_object": SOURCE_OBJECT,
                "limitations": ["Paginação operacional limitada às primeiras 1.000 páginas; use filtros para recortes mais profundos."]}

    @staticmethod
    def detail(item_id: str) -> Optional[dict]:
        rows = _query("agro", """SELECT i.id::text detail_id, i.codigo_car, i.municipio, i.uf,
          i.codigo_ibge_mun codigo_ibge, i.area_total_ha::float area_ha,
          i.latitude::float latitude, i.longitude::float longitude,
          i.coletado_em::text updated_at FROM prospeccao.imovel_rural i
          WHERE i.fonte_principal='SICAR' AND i.id::text=%s LIMIT 1""", [str(item_id)])
        if not rows: return None
        item = _base_item(rows[0]); by_code, enrichment = _territorial_by_codes([str(item["codigo_ibge"])]) if item.get("codigo_ibge") else ({}, {"status":"UNAVAILABLE","reason":"MISSING_IBGE_CODE"})
        context = by_code.get(str(item.get("codigo_ibge")))
        return {"status": "AVAILABLE", "property": item, "municipal_context": context,
                "enrichment": enrichment, "declared_holder": None,
                "declared_holder_status": "NOT_EXPOSED_WITHOUT_IDENTITY_EVIDENCE",
                "limitations": item["limitations"] + ["Nenhum proprietário ou atividade econômica é inferido deste registro."]}

    @staticmethod
    def municipal_context(uf: Optional[str] = None, municipio: Optional[str] = None, limit: int = 100):
        where, params = ["1=1"], []
        if uf: where.append("upper(uf)=upper(%s)"); params.append(uf)
        if municipio: where.append("nome ILIKE %s"); params.append(municipio)
        rows = _query("agro_legacy", f"""SELECT codigo_ibge::text codigo_ibge,nome municipio,uf,
          bovinos::bigint rebanho_municipal,tecnicos_75km::int presenca_tecnica_conhecida_75km,
          carga_regional::bigint carga_regional,replace(classificacao_vet,' ','_') classificacao_veterinaria,
          latitude::float latitude_municipal,longitude::float longitude_municipal
          FROM prospeccao.v_white_space_pecuaria WHERE {' AND '.join(where)}
          ORDER BY bovinos DESC NULLS LAST,codigo_ibge LIMIT %s""", params + [max(1,min(500,limit))])
        codes=[r["codigo_ibge"] for r in rows]
        counts=_query("agro", """SELECT codigo_ibge_mun::text codigo_ibge,count(*)::bigint total
          FROM prospeccao.imovel_rural WHERE fonte_principal='SICAR' AND codigo_ibge_mun::text=ANY(%s::text[])
          GROUP BY codigo_ibge_mun""", [codes]) if codes else []
        by_code={str(r["codigo_ibge"]):int(r["total"]) for r in counts}
        for row in rows:
            row.update({"imoveis_registrados": by_code.get(str(row["codigo_ibge"])), "scope":"MUNICIPAL",
                        "link_quality":"IBGE_CODE_EXACT", "source":"SICAR/CAR + contexto territorial municipal",
                        "source_objects":[SOURCE_OBJECT,TERRITORIAL_OBJECT],
                        "limitations":["Presença conhecida na base; não prova cobertura completa ou vínculo com imóveis."]})
        return {"items":rows,"returned":len(rows),"status":"AVAILABLE","scope":"MUNICIPAL",
                "link_quality":"IBGE_CODE_EXACT","limitations":["Use filtros para recortes municipais; limite máximo de 500 municípios."]}

    @staticmethod
    def map(uf: Optional[str] = None, municipio: Optional[str] = None, bbox: Optional[tuple[float,float,float,float]] = None, limit: int = 1000):
        where, params = ["fonte_principal='SICAR'"], []
        bounds = bbox or (BRAZIL_BOUNDS[2], BRAZIL_BOUNDS[0], BRAZIL_BOUNDS[3], BRAZIL_BOUNDS[1])
        min_lon,min_lat,max_lon,max_lat = bounds
        where += ["latitude BETWEEN %s AND %s", "longitude BETWEEN %s AND %s", "NOT(latitude=0 AND longitude=0)"]
        params += [min_lat,max_lat,min_lon,max_lon]
        if uf: where.append("uf=%s");params.append(uf.upper())
        if municipio: where.append("municipio ILIKE %s");params.append(municipio)
        size=max(1,min(2000,limit))
        rows=_query("agro",f"""SELECT id::text detail_id,codigo_car identifier,municipio,uf,
          codigo_ibge_mun codigo_ibge,area_total_ha::float area_ha,latitude::float,longitude::float
          FROM prospeccao.imovel_rural WHERE {' AND '.join(where)} LIMIT %s""",params+[size])
        return {"items":rows,"returned":len(rows),"total":None,"total_status":"NOT_CALCULABLE_WITHIN_PERFORMANCE_TARGET",
                "aggregation":"PROPERTY_POINTS","status":"AVAILABLE","bbox":[min_lon,min_lat,max_lon,max_lat],
                "source":"SICAR/CAR","source_object":SOURCE_OBJECT,
                "limitations":[f"Recorte limitado a {size} registros dentro do viewport; não representa todos os imóveis."]}
