import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Tooltip, useMap } from 'react-leaflet';
import { Link } from 'react-router-dom';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { OverviewEntity } from '../types/hub';

export const overviewColors: Record<string, string> = {
  engenharia: '#3b82f6',
  logistica: '#f59e0b',
  agro: '#22c55e',
  saude: '#ec4899',
  oportunidades: '#a855f7'
};

export interface TerritoryCluster {
  key: string;
  vertical: string;
  territory: string;
  items: OverviewEntity[];
}

export function formatClusterLabel(count: number): string {
  if (count >= 1000000) {
    return `${(count / 1000000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mi`;
  }
  if (count >= 1000) {
    return `${(count / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mil`;
  }
  return String(count);
}

// Controller component inside MapContainer to manage view bounds and reset
const MapController: React.FC<{
  clusters: TerritoryCluster[];
  selectedKey: string;
  resetKey: number;
}> = ({ clusters, selectedKey, resetKey }) => {
  const map = useMap();

  useEffect(() => {
    // Standard Brazil bounding box
    const brazilBounds: L.LatLngBoundsExpression = [[-33.75, -73.98], [5.27, -34.79]];
    
    if (resetKey > 0) {
      map.fitBounds(brazilBounds, { animate: true, padding: [20, 20] });
      return;
    }

    if (selectedKey) {
      const selected = clusters.find(c => c.key === selectedKey);
      if (selected && selected.items.length > 0) {
        const lat = selected.items.reduce((s, x) => s + x.latitude, 0) / selected.items.length;
        const lon = selected.items.reduce((s, x) => s + x.longitude, 0) / selected.items.length;
        map.flyTo([lat, lon], 9, { duration: 1.2 });
        return;
      }
    }

    if (clusters.length > 0 && clusters.length < 15) {
      // Fit to filtered clusters
      const validPoints = clusters
        .map(c => [
          c.items.reduce((s, x) => s + x.latitude, 0) / c.items.length,
          c.items.reduce((s, x) => s + x.longitude, 0) / c.items.length
        ])
        .filter(([lat, lon]) => !isNaN(lat) && !isNaN(lon));

      if (validPoints.length > 0) {
        const bounds = L.latLngBounds(validPoints as [number, number][]);
        map.fitBounds(bounds, { maxZoom: 8, padding: [40, 40], animate: true });
      }
    } else {
      map.fitBounds(brazilBounds, { animate: true });
    }
  }, [clusters, selectedKey, resetKey, map]);

  return null;
};

export const OverviewTerritoryMap: React.FC<{
  clusters: TerritoryCluster[];
  selected: string;
  onSelect: (key: string) => void;
  resetKey?: number;
}> = ({ clusters, selected, onSelect, resetKey = 0 }) => {
  const createClusterIcon = (count: number, vertical: string, isSelected: boolean) => {
    const color = overviewColors[vertical] || '#3b82f6';
    const label = formatClusterLabel(count);
    const size = Math.min(52, Math.max(32, 26 + Math.sqrt(count) * 2.8));

    const html = `
      <div class="custom-map-cluster ${isSelected ? 'selected' : ''}" style="
        width: ${size}px;
        height: ${size}px;
        background: ${color};
        border: 2px solid #ffffff;
        box-shadow: 0 2px 8px rgba(0,0,0,0.35)${isSelected ? `, 0 0 0 4px ${color}55` : ''};
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        color: #ffffff;
        font-weight: 700;
        font-size: ${size < 36 ? 10 : 12}px;
        font-family: inherit;
        cursor: pointer;
        transition: transform 0.2s ease, box-shadow 0.2s ease;
      ">
        ${label}
      </div>
    `;

    return L.divIcon({
      html,
      className: 'cluster-icon-wrapper',
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2]
    });
  };

  const brazilCenter: L.LatLngExpression = [-14.235, -51.925];
  const brazilBounds: L.LatLngBoundsExpression = [[-34.0, -74.0], [5.5, -32.0]];

  return (
    <MapContainer
      className="leaflet-overview-map"
      center={brazilCenter}
      zoom={4}
      minZoom={3}
      maxZoom={13}
      maxBounds={brazilBounds}
      maxBoundsViscosity={1.0}
      scrollWheelZoom
    >
      <TileLayer
        attribution='&copy; OpenStreetMap contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <MapController clusters={clusters} selectedKey={selected} resetKey={resetKey} />
      {clusters.map(cluster => {
        const lat = cluster.items.reduce((sum, x) => sum + x.latitude, 0) / cluster.items.length;
        const lon = cluster.items.reduce((sum, x) => sum + x.longitude, 0) / cluster.items.length;

        if (isNaN(lat) || isNaN(lon)) return null;

        const kinds = [...new Set(cluster.items.map(x => x.kind))].join(' + ');
        const isSelected = selected === cluster.key;

        return (
          <Marker
            key={cluster.key}
            position={[lat, lon]}
            icon={createClusterIcon(cluster.items.length, cluster.vertical, isSelected)}
            eventHandlers={{ click: () => onSelect(cluster.key) }}
          >
            <Tooltip direction="top" offset={[0, -10]}>
              <strong>{cluster.territory}</strong>
              <br />
              <strong>{formatClusterLabel(cluster.items.length)} ({cluster.items.length}) entidades</strong>
              <br />
              <small>{kinds}</small>
            </Tooltip>
            <Popup>
              <div className="map-popup">
                <strong>{cluster.territory}</strong>
                <span>{cluster.items.length} entidades · {kinds}</span>
                <span>Fonte: {[...new Set(cluster.items.map(x => x.source))].join(' + ')}</span>
                <span>
                  {cluster.items.some(x => x.geoPrecision === 'municipality')
                    ? 'Localização aproximada por centroide municipal IBGE'
                    : 'Coordenada exata informada pela fonte'}
                </span>
                <Link to={cluster.items[0]?.detailPath || '/territorial'}>
                  Abrir detalhe ({cluster.items[0]?.name || 'Entidade'})
                </Link>
              </div>
            </Popup>
          </Marker>
        );
      })}
    </MapContainer>
  );
};
