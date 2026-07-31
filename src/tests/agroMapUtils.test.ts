import { describe, it, expect } from 'vitest';
import {
  BRAZIL_CENTER,
  BRAZIL_BOUNDS,
  isWithinBrazilBounds,
  normalizeAgroMapPoint,
  calculateMarkerRadius,
  calculateMapCoverage,
  calculateTerritorialCoveragePercentage
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

  it('3. deve validar a nova nomenclatura isWithinBrazilBounds', () => {
    expect(isWithinBrazilBounds(-15.0, -50.0)).toBe(true);
    expect(isWithinBrazilBounds('-15.0', '-50.0')).toBe(true);
    expect(isWithinBrazilBounds(-35.0, -50.0)).toBe(false);
    expect(isWithinBrazilBounds(7.0, -50.0)).toBe(false);
    expect(isWithinBrazilBounds(-15.0, -75.0)).toBe(false);
    expect(isWithinBrazilBounds(-15.0, -31.0)).toBe(false);
  });

  it('4. deve tratar tipos unknown e descartar NaN, null, undefined e (0,0)', () => {
    expect(isWithinBrazilBounds(NaN, -50.0)).toBe(false);
    expect(isWithinBrazilBounds(-15.0, NaN)).toBe(false);
    expect(isWithinBrazilBounds(null, -50.0)).toBe(false);
    expect(isWithinBrazilBounds(undefined, undefined)).toBe(false);
    expect(isWithinBrazilBounds(0, 0)).toBe(false);
    expect(isWithinBrazilBounds('invalid', 'data')).toBe(false);
  });

  it('5. deve calcular percentual de cobertura territorial somente quando válido', () => {
    // Válido
    expect(calculateTerritorialCoveragePercentage(980, 1000)).toBe(98.0);
    expect(calculateTerritorialCoveragePercentage(500, 1000)).toBe(50.0);

    // Denominador zero ou negativo -> null
    expect(calculateTerritorialCoveragePercentage(500, 0)).toBeNull();
    expect(calculateTerritorialCoveragePercentage(500, -100)).toBeNull();

    // Numerador negativo -> null
    expect(calculateTerritorialCoveragePercentage(-10, 1000)).toBeNull();

    // População incompatível (numerador >> denominador) -> null
    expect(calculateTerritorialCoveragePercentage(5000, 1000)).toBeNull();
  });

  it('6. deve respeitar raio mínimo (>= 4) e raio máximo (<= 16)', () => {
    expect(calculateMarkerRadius(0, 1, 1000, 4, 16)).toBe(4);
    expect(calculateMarkerRadius(10000, 1, 10000, 4, 16)).toBe(16);
  });

  it('7. deve normalizar tipos RawAgroPoint com campos unknown', () => {
    const raw: RawAgroPoint = {
      lat: '-15.78',
      lng: '-47.92',
      quantidade: '250',
      municipio: ' Brasília ',
      uf: 'df',
      area_ha: '5000.5'
    };

    const pt = normalizeAgroMapPoint(raw, 1000);
    expect(pt).not.toBeNull();
    expect(pt?.lat).toBe(-15.78);
    expect(pt?.lng).toBe(-47.92);
    expect(pt?.quantidade).toBe(250);
    expect(pt?.municipio).toBe('Brasília');
    expect(pt?.uf).toBe('DF');
    expect(pt?.area_ha).toBe(5000.5);
    expect(pt?.pct).toBe(25.0);
  });

  it('8. deve garantir a ausência de /api/v1/api/v1 nas rotas do Agro', () => {
    Object.values(AGRO_API).forEach(url => {
      expect(url).not.toContain('/api/v1/api/v1');
    });
  });

  it('9. deve acumular descartados fora da janela geográfica configurada', () => {
    const mockPoints: RawAgroPoint[] = [
      { lat: -15.78, lng: -47.92, quantidade: 100 }, // Válido
      { lat: 48.85, lng: 2.35, quantidade: 50 },      // Fora da janela BR (França)
    ];

    const coverage = calculateMapCoverage(mockPoints, 150);
    expect(coverage.validCount).toBe(1);
    expect(coverage.invalidCount).toBe(1);
  });
});
