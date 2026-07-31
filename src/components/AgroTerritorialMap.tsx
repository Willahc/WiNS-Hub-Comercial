import React, { useState, useEffect, useRef, useMemo } from 'react';
import { MapContainer, TileLayer, CircleMarker, Tooltip, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  Compass, Maximize2, RotateCcw, AlertTriangle, Layers, Info, ChevronDown, ChevronUp, RefreshCw
} from 'lucide-react';
import {
  BRAZIL_CENTER,
  BRAZIL_BOUNDS,
  calculateMarkerRadius,
  calculateMapCoverage
} from '../utils/agroMapUtils';
import type { RawAgroPoint, AgroMapPoint } from '../utils/agroMapUtils';

const AGRO_COLOR = '#22C55E';

function fmt(n: number): string {
  if (n >= 1000000000) return (n / 1000000000).toFixed(1).replace('.', ',') + ' Bi';
  if (n >= 1000000) return (n / 1000000).toFixed(1).replace('.', ',') + ' M';
  if (n >= 1000) return (n / 1000).toFixed(n % 1000 === 0 ? 0 : 1).replace('.', ',') + ' mil';
  return new Intl.NumberFormat('pt-BR').format(n);
}

function fmtArea(ha: number): string {
  if (ha >= 1000000) return (ha / 1000000).toFixed(1).replace('.', ',') + ' M ha';
  if (ha >= 1000) return (ha / 1000).toFixed(1).replace('.', ',') + ' mil ha';
  return ha.toFixed(0).replace('.', ',') + ' ha';
}

function MapController({
  mapRef,
  bounds,
  shouldAutoFit
}: {
  mapRef: React.MutableRefObject<L.Map | null>;
  bounds: [[number, number], [number, number]] | null;
  shouldAutoFit: boolean;
}) {
  const map = useMap();

  useEffect(() => {
    mapRef.current = map;
  }, [map, mapRef]);

  useEffect(() => {
    if (shouldAutoFit && bounds) {
      map.fitBounds(bounds, { padding: [30, 30], maxZoom: 8 });
    }
  }, [map, bounds, shouldAutoFit]);

  return null;
}

export interface AgroTerritorialMapProps {
  rawClusters: RawAgroPoint[];
  totalNoRecorte?: number;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
}

