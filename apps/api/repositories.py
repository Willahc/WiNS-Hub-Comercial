import logging
from typing import Optional, List, Dict, Any
from database import get_connection, release_connection

logger = logging.getLogger("wins_hub_api.repositories")

class HealthRepository:
    @staticmethod
    def check_db_health() -> bool:
        conn = None
        try:
            conn = get_connection()
            cursor = conn.cursor()
            cursor.execute("SELECT 1;")
            cursor.close()
            return True
        except Exception as e:
            logger.error(f"DB health check query failed: {e}")
            return False
        finally:
            if conn:
                release_connection(conn)

class DashboardRepository:
    @staticmethod
    def get_kpis() -> List[Dict[str, Any]]:
        conn = None
        try:
            conn = get_connection()
            cursor = conn.cursor()
            cursor.execute("SELECT COUNT(*) FROM engenharia.obras;")
            obras_count = cursor.fetchone()[0]
            
            cursor.execute("SELECT COUNT(*) FROM canonical_mvp.resultado_match;")
            matches_count = cursor.fetchone()[0]
            cursor.close()
            
            return [
                {"label": "Eventos Ativos", "value": str(obras_count), "change": "+12%", "trend": "up"},
                {"label": "Empresas Mapeadas", "value": "4.8M", "change": "+5%", "trend": "up"},
                {"label": "Oportunidades", "value": str(matches_count), "change": "+18%", "trend": "up"}
            ]
        except Exception as e:
            logger.error(f"Erro ao buscar KPIs do Dashboard: {e}")
            raise e
        finally:
            if conn:
                release_connection(conn)

class EventosRepository:
    @staticmethod
    def get_all(limit: int = 50) -> List[Dict[str, Any]]:
        conn = None
        try:
            conn = get_connection()
            cursor = conn.cursor()
            cursor.execute("""
                SELECT id, nome, fase, municipio, uf, valor_estimado, data_publicacao, lead_score, confianca_extracao, descricao
                FROM engenharia.obras
                WHERE visivel = true AND nome IS NOT NULL
                LIMIT %s;
            """, (limit,))
            rows = cursor.fetchall()
            cursor.close()
            
            events = []
            for r in rows:
                events.append({
                    "id": str(r[0]),
                    "titulo": r[1] or "Sem título",
                    "tipo": "Obra",
                    "severidade": "alta" if (r[7] or 50) > 75 else "media",
                    "dataInicio": str(r[6]) if r[6] else "",
                    "dataFim": None,
                    "local": f"{r[3]}, {r[4]}" if r[3] else "Brasil",
                    "valor": f"R$ {r[5]:,.2f}" if r[5] else "R$ 0",
                    "verticais": ["engenharia"],
                    "status": r[2] or "Identificado",
                    "relevancia": int(r[7] or 50),
                    "confianca": int(r[8] or 50),
                    "description": r[9] or ""
                })
            return events
        except Exception as e:
            logger.error(f"Erro ao buscar eventos: {e}")
            raise e
        finally:
            if conn:
                release_connection(conn)

    @staticmethod
    def get_by_id(event_id: str) -> Optional[Dict[str, Any]]:
        conn = None
        try:
            conn = get_connection()
            cursor = conn.cursor()
            cursor.execute("""
                SELECT id, nome, fase, municipio, uf, valor_estimado, data_publicacao, lead_score, confianca_extracao, descricao
                FROM engenharia.obras
                WHERE id = %s;
            """, (event_id,))
            r = cursor.fetchone()
            cursor.close()
            
            if not r:
                return None
                
            return {
                "id": str(r[0]),
                "titulo": r[1] or "Sem título",
                "tipo": "Obra",
                "severidade": "alta" if (r[7] or 50) > 75 else "media",
                "dataInicio": str(r[6]) if r[6] else "",
                "dataFim": None,
                "local": f"{r[3]}, {r[4]}" if r[3] else "Brasil",
                "valor": f"R$ {r[5]:,.2f}" if r[5] else "R$ 0",
                "verticais": ["engenharia"],
                "status": r[2] or "Identificado",
                "relevancia": int(r[7] or 50),
                "confianca": int(r[8] or 50),
                "description": r[9] or ""
            }
        except Exception as e:
            logger.error(f"Erro ao buscar evento {event_id}: {e}")
            raise e
        finally:
            if conn:
                release_connection(conn)

class IndicadoresRepository:
    @staticmethod
    def get_all(limit: int = 50) -> List[Dict[str, Any]]:
        conn = None
        try:
            conn = get_connection()
            cursor = conn.cursor()
            cursor.execute("""
                SELECT municipio_nome, leitos_total, leitos_uti, leitos_sus_por_mil, equip_tomografo
                FROM saude.cnes_capacidade
                WHERE leitos_total IS NOT NULL AND leitos_total > 0
                LIMIT %s;
            """, (limit,))
            rows = cursor.fetchall()
            cursor.close()
            
            indicators = []
            for r in rows:
                indicators.append({
                    "municipio": f"{r[0]}",
                    "leitos": r[1] or 0,
                    "medicos": r[2] or 0,
                    "coberturaESF": f"{r[3]:.1f}/mil" if r[3] else "0/mil",
                    "hospitais": r[4] or 0
                })
            return indicators
        except Exception as e:
            logger.warning(f"Indicadores de saúde não acessíveis para a role atual: {e}")
            return []
        finally:
            if conn:
                release_connection(conn)

