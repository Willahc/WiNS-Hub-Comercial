/**
 * Funções utilitárias puras para processamento, validação e cálculo de escala do Mapa Agro.
 * Nota: O bounding box limita a visualização ao entorno territorial brasileiro,
 * mas não substitui validação por geometria oficial.
 */

export const BRAZIL_CENTER: [number, number] = [-14.235, -51.925];

export const BRAZIL_BOUNDS: [[number, number], [number, number]] = [
  [-34.0, -74.0], // Sudoeste [latMin, lngMin]
  [6.0, -32.0]    // Nordeste [latMax, lngMax]
];

export interface RawAgroPoint {
  lat?: unknown;
  lng?: unknown;
  quantidade?: unknown;
  municipio?: unknown;
  uf?: unknown;
  area_ha?: unknown;
  municipios?: unknown;
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

export interface AgroMapResponse {
  clusters?: RawAgroPoint[];
  total_no_recorte?: number;
  fontes?: string[];
  ultima_atualizacao?: string | null;
  data_carga?: string | null;
  data_consolidacao?: string | null;
}

/**
 * Valida se as coordenadas estão dentro da janela geográfica configurada do Brasil.
 * Limites: Latitude entre -34.0 e 6.0, Longitude entre -74.0 e -32.0.
 * Descarta lat/lng ausentes, NaN, (0,0) ou fora do bounding box.
 */
export function isWithinBrazilBounds(lat: unknown, lng: unknown): boolean {
  const numLat = typeof lat === 'string' ? parseFloat(lat) : Number(lat);
  const numLng = typeof lng === 'string' ? parseFloat(lng) : Number(lng);

  if (typeof lat !== 'number' && typeof lat !== 'string') return false;
  if (typeof lng !== 'number' && typeof lng !== 'string') return false;
  if (isNaN(numLat) || isNaN(numLng)) return false;
  if (numLat === 0 && numLng === 0) return false;
  if (numLat < BRAZIL_BOUNDS[0][0] || numLat > BRAZIL_BOUNDS[1][0]) return false;
  if (numLng < BRAZIL_BOUNDS[0][1] || numLng > BRAZIL_BOUNDS[1][1]) return false;
  return true;
}

/**
 * Normaliza um registro de ponto vindo da API /agro/mapa.
 * Retorna null se a coordenada for inválida ou fora da janela geográfica.
 */
export function normalizeAgroMapPoint(raw: RawAgroPoint, totalQuantidade: number = 0): AgroMapPoint | null {
  if (!raw || typeof raw !== 'object') return null;

  const lat = typeof raw.lat === 'string' ? parseFloat(raw.lat) : Number(raw.lat);
  const lng = typeof raw.lng === 'string' ? parseFloat(raw.lng) : Number(raw.lng);
  const quantidade = Math.max(0, Math.floor(Number(raw.quantidade) || 0));

  if (!isWithinBrazilBounds(lat, lng)) {
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
 * Calcula o percentual de cobertura territorial somente quando houver numerador e denominador
 * semanticamente compatíveis. Retorna null se totalRepresented > totalNoRecorte ou indisponível.
 */
export function calculateTerritorialCoveragePercentage(
  totalRepresented: number,
  totalNoRecorte: number
): number | null {
  if (typeof totalNoRecorte !== 'number' || isNaN(totalNoRecorte) || totalNoRecorte <= 0) {
    return null;
  }
  if (typeof totalRepresented !== 'number' || isNaN(totalRepresented) || totalRepresented < 0) {
    return null;
  }
  if (totalRepresented > totalNoRecorte) {
    return null;
  }
  const pct = (totalRepresented / totalNoRecorte) * 100;
  const clamped = Math.max(0, Math.min(100, pct));
  return Number(clamped.toFixed(1));
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
 * Calcula o fitBounds e métricas de cobertura dos pontos válidos na janela geográfica.
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

    if (isWithinBrazilBounds(lat, lng)) {
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
