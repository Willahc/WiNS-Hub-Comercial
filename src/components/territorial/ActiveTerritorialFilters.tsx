import React from 'react';
import { X } from 'lucide-react';
import { ALL_27_UFS } from '../../services/canonicalTerritorialService';

export interface ActiveFilterChip {
  key: string;
  label: string;
  onClear: () => void;
}

export interface ActiveTerritorialFiltersProps {
  filters: ActiveFilterChip[];
  onClearAll?: () => void;
  dataTestId?: string;
}

export const ActiveTerritorialFilters: React.FC<ActiveTerritorialFiltersProps> = ({
  filters,
  onClearAll,
  dataTestId = 'active-territorial-filters',
}) => {
  if (filters.length === 0) return null;

  return (
    <div
      data-testid={dataTestId}
      style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}
    >
      <span style={{ fontSize: 10, color: '#64748B' }}>Filtros ativos:</span>
      {filters.map(chip => (
        <span
          key={chip.key}
          style={{
            fontSize: 10, background: '#1E293B', color: '#F8FAFC',
            padding: '2px 8px', borderRadius: 12,
            display: 'inline-flex', alignItems: 'center', gap: 4,
            border: '1px solid #334155',
          }}
        >
          {chip.label}
          <button
            onClick={chip.onClear}
            style={{
              background: 'none', border: 'none', color: '#94A3B8',
              cursor: 'pointer', padding: 0, display: 'flex',
            }}
          >
            <X size={10} />
          </button>
        </span>
      ))}
      {onClearAll && filters.length > 1 && (
        <button
          onClick={onClearAll}
          style={{
            fontSize: 10, color: '#EF4444', background: 'none',
            border: 'none', cursor: 'pointer', textDecoration: 'underline',
          }}
        >
          Limpar tudo
        </button>
      )}
    </div>
  );
};

export function buildTerritorialFilterChips(params: {
  scope?: string;
  uf?: string;
  municipality?: string;
  radius_km?: number;
}): ActiveFilterChip[] {
  const chips: ActiveFilterChip[] = [];
  if (params.scope === 'BR' || (!params.uf && !params.municipality)) {
    return chips;
  }
  if (params.uf) {
    const ufInfo = ALL_27_UFS.find(u => u.sigla === params.uf);
    chips.push({
      key: `uf-${params.uf}`,
      label: `UF: ${params.uf}${ufInfo ? ` - ${ufInfo.nome}` : ''}`,
      onClear: () => {},
    });
  }
  if (params.municipality) {
    chips.push({
      key: `mun-${params.municipality}`,
      label: `Município: ${params.municipality}`,
      onClear: () => {},
    });
  }
  if (params.radius_km) {
    chips.push({
      key: `radius-${params.radius_km}`,
      label: `Raio: ${params.radius_km}km`,
      onClear: () => {},
    });
  }
  return chips;
}