class EmpresasRepository:
    @staticmethod
    def get_all(cnpj: Optional[str] = None, search: Optional[str] = None) -> List[Dict[str, Any]]:
        conn = None
        try:
            conn = get_connection()
            cursor = conn.cursor()
            
            if cnpj:
                cursor.execute("""
                    SELECT id, cnpj, razao_social, municipio, uf, confianca_geral
                    FROM canonical_mvp.vw_empresa_360
                    WHERE cnpj = %s LIMIT 1;
                """, (cnpj,))
            elif search:
                cursor.execute("""
                    SELECT id, cnpj, razao_social, municipio, uf, confianca_geral
                    FROM canonical_mvp.vw_empresa_360
                    WHERE razao_social ILIKE %s LIMIT 20;
                """, (f"%{search}%",))
            else:
                cursor.execute("""
                    SELECT id, cnpj, razao_social, situacao_cadastral, confianca_geral
                    FROM canonical_mvp.entidade_empresa
                    LIMIT 20;
                """)
                
            rows = cursor.fetchall()
            cursor.close()
            
            companies = []
            for r in rows:
                if cnpj or search:
                    companies.append({
                        "cnpj": str(r[1]).strip(),
                        "nome": r[2] or "Sem Razão Social",
                        "cidade": r[3] or "Desconhecida",
                        "uf": r[4] or "BR",
                        "setor": "Corporativo",
                        "receita": "R$ 10M+",
                        "funcionarios": 100,
                        "status": "Ativa",
                        "verticais": ["empresa360"],
                        "score": int(r[5] or 50)
                    })
                else:
                    companies.append({
                        "cnpj": str(r[1]).strip(),
                        "nome": r[2] or "Sem Razão Social",
                        "cidade": "Desconhecida",
                        "uf": "BR",
                        "setor": "Corporativo",
                        "receita": "R$ 10M+",
                        "funcionarios": 100,
                        "status": "Ativa" if r[3] == "ATIVA" else "Inativa",
                        "verticais": ["empresa360"],
                        "score": int(r[4] or 50)
                    })
            return companies
        except Exception as e:
            logger.error(f"Erro ao listar empresas: {e}")
            raise e
        finally:
            if conn:
                release_connection(conn)

    @staticmethod
    def get_by_id(id_or_cnpj: str) -> Optional[Dict[str, Any]]:
        conn = None
        try:
            conn = get_connection()
            cursor = conn.cursor()
            cursor.execute("""
                SELECT id, cnpj, razao_social, municipio, uf, confianca_geral, porte, capital_social
                FROM canonical_mvp.vw_empresa_360
                WHERE id::text = %s OR cnpj = %s;
            """, (id_or_cnpj, id_or_cnpj))
            r = cursor.fetchone()
            cursor.close()
            
            if not r:
                return None
                
            return {
                "cnpj": str(r[1]).strip(),
                "nome": r[2] or "Sem Razão Social",
                "cidade": r[3] or "Desconhecida",
                "uf": r[4] or "BR",
                "setor": "Corporativo",
                "receita": f"R$ {r[7]:,.2f}" if r[7] else "R$ 0",
                "funcionarios": 100,
                "status": "Ativa",
                "verticais": ["empresa360"],
                "score": int(r[5] or 50)
            }
        except Exception as e:
            logger.error(f"Erro ao buscar detalhes da empresa {id_or_cnpj}: {e}")
            raise e
        finally:
            if conn:
                release_connection(conn)

class OportunidadesRepository:
    @staticmethod
    def get_all(limit: int = 50) -> List[Dict[str, Any]]:
        conn = None
        try:
            conn = get_connection()
            cursor = conn.cursor()
            cursor.execute("""
                SELECT id, score, evidencia->>'cnpj', decisao, evidencia->>'fonte'
                FROM canonical_mvp.resultado_match
                LIMIT %s;
            """, (limit,))
            rows = cursor.fetchall()
            cursor.close()
            
            opps = []
            for r in rows:
                opps.append({
                    "id": str(r[0]),
                    "score": int(float(r[1] or 50)),
                    "demanda": f"Integração de Base - {r[4] or 'Fonte Unificada'}",
                    "valor": "R$ 150K",
                    "justification": f"Firme match identificado com score de {r[1]}%",
                    "local": "Staging",
                    "stage": "identificada" if r[3] == "match" else "qualificada",
                    "cnpjAssociado": r[2]
                })
            return opps
        except Exception as e:
            logger.error(f"Erro ao buscar oportunidades: {e}")
            raise e
        finally:
            if conn:
                release_connection(conn)
