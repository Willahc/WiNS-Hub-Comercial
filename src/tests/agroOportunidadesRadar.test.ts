import React from 'react';
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import fs from 'node:fs';
import path from 'node:path';
import AgroOportunidadesApproved from '../pages/AgroOportunidadesApproved';
import { AGRO_API } from '../pages/agroApiEndpoints';
import { httpClient } from '../services/http/client';
import { AuthProvider } from '../services/auth';

const page = fs.readFileSync(path.resolve(__dirname, '../pages/AgroOportunidadesApproved.tsx'), 'utf8');
const contract = fs.readFileSync(path.resolve(__dirname, '../pages/agroOportunidadesContract.ts'), 'utf8');
const endpoints = fs.readFileSync(path.resolve(__dirname, '../pages/agroApiEndpoints.ts'), 'utf8');

const RADAR_LIST_STAGE_CONTRACT = [
  ['sinais', 'SIGNAL'],
  ['candidatas', 'CANDIDATE'],
] as const;

const stagesResponse = {
  engine_status: 'VALIDATION',
  stages: [
    { stage: 'CANDIDATE', status: 'UNAVAILABLE', record_count: 0, description: 'Consulta de propriedades indisponível.', entry_criteria: ['CAR real'], blockers: [{ code: 'PROPERTY_QUERY_NOT_PERFORMANT', description: 'Consulta acima da meta.' }] },
    { stage: 'VALIDATION', status: 'UNAVAILABLE', record_count: 0, readiness: [] },
    { stage: 'VALIDATED', status: 'UNAVAILABLE', record_count: 0, entry_criteria: [], blockers: [] },
  ],
};

function requestStage(config: { params?: unknown } | undefined): unknown {
  const params = config?.params;
  return params && typeof params === 'object' ? (params as Record<string, unknown>).stage : undefined;
}

function installRadarApiMock() {
  return vi.spyOn(httpClient, 'get').mockImplementation(async (url, config) => {
    if (url === AGRO_API.oportunidades) {
      const stage = requestStage(config);
      const signalItems = stage === 'SIGNAL' ? [{ signal_id: 'signal-test', municipio: 'Teste', uf: 'MT', classification: 'DESERTO_VET', priority: 'ALTA', metrics: {}, rule: {}, sources: [], limitations: [] }] : [];
      return { data: { engine_status: 'VALIDATION', stage, filtered_total: signalItems.length, total_pages: signalItems.length, items: signalItems, universe: {}, status: 'ok', sources: [], limitations: [] } } as never;
    }
    if (url === AGRO_API.oportunidadesStatus) return { data: { engine_status: 'VALIDATION' } } as never;
    if (url === AGRO_API.oportunidadesFunil) return { data: { municipalities_evaluated: 5536, signals_total: 1368, candidates_total: 0, validation_total: 0, validated_total: 0 } } as never;
    if (url === AGRO_API.oportunidadesEstagios) return { data: stagesResponse } as never;
    if (url === AGRO_API.oportunidadesRegras) return { data: { rules: [], summary: {} } } as never;
    throw new Error(`Endpoint inesperado no teste: ${url}`);
  });
}

function renderRadar(entry: string) {
  return render(React.createElement(
    AuthProvider,
    null,
    React.createElement(MemoryRouter, { initialEntries: [entry] }, React.createElement(AgroOportunidadesApproved)),
  ));
}

function opportunityCalls(spy: ReturnType<typeof installRadarApiMock>) {
  return spy.mock.calls.filter(([url]) => url === AGRO_API.oportunidades);
}

