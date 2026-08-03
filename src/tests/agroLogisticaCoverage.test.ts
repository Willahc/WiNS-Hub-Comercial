import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const page = fs.readFileSync(path.resolve(__dirname, '../pages/AgroLogisticaApproved.tsx'), 'utf8');
const endpoints = fs.readFileSync(path.resolve(__dirname, '../pages/agroApiEndpoints.ts'), 'utf8');

describe('Agro-Logística canônica', () => {
  it('consulta contratos independentes sem números fixos', () => {
    for (const endpoint of ['logisticaResumo', 'logisticaMunicipios', 'logisticaMapa']) {
      expect(page).toContain(`AGRO_API.${endpoint}`);
      expect(endpoints).toContain(endpoint);
    }
    for (const auditCount of ['151729', '25753', '6024', '4257', '49120', '46410', '1124684']) {
      expect(page).not.toContain(auditCount);
    }
    expect(page).toContain('Promise.allSettled');
    expect(page).toContain('summaryError');
    expect(page).toContain('tableError');
    expect(page).toContain('mapError');
  });

  it('mostra cards, estado parcial, mapa, tabela, filtros e paginação', () => {
    for (const label of ['Transportadoras conhecidas', 'Municípios cobertos', 'Com RNTRC', 'Geocodificadas',
      'Contatos institucionais', 'Registros logísticos', 'Cobertura parcial', 'MapContainer',
      'Buscar município', 'Todas as coberturas', 'Anterior', 'Próxima']) expect(page).toContain(label);
  });

  it('declara proveniência, ligação territorial e limitações sem alegações comerciais', () => {
    for (const value of ['log.transportadora', 'log.match', 'SICAR/CAR', 'IBGE PPM',
      'MUNICIPAL_NAME_NORMALIZED', 'CONAB', 'Capacidade estática', 'registros logísticos previamente calculados']) {
      expect(page).toContain(value);
    }
    expect(page.toLowerCase()).not.toContain('carga disponível');
    expect(page).not.toContain('contratos confirmados');
  });

  it('preserva layout responsivo sem dimensões fixas horizontais', () => {
    expect(page).toContain('repeat(auto-fit,minmax(');
    expect(page).toContain("overflowX: 'auto'");
    expect(page).toContain('width: \'100%\'');
  });
});
