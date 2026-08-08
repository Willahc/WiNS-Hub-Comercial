import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const page = fs.readFileSync(path.resolve(__dirname, '../pages/AgroLogisticaApproved.tsx'), 'utf8');
const endpoints = fs.readFileSync(path.resolve(__dirname, '../pages/agroApiEndpoints.ts'), 'utf8');

describe('Agro-Logística canônica e qualidade territorial', () => {
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

  it('mostra cards, estado parcial, mapa com recorte limitado e semântica de concentração conhecida', () => {
    for (const label of [
      'Transportadoras conhecidas', 'Municípios cobertos', 'Com RNTRC', 'Geocodificadas',
      'Contatos institucionais', 'Registros logísticos', 'Cobertura parcial', 'MapContainer',
      'Concentração conhecida alta', 'Concentração conhecida média', 'Concentração conhecida baixa',
      'Recorte limitado', 'Buscar município', 'Todas as concentrações', 'Anterior', 'Próxima'
    ]) {
      expect(page).toContain(label);
    }
  });

  it('filtra coordenadas estritamente no Brasil e declara returned e total no mapa', () => {
    expect(page).toContain('isWithinBrazil');
    expect(page).toContain('-33.75');
    expect(page).toContain('5.27');
    expect(page).toContain('-73.99');
    expect(page).toContain('-34.79');
    expect(page).toContain('municípios agregados com coordenadas válidas');
  });

  it('oculta CAR da tabela enquanto não calculável e remove coluna repetitiva de ligação', () => {
    expect(page).not.toContain("<th>CAR</th>");
    expect(page).not.toContain("<th>Ligação</th>");
    expect(page).toContain('A contagem CAR municipal permanece oculta');
    expect(page).toContain('Ligação territorial declarada por nome normalizado + UF ou código IBGE exato');
  });

  it('audita completude do RNTRC por UF sem interpretar zero como ausência oficial', () => {
    expect(page).toContain('A completude do RNTRC varia por UF na camada disponível');
    expect(page).toContain('e não ausência oficial de transportadores habilitados');
  });

  it('declara proveniência, ligação territorial e limitações sem alegações comerciais', () => {
    for (const value of ['log.transportadora', 'log.match', 'SICAR/CAR', 'IBGE PPM',
      'CONAB', 'Capacidade estática', 'registros logísticos previamente calculados']) {
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
