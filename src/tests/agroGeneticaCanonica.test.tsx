import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const src = fs.readFileSync(path.resolve(__dirname, '../pages/AgroGeneticaApproved.tsx'), 'utf8');
const endpoints = fs.readFileSync(path.resolve(__dirname, '../pages/agroApiEndpoints.ts'), 'utf8');

describe('Genética & Rebanho — prontidão e UX v3', () => {
  it('expõe seis tabs com query string', () => {
    for (const t of ['resumo', 'reprodutores', 'caracteristicas', 'matrizes', 'prontidao', 'metodologia']) {
      expect(src).toContain(`'${t}'`);
    }
    expect(src).toContain("searchParams.get('tab')");
    expect(src).toContain('Visão Geral');
    expect(src).toContain('Prontidão de Acasalamento');
  });

  it('consome contratos factuais incluindo matrizes e metodologia', () => {
    expect(src).toContain('geneticaResumo');
    expect(src).toContain('geneticaReprodutores');
    expect(src).toContain('geneticaCaracteristicas');
    expect(src).toContain('geneticaAcasalamentoProntidao');
    expect(endpoints).toContain("geneticaMatrizes: '/agro/genetica/matrizes'");
    expect(endpoints).toContain("geneticaMetodologia: '/agro/genetica/metodologia'");
  });

  it('explica 13 vs 8 e zero elegíveis no banner', () => {
    expect(src).toContain('femeas_cadastradas');
    expect(src).toContain('operational_farm_females');
    expect(src).toContain('eligible_matrices_count');
    expect(src).toContain('NOT_CALCULABLE');
    expect(src).toContain('Ver diagnóstico de prontidão');
  });

  it('catálogo com filtros, paginação e detalhe', () => {
    expect(src).toContain('has_evaluation');
    expect(src).toContain('has_semen_offer');
    expect(src).toContain('page_size');
    expect(src).toContain('loadDetail');
    expect(src).toContain('25');
    expect(src).toContain('50');
    expect(src).toContain('100');
  });

  it('traduz direção das DEPs sem afirmar universalidade', () => {
    expect(src).toContain('Maior valor geralmente desejável');
    expect(src).toContain('Menor valor geralmente desejável');
    expect(src).toContain('não é universalmente melhor');
  });

  it('não possui scores inventados, ROI sintético nem ganho fixo fabricado', () => {
    const forbidden = [
      'CXP0272', 'NELORE PO', '14,8 kg', 'Top 2%', '3.250,00',
      'ganho_peso_desmama_dep', 'previsao_valor_bezerro', 'runAcasalamento',
    ];
    for (const item of forbidden) expect(src).not.toContain(item);
  });

  it('declara estados canônicos e limitações de pedigree', () => {
    expect(src).toContain('AVAILABLE');
    expect(src).toContain('NOT_CALCULABLE');
    expect(src).toContain('eligible_matrices_count');
    expect(src).toContain('pedigree imediato declarado');
    expect(src).toContain('não calcula coeficiente formal de consanguinidade');
    expect(src).toContain('Null não é convertido em zero');
  });

  it('carrega seções de forma independente', () => {
    expect(src).toContain('loadSummary');
    expect(src).toContain('loadCatalog');
    expect(src).toContain('loadTraits');
    expect(src).toContain('loadReadiness');
    expect(src).toContain('errCatalog');
    expect(src).toContain('errReadiness');
  });

  it('não promove fontes a oficiais sem evidência', () => {
    expect(src).not.toContain('oficiais homologados');
    expect(src).not.toContain('Catálogo Oficial');
  });
});
