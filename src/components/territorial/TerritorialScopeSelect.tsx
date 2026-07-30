import React from 'react';

export type TerritorialScope = 'BR' | 'uf' | 'municipio' | 'radius';

export interface TerritorialScopeSelectProps {
  value: TerritorialScope;
  onChange: (scope: TerritorialScope) => void;
  dataTestId?: string;
  disabled?: boolean;
}

const SCOPE_OPTIONS: { value: TerritorialScope; label: string }[] = [
  { value: 'BR', label: 'Brasil' },
  { value: 'uf', label: 'UF' },
  { value: 'municipio', label: 'Município' },
  { value: 'radius', label: 'Raio 15km' },
];

export const TerritorialScopeSelect: React.FC<TerritorialScopeSelectProps> = ({
  value,
  onChange,
  dataTestId = 'territorial-scope-select',
  disabled = false,
}) => {
  return (
    <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
      <span style={{ fontSize: 11, color: '#94A3B8' }}>Escopo:</span>
      {SCOPE_OPTIONS.map(opt => (
        <button
          key={opt.value}
          data-testid={`${dataTestId}-${opt.value}`}
          onClick={() => onChange(opt.value)}
          disabled={disabled}
          style={{
            height: 26, padding: '0 10px', fontSize: 10, fontWeight: 700,
            borderRadius: 4, cursor: disabled ? 'not-allowed' : 'pointer',
            background: value === opt.value ? '#3B82F6' : '#1E293B',
            color: value === opt.value ? '#FFF' : '#94A3B8',
            border: '1px solid #334155',
            opacity: disabled ? 0.5 : 1,
          }}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
};
