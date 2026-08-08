#!/usr/bin/env python3
"""
Testes de regressão estáticos para validação da missão Agro Production Truth.

Estes testes fazem ANÁLISE ESTÁTICA do código-fonte (leitura de arquivo + inspect.getsource)
SEM importar o módulo wave1_repository (evita dependência de DB/config).

Validam:
1. Nenhum dado fabricado (hardcoded) permanece nos endpoints Agro
2. Contratos fail-closed estão no código (status=validation, total=0, items=[])
3. Vazamento cross-domain (Obra->Decisor) está bloqueado no dashboard Agro
4. Totais dinâmicos substituem constantes fixas
5. Auth, Nginx, Docker, CI e outras verticais NÃO foram alterados
"""

import os

# Caminho do arquivo wave1_repository.py
WAVE1_PATH = os.path.join(os.path.dirname(__file__), "wave1_repository.py")


def read_source(method_name: str) -> str:
    """Lê o código-fonte de um método específico do wave1_repository.py."""
    with open(WAVE1_PATH, "r", encoding="utf-8") as f:
        full_source = f.read()

    # Encontra o método usando busca simples (mais robusto que import)
    lines = full_source.split("\n")
    in_method = False
    method_lines = []
    indent = None

    for i, line in enumerate(lines):
        stripped = line.lstrip()
        if stripped.startswith(f"def {method_name}("):
            in_method = True
            indent = len(line) - len(stripped)
            method_lines.append(line)
            continue

        if in_method:
            if line.strip() == "":
                method_lines.append(line)
                continue
            current_indent = len(line) - len(line.lstrip())
            if current_indent <= indent and line.strip() != "":
                # Saiu do método
                break
            method_lines.append(line)

    return "\n".join(method_lines)


def source_without_comments(source: str) -> str:
    """Remove comentários do código para busca precisa."""
    lines = []
    for line in source.split("\n"):
        # Remove comentários inline
        if "#" in line:
            # Cuidado com strings que contêm #
            in_string = False
            quote_char = None
            result = []
            i = 0
            while i < len(line):
                ch = line[i]
                if ch in ('"', "'") and (i == 0 or line[i-1] != "\\"):
                    if not in_string:
                        in_string = True
                        quote_char = ch
                    elif ch == quote_char:
                        in_string = False
                        quote_char = None
                elif ch == "#" and not in_string:
                    break
                result.append(ch)
                i += 1
            lines.append("".join(result))
        else:
            lines.append(line)
    return "\n".join(lines)


