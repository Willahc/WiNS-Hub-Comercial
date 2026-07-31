/**
 * Funções utilitárias puras para processamento, validação e cálculo de escala do Mapa Agro.
 */

export const BRAZIL_CENTER: [number, number] = [-14.235, -51.925];

export const BRAZIL_BOUNDS: [[number, number], [number, number]] = [
  [-34.0, -74.0], // Sudoeste [latMin, lngMin]
  [6.0, -32.0]    // Nordeste [latMax, lngMax]
];

export interface RawAgroPoint {
  lat?: any;
  lng?: any;
  quantidade?: any;
  municipio?: any;
  uf?: any;
  area_ha?: any;
  municipios?: any;
}

export interface AgroMapPoint {
  lat: number;
  lng: number;
  quantidade: number;
  municipio: string;
  uf: string;
  area_ha: number | null;
  municipios: number;
  pct: number;
}

/**
 * Validar se as coordenadas pertencem estritamente ao território brasileiro.
 * Limites: Latitude entre -34.0 e 6.0, Longitude entre -74.0 e -32.0.
 * Descarta lat/lng ausentes, NaN, (0,0) ou fora do bounding box.
 */
export function isBrazilCoordinate(lat: any, lng: any): boolean {
  if (typeof lat !== 'number' || typeof lng !== 'number') return false;
  if (isNaN(lat) || isNaN(lng)) return false;
  if (lat === 0 && lng === 0) return false;
  if (lat < BRAZIL_BOUNDS[0][0] || lat > BRAZIL_BOUNDS[1][0]) return false;
  if (lng < BRAZIL_BOUNDS[0][1] || lng > BRAZIL_BOUNDS[1][1]) return false;
  return true;
}

/**
 * Normaliza um registro de ponto vindo da API /agro/mapa.
 * Retorna null se a coordenada for inválida ou fora do Brasil.
 */
export function normalizeAgroMapPoint(raw: RawAgroPoint, totalQuantidade: number = 0): AgroMapPoint | null {
  if (!raw) return null;

  const lat = typeof raw.lat === 'string' ? parseFloat(raw.lat) : Number(raw.lat);
  const lng = typeof raw.lng === 'string' ? parseFloat(raw.lng) : Number(raw.lng);
  const quantidade = Math.max(0, Math.floor(Number(raw.quantidade) || 0));

  if (!isBrazilCoordinate(lat, lng)) {
    return null;
  }

  const municipio = typeof raw.municipio === 'string' && raw.municipio.trim()
    ? raw.municipio.trim()
    : 'Município não identificado';

  const uf = typeof raw.uf === 'string' && raw.uf.trim()
    ? raw.uf.trim().toUpperCase()
    : 'UF não informada';

  const area_ha = raw.area_ha != null && !isNaN(Number(raw.area_ha)) && Number(raw.area_ha) > 0
    ? Number(raw.area_ha)
    : null;

  const municipiosCount = Math.max(1, Math.floor(Number(raw.municipios) || 1));
  const pct = totalQuantidade > 0 ? Number(((quantidade / totalQuantidade) * 100).toFixed(1)) : 0;

  return {
    lat,
    lng,
    quantidade,
    municipio,
    uf,
    area_ha,
    municipios: municipiosCount,
    pct,
  };
}

/**
 * Calcula o raio do CircleMarker no mapa.
 * Raio mínimo: 4px, Raio máximo: 16px.
 * Utiliza escala de raiz quadrada para preservar proporcionalidade visual.
 */
export function calculateMarkerRadius(
  quantidade: number,
  minCount: number = 1,
  maxCount: number = 10000,
  minRadius: number = 4,
  maxRadius: number = 16
): number {
  const validQty = Math.max(0, isNaN(quantidade) ? 0 : quantidade);
  if (validQty === 0) return minRadius;
  if (maxCount <= minCount) return minRadius;

  const sqrtQty = Math.sqrt(validQty);
  const sqrtMin = Math.sqrt(Math.max(1, minCount));
  const sqrtMax = Math.sqrt(Math.max(2, maxCount));

  const ratio = (sqrtQty - sqrtMin) / (sqrtMax - sqrtMin);
  const clampedRatio = Math.max(0, Math.min(1, ratio));

  const radius = minRadius + clampedRatio * (maxRadius - minRadius);
  return Number(radius.toFixed(1));
}

/**
 * Calcula o fitBounds e métricas de cobertura dos pontos válidos no Brasil.
 */
export function calculateMapCoverage(rawPoints: RawAgroPoint[], totalCountFromApi: number = 0): {
  validPoints: AgroMapPoint[];
  bounds: [[number, number], [number, number]] | null;
  validCount: number;
  invalidCount: number;
  totalRepresented: number;
} {
  if (!rawPoints || !Array.isArray(rawPoints)) {
    return { validPoints: [], bounds: null, validCount: 0, invalidCount: 0, totalRepresented: 0 };
  }

  let invalidCount = 0;
  const tempValid: { raw: RawAgroPoint; lat: number; lng: number; quantidade: number }[] = [];
  let sumQty = 0;

  for (const raw of rawPoints) {
    const lat = typeof raw?.lat === 'string' ? parseFloat(raw.lat) : Number(raw?.lat);
    const lng = typeof raw?.lng === 'string' ? parseFloat(raw.lng) : Number(raw?.lng);
    const qty = Math.max(0, Math.floor(Number(raw?.quantidade) || 0));

    if (isBrazilCoordinate(lat, lng)) {
      tempValid.push({ raw, lat, lng, quantidade: qty });
      sumQty += qty;
    } else {
      invalidCount++;
    }
  }

  const effectiveTotal = totalCountFromApi > 0 ? totalCountFromApi : sumQty;

  const validPoints: AgroMapPoint[] = tempValid
    .map(v => normalizeAgroMapPoint(v.raw, effectiveTotal))
    .filter((pt): pt is AgroMapPoint => pt !== null);

  if (validPoints.length === 0) {
    return { validPoints: [], bounds: null, validCount: 0, invalidCount, totalRepresented: 0 };
  }

  let minLat = 90, maxLat = -90, minLng = 180, maxLng = -180;
  for (const pt of validPoints) {
    if (pt.lat < minLat) minLat = pt.lat;
    if (pt.lat > maxLat) maxLat = pt.lat;
    if (pt.lng < minLng) minLng = pt.lng;
    if (pt.lng > maxLng) maxLng = pt.lng;
  }

  // Clampar estritamente aos limites do Brasil
  minLat = Math.max(BRAZIL_BOUNDS[0][0], minLat);
  maxLat = Math.min(BRAZIL_BOUNDS[1][0], maxLat);
  minLng = Math.max(BRAZIL_BOUNDS[0][1], minLng);
  maxLng = Math.min(BRAZIL_BOUNDS[1][1], maxLng);

  return {
    validPoints,
    bounds: [[minLat, minLng], [maxLat, maxLng]],
    validCount: validPoints.length,
    invalidCount,
    totalRepresented: sumQty,
  };
}
