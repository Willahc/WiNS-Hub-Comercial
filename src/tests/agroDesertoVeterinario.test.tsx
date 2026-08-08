import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const page = fs.readFileSync(path.resolve(__dirname, '../pages/AgroDesertoVeterinarioApproved.tsx'), 'utf8');
const app = fs.readFileSync(path.resolve(__dirname, '../App.tsx'), 'utf8');
const dash = fs.readFileSync(path.resolve(__dirname, '../pages/AgroApproved.tsx'), 'utf8');
const shell = fs.readFileSync(path.resolve(__dirname, '../components/AgroPageShell.tsx'), 'utf8');
const endpoints = fs.readFileSync(path.resolve(__dirname, '../pages/agroApiEndpoints.ts'), 'utf8');
const opp = fs.readFileSync(path.resolve(__dirname, '../pages/AgroOportunidadesApproved.tsx'), 'utf8');
const log = fs.readFileSync(path.resolve(__dirname, '../pages/AgroLogisticaApproved.tsx'), 'utf8');

describe('Deserto Veterinário explicável v2', () => {
  it('possui 4 abas, query string e cards canônicos', () => {
    for (const value of [
      "tab === 'resumo'",
      "tab === 'municipios'",
      "tab === 'mapa'",
      "tab === 'metodologia'",
      "searchParams.get('tab')",
      'Municípios avaliados',
      'Deserto Veterinário',
      'Baixa cobertura',
      'Cobertura normal',
      'Rebanho no recorte',
      'Presença técnica conhecida',
    ]) {
      expect(page).toContain(value);
    }
  });

  it('possui mapa Brasil, legenda, tooltip, filtros, paginação e metodologia', () => {
    for (const value of [
      'MapContainer',
      'maxBounds',
      'BRAZIL_BOUNDS',
      'Deserto Vet',
      'Baixa Cobertura',
      'Normal',
      'Busca municipal',
      'Classificação',
      'Tooltip',
      'Presença técnica conhecida (75 km)',
      'Legenda',
      'Anterior',
      'Próxima',
      'A classificação utiliza a carga bovina regional por técnico em um raio de 75 km',
      '25',
      '50',
      '100',
    ]) {
      expect(page).toContain(value);
    }
  });

  it('trata ratio null, zero técnico e ausência conhecida sem afirmações absolutas', () => {
    expect(page).toContain('NOT_CALCULABLE_ZERO_DENOMINATOR');
    expect(page).toContain('Não calculável (denominador zero)');
    expect(page).toContain('Ausência na base ≠ ausência real');
    expect(page).not.toContain('não existem veterinários');
    expect(page).toContain('NOT_VALIDATED');
    expect(page).toContain('PPM');
  });

  it('carrega resumo, lista, mapa e metodologia de forma independente', () => {
    expect(page).toContain('loadStats');
    expect(page).toContain('loadList');
    expect(page).toContain('loadMap');
    expect(page).toContain('loadMethod');
    expect(page).toContain('statsError');
    expect(page).toContain('listError');
    expect(page).toContain('mapError');
    expect(page).toContain('methodError');
  });

  it('expõe detalhe com classification_reason e links contextuais', () => {
    for (const value of [
      'classification_reason',
      'Canal Técnico',
      'Propriedades',
      'Radar de Oportunidades',
      'Agro-Logística',
      'nenhum implica vínculo comercial',
    ]) {
      expect(page).toContain(value);
    }
  });

  it('possui loading, empty, error e retry pelo shell', () => {
    expect(page).toContain('loading={shellLoading}');
    expect(page).toContain('error={shellError}');
    expect(page).toContain('onRetry=');
  });

  it('liga rotas, endpoints canônicos e navegação interna', () => {
    expect(app).toContain('/agro/deserto-veterinario');
    expect(dash).toContain('Deserto Veterinário');
    expect(shell).toContain("{ label: 'Deserto Veterinário'");
    expect(endpoints).toContain("desertoVeterinarioResumo: '/agro/deserto-veterinario/resumo'");
    expect(endpoints).toContain("desertoVeterinarioMunicipios: '/agro/deserto-veterinario/municipios'");
    expect(endpoints).toContain("desertoVeterinarioMapa: '/agro/deserto-veterinario/mapa'");
    expect(endpoints).toContain("desertoVeterinarioMetodologia: '/agro/deserto-veterinario/metodologia'");
    expect(endpoints).toContain('desertoVeterinarioDetalhe');
  });

  it('preserva integração com Radar e null logístico', () => {
    expect(opp).toContain('/agro/deserto-veterinario');
    expect(log).toContain("typeof value === 'number'");
    expect(log).toContain("'Não calculável'");
  });
});