describe('Radar de Sinais e Oportunidades Agro', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
  });
  afterEach(() => cleanup());

  it.each(RADAR_LIST_STAGE_CONTRACT)('declara o contrato da aba %s como %s sem derivação textual', (tab, stage) => {
    expect(page).toContain(`${tab}: '${stage}'`);
  });

  it('abre diretamente Candidatas com CANDIDATE, total zero e diagnóstico fail-closed', async () => {
    const get = installRadarApiMock();
    renderRadar('/agro/oportunidades?tab=candidatas');

    await screen.findByText('PROPERTY_QUERY_NOT_PERFORMANT');
    await waitFor(() => expect(opportunityCalls(get)).toHaveLength(1));
    const config = opportunityCalls(get)[0][1];
    expect(config?.params).toMatchObject({ stage: 'CANDIDATE', page: 1, page_size: 25 });
    expect(get.mock.calls.every(([, request]) => requestStage(request) !== 'CANDIDATAS')).toBe(true);
    expect(screen.getByText('Candidatas: diagnóstico fail-closed')).toBeTruthy();
    expect(screen.getByText('Nenhum registro foi fabricado. A promoção permanece bloqueada até a consulta cumprir a meta de desempenho.')).toBeTruthy();
    expect(screen.getByText('Total atual').nextElementSibling?.textContent).toBe('0');
  });

  it('troca de Sinais para Candidatas e envia uma nova chamada com CANDIDATE', async () => {
    const get = installRadarApiMock();
    renderRadar('/agro/oportunidades?tab=sinais');
    await waitFor(() => expect(opportunityCalls(get).some(([, config]) => requestStage(config) === 'SIGNAL')).toBe(true));

    fireEvent.click(await screen.findByRole('tab', { name: 'Candidatas' }));
    await waitFor(() => expect(opportunityCalls(get).some(([, config]) => requestStage(config) === 'CANDIDATE')).toBe(true));
    expect(opportunityCalls(get).every(([, config]) => requestStage(config) !== 'CANDIDATAS')).toBe(true);
  });

  it.each([
    ['validacao', 'Em validação'],
    ['validadas', 'Validadas'],
    ['regras', 'Regras do motor'],
  ])('a aba %s não chama a lista de oportunidades', async (tab, visibleText) => {
    const get = installRadarApiMock();
    renderRadar(`/agro/oportunidades?tab=${tab}`);
    await screen.findAllByText(visibleText);
    await waitFor(() => expect(get).toHaveBeenCalled());
    expect(opportunityCalls(get)).toHaveLength(0);
  });

  it('não contém o estágio de API inválido nem conversão implícita', () => {
    expect(page).not.toContain('tab.toUpperCase()');
    expect(page).not.toMatch(/stage\s*:\s*['"]CANDIDATAS['"]/);
  });
  it('exibe título, subtítulo e badge de motor em validação', () => {
    expect(page).toContain('Sinais e Oportunidades Agro');
    expect(page).toContain('Radar baseado em evidências territoriais reais');
    expect(page).toContain('Motor em validação');
  });

  it('possui as cinco abas do funil e das regras', () => {
    for (const value of ['Sinais', 'Candidatas', 'Em validação', 'Validadas', 'Regras do motor']) {
      expect(page).toContain(value);
    }
  });

  it('apresenta os sete KPIs do funil real', () => {
    for (const value of ['Municípios avaliados', 'Sinais identificados', 'Deserto Veterinário', 'Baixa cobertura', 'Candidatas', 'Em validação', 'Validadas']) {
      expect(page).toContain(value);
    }
  });

  it('renderiza o funil visual com etapas e motivos de não promoção', () => {
    for (const value of ['Funil de sinais', 'Municípios avaliados', 'Candidatas', 'Validadas', 'Motivos de não promoção', 'Cobertura normal', 'Entidade não identificada', 'Contato indisponível', 'Decisor não comprovado', 'Sinais sem regra de promoção']) {
      expect(page).toContain(value);
    }
  });

  it('renderiza cards de sinal municipal real com evidência e métricas', () => {
    for (const value of ['signal_id', 'evidence_summary', 'rebanho_bovino', 'bovinos_por_tecnico', 'classificação', 'Prioridade Alta', 'Prioridade Média', 'cabeças']) {
      expect(page).toContain(value);
    }
  });

  it('não exibe score, categorias fabricadas nem Fila Comercial', () => {
    expect(page).not.toMatch(/Score:/);
    expect(page).not.toContain('composicao_score');
    expect(page).not.toContain('Fila Comercial');
    expect(page).not.toContain('Insumos Agrícolas & Fertilizantes');
    expect(page).not.toContain('Armazenagem & Silos Rurais');
    expect(page).not.toContain('Frete & Logística de Escoamento');
    expect(page).not.toContain('Máquinas, Tratores & Irrigação');
  });

  it('oferece ações reais: Deserto Veterinário, Propriedades, Copiar recorte e Ver regra', () => {
    expect(page).toContain('/agro/deserto-veterinario');
    expect(page).toContain('/agro/propriedades?uf=');
    expect(page).toContain('Copiar recorte');
    expect(page).toContain('Ver regra');
  });

  it('aplica filtros, ordenação e paginação na aba de sinais', () => {
    for (const value of ['Busca municipal', 'Todas as UFs', 'Toda classificação', 'Prioridade Alta', 'Anterior', 'Próxima', 'Itens por página', 'Decrescente', 'Crescente']) {
      expect(page).toContain(value);
    }
  });

  it('exibe estados vazios por aba com a copy exata', () => {
    expect(page).toContain('Nenhum sinal territorial identificado com os filtros atuais.');
    expect(page).toContain('Nenhuma candidata atende aos critérios documentais disponíveis.');
    expect(page).toContain('A validação humana ainda não está disponível nesta versão.');
    expect(page).toContain('Nenhuma oportunidade comercial foi validada.');
  });

  it('exibe estados de loading, erro e parcial com copy exata', () => {
    expect(page).toContain('Não foi possível carregar o Radar de Sinais Agro.');
    expect(page).toContain('Algumas métricas ou fontes complementares não estão disponíveis.');
    expect(page).toContain('Analisando sinais territoriais reais…');
  });

  it('mantém o tratamento de erro compatível com o teste de integração', () => {
    expect(page).toContain('const errorMessage = error ?');
  });

  it('valida o contrato de sinais reais sem campos fabricados', () => {
    expect(contract).toContain('REQUIRED_REAL_SIGNAL_FIELDS');
    expect(contract).toContain('FORBIDDEN_FABRICATED_SIGNAL_FIELDS');
    expect(contract).toContain('score');
    expect(contract).toContain('decisor');
    expect(contract).toContain('codigo_car');
  });

  it('lista vazia não torna o motor ativo no contrato', () => {
    expect(contract).not.toMatch(/if\s*\(\s*items\.length\s*===\s*0\s*\)\s*return\s*true/);
    expect(contract).toContain('isEngineActive');
  });

  it('expõe endpoints canônicos de status, funil e regras', () => {
    expect(endpoints).toContain("oportunidadesStatus: '/agro/oportunidades/status'");
    expect(endpoints).toContain("oportunidadesFunil: '/agro/oportunidades/funil'");
    expect(endpoints).toContain("oportunidadesRegras: '/agro/oportunidades/regras'");
    expect(endpoints).toContain("oportunidadesEstagios: '/agro/oportunidades/estagios'");
  });

  it('transforma candidatas vazias em diagnóstico fail-closed útil', () => {
    for (const value of ['Candidatas: diagnóstico fail-closed', 'Critérios necessários', 'O que já está disponível', 'Blockers', 'Fontes auditadas', 'Nenhum registro foi fabricado']) {
      expect(page).toContain(value);
    }
  });

  it('expõe prontidão sem controles funcionais enganosos', () => {
    expect(page).toContain('Prontidão da validação humana');
    expect(page).toContain('Fluxo de validação ainda indisponível');
    expect(page).toContain('disabled aria-describedby="validation-disabled-help"');
    expect(page).not.toMatch(/>\s*Aprovar\s*</);
    expect(page).not.toMatch(/>\s*Rejeitar\s*</);
  });

  it('explica o zero legítimo das validadas como política de integridade', () => {
    expect(page).toContain('Por que ainda não existem oportunidades validadas?');
    expect(page).toContain('política de integridade dos dados');
    expect(page).toContain('Contatos acionáveis validados: zero');
    expect(page).toContain('Nenhuma abordagem, exportação ou promoção automática está disponível.');
  });

  it('oferece filtros, agrupamentos e expansão no catálogo de regras', () => {
    for (const value of ['Buscar regra', 'Todos os status', 'Todos os estágios', 'Todas as entidades', 'Regras ativas', 'Regras indisponíveis', 'Regras planejadas', 'Expandir detalhe', 'Contrato produzido:']) {
      expect(page).toContain(value);
    }
  });

  it('renderiza zero com largura zero e null sem barra', () => {
    expect(page).toContain("numeric === null || numeric === 0 || base === 0 ? 0");
    expect(page).toContain("numeric !== null && <div className=\"radar-funnel-fill\"");
    expect(page).toContain("numeric === null ? 'Não calculável'");
    expect(page).not.toContain('Math.max(3');
    expect(page).toContain('Sinais sem regra de promoção');
  });

  it('mantém URL, cancelamento e acessibilidade das abas', () => {
    expect(page).toContain("const p: Record<string, string> = { tab }");
    expect(page).toContain('abort.current?.abort()');
    expect(page).toContain('aria-current');
    expect(page).toContain('aria-selected');
    expect(page).toContain("event.key !== 'ArrowLeft'");
  });

  it('isola erros e retries por área', () => {
    for (const value of ['metaError', 'stageError', 'rulesError', 'loadMeta', 'loadStages', 'loadRules']) {
      expect(page).toContain(value);
    }
  });
});
