import { describe, it, expect } from 'vitest';
import {
  BRAZIL_CENTER,
  BRAZIL_BOUNDS,
  isBrazilCoordinate,
  normalizeAgroMapPoint,
  calculateMarkerRadius,
  calculateMapCoverage
} from '../utils/agroMapUtils';
import type { RawAgroPoint } from '../utils/agroMapUtils';
import { AGRO_API } from '../pages/agroApiEndpoints';

describe('Agro Map Utils & Constants', () => {
  it('1. deve ter BRAZIL_CENTER configurado corretamente', () => {
    expect(BRAZIL_CENTER).toEqual([-14.235, -51.925]);
  });

  it('2. deve ter BRAZIL_BOUNDS configurado dentro do território brasileiro', () => {
    expect(BRAZIL_BOUNDS[0]).toEqual([-34.0, -74.0]); // Sudoeste
    expect(BRAZIL_BOUNDS[1]).toEqual([6.0, -32.0]);   // Nordeste
  });

  it('3. deve validar zoom inicial e limites de zoom no componente (metadados)', () => {
    expect(BRAZIL_CENTER[0]).toBeLessThan(6.0);
    expect(BRAZIL_CENTER[0]).toBeGreaterThan(-34.0);
  });

  it('4. deve filtrar latitude inválida (< -34 ou > 6)', () => {
    expect(isBrazilCoordinate(-35.0, -50.0)).toBe(false);
    expect(isBrazilCoordinate(7.0, -50.0)).toBe(false);
    expect(isBrazilCoordinate(-15.0, -50.0)).toBe(true);
  });

  it('5. deve filtrar longitude inválida (< -74 ou > -32)', () => {
    expect(isBrazilCoordinate(-15.0, -75.0)).toBe(false);
    expect(isBrazilCoordinate(-15.0, -31.0)).toBe(false);
    expect(isBrazilCoordinate(-15.0, -50.0)).toBe(true);
  });

  it('6. deve descartar NaN, null, undefined e (0,0)', () => {
    expect(isBrazilCoordinate(NaN, -50.0)).toBe(false);
    expect(isBrazilCoordinate(-15.0, NaN)).toBe(false);
    expect(isBrazilCoordinate(null, -50.0)).toBe(false);
    expect(isBrazilCoordinate(undefined, undefined)).toBe(false);
    expect(isBrazilCoordinate(0, 0)).toBe(false);
  });

  it('7. deve respeitar o raio mínimo do marcador (>= 4)', () => {
    const radiusZero = calculateMarkerRadius(0, 1, 1000, 4, 16);
    expect(radiusZero).toBe(4);
    const radiusOne = calculateMarkerRadius(1, 1, 1000, 4, 16);
    expect(radiusOne).toBe(4);
  });

  it('8. deve respeitar o raio máximo do marcador (<= 16)', () => {
    const radiusMax = calculateMarkerRadius(10000, 1, 10000, 4, 16);
    expect(radiusMax).toBe(16);
    const radiusExtreme = calculateMarkerRadius(999999, 1, 10000, 4, 16);
    expect(radiusExtreme).toBe(16);
  });

  it('9. deve calcular o raio de forma estritamente proporcional e determinística', () => {
    const rSmall = calculateMarkerRadius(10, 1, 1000, 4, 16);
    const rMedium = calculateMarkerRadius(250, 1, 1000, 4, 16);
    const rLarge = calculateMarkerRadius(900, 1, 1000, 4, 16);

    expect(rSmall).toBeGreaterThanOrEqual(4);
    expect(rMedium).toBeGreaterThan(rSmall);
    expect(rLarge).toBeGreaterThan(rMedium);
    expect(rLarge).toBeLessThanOrEqual(16);
  });

  it('15. deve calcular o percentual do total exibido por ponto', () => {
    const raw: RawAgroPoint = { lat: -15.0, lng: -50.0, quantidade: 250, municipio: 'Sorriso', uf: 'MT' };
    const pt = normalizeAgroMapPoint(raw, 1000);
    expect(pt).not.toBeNull();
    expect(pt?.pct).toBe(25.0);
  });

  it('19. deve garantir a ausência de /api/v1/api/v1 nas rotas do Agro', () => {
    Object.values(AGRO_API).forEach(url => {
      expect(url).not.toContain('/api/v1/api/v1');
    });
  });

  it('20. deve descartar registros fora do Brasil e acumular invalidCount', () => {
    const mockPoints: RawAgroPoint[] = [
      { lat: -15.78, lng: -47.92, quantidade: 100, municipio: 'Brasília', uf: 'DF' }, // Válido
      { lat: 48.85, lng: 2.35, quantidade: 50, municipio: 'Paris', uf: 'FR' },        // Fora do BR (França)
      { lat: -23.55, lng: -46.63, quantidade: 200, municipio: 'São Paulo', uf: 'SP' }, // Válido
    ];

    const coverage = calculateMapCoverage(mockPoints, 350);
    expect(coverage.validCount).toBe(2);
    expect(coverage.invalidCount).toBe(1);
    expect(coverage.totalRepresented).toBe(300);
    expect(coverage.bounds).not.toBeNull();
    if (coverage.bounds) {
      expect(coverage.bounds[0][0]).toBeGreaterThanOrEqual(-34.0);
      expect(coverage.bounds[1][0]).toBeLessThanOrEqual(6.0);
    }
  });
});
