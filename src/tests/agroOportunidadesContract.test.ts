import { describe, it, expect } from 'vitest';
import {
  isMotorOportunidadesReal,
  isRetryableError,
  REQUIRED_REAL_OPPORTUNITY_FIELDS,
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
    produto_recomendado: 'Fertilizante Formulão NPK NPK 04-14-08 (Big Bags 1.000 kg)',
    decisor_nome: 'Carlos Alberto de Mendonça',
    decisor_cargo: 'Diretor de Suprimentos & Insumos',
    contato: 'carlos.mendonca@boavistaagro.com.br',
    status: 'Identificada',
  },
];

const realFixture = [
  {
    id: '8a0f90cd-0001-4b00-8000-000000000001',
    entidade_agro: 'Fazenda Boa Vista — CAR MT-5107909-84A1',
    codigo_car: 'MT-5107909-84A1',
    cnpj: '18245910000184',
    evidencia: 'Lavoura de soja declarada sem contrato de fornecimento registrado.',
    regra_geracao: 'regra-v1-fertilizantes',
    composicao_score: { total: 96 },
    fonte: 'SICAR/CAR + RFB/QSA',
    data_calculo: '2026-07-31T00:00:00Z',
    versao_algoritmo: 'v1.0.0',
    decisor: { nome: 'Carlos Alberto de Mendonça', classificacao: 'sócio' },
    limitacoes: 'Base declaratória; sem validação geométrica.',
  },
];

describe('Agro 360 — Contrato fail-closed do Motor de Oportunidades', () => {
  it('rejeita o conjunto fabricado retornado pelo endpoint (dados ilustrativos não persistidos)', () => {
    expect(isMotorOportunidadesReal(fabricatedFixture)).toBe(false);
  });

  it('rejeita item nulo, não-objeto ou com campos obrigatórios ausentes', () => {
    expect(isMotorOportunidadesReal([null])).toBe(false);
    expect(isMotorOportunidadesReal(['texto'])).toBe(false);
    expect(isMotorOportunidadesReal([{}])).toBe(false);
    const parcial: Record<string, unknown> = { ...realFixture[0] };
    delete parcial.evidencia;
    expect(isMotorOportunidadesReal([parcial])).toBe(false);
  });

  it('aceita lista vazia (recorte legítimo sem oportunidades)', () => {
    expect(isMotorOportunidadesReal([])).toBe(true);
  });

  it('aceita apenas itens que satisfazem todos os campos do contrato de dado real', () => {
    expect(isMotorOportunidadesReal(realFixture)).toBe(true);
  });

  it('exige todos os campos do contrato documentado', () => {
    const expected = [
      'id', 'entidade_agro', 'codigo_car', 'cnpj', 'evidencia', 'regra_geracao',
      'composicao_score', 'fonte', 'data_calculo', 'versao_algoritmo', 'decisor', 'limitacoes',
    ];
    expect(REQUIRED_REAL_OPPORTUNITY_FIELDS).toEqual(expected);
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
