import React from "react";
import {
  CircleMarker,
  MapContainer,
  Popup,
  TileLayer,
  Tooltip,
  useMapEvents,
} from "react-leaflet";

export type EngineeringMapCluster = {
  layer: "works" | "companies" | "suppliers" | "opportunities";
  latitude: number;
  longitude: number;
  quantity: number;
  municipality_count: number;
  municipality: string;
  uf: string;
  sample_id: string;
  updated_at?: string;
  geoPrecision: string;
  source: string;
  detailUrl: string;
  locationLabel: string;
  approximateLocation: boolean;
};
const colors = {
  works: "#3b82f6",
  companies: "#a855f7",
  suppliers: "#f59e0b",
  opportunities: "#22c55e",
};
const labels = {
  works: "Obras",
  companies: "Empresas",
  suppliers: "Fornecedores",
  opportunities: "Oportunidades",
};
const ViewEvents: React.FC<{
  onViewport: (bbox: {
    min_lat: number;
    max_lat: number;
    min_lng: number;
    max_lng: number;
    zoom: number;
  }) => void;
}> = ({ onViewport }) => {
  useMapEvents({
    moveend: (e) => {
      const m = e.target,
        b = m.getBounds();
      onViewport({
        min_lat: b.getSouth(),
        max_lat: b.getNorth(),
        min_lng: b.getWest(),
        max_lng: b.getEast(),
        zoom: m.getZoom(),
      });
    },
  });
  return null;
};

export const EngineeringWorksMap: React.FC<{
  clusters: EngineeringMapCluster[];
  zoom: number;
  focusFiltered: boolean;
  onSelect: (cluster: EngineeringMapCluster) => void;
  onViewport: (bbox: {
    min_lat: number;
    max_lat: number;
    min_lng: number;
    max_lng: number;
    zoom: number;
  }) => void;
}> = ({ clusters, zoom, focusFiltered, onSelect, onViewport }) => (
  <MapContainer
    className="leaflet-overview-map"
    center={
      focusFiltered && clusters.length
        ? [clusters[0].latitude, clusters[0].longitude]
        : [-14.2, -51.9]
    }
    zoom={zoom}
    minZoom={3}
    maxZoom={14}
    maxBounds={[
      [-35.5, -75.5],
      [6.5, -32],
    ]}
    scrollWheelZoom
  >
    <TileLayer
      attribution="&copy; OpenStreetMap contributors"
      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
    />
    <ViewEvents onViewport={onViewport} />
    {clusters.map((c, i) => (
      <CircleMarker
        key={`${c.layer}-${c.latitude}-${c.longitude}-${i}`}
        center={[c.latitude, c.longitude]}
        radius={Math.min(22, 7 + Math.log10(Math.max(1, c.quantity)) * 3)}
        pathOptions={{
          color: colors[c.layer],
          fillColor: colors[c.layer],
          fillOpacity: 0.75,
          weight: 2,
        }}
        eventHandlers={{ click: () => onSelect(c) }}
      >
        <Tooltip>
          <strong>
            {c.quantity.toLocaleString("pt-BR")} {labels[c.layer]}
          </strong>
          <br />
          {c.locationLabel}
          <br />
          Fonte: {c.source}
          <br />
          Localização aproximada pelo município
        </Tooltip>
        <Popup>
          <strong>
            {c.quantity.toLocaleString("pt-BR")} {labels[c.layer]}
          </strong>
          <br />
          {c.locationLabel}
          <br />
          Fonte: {c.source}
          <br />
          Atualização:{" "}
          {c.updated_at
            ? new Date(c.updated_at).toLocaleDateString("pt-BR")
            : "não informada"}
          <br />
          Precisão: centroide municipal
        </Popup>
      </CircleMarker>
    ))}
  </MapContainer>
);
