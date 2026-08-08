import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const src = fs.readFileSync(path.resolve(__dirname, '../pages/AgroGeneticaApproved.tsx'), 'utf8');

describe('Genética & Rebanho — Testes Canônicos de Integridade', () => {
  it('consome os quatro contratos factuais do núcleo genético', () => {
    expect(src).toContain('/agro/genetica/resumo');
    expect(src).toContain('/agro/genetica/reprodutores');
    expect(src).toContain('/agro/genetica/caracteristicas');
    expect(src).toContain('/agro/genetica/acasalamento/prontidao');
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
    expect(src).toContain('NOT_CALCULABLE');
    expect(src).toContain('eligible_matrices_count');
  });

  it('não oferece simulação quando não há matriz elegível', () => {
    expect(src).toContain("readiness?.status === 'AVAILABLE'");
    expect(src).toContain('Nenhuma das');
    expect(src).not.toContain('runAcasalamento');
  });

  it('não promove fontes a oficiais sem evidência do contrato', () => {
    expect(src).not.toContain('oficiais homologados');
    expect(src).not.toContain('Catálogo Oficial');
  });

  it('explicita limitações de pedigree e resultados não calculáveis', () => {
    expect(src).toContain('pedigree imediato declarado');
    expect(src).toContain('não calcula coeficiente formal de consanguinidade');
    expect(src).toContain('Null não é convertido em zero');
  });
});
