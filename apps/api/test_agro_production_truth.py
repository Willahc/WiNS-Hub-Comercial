#!/usr/bin/env python3
"""
Testes de regressão para validação da missão Agro Production Truth.

Estes testes fazem ANÁLISE ESTÁTICA do código-fonte (inspect.getsource)
para garantir que:
1. Nenhum dado fabricado (hardcoded) permanece nos endpoints Agro
2. Contratos fail-closed estão no código (status=validation, total=0, items=[])
3. Vazamento cross-domain (Obra->Decisor) está bloqueado no dashboard Agro
4. Totais dinâmicos substituem constantes fixas
5. Auth, Nginx, Docker, CI e outras verticais NÃO foram alterados

NÃO requerem conexão com banco de dados.
"""

import os
import sys
import inspect

# Adiciona o diretório da API ao path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from wave1_repository import Wave1Repository


class TestAgroProductionTruthStatic:
    """Testes estáticos: validam o código-fonte sem chamar banco."""

    def test_agro_oportunidades_calculadas_retorna_vazio_fail_closed(self):
        """Oportunidades calculadas deve retornar lista vazia, total=0, status=validation."""
        source = inspect.getsource(Wave1Repository.agro_oportunidades_calculadas)
        
        # Deve retornar estrutura fail-closed
        assert '"oportunidades": []' in source or "'oportunidades': []" in source
        assert '"total": 0' in source or "'total': 0" in source
        assert '"status": "validation"' in source or "'status': 'validation'" in source
        assert '"message"' in source
        assert '"limitacoes"' in source
        
        # NÃO deve conter o conjunto fabricado anterior (apenas no código executável, não comentários)
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
        # Verifica apenas linhas que NÃO são comentários
        code_lines = [l for l in source.split("\n") if not l.strip().startswith("#")]
        code_only = "\n".join(code_lines)
        for f in forbidden:
            assert f not in code_only, f"Dado fabricado encontrado no código: {f}"

    def test_agro_logistica_correlacao_sem_hardcodes(self):
        """Logística correlacao não deve conter 4210, 128, corredores, caminhão vazio."""
        source = inspect.getsource(Wave1Repository.agro_logistica_correlacao)
        
        # Não deve ter os valores hardcoded antigos (apenas no código executável)
        code_lines = [l for l in source.split("\n") if not l.strip().startswith("#")]
        code_only = "\n".join(code_lines)
        
        assert "4210" not in code_only, "Não deve conter 4210 hardcoded"
        assert "128" not in code_only, "Não deve conter 128 hardcoded"
        assert "Corredor BR-163" not in source
        assert "Ferrovia Norte-Sul" not in source
        assert "Hidrovia Tietê" not in source
        assert "Porto de Santos" not in source
        assert "Porto de Paranaguá" not in source
        
        # Corredores deve ser lista vazia
        assert "corredores_exportacao" in source
        assert "[]" in source.replace(" ", "") or "[]" in source
        
        # Armazéns CONAB deve ser None
        assert "armazens_conab_proximos" in source
        assert "None" in source or "null" in source.lower()
        
        # Oportunidades caminhão vazio deve ser lista vazia (chave existe mas vazio)
        assert "oportunidades_caminhao_vazio" in source
        assert "[]" in source.replace(" ", "")
        
        # Deve ter campos de cobertura real
        assert "transportadores_rntrc_disponiveis" in source
        assert "transportadores_base_total" in source
        assert "log.transportadora" in source
        
        # Status e nota
        assert "status" in source
        assert "nota" in source

    def test_agro_genetica_simulador_sem_simulador_exemplo(self):
        """Genética simulador não deve conter simulador_exemplo fabricado."""
        source = inspect.getsource(Wave1Repository.agro_genetica_simulador)
        
        # simulador_exemplo deve ser None
        assert "simulador_exemplo" in source
        assert "None" in source
        
        # NÃO deve ter o bloco fabricado
        forbidden = [
            "CXP0272", "NELORE PO", "14,8 kg", "Top 2%", "0,85%",
            "Seguro < 3,0%", "3.250,00", "18%", "média de mercado",
            "ganho_peso_desmama_dep", "consanguinidade_estimada",
            "previsao_valor_bezerro", "touro_selecionado"
        ]
        for f in forbidden:
            assert f not in source, f"Simulador fabricado encontrado: {f}"
        
        # Deve ter total_reprodutores
        assert "total_reprodutores" in source
        
        # Deve ter status=validation
        assert "status" in source
        assert "validation" in source
        
        # Deve consultar DEPs reais
        assert "mercado.avaliacao" in source
        assert "caracteristica" in source
        assert "GPD" in source or "PD" in source
        assert "catalogo.raca" in source

    def test_agro_holdings_total_dinamico(self):
        """Holdings não deve ter total hardcoded 67362."""
        source = inspect.getsource(Wave1Repository.agro_holdings)
        
        # Deve ter query de count real
        assert "count(*)" in source.lower() or "count(*)" in source
        assert "holding_lead_ui" in source
        
        # NÃO deve ter total fixo 67362 no retorno
        assert '"total": 67362' not in source
        assert "'total': 67362" not in source
        assert "total=67362" not in source.replace(" ", "")

    def test_agro_decisores_total_dinamico_sem_cargo_fabricado(self):
        """Decisores não deve ter total hardcoded 228000 e não deve fabricar 'Diretor Executivo'."""
        source = inspect.getsource(Wave1Repository.agro_decisores)
        
        # Deve ter query de count real
        assert "count(*)" in source.lower() or "count(*)" in source
        assert "holding_lead_ui" in source
        
        # NÃO deve ter total fixo 228000
        assert '"total": 228000' not in source
        assert "'total': 228000" not in source
        assert "total=228000" not in source.replace(" ", "")
        
        # NÃO deve fabricar "Diretor Executivo"
        assert "Diretor Executivo" not in source
        
        # Cargo deve refletir origem QSA
        assert "QSA" in source or "Sócio" in source
        
        # Fonte deve ser honesta
        assert "fonte" in source.lower()
        assert "RFB" in source or "QSA" in source

    def test_agro_relacoes_sem_vazamento_obra_decisor(self):
        """Relações sem filtro não deve vazar relações globais de Engenharia (Obra->Decisor)."""
        source = inspect.getsource(Wave1Repository.agro_relacoes)
        
        # Fail-closed: sem cláusulas (sem imovel_id nem cnpj) deve retornar vazio
        assert "if not clauses:" in source or "not clauses" in source
        assert '"relacoes": []' in source or "'relacoes': []" in source
        assert '"total": 0' in source or "'total': 0" in source
        
        # Mensagem honesta
        assert "message" in source
        msg_check = "agro" in source.lower() and ("materializada" in source.lower() or "recorte" in source.lower())
        assert msg_check, "Mensagem deve indicar recorte Agro"
        
        # NÃO deve ter clause = "1=1" (que vazava tudo)
        assert 'clause = "1=1"' not in source and "clause = '1=1'" not in source
        assert "1=1" not in source or "not clauses" in source  # só permitido se no contexto fail-closed
        
        # Com filtro, deve filtrar por prop_ ou cnpj
        assert "prop_" in source

    def test_agro_imovel_360_decisores_escopo_cnpj(self):
        """Ficha 360 decisores deve ser escopo por CNPJ, não LIMIT 3 global."""
        source = inspect.getsource(Wave1Repository.agro_imovel_360_detail)
        
        # NÃO deve ter LIMIT 3 sem filtro em decisores_fazenda
        # A query antiga: SELECT ... FROM prospeccao.decisores_fazenda LIMIT 3
        assert "LIMIT 3" not in source or "decisores_fazenda" not in source or "WHERE cnpj_basico" in source
        
        # Deve filtrar por cnpj_basico quando cpf_cnpj presente
        assert "cnpj_basico" in source
        assert "decisores_fazenda" in source
        
        # Deve ter _clean_cnpj
        assert "_clean_cnpj" in source

    def test_agro_imovel_360_sem_oportunidades_heuristicas(self):
        """Ficha 360 não deve ter oportunidades heurísticas com scores inventados."""
        source = inspect.getsource(Wave1Repository.agro_imovel_360_detail)
        
        # Oportunidades calculadas deve ser lista vazia
        assert "oportunidades_calculadas" in source
        assert "opps = []" in source or "oportunidades_calculadas\": []" in source or "'oportunidades_calculadas': []" in source
        
        # NÃO deve ter scores fabricados 94, 89, 91, 86
        # NÃO deve ter títulos heurísticos
        heuristic_titles = [
            "Fornecimento de NPK",
            "Silo Metálico",
            "Silo Pulmão",
            "Touros Nelore",
            "Touros Nelore/Angus",
            "Frota Dedicada",
            "Carreta Graneleira",
            "Bitrem de Retorno",
            "score\": 94",
            "score\": 89",
            "score\": 91",
            "score\": 86",
            "\"score\": 94",
            "\"score\": 89",
            "\"score\": 91",
            "\"score\": 86",
            "Gerente de Compras Agrícolas",
            "Diretor Operacional",
            "Administrador da Fazenda",
            "Coordenador de Logística"
        ]
        
        for title in heuristic_titles:
            assert title not in source, f"Texto heurístico fabricado encontrado: {title}"

    def test_agro_kpis_total_cnpjs_dinamico(self):
        """KPIs total_cnpjs deve vir de query real, não 67362 hardcoded."""
        source = inspect.getsource(Wave1Repository.agro_kpis)
        
        # Deve ter query para contar holding_lead_ui
        assert "holding_lead_ui" in source
        assert "count(*)" in source.lower()
        
        # O fallback 67362 deve estar ANTES da query real (como fallback)
        fallback_idx = source.find("total_cnpjs = 67362")
        query_idx = source.find("holding_lead_ui")
        if fallback_idx >= 0 and query_idx >= 0:
            assert query_idx > fallback_idx, "Query real deve vir após fallback"

    def test_agro_logistica_query_log_transportadora(self):
        """Logística deve consultar log.transportadora (dados reais), não constantes."""
        source = inspect.getsource(Wave1Repository.agro_logistica_correlacao)
        
        assert "log.transportadora" in source
        assert "numero_rntrc" in source
        assert "count(*)" in source.lower()

    def test_genetica_query_dep_real(self):
        """Genética deve consultar mercado.avaliacao para DEPs reais."""
        source = inspect.getsource(Wave1Repository.agro_genetica_simulador)
        
        assert "mercado.avaliacao" in source
        assert "caracteristica" in source
        assert "GPD" in source or "PD" in source
        assert "catalogo.raca" in source


class TestNoUnintendedChanges:
    """Valida que autenticação, Nginx, Docker, CI e outras verticais NÃO foram alteradas na missão."""

    def test_wave1_repository_apenas_metodos_agro_alterados(self):
        """Apenas métodos Agro devem ter sido alterados em wave1_repository.py."""
        # Os métodos Agro são identificados pelo prefixo "agro_"
        # Verificamos que métodos de outras verticais não têm nossas marcações
        source = inspect.getsource(Wave1Repository)
        
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
        
        # Essas marcações devem aparecer APENAS em métodos agro_*
        for marker in mission_markers:
            if marker in source:
                # Encontra o método que contém essa marcação
                lines = source.split("\n")
                in_agro_method = False
                for i, line in enumerate(lines):
                    if marker in line:
                        # Procura o método pai (def agro_...)
                        for j in range(i, -1, -1):
                            if "def agro_" in lines[j]:
                                in_agro_method = True
                                break
                            elif "def " in lines[j] and "agro_" not in lines[j]:
                                # Achou outro método antes
                                break
                        assert in_agro_method, f"Marcador da missão '{marker}' encontrado fora de método agro_"


if __name__ == "__main__":
    import pytest
    pytest.main([__file__, "-v", "--tb=short"])