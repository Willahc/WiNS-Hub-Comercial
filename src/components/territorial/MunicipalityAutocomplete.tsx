import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Search } from 'lucide-react';
import { ALL_27_UFS, UF_SIGLAS } from '../../services/canonicalTerritorialService';

export interface MunicipalityOption {
  ibge: string;
  name: string;
  uf: string;
  region?: string;
}

export interface MunicipalityAutocompleteProps {
  value?: string;
  onChange: (ibge: string, name: string, uf: string) => void;
  placeholder?: string;
  dataTestId?: string;
  style?: React.CSSProperties;
  disabled?: boolean;
}

const BRAZIL_MUNICIPALITIES_DEMO: MunicipalityOption[] = [
  { ibge: '4106902', name: 'Curitiba', uf: 'PR', region: 'Sul' },
  { ibge: '4101804', name: 'Araucária', uf: 'PR', region: 'Sul' },
  { ibge: '4125506', name: 'São José dos Pinhais', uf: 'PR', region: 'Sul' },
  { ibge: '4115200', name: 'Maringá', uf: 'PR', region: 'Sul' },
  { ibge: '4113701', name: 'Londrina', uf: 'PR', region: 'Sul' },
  { ibge: '3548708', name: 'São Paulo', uf: 'SP', region: 'Sudeste' },
  { ibge: '3550308', name: 'São Bernardo do Campo', uf: 'SP', region: 'Sudeste' },
  { ibge: '3509502', name: 'Campinas', uf: 'SP', region: 'Sudeste' },
  { ibge: '3304557', name: 'Rio de Janeiro', uf: 'RJ', region: 'Sudeste' },
  { ibge: '3106200', name: 'Belo Horizonte', uf: 'MG', region: 'Sudeste' },
  { ibge: '5300108', name: 'Brasília', uf: 'DF', region: 'Centro-Oeste' },
  { ibge: '2927408', name: 'Salvador', uf: 'BA', region: 'Nordeste' },
  { ibge: '2304400', name: 'Fortaleza', uf: 'CE', region: 'Nordeste' },
  { ibge: '1302603', name: 'Manaus', uf: 'AM', region: 'Norte' },
  { ibge: '4314902', name: 'Porto Alegre', uf: 'RS', region: 'Sul' },
  { ibge: '4205407', name: 'Florianópolis', uf: 'SC', region: 'Sul' },
  { ibge: '5208707', name: 'Goiânia', uf: 'GO', region: 'Centro-Oeste' },
  { ibge: '2611606', name: 'Recife', uf: 'PE', region: 'Nordeste' },
  { ibge: '1501402', name: 'Belém', uf: 'PA', region: 'Norte' },
  { ibge: '5002704', name: 'Campo Grande', uf: 'MS', region: 'Centro-Oeste' },
];

export const MunicipalityAutocomplete: React.FC<MunicipalityAutocompleteProps> = ({
  value = '',
  onChange,
  placeholder = 'Buscar município...',
  dataTestId = 'municipality-autocomplete',
  style,
  disabled = false,
}) => {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const suggestions = useMemo(() => {
    if (!query || query.length < 2) return [];
    const q = query.toLowerCase();
    return BRAZIL_MUNICIPALITIES_DEMO.filter(m =>
      m.name.toLowerCase().includes(q) ||
      m.uf.toLowerCase().includes(q) ||
      m.ibge.includes(q)
    ).slice(0, 10);
  }, [query]);

  const handleSelect = (m: MunicipalityOption) => {
    onChange(m.ibge, m.name, m.uf);
    setQuery(`${m.name}/${m.uf}`);
    setIsOpen(false);
  };

  return (
    <div ref={wrapperRef} style={{ position: 'relative', ...style }}>
      <div style={{ position: 'relative' }}>
        <Search size={13} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: '#64748B' }} />
        <input
          data-testid={dataTestId}
          value={query}
          onChange={e => { setQuery(e.target.value); setIsOpen(true); }}
          onFocus={() => setIsOpen(true)}
          placeholder={placeholder}
          disabled={disabled}
          style={{
            width: '100%', height: 30, paddingLeft: 28, fontSize: 11,
            background: '#090D16', border: '1px solid #334155', borderRadius: 4,
            color: '#FFF', outline: 'none', cursor: disabled ? 'not-allowed' : 'text',
          }}
        />
      </div>
      {isOpen && suggestions.length > 0 && (
        <div style={{
          position: 'absolute', top: 34, left: 0, right: 0,
          background: '#0F172A', border: '1px solid #3B82F6', borderRadius: 6,
          zIndex: 100, maxHeight: 200, overflowY: 'auto',
          boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
        }}>
          {suggestions.map(m => (
            <div
              key={m.ibge}
              data-testid={`mun-suggestion-${m.ibge}`}
              onClick={() => handleSelect(m)}
              style={{
                padding: '8px 12px', borderBottom: '1px solid #1E293B',
                cursor: 'pointer', display: 'flex', justifyContent: 'space-between',
                alignItems: 'center', fontSize: 11,
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(59,130,246,0.1)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
            >
              <div>
                <strong style={{ color: '#FFF' }}>{m.name}/{m.uf}</strong>
                {m.region && <span style={{ color: '#64748B', marginLeft: 6 }}>({m.region})</span>}
              </div>
              <span style={{ color: '#3B82F6', fontSize: 10 }}>IBGE: {m.ibge}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
