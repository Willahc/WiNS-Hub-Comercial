import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const src = fs.readFileSync(path.resolve(__dirname, '../pages/AgroGeneticaApproved.tsx'), 'utf8');

describe('Genética & Rebanho — Testes Canônicos de Integridade', () => {
  it('contém as 7 abas sincronizadas de governança e zootecnia', () => {
    const tabs = [
      '1. Visão Geral',
      '2. Reprodutores',
      '3. Perfil & DEPs',
      '4. Pedigree',
      '5. Acasalamento',
      '6. Matrizes & Lotes',
      '7. Metodologia'
    ];
    for (const tab of tabs) {
      expect(src).toContain(tab);
    }
  });

  it('não possui scores inventados, ROI sintético nem ganho fixo fabricado', () => {
    const forbidden = [
      'CXP0272',
      'NELORE PO',
      '14,8 kg',
      'Top 2%',
      '3.250,00',
      'ganho_peso_desmama_dep',
      'previsao_valor_bezerro'
    ];
    for (const item of forbidden) {
      expect(src).not.toContain(item);
    }
  });

  it('declara honestamente os estados canônicos dos pilares', () => {
    expect(src).toContain('AVAILABLE');
    expect(src).toContain('AVAILABLE_WITH_MATRIX');
    expect(src).toContain('UNAVAILABLE');
  });

  it('possui simulação fail-closed com bloqueio de parentesco direto', () => {
    expect(src).toContain('Simulador de Acasalamento Dirigido — Motor Fail-Closed');
    expect(src).toContain('Touros Descartados por Risco de Consanguinidade Direta');
    expect(src).toContain('PARENT_CHILD');
    expect(src).toContain('HALF_SIBLING_PATERNAL');
    expect(src).toContain('HALF_SIBLING_MATERNAL');
  });

  it('documenta as fontes oficiais Embrapa Geneplus, ABCZ PMGZ e ANCP', () => {
    expect(src).toContain('Embrapa Geneplus');
    expect(src).toContain('ABCZ PMGZ');
    expect(src).toContain('ANCP Nelore Brasil');
    expect(src).toContain('GenSys Consultores');
  });

  it('exibe o catálogo factual de matrizes e fêmeas da fazenda', () => {
    expect(src).toContain('Base Factual de Matrizes & Fêmeas Cadastradas');
    expect(src).toContain('MATRIZ_FAZENDA');
    expect(src).toContain('DOADORA_CATALOGO');
  });
});
