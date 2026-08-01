import { describe, it, expect } from 'vitest';
import {
  isEngineActive,
  isEngineStatusExplicit,
  isMotorOportunidadesReal,
  isRetryableError,
  isSignalReal,
  hasNoFabricatedFields,
  REQUIRED_REAL_SIGNAL_FIELDS,
  FORBIDDEN_FABRICATED_SIGNAL_FIELDS,
} from '../pages/agroOportunidadesContract';

const fabricatedFixture = [
  {
    id: 'opp_agro_001',
    categoria: 'Insumos Agrícolas & Fertilizantes',
    titulo: 'Demanda de NPK 04-14-08 para Lavoura de Soja/Milho',
    imovel: 'Fazenda Boa Vista · CAR MT-5107909-84A1',
    empresa_alvo: 'GRUPO AGROPECUÁRIO BOA VISTA LTDA',
    cnpj: '18.245.910/0001-84',
    score: 96,
    justificativa: '3.450 ha de lavoura declarada sem contrato formal.',
    decisor_nome: 'Carlos Alberto de Mendonça',
    contato: 'carlos.mendonca@boavistaagro.com.br',
    status: 'Identificada',
  },
];

const realSignalFixture = [
  {
    signal_id: 'SIG-abc123',
    stage: 'SIGNAL',
    signal_type: 'TECHNICAL_COVERAGE_GAP_MUNICIPAL',
    entity_type: 'MUNICIPIO',
    entity_id: '5107909',
    municipio: 'Vila Bela da Santíssima Trindade',
    uf: 'MT',
    priority: 'ALTA',
    classification: 'DESERTO_VET',
    evidence_summary: 'Município classificado como Deserto Veterinário.',
    metrics: { rebanho_bovino: 220000, tecnicos_regionais: 3, bovinos_por_tecnico: 12000, raio_km: 75 },
    rule: { rule_id: 'TECHNICAL_COVERAGE_GAP_MUNICIPAL_V1', version: '1.0', description: 'Lacuna de cobertura técnica veterinária municipal' },
    sources: ['prospeccao.v_white_space_pecuaria', 'IBGE PPM 2023'],
    reference_date: null,
    calculated_at: '2026-08-01T00:00:00Z',
    actionability: 'REQUIRES_ENRICHMENT',
    missing_fields: [],
    limitations: ['A classificação é territorial.'],
    next_step: 'Identificar propriedades, empresas e canais técnicos do município antes de qualquer abordagem comercial.',
  },
];

describe('Radar de Sinais — contrato fail-closed do motor Agro', () => {
  it('lista vazia NÃO implica motor real/ativo', () => {
    expect(isMotorOportunidadesReal([])).toBe(false);
    expect(isMotorOportunidadesReal(undefined)).toBe(false);
    expect(isMotorOportunidadesReal(null)).toBe(false);
  });

  it('rejeita sinais fabricados com score, decisor, contato, CNPJ ou CAR', () => {
    expect(isMotorOportunidadesReal(fabricatedFixture)).toBe(false);
    expect(hasNoFabricatedFields(fabricatedFixture[0])).toBe(false);
    expect(hasNoFabricatedFields(realSignalFixture[0])).toBe(true);
  });

  it('aceita apenas sinais que satisfazem todos os campos do contrato de sinal real', () => {
    expect(isSignalReal(realSignalFixture[0])).toBe(true);
    expect(isMotorOportunidadesReal(realSignalFixture)).toBe(true);
  });

  it('rejeita sinal nulo, não-objeto ou com campos obrigatórios ausentes', () => {
    expect(isSignalReal(null)).toBe(false);
    expect(isSignalReal('texto')).toBe(false);
    expect(isSignalReal({})).toBe(false);
    const parcial: Record<string, unknown> = { ...realSignalFixture[0] };
    delete parcial.evidence_summary;
    expect(isSignalReal(parcial)).toBe(false);
  });

  it('exige todos os campos do contrato documentado', () => {
    const expected = [
      'signal_id', 'stage', 'signal_type', 'entity_type', 'entity_id', 'municipio',
      'uf', 'priority', 'classification', 'evidence_summary', 'metrics', 'rule',
      'sources', 'limitations', 'next_step',
    ];
    expect(REQUIRED_REAL_SIGNAL_FIELDS).toEqual(expected);
  });

  it('proíbe campos fabricados no contrato', () => {
    for (const f of ['score', 'min_score', 'composicao_score', 'decisor', 'contato', 'telefone', 'email', 'cnpj', 'codigo_car']) {
      expect(FORBIDDEN_FABRICATED_SIGNAL_FIELDS).toContain(f);
    }
  });

  it('motor só é ativo com status explícito ACTIVE', () => {
    expect(isEngineStatusExplicit({ engine_status: 'VALIDATION' })).toBe(true);
    expect(isEngineStatusExplicit({ engine_status: 'ACTIVE' })).toBe(true);
    expect(isEngineStatusExplicit({})).toBe(false);
    expect(isEngineStatusExplicit(null)).toBe(false);
    expect(isEngineActive({ engine_status: 'VALIDATION' })).toBe(false);
    expect(isEngineActive({ engine_status: 'ACTIVE' })).toBe(true);
  });

  it('marca como retryable apenas erros transitórios (5xx/sem resposta)', () => {
    expect(isRetryableError({ response: { status: 503 } })).toBe(true);
    expect(isRetryableError(new Error('Network Error'))).toBe(true);
    expect(isRetryableError({ response: { status: 404 } })).toBe(false);
    expect(isRetryableError({ response: { status: 401 } })).toBe(false);
    expect(isRetryableError({ response: { status: 403 } })).toBe(false);
    expect(isRetryableError(null)).toBe(false);
  });
});
