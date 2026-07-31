import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { httpClient } from '../services/http/client';
import { AGRO_API } from '../pages/agroApiEndpoints';

type PathEntry = [string, string];

const ENDPOINT_ENTRIES: PathEntry[] = Object.entries(AGRO_API).map(([name, path]) =>
  typeof path === 'function' ? [name, path('8995552')] : [name, path as string]
);

describe('Agro API — contrato único de URL (sem duplicação /api/v1)', () => {
  it.each(ENDPOINT_ENTRIES)(
    '%s resolve para /api/v1/agro/... (sem /api/v1/api/v1)',
    (_name, path) => {
      const final = httpClient.getUri({ url: path });
      expect(final).toBe(`/api/v1${path}`);
      expect(final.startsWith('/api/v1/agro/')).toBe(true);
      expect(final).not.toContain('/api/v1/api/v1');
    }
  );

  it('a instância HTTP real usa baseURL /api/v1', async () => {
    let captured: { baseURL?: string; url?: string } = {};
    await httpClient.get(AGRO_API.kpis, {
      adapter: async (config) => {
        captured = { baseURL: config.baseURL, url: config.url };
        return { data: {}, status: 200, statusText: 'OK', headers: {}, config } as never;
      },
    });
    expect(captured.baseURL).toBe('/api/v1');
    expect(captured.url).toBe('/agro/kpis');
    expect(httpClient.getUri({ url: captured.url })).toBe('/api/v1/agro/kpis');
  });

  it('nenhum componente de produção Agro referencia literal /api/v1/agro', () => {
    const pagesDir = join(process.cwd(), 'src/pages');
    const offenders: string[] = [];
    for (const file of readdirSync(pagesDir)) {
      if (!file.endsWith('.tsx') && !file.endsWith('.ts')) continue;
      const content = readFileSync(join(pagesDir, file), 'utf8');
      if (content.includes('/api/v1/agro')) offenders.push(file);
    }
    expect(offenders).toEqual([]);
  });
});
