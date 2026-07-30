import React from 'react';
import { ALL_27_UFS } from '../../services/canonicalTerritorialService';

export interface BrazilUfSelectProps {
  value?: string;
  onChange: (value: string) => void;
  id?: string;
  dataTestId?: string;
  style?: React.CSSProperties;
  className?: string;
  disabled?: boolean;
  showAllLabel?: string;
}

export const BrazilUfSelect: React.FC<BrazilUfSelectProps> = ({
  value = '',
  onChange,
  id,
  dataTestId = 'uf-filter-select',
  style,
  className,
  disabled = false,
  showAllLabel = 'Todas as 27 UFs (Brasil)'
}) => {
  return (
    <select
      id={id}
      data-testid={dataTestId}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      className={className}
      style={{
        height: 32,
        background: '#090D16',
        border: '1px solid #334155',
        color: '#FFF',
        fontSize: 11,
        borderRadius: 6,
        padding: '0 10px',
        cursor: disabled ? 'not-allowed' : 'pointer',
        outline: 'none',
        ...style
      }}
    >
      <option value="">{showAllLabel}</option>
      {ALL_27_UFS.map((uf) => (
        <option key={uf.sigla} value={uf.sigla}>
          {uf.sigla} - {uf.nome}
        </option>
      ))}
    </select>
  );
};