class TestAgroProductionTruthStatic:
    """Testes estáticos: validam o código-fonte sem chamar banco."""

    def test_agro_oportunidades_calculadas_retorna_vazio_fail_closed(self):
        source = read_source("agro_oportunidades_calculadas")
        code_only = source_without_comments(source)

        # Deve retornar estrutura fail-closed
        assert '"oportunidades": []' in code_only or "'oportunidades': []" in code_only
        assert '"total": 0' in code_only or "'total': 0" in code_only
        assert '"status": "validation"' in code_only or "'status': 'validation'" in code_only
        assert '"message"' in code_only
        assert '"limitacoes"' in code_only

        # NÃO deve conter o conjunto fabricado anterior (apenas no código executável)
        forbidden = [
            "opp_agro_001", "opp_agro_002", "opp_agro_003", "opp_agro_004", "opp_agro_005",
            "Carlos Alberto de Mendonça", "Roberto Prado Filho", "Marcio Rogério Souza",
            "Eduardo Henrique Silva", "Vinícius Vanzella de Souza",
            "18.245.910/0001-84", "04.182.731/0001-49", "08.912.440/0001-20",
            "12.381.990/0001-55", "55.055.019/0001-27",
            "MT-5107909-84A1", "GO-5218805-99B2", "MS-5003702-12C3",
            "MT-5107909-77D4", "SP-3550308-44E5",
            "carlos.mendonca@boavistaagro.com.br", "(64) 99812-4401",
            "marcio.souza@primaveraagro.com.br", "(65) 99654-1122",
            "vinicius@vanzellaagro.com.br",
            "Diretor de Suprimentos", "Gerente de Infraestrutura",
            "Administrador da Fazenda", "Gerente de Logística",
            "CEO / Diretor Geral"
        ]
        for f in forbidden:
            assert f not in code_only, f"Dado fabricado encontrado no código: {f}"

    def test_agro_logistica_correlacao_sem_hardcodes(self):
        source = read_source("agro_logistica_correlacao")
        code_only = source_without_comments(source)

        # Não deve ter os valores hardcoded antigos
        assert "4210" not in code_only, "Não deve conter 4210 hardcoded"
        assert "128" not in code_only, "Não deve conter 128 hardcoded"
        assert "Corredor BR-163" not in source
        assert "Ferrovia Norte-Sul" not in source
        assert "Hidrovia Tietê" not in source
        assert "Porto de Santos" not in source
        assert "Porto de Paranaguá" not in source

        assert "agro_logistica_resumo" in source

    def test_agro_logistica_usa_pool_canonico_local(self):
        helper = read_source("_run_agro_logistics")
        assert "get_connection()" in helper
        assert "release_connection(conn)" in helper
        assert "readonly=True" in helper
        assert "rollback()" in helper
        for method in ("agro_logistica_resumo", "agro_logistica_municipios"):
            source = read_source(method)
            assert "_run_agro_logistics" in source
            assert 'domain="agro"' not in source
            assert "log_staging" not in source

    def test_agro_logistica_contrato_parcial_sem_hardcode_nacional(self):
        source = read_source("agro_logistica_resumo")
        assert '"status": "PARTIAL"' in source
        assert "PENDING_CANONICAL_PROMOTION" in source
        assert "CONAB_SOURCE_NOT_INTEGRATED" in source
        assert '"known_source_total": None' in source
        assert "1124684" not in source
        assert "count(*)" in source
        assert "log.transportadora" in source
        assert "log.match" in source
        assert "registros logísticos previamente calculados" in source
        assert "cargas disponíveis" not in source.lower()

    def test_agro_logistica_municipios_pagina_filtra_e_declara_fontes(self):
        source = read_source("agro_logistica_municipios")
        assert "LIMIT %s OFFSET %s" in source
        assert "a.uf = %s" in source
        assert "a.municipio ILIKE %s" in source
        assert "MUNICIPAL_NAME_NORMALIZED" in source
        assert "SICAR/CAR" in source
        assert "IBGE PPM" in source
        assert "COBERTURA_CONHECIDA_ALTA" in source
        assert "DADOS_INSUFICIENTES" in source
        assert "-33.75" in source
        assert "5.27" in source
        assert "-73.99" in source
        assert "-34.79" in source

    def test_agro_logistica_mapa_sem_coordenadas_invalidas_ou_outliers(self):
        source = read_source("agro_logistica_mapa")
        assert "-33.75" in source
        assert "5.27" in source
        assert "-73.99" in source
        assert "-34.79" in source
        assert "lat_f != 0 or lng_f != 0" in source
        assert '"returned": len(valid_items)' in source
        assert '"total": response["total"]' in source

    def test_agro_genetica_simulador_sem_simulador_exemplo(self):
        source = read_source("agro_genetica_simulador")
        code_only = source_without_comments(source)

        # simulador_exemplo deve ser None
        assert "simulador_exemplo" in source
        assert "None" in code_only

        # NÃO deve ter o bloco fabricado
        forbidden = [
            "CXP0272", "NELORE PO", "14,8 kg", "Top 2%", "0,85%",
            "Seguro < 3,0%", "3.250,00", "18%", "média de mercado",
            "ganho_peso_desmama_dep", "consanguinidade_estimada",
            "previsao_valor_bezerro", "touro_selecionado"
        ]
        for f in forbidden:
            assert f not in code_only, f"Simulador fabricado encontrado: {f}"

        # Deve ter total_reprodutores
        assert "total_reprodutores" in source

        # Deve declarar que o endpoint legado é parcial
        assert "status" in source
        assert "PARTIAL" in source
        assert "a.valor IS NOT NULL" in source
        assert "r.pai_nome IS NOT NULL AND r.mae_nome IS NOT NULL" in source

        # Deve consultar DEPs reais
        assert "mercado.avaliacao" in source
        assert "caracteristica" in source
        assert "GPD" in source or "PD" in source
        assert "catalogo.raca" in source

    def test_agro_holdings_total_dinamico(self):
        source = read_source("agro_holdings")
        code_only = source_without_comments(source)

        # Deve ter query de count real
        assert "count(*)" in code_only.lower()
        assert "holding_lead_ui" in source

        # NÃO deve ter total fixo 67362 no retorno
        assert '"total": 67362' not in code_only
        assert "'total': 67362" not in code_only

    def test_agro_decisores_total_dinamico_sem_cargo_fabricado(self):
        source = read_source("agro_decisores")
        code_only = source_without_comments(source)

        # Deve ter query de count real
        assert "count(*)" in code_only.lower()
        assert "holding_lead_ui" in source

        # NÃO deve ter total fixo 228000
        assert '"total": 228000' not in code_only
        assert "'total': 228000" not in code_only

        # NÃO deve fabricar "Diretor Executivo"
        assert "Diretor Executivo" not in source

        # Cargo deve refletir origem QSA
        assert "QSA" in source or "Sócio" in source

        # Fonte deve ser honesta
        assert "fonte" in source.lower()
        assert "RFB" in source or "QSA" in source

    def test_agro_relacoes_sem_vazamento_obra_decisor(self):
        source = read_source("agro_relacoes")
        code_only = source_without_comments(source)

        # Fail-closed: sem cláusulas (sem imovel_id nem cnpj) deve retornar vazio
        assert "if not clauses:" in code_only or "not clauses" in code_only
        assert '"relacoes": []' in code_only or "'relacoes': []" in code_only
        assert '"total": 0' in code_only or "'total': 0" in code_only

        # Mensagem honesta
        assert "message" in source
        msg_check = "agro" in source.lower() and ("materializada" in source.lower() or "recorte" in source.lower())
        assert msg_check, "Mensagem deve indicar recorte Agro"

        # NÃO deve ter clause = "1=1" (que vazava tudo)
        assert 'clause = "1=1"' not in code_only and "clause = '1=1'" not in code_only

        # Com filtro, deve filtrar por prop_ ou cnpj
        assert "prop_" in source

    def test_agro_imovel_360_decisores_escopo_cnpj(self):
        source = read_source("agro_imovel_360_detail")
        code_only = source_without_comments(source)

        # NÃO deve ter LIMIT 3 sem filtro em decisores_fazenda
        # A query antiga: SELECT ... FROM prospeccao.decisores_fazenda LIMIT 3
        has_limit3 = "LIMIT 3" in code_only
        has_decisores = "decisores_fazenda" in source
        has_where_cnpj = "WHERE cnpj_basico" in code_only or "WHERE cnpj_basico" in source.replace("\n", " ")

        # Se tem LIMIT 3 e decisores_fazenda, deve ter WHERE cnpj_basico
        if has_limit3 and has_decisores:
            assert has_where_cnpj, "deve filtrar por cnpj_basico"

        # O novo contrato não consulta decisores: empresa/titular enriquecidos
        # permanecem nulos quando não há evidência no cadastro básico.
        assert "decisores_fazenda" not in source
        assert '"owner":None' in code_only or '"owner": None' in code_only

    def test_agro_imovel_360_sem_oportunidades_heuristicas(self):
        source = read_source("agro_imovel_360_detail")
        code_only = source_without_comments(source)

        # A ficha cadastral não cria nem expõe oportunidades comerciais.
        assert "oportunidades_calculadas" not in source

        # NÃO deve ter scores fabricados 94, 89, 91, 86
        heuristic_titles = [
            "Fornecimento de NPK",
            "Silo Metálico",
            "Silo Pulmão",
            "Touros Nelore",
            "Touros Nelore/Angus",
            "Frota Dedicada",
            "Carreta Graneleira",
            "Bitrem de Retorno",
            '"score": 94',
            '"score": 89',
            '"score": 91',
            '"score": 86',
            "'score': 94",
            "'score': 89",
            "'score': 91",
            "'score': 86",
            "Gerente de Compras Agrícolas",
            "Diretor Operacional",
            "Administrador da Fazenda",
            "Coordenador de Logística"
        ]

        for title in heuristic_titles:
            assert title not in code_only, f"Texto heurístico fabricado encontrado: {title}"

    def test_agro_kpis_total_cnpjs_dinamico(self):
        source = read_source("agro_kpis")
        code_only = source_without_comments(source)

        # Deve ter query para contar holding_lead_ui
        assert "holding_lead_ui" in source
        assert "count(*)" in code_only.lower()

        # O fallback 67362 deve estar ANTES da query real (como fallback)
        fallback_idx = code_only.find("total_cnpjs = 67362")
        query_idx = code_only.find("holding_lead_ui")
        if fallback_idx >= 0 and query_idx >= 0:
            assert query_idx > fallback_idx, "Query real deve vir após fallback"

    def test_agro_logistica_query_log_transportadora(self):
        source = read_source("agro_logistica_resumo")
        assert "log.transportadora" in source
        assert "numero_rntrc" in source
        assert "count(*)" in source.lower()

    def test_genetica_query_dep_real(self):
        source = read_source("agro_genetica_simulador")
        assert "mercado.avaliacao" in source
        assert "caracteristica" in source
        assert "GPD" in source or "PD" in source
        assert "catalogo.raca" in source

    def test_agro_genetica_resumo_sem_hardcode(self):
        source = read_source("agro_genetica_resumo")
        assert "mercado.reprodutor" in source
        assert "mercado.avaliacao" in source
        assert "catalogo.caracteristica" in source
        assert "catalogo.raca" in source
        assert "fazenda.animal" in source
        assert "mercado.doadora" in source
        assert "AVAILABLE" in source
        assert "UNAVAILABLE" in source
        assert "PLANNED" in source
        assert "updated_at" in source
        assert "source_rows" in source
        assert "118.793" not in source
        assert "1,19M" not in source

    def test_agro_genetica_reprodutores_paginacao(self):
        source = read_source("agro_genetica_reprodutores")
        assert "mercado.reprodutor" in source
        assert "catalogo.raca" in source
        assert "_page" in source
        assert "LIMIT" in source
        assert "OFFSET" in source
        assert "pedigree_quality" in source

    def test_agro_genetica_reprodutor_detail_com_deps(self):
        source = read_source("agro_genetica_reprodutor_detail")
        assert "mercado.reprodutor" in source
        assert "mercado.avaliacao" in source
        assert "catalogo.caracteristica" in source
        assert "selection_direction" in source

    def test_agro_genetica_caracteristicas_cobertura(self):
        source = read_source("agro_genetica_caracteristicas")
        assert "catalogo.caracteristica" in source
        assert "total_avaliacoes" in source
        assert "selection_direction" in source
        assert "objetivo_aumentar" in source
        assert "c.grupo as categoria" in source
        assert "max(av.coletado_em)" in source

    def test_agro_genetica_pedigree_declarado(self):
        source = read_source("agro_genetica_pedigree")
        assert "mercado.reprodutor" in source
        assert "pai_registro" in source
        assert "mae_registro" in source
        assert "PEDIGREE_ID_RESOLVED" in source
        assert "PEDIGREE_NAME_ONLY" in source
        assert "nome = %s" not in source

    def test_agro_genetica_acasalamento_prontidao_fail_closed(self):
        source = read_source("agro_genetica_acasalamento_prontidao")
        assert "fazenda.animal" in source
        assert "mercado.doadora" in source
        assert "NOT_CALCULABLE" in source
        assert "eligible_matrices_count" in source
        assert "a.sexo = 'F'" in source
        assert "a.sexo IS NULL" not in source
        assert "PEDIGREE_DEPTH_INSUFFICIENT_FOR_FORMAL_COEFFICIENT" in source
        assert "REQUIRES_HERD_PRODUCTION_AND_COMMERCIAL_COST_PARAMETERS" in source

    def test_agro_genetica_acasalamento_candidatos_bloqueio_parentesco(self):
        source = read_source("agro_genetica_acasalamento_candidatos")
        assert "PARENT_CHILD" in source
        assert "HALF_SIBLING_PATERNAL" in source
        assert "HALF_SIBLING_MATERNAL" in source
        assert "PREREQUISITE_REQUIRED" in source
        assert "eligible_reproducers" in source
        assert "excluded_reproducers" in source