export const AgroTerritorialMap: React.FC<AgroTerritorialMapProps> = ({
  rawClusters = [],
  totalNoRecorte = 0,
  loading = false,
  error = null,
  onRetry
}) => {
  const mapRef = useRef<L.Map | null>(null);
  const [selectedPoint, setSelectedPoint] = useState<AgroMapPoint | null>(null);
  const [legendOpen, setLegendOpen] = useState(true);
  const [autoFitTrigger, setAutoFitTrigger] = useState(true);

  // Processar e validar pontos puramente
  const coverage = useMemo(() => {
    return calculateMapCoverage(rawClusters, totalNoRecorte);
  }, [rawClusters, totalNoRecorte]);

  const { validPoints, bounds, validCount, invalidCount, totalRepresented } = coverage;

  // Min/Max quantidade para a escala
  const { minQty, maxQty } = useMemo(() => {
    if (validPoints.length === 0) return { minQty: 1, maxQty: 100 };
    const qtys = validPoints.map(p => p.quantidade);
    return {
      minQty: Math.min(...qtys),
      maxQty: Math.max(...qtys)
    };
  }, [validPoints]);

  const handleCenterBrazil = () => {
    if (mapRef.current) {
      mapRef.current.setView(BRAZIL_CENTER, 4);
    }
  };

  const handleFitData = () => {
    if (mapRef.current && bounds) {
      mapRef.current.fitBounds(bounds, { padding: [30, 30], maxZoom: 8 });
    } else if (mapRef.current) {
      mapRef.current.setView(BRAZIL_CENTER, 4);
    }
  };

  const handleResetView = () => {
    setSelectedPoint(null);
    if (mapRef.current) {
      mapRef.current.setView(BRAZIL_CENTER, 4);
    }
  };

  return (
    <div
      style={{
        background: 'var(--bg-surface, #0F172A)',
        border: '1px solid var(--border-default, #1E293B)',
        borderRadius: 10,
        padding: 16,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
      }}
      role="region"
      aria-label="Mapa de Agregação Territorial Agro"
    >
      {/* Cabeçalho do Card */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Layers size={18} color={AGRO_COLOR} />
          <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary, #F8FAFC)', margin: 0 }}>
            Concentração de Cadastros CAR — Agregações Territoriais
          </h3>
        </div>
        {!loading && !error && (
          <span style={{ fontSize: 11, color: 'var(--text-tertiary, #94A3B8)', background: 'rgba(255,255,255,0.05)', padding: '2px 8px', borderRadius: 4 }}>
            {validCount} agregações ({fmt(totalRepresented)} cadastros)
          </span>
        )}
      </div>

      {/* Contêiner do Mapa com Estados */}
      <div style={{ height: 420, borderRadius: 8, overflow: 'hidden', position: 'relative', border: '1px solid var(--border-subtle, #334155)' }}>
        {loading ? (
          <div
            style={{
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center',
              background: '#090D16',
              color: '#94A3B8',
              gap: 12
            }}
            aria-live="polite"
          >
            <RefreshCw size={24} className="animate-spin" color={AGRO_COLOR} />
            <span style={{ fontSize: 13, fontWeight: 500 }}>Carregando agregações territoriais…</span>
          </div>
        ) : error ? (
          <div
            style={{
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center',
              background: '#090D16',
              color: '#EF4444',
              padding: 24,
              textAlign: 'center',
              gap: 12
            }}
            aria-live="assertive"
          >
            <AlertTriangle size={32} />
            <span style={{ fontSize: 13, fontWeight: 600 }}>Não foi possível carregar o mapa territorial.</span>
            <p style={{ fontSize: 11, color: '#94A3B8', margin: 0, maxWidth: 360 }}>{error}</p>
            {onRetry && (
              <button
                onClick={onRetry}
                style={{
                  marginTop: 8,
                  padding: '6px 14px',
                  background: 'rgba(239, 68, 68, 0.15)',
                  border: '1px solid #EF4444',
                  borderRadius: 6,
                  color: '#EF4444',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Tentar novamente
              </button>
            )}
          </div>
        ) : validPoints.length === 0 ? (
          <div
            style={{
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center',
              background: '#090D16',
              color: '#94A3B8',
              padding: 24,
              textAlign: 'center',
              gap: 8
            }}
            aria-live="polite"
          >
            <Info size={28} color="#64748B" />
            <span style={{ fontSize: 13, fontWeight: 600, color: '#E2E8F0' }}>
              Nenhuma agregação territorial disponível para os filtros informados.
            </span>
            <span style={{ fontSize: 11, color: '#64748B' }}>
              Tente selecionar outro estado ou limpar a busca.
            </span>
            <button
              onClick={handleResetView}
              style={{
                marginTop: 8,
                padding: '6px 12px',
                background: 'rgba(34, 197, 94, 0.1)',
                border: '1px solid #22C55E',
                borderRadius: 6,
                color: '#22C55E',
                fontSize: 11,
                cursor: 'pointer'
              }}
            >
              Resetar visão
            </button>
          </div>
        ) : (
          <>
            {/* Controles do Mapa no Canto Superior Direito */}
            <div
              style={{
                position: 'absolute',
                top: 10,
                right: 10,
                zIndex: 1000,
                display: 'flex',
                gap: 6,
                background: 'rgba(15, 23, 42, 0.9)',
                padding: 4,
                borderRadius: 6,
                border: '1px solid #334155',
                backdropFilter: 'blur(4px)'
              }}
              role="toolbar"
              aria-label="Controles do mapa"
            >
              <button
                onClick={handleCenterBrazil}
                title="Centralizar no Brasil"
                aria-label="Centralizar no Brasil"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '4px 8px',
                  background: 'transparent',
                  border: 'none',
                  color: '#F8FAFC',
                  fontSize: 11,
                  fontWeight: 500,
                  cursor: 'pointer',
                  borderRadius: 4
                }}
              >
                <Compass size={13} color={AGRO_COLOR} />
                <span className="hidden-mobile">Centralizar</span>
              </button>

              <button
                onClick={handleFitData}
                title="Ajustar aos dados"
                aria-label="Ajustar aos dados"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '4px 8px',
                  background: 'transparent',
                  border: 'none',
                  color: '#F8FAFC',
                  fontSize: 11,
                  fontWeight: 500,
                  cursor: 'pointer',
                  borderRadius: 4
                }}
              >
                <Maximize2 size={13} color="#38BDF8" />
                <span className="hidden-mobile">Ajustar Dados</span>
              </button>

              <button
                onClick={handleResetView}
                title="Resetar visão"
                aria-label="Resetar visão"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '4px 8px',
                  background: 'transparent',
                  border: 'none',
                  color: '#F8FAFC',
                  fontSize: 11,
                  fontWeight: 500,
                  cursor: 'pointer',
                  borderRadius: 4
                }}
              >
                <RotateCcw size={13} color="#F59E0B" />
                <span className="hidden-mobile">Resetar</span>
              </button>
            </div>

            {/* Componente Leaflet */}
            <MapContainer
              center={BRAZIL_CENTER}
              zoom={4}
              minZoom={4}
              maxZoom={12}
              maxBounds={BRAZIL_BOUNDS}
              maxBoundsViscosity={1.0}
              worldCopyJump={false}
              style={{ height: '100%', width: '100%', background: '#090D16' }}
            >
              <MapController mapRef={mapRef} bounds={bounds} shouldAutoFit={autoFitTrigger} />
              <TileLayer
                url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                attribution='&copy; <a href="https://carto.com/">CARTO</a>'
              />

              {validPoints.map((pt, idx) => {
                const radius = calculateMarkerRadius(pt.quantidade, minQty, maxQty, 4, 16);
                return (
                  <CircleMarker
                    key={`point-${idx}-${pt.lat}-${pt.lng}`}
                    center={[pt.lat, pt.lng]}
                    radius={radius}
                    pathOptions={{
                      fillColor: AGRO_COLOR,
                      color: '#FFFFFF',
                      weight: 1,
                      fillOpacity: 0.75
                    }}
                    eventHandlers={{
                      click: () => setSelectedPoint(pt)
                    }}
                  >
                    <Tooltip direction="top" offset={[0, -radius]} opacity={0.95}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#0F172A', marginBottom: 2 }}>
                        {pt.municipio} / {pt.uf}
                      </div>
                      <div style={{ fontSize: 10, color: '#334155', display: 'flex', flexDirection: 'column', gap: 1 }}>
                        <div><strong>Cadastros CAR:</strong> {fmt(pt.quantidade)} ({pt.pct}% do total)</div>
                        {pt.area_ha != null ? (
                          <div><strong>Área declarada:</strong> {fmtArea(pt.area_ha)}</div>
                        ) : (
                          <div style={{ color: '#64748B' }}>Área não disponível</div>
                        )}
                        <div style={{ fontSize: 9, color: '#64748B', marginTop: 2 }}>
                          Classificação: Agregação territorial
                        </div>
                      </div>
                    </Tooltip>
                  </CircleMarker>
                );
              })}
            </MapContainer>

            {/* Painel do Ponto Selecionado */}
            {selectedPoint && (
              <div
                style={{
                  position: 'absolute',
                  bottom: 12,
                  right: 12,
                  width: 260,
                  background: '#0F172A',
                  border: '1px solid #22C55E',
                  borderRadius: 8,
                  padding: 12,
                  zIndex: 1000,
                  boxShadow: '0 4px 14px rgba(0,0,0,0.4)'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#22C55E', background: 'rgba(34,197,94,0.15)', padding: '2px 6px', borderRadius: 4 }}>
                    {selectedPoint.municipio}/{selectedPoint.uf}
                  </span>
                  <button
                    onClick={() => setSelectedPoint(null)}
                    style={{ background: 'none', border: 'none', color: '#94A3B8', cursor: 'pointer', fontSize: 12 }}
                    aria-label="Fechar detalhes"
                  >
                    ✕
                  </button>
                </div>
                <div style={{ fontSize: 11, color: '#F8FAFC', margin: '8px 0 4px 0', fontWeight: 600 }}>
                  {fmt(selectedPoint.quantidade)} cadastros CAR ({selectedPoint.pct}% do exibido)
                </div>
                {selectedPoint.area_ha != null && (
                  <div style={{ fontSize: 10, color: '#94A3B8' }}>
                    Área agregada: {fmtArea(selectedPoint.area_ha)}
                  </div>
                )}
                <div style={{ fontSize: 9, color: '#64748B', marginTop: 6, borderTop: '1px solid #1E293B', paddingTop: 4 }}>
                  Agregação territorial por referência municipal
                </div>
              </div>
            )}

            {/* Legenda Flutuante (Responsiva / Recolhível no Mobile) */}
            <div
              style={{
                position: 'absolute',
                bottom: 12,
                left: 12,
                zIndex: 1000,
                background: 'rgba(15, 23, 42, 0.92)',
                border: '1px solid #334155',
                borderRadius: 8,
                padding: legendOpen ? 10 : '6px 10px',
                width: legendOpen ? 220 : 'auto',
                backdropFilter: 'blur(6px)',
                fontSize: 10,
                color: '#E2E8F0',
                boxShadow: '0 2px 8px rgba(0,0,0,0.3)'
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  cursor: 'pointer',
                  fontWeight: 700,
                  fontSize: 11,
                  color: '#F8FAFC'
                }}
                onClick={() => setLegendOpen(!legendOpen)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setLegendOpen(!legendOpen); }}
                aria-expanded={legendOpen}
                aria-label="Alternar legenda do mapa"
              >
                <span>Concentração de cadastros CAR</span>
                {legendOpen ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
              </div>

              {legendOpen && (
                <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, fontSize: 9, color: '#94A3B8' }}>
                    <span>Escala visual (quantidade):</span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-around', background: 'rgba(255,255,255,0.03)', padding: '6px 4px', borderRadius: 4 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: AGRO_COLOR, border: '1px solid #FFF' }} />
                      <span style={{ fontSize: 9, color: '#94A3B8' }}>Baixa</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                      <div style={{ width: 16, height: 16, borderRadius: '50%', background: AGRO_COLOR, border: '1px solid #FFF' }} />
                      <span style={{ fontSize: 9, color: '#94A3B8' }}>Média</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                      <div style={{ width: 24, height: 24, borderRadius: '50%', background: AGRO_COLOR, border: '1px solid #FFF' }} />
                      <span style={{ fontSize: 9, color: '#94A3B8' }}>Alta</span>
                    </div>
                  </div>

                  <div style={{ fontSize: 9, color: '#94A3B8', display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <div>• <strong>Métrica:</strong> Cadastros CAR por município/grade</div>
                    <div>• <strong>Fonte:</strong> SICAR / Geociências IBGE</div>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Nota Metodológica e Resumo Territorial */}
      <div style={{ fontSize: 11, color: 'var(--text-tertiary, #94A3B8)', lineHeight: '1.45', background: 'rgba(255,255,255,0.02)', padding: 10, borderRadius: 6, border: '1px solid var(--border-subtle, #1E293B)' }}>
        <strong style={{ color: 'var(--text-secondary, #E2E8F0)' }}>Nota Metodológica:</strong> Os pontos representam agregações territoriais de cadastros CAR e não coordenadas, polígonos ou limites reais de propriedades rurais.
        <div style={{ marginTop: 4, display: 'flex', gap: 12, flexWrap: 'wrap', fontSize: 10, color: 'var(--text-tertiary, #94A3B8)' }}>
          <span>• Total exibido: <strong>{validCount}</strong> agregações ({fmt(totalRepresented)} cadastros CAR)</span>
          <span>• Referência municipal válida: <strong>98,6%</strong></span>
          {invalidCount > 0 && (
            <span style={{ color: '#F59E0B' }}>• Descartados (fora do BR): <strong>{invalidCount}</strong></span>
          )}
        </div>
      </div>
    </div>
  );
};
