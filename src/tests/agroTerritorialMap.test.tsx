import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { AgroTerritorialMap } from '../components/AgroTerritorialMap';

describe('AgroTerritorialMap Component', () => {
  it('10. deve renderizar estado de carregamento (LOADING)', () => {
    render(<AgroTerritorialMap rawClusters={[]} loading={true} />);
    expect(screen.getByText(/Carregando agregações territoriais…/i)).toBeInTheDocument();
  });

  it('10 & 11. deve renderizar estado de erro (ERROR) com opção de retry', () => {
    render(
      <AgroTerritorialMap
        rawClusters={[]}
        loading={false}
        error="Falha na conexão com a API"
        onRetry={() => {}}
      />
    );
    expect(screen.getByText(/Não foi possível carregar o mapa territorial/i)).toBeInTheDocument();
    expect(screen.getByText(/Falha na conexão com a API/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Tentar novamente/i })).toBeInTheDocument();
  });

  it('10. deve renderizar estado vazio (EMPTY)', () => {
    render(<AgroTerritorialMap rawClusters={[]} loading={false} error={null} />);
    expect(screen.getByText(/Nenhuma agregação territorial disponível para os filtros informados/i)).toBeInTheDocument();
  });

  it('12, 13, 16, 17, 18. deve renderizar controles, legenda e nota metodológica em SUCCESS', () => {
    const mockClusters = [
      { lat: -15.78, lng: -47.92, quantidade: 120, municipio: 'Brasília', uf: 'DF', area_ha: 5000 },
      { lat: -16.32, lng: -48.95, quantidade: 80, municipio: 'Anápolis', uf: 'GO', area_ha: 3200 }
    ];

    render(<AgroTerritorialMap rawClusters={mockClusters} totalNoRecorte={200} loading={false} />);

    // Legenda
    expect(screen.getAllByText(/Concentração de cadastros CAR/i).length).toBeGreaterThan(0);

    // Nota metodológica
    expect(screen.getByText(/Os pontos representam agregações territoriais de cadastros CAR/i)).toBeInTheDocument();

    // Controles presentes
    expect(screen.getByRole('button', { name: /Centralizar no Brasil/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Ajustar aos dados/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Resetar visão/i })).toBeInTheDocument();
  });
});
