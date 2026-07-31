import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Search, Building2, Info } from 'lucide-react';
import AgroPageShell from '../components/AgroPageShell';
import { BrazilUfSelect } from '../components/territorial/BrazilUfSelect';
import { httpClient } from '../services/http/client';
import { AGRO_API } from './agroApiEndpoints';

/**
 * Catálogo de Empresas e Vínculos Societários Agro
 * Rota: /agro/holdings
 * Endpoint: GET /agro/holdings
 */
export default function AgroHoldingsApproved() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [uf, setUf] = useState(searchParams.get('uf') || '');

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: any = { page: 1, page_size: 25 };
      if (search) params.search = search;
      if (uf) params.uf = uf;
      const res = await httpClient.get(AGRO_API.holdings, { params });
      setItems(res.data?.items || []);
    } catch (err: any) {
      setError(err?.userMessage || err?.message || 'Falha ao carregar empresas e vínculos societários');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [search, uf]);

  useEffect(() => { loadData(); }, [loadData]);
  useEffect(() => {
    const p: Record<string, string> = {};
    if (uf) p.uf = uf;
    if (search) p.search = search;
    setSearchParams(p, { replace: true });
  }, [uf, search, setSearchParams]);

  const empty = !loading && !error && items.length === 0;

  return (
    <AgroPageShell
      title="Empresas e Vínculos Societários Agro"
      subtitle="Mapeamento de empresas agropecuárias, holdings patrimoniais e vínculos QSA com imóveis rurais. Registros baseados exclusivamente em dados oficiais da Receita Federal do Brasil (RFB)."
      loading={loading} error={error} onRetry={loadData}
      empty={empty} emptyMessage="Nenhuma empresa ou grupo encontrado com os filtros atuais."
      statusBadge="Vínculos Societários RFB"
    >
      {/* Filtros */}
      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: 8, padding: 12, display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 260, background: 'var(--bg-base)', border: '1px solid var(--border-subtle)', borderRadius: 6, padding: '6px 12px' }}>
          <Search size={16} color="#94A3B8" />
          <input type="text" placeholder="Buscar por Razão Social, CNPJ ou município..." value={search}
            onChange={e => setSearch(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') loadData(); }}
            style={{ background: 'none', border: 'none', color: '#F8FAFC', fontSize: 13, width: '100%', outline: 'none' }} />
        </div>
        <BrazilUfSelect value={uf} onChange={v => setUf(v)} showAllLabel="Todas as UFs" />
        <button onClick={loadData} style={{ background: '#22C55E', color: '#FFF', border: 'none', padding: '7px 16px', borderRadius: 6, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>Buscar</button>
      </div>

      {/* Nota de Governança e Transparência */}
      <div style={{ background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.3)', borderRadius: 8, padding: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
        <Info size={16} color="#3B82F6" style={{ flexShrink: 0 }} />
        <div style={{ fontSize: 11, color: '#CBD5E1' }}>
          <strong>Critério de Grupo Econômico:</strong> Agrupamentos requerem vínculo documental no Quadro de Sócios e Administradores (QSA/RFB) ou participação acionária declarada. Empresas individuais são classificadas de forma autônoma até haver evidência de grupo.
        </div>
      </div>

      {/* Tabela de Empresas e Grupos */}
      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: 8, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, textAlign: 'left' }}>
          <thead>
            <tr style={{ background: '#0B132B', color: '#94A3B8', borderBottom: '1px solid #1E293B' }}>
              <th style={{ padding: 10 }}>Razão Social / CNPJ</th>
              <th style={{ padding: 10 }}>CNAE Principal</th>
              <th style={{ padding: 10 }}>Município / UF</th>
              <th style={{ padding: 10 }}>Grupo / Vínculo Agro</th>
              <th style={{ padding: 10 }}>Sócio em Comum / Elo</th>
              <th style={{ padding: 10 }}>Força da Relação</th>
              <th style={{ padding: 10 }}>Fonte</th>
              <th style={{ padding: 10 }}>Ficha</th>
            </tr>
          </thead>
          <tbody>
            {items.map((h: any, i: number) => (
              <tr key={i} style={{ borderBottom: '1px solid #1E293B' }}>
                <td style={{ padding: 10 }}>
                  <strong style={{ color: '#F8FAFC', display: 'block' }}>{h.razao || h.razao_social || 'Razão social não informada'}</strong>
                  <span style={{ fontSize: 11, fontFamily: 'monospace', color: '#64748B' }}>{h.cnpj14 || h.cnpj || '—'}</span>
                </td>
                <td style={{ padding: 10, color: '#3B82F6', fontSize: 11 }}>{h.cnae_principal || h.cnae || 'CNAE Agropecuário'}</td>
                <td style={{ padding: 10, color: '#CBD5E1' }}>{h.municipio || '—'} / {h.uf || '—'}</td>
                <td style={{ padding: 10, color: '#22C55E', fontSize: 11 }}>
                  {h.nome_grupo
                    ? <span style={{ color: '#22C55E', fontWeight: 700 }}>{h.nome_grupo}</span>
                    : (h.nome_socio_comum
                        ? 'Vínculo via QSA Cadastral'
                        : <span style={{ color: '#64748B' }}>Sem vínculo documentado</span>)}
                </td>
                <td style={{ padding: 10, color: '#94A3B8', fontSize: 11 }}>
                  {h.nome_socio_comum || '—'}
                </td>
                <td style={{ padding: 10 }}>
                  <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 4,
                    background: (h.score || 0) >= 80 ? 'rgba(34,197,94,0.15)' : 'rgba(245,158,11,0.15)',
                    color: (h.score || 0) >= 80 ? '#22C55E' : '#F59E0B' }}>
                    {h.score !== undefined ? `${Math.round(h.score)}/100` : '—'}
                  </span>
                </td>
                <td style={{ padding: 10, fontSize: 11, color: '#94A3B8' }}>{h.fonte || 'RFB / QSA'}</td>
                <td style={{ padding: 10 }}>
                  {h.cnpj14 || h.cnpj ? (
                    <Link to={`/empresas/${h.cnpj14 || h.cnpj}`} style={{ color: '#3B82F6', fontSize: 11, fontWeight: 600, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <Building2 size={12} /> Empresa 360°
                    </Link>
                  ) : <span style={{ color: '#64748B', fontSize: 11 }}>—</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AgroPageShell>
  );
}