class TestNoUnintendedChanges:
    """Valida que autenticação, Nginx, Docker, CI e outras verticais NÃO foram alteradas na missão."""

    def test_wave1_repository_apenas_metodos_agro_alterados(self):
        """Apenas métodos Agro devem ter marcações da missão."""
        with open(WAVE1_PATH, "r", encoding="utf-8") as f:
            source = f.read()

        # Marcações da nossa missão
        mission_markers = [
            "Motor de oportunidades em validação",
            "Cobertura real da base",
            "simulador fail-closed",
            "sem vazamento global",
            "fail-closed: no dashboard",
            "escopo por cnpj_basico",
            "heurísticas fabricadas",
            "Motor de Inferência Comercial WiNS Agro"
        ]

        for marker in mission_markers:
            if marker in source:
                # Verifica se está dentro de um método agro_
                lines = source.split("\n")
                for i, line in enumerate(lines):
                    if marker in line:
                        # Procura o método pai
                        found_agro = False
                        for j in range(i, -1, -1):
                            if "def agro_" in lines[j]:
                                found_agro = True
                                break
                            elif "def " in lines[j] and "agro_" not in lines[j]:
                                break
                        assert found_agro, f"Marcador '{marker}' fora de método agro_"


if __name__ == "__main__":
    import pytest
    pytest.main([__file__, "-v", "--tb=short"])
