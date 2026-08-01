import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { AgroTerritorialMap } from '../components/AgroTerritorialMap';
import AgroApproved from '../pages/AgroApproved';
import fs from 'fs';
import path from 'path';

describe('AgroTerritorialMap Component & AgroApproved Clean Integration', () => {
  it('1. deve renderizar estado de carregamento (LOADING)', () => {
    render(<AgroTerritorialMap rawClusters={[]} loading={true} />);
    expect(screen.getByText(/Carregando agregações territoriais…/i)).toBeInTheDocument();
  });

  it('2. deve renderizar estado de erro (ERROR) sem confundir com empty state', () => {
    render(
      <AgroTerritorialMap
        rawClusters={[]}
        loading={false}
        error="Falha na requisição HTTP"
        onRetry={() => {}}
      />
    );
    expect(screen.getByText(/Não foi possível carregar o mapa territorial/i)).toBeInTheDocument();
    expect(screen.getByText(/Falha na requisição HTTP/i)).toBeInTheDocument();
    expect(screen.queryByText(/Nenhuma agregação territorial disponível/i)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Tentar novamente/i })).toBeInTheDocument();
  });

  it('3. deve renderizar estado vazio (EMPTY) em chamada bem-sucedida sem dados', () => {
    render(<AgroTerritorialMap rawClusters={[]} loading={false} error={null} />);
    expect(screen.getByText(/Nenhuma agregação territorial disponível para os filtros informados/i)).toBeInTheDocument();
    expect(screen.queryByText(/Não foi possível carregar o mapa territorial/i)).not.toBeInTheDocument();
  });

  it('4. deve exibir fallback integrado SICAR/CAR e IBGE quando sources for omissa', () => {
    render(<AgroTerritorialMap rawClusters={[{ lat: -15.78, lng: -47.92, quantidade: 100 }]} loading={false} />);
    expect(screen.getByText(/SICAR\/CAR, com referência municipal IBGE/i)).toBeInTheDocument();
  });

  it('5. deve exibir a fonte fornecida via props quando disponível', () => {
    render(
      <AgroTerritorialMap
        rawClusters={[{ lat: -15.78, lng: -47.92, quantidade: 100 }]}
        loading={false}
        sources={['SICAR / MAPA', 'IBGE 2026']}
      />
    );
    expect(screen.getByText(/SICAR \/ MAPA, IBGE 2026/i)).toBeInTheDocument();
  });

  it('6. deve utilizar a nova nomenclatura "janela geográfica configurada"', () => {
    render(
      <AgroTerritorialMap
        rawClusters={[
          { lat: -15.78, lng: -47.92, quantidade: 100 },
          { lat: 48.85, lng: 2.35, quantidade: 50 } // Fora da janela BR
        ]}
        loading={false}
      />
    );
    expect(screen.getByText(/Descartados fora da janela configurada/i)).toBeInTheDocument();
  });

  it('7. deve comprovar ausência literal de "98,6%" no componente e no fonte do AgroApproved', () => {
    const agroApprovedPath = path.resolve(__dirname, '../pages/AgroApproved.tsx');
    const source = fs.readFileSync(agroApprovedPath, 'utf-8');
    expect(source).not.toContain('98,6%');

    render(<AgroTerritorialMap rawClusters={[]} loading={false} />);
    expect(screen.queryByText(/98,6%/i)).not.toBeInTheDocument();
  });

  it('8. deve comprovar ausência de imports Leaflet antigos e FitBoundsControl em AgroApproved.tsx', () => {
    const agroApprovedPath = path.resolve(__dirname, '../pages/AgroApproved.tsx');
    const source = fs.readFileSync(agroApprovedPath, 'utf-8');
    expect(source).not.toContain('MapContainer');
    expect(source).not.toContain('TileLayer');
    expect(source).not.toContain('CircleMarker');
    expect(source).not.toContain('FitBoundsControl');
    expect(source).not.toContain("import L from 'leaflet'");
  });

  it('9. separa mapa e legenda e renomeia cobertura como registros representados', () => {
    render(<AgroTerritorialMap rawClusters={[{ lat: -15.78, lng: -47.92, quantidade: 100 }]} totalNoRecorte={100} />);
    expect(document.querySelector('.agro-map-layout')).toBeInTheDocument();
    expect(document.querySelector('.agro-map-container')).toBeInTheDocument();
    expect(document.querySelector('.agro-map-sidebar')).toBeInTheDocument();
    expect(screen.getByText(/Registros representados no mapa/i)).toBeInTheDocument();
    expect(screen.queryByText(/Cobertura territorial/i)).not.toBeInTheDocument();
  });
});
