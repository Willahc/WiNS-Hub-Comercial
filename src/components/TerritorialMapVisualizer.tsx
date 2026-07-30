import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  Layers, ZoomIn, ZoomOut, Maximize2, Minimize2, RotateCcw,
  Building2, HardHat, Truck, Sprout, HeartPulse, Sparkles, X,
  MapPin, ShieldCheck, ExternalLink, Globe, TrendingUp, AlertTriangle
} from 'lucide-react';
import type { TerritorialMarker } from '../services/territorialDatabase';

interface Props {
  markers: TerritorialMarker[];
  centerLat?: number;
  centerLng?: number;
  zoomLevel?: number;
  activeLayers: string[];
  viewMode: 'pontos' | 'clusters' | 'densidade' | 'municipios';
  onSelectMarker: (marker: TerritorialMarker) => void;
  onSelectMunicipality?: (ibge: string) => void;
}

export const TerritorialMapVisualizer: React.FC<Props> = ({
  markers,
  centerLat = -25.4297,
  centerLng = -49.2719,
  zoomLevel = 11,
  activeLayers,
  viewMode,
  onSelectMarker,
  onSelectMunicipality
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersLayerGroupRef = useRef<L.LayerGroup | null>(null);

  const [isFullscreen, setIsFullscreen] = useState(false);

  const getMarkerColor = (type: string) => {
    switch (type) {
      case 'obra': return '#3B82F6';
      case 'empresa': return '#8B5CF6';
      case 'transportador': return '#06B6D4';
      case 'imovel_car': return '#22C55E';
      case 'estabelecimento_cnes': return '#EC4899';
      case 'oportunidade': return '#10B981';
      case 'evento': return '#EF4444';
      default: return '#6366F1';
    }
  };

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        center: [centerLat, centerLng],
        zoom: zoomLevel,
        zoomControl: false,
        attributionControl: false
      });

      // Dark Matter CartoDB Basemap Tile Layer
      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        maxZoom: 19,
        subdomains: 'abcd'
      }).addTo(map);

      mapInstanceRef.current = map;
      markersLayerGroupRef.current = L.layerGroup().addTo(map);
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Update map view center on prop change
  useEffect(() => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.setView([centerLat, centerLng], zoomLevel, { animate: true });
    }
  }, [centerLat, centerLng, zoomLevel]);

  // Update Markers Layer
  useEffect(() => {
    if (!mapInstanceRef.current || !markersLayerGroupRef.current) return;
    const layerGroup = markersLayerGroupRef.current;
    layerGroup.clearLayers();

    const filtered = markers.filter(m => activeLayers.includes(m.type) || activeLayers.includes(m.vertical.toLowerCase()));

    filtered.forEach(m => {
      const color = getMarkerColor(m.type);
      const customHtml = `
        <div style="
          width: 28px; height: 28px; border-radius: 50%;
          background: ${color}; border: 2px solid #FFF;
          box-shadow: 0 0 10px ${color}; display: flex;
          align-items: center; justify-content: center; color: #FFF;
          font-weight: bold; font-size: 10px; cursor: pointer;
        ">
          ${m.type.substring(0, 1).toUpperCase()}
        </div>
      `;

      const icon = L.divIcon({
        html: customHtml,
        className: 'custom-leaflet-marker',
        iconSize: [28, 28],
        iconAnchor: [14, 14]
      });

      const marker = L.marker([m.lat, m.lng], { icon });

      // Popup Content
      const popupHtml = `
        <div style="font-family: system-ui, sans-serif; font-size: 11px; padding: 4px; color: #0F172A;">
          <strong style="color: ${color}; font-size: 12px;">${m.name}</strong><br/>
          <span>${m.vertical} · ${m.municipality}/${m.uf}</span><br/>
          <span style="color: #64748B;">${m.metricLabel}: <strong>${m.metricValue}</strong></span><br/>
          <span style="font-size: 9px; color: #94A3B8;">Fonte: ${m.source} (${m.updatedAt})</span>
        </div>
      `;
      marker.bindPopup(popupHtml);

      marker.on('click', () => {
        onSelectMarker(m);
      });

      layerGroup.addLayer(marker);
    });

  }, [markers, activeLayers, onSelectMarker]);

  const handleZoomIn = () => mapInstanceRef.current?.zoomIn();
  const handleZoomOut = () => mapInstanceRef.current?.zoomOut();
  const handleFitBounds = () => {
    if (mapInstanceRef.current && markers.length > 0) {
      const bounds = L.latLngBounds(markers.map(m => [m.lat, m.lng]));
      mapInstanceRef.current.fitBounds(bounds, { padding: [40, 40] });
    }
  };

  return (
    <div style={{
      width: '100%', height: isFullscreen ? '100vh' : 580,
      position: isFullscreen ? 'fixed' : 'relative',
      top: isFullscreen ? 0 : 'auto', left: isFullscreen ? 0 : 'auto',
      zIndex: isFullscreen ? 9999 : 1, background: '#090D16',
      border: '1px solid var(--border-default, #1E293B)',
      borderRadius: isFullscreen ? 0 : 10, display: 'flex', flexDirection: 'column', overflow: 'hidden'
    }}>
      {/* Controls Bar */}
      <div style={{
        padding: '10px 16px', background: '#0F172A', borderBottom: '1px solid #1E293B',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, zIndex: 10
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Globe size={16} color="#06B6D4" />
          <h3 style={{ fontSize: 13, fontWeight: 700, color: '#F8FAFC', margin: 0 }}>
            Mapa Territorial Integrado ({markers.length} marcadores georreferenciados)
          </h3>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button onClick={handleZoomIn} title="Zoom In" style={{ background: '#1E293B', border: '1px solid #334155', color: '#FFF', borderRadius: 4, padding: '4px 8px', cursor: 'pointer' }}>
            <ZoomIn size={14} />
          </button>
          <button onClick={handleZoomOut} title="Zoom Out" style={{ background: '#1E293B', border: '1px solid #334155', color: '#FFF', borderRadius: 4, padding: '4px 8px', cursor: 'pointer' }}>
            <ZoomOut size={14} />
          </button>
          <button onClick={handleFitBounds} title="Ajustar ao Recorte" style={{ background: '#1E293B', border: '1px solid #334155', color: '#FFF', borderRadius: 4, padding: '4px 8px', fontSize: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
            <RotateCcw size={12} /> Reset Fit
          </button>
          <button onClick={() => setIsFullscreen(!isFullscreen)} title="Tela Cheia" style={{ background: '#1E293B', border: '1px solid #334155', color: '#FFF', borderRadius: 4, padding: '4px 8px', cursor: 'pointer' }}>
            {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </button>
        </div>
      </div>

      {/* Map Element */}
      <div style={{ flex: 1, position: 'relative', width: '100%', overflow: 'hidden' }}>
        <div ref={mapContainerRef} style={{ width: '100%', height: '100%' }} />

        {/* Legend Overlay */}
        <div style={{
          position: 'absolute', bottom: 12, left: 12, background: 'rgba(15,23,42,0.95)',
          padding: '8px 12px', borderRadius: 6, border: '1px solid #1E293B',
          display: 'flex', gap: 12, fontSize: 10, flexWrap: 'wrap', zIndex: 1000
        }}>
          <span style={{ color: '#3B82F6', fontWeight: 600 }}>● Engenharia</span>
          <span style={{ color: '#8B5CF6', fontWeight: 600 }}>● Empresas</span>
          <span style={{ color: '#06B6D4', fontWeight: 600 }}>◆ Logística/RNTRC</span>
          <span style={{ color: '#22C55E', fontWeight: 600 }}>■ Agro/CAR</span>
          <span style={{ color: '#EC4899', fontWeight: 600 }}>✚ Saúde/CNES</span>
          <span style={{ color: '#10B981', fontWeight: 600 }}>★ Oportunidades</span>
        </div>
      </div>
    </div>
  );
};
