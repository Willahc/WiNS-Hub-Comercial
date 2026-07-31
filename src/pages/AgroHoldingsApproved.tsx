import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Search, Building2 } from 'lucide-react';
import AgroPageShell from '../components/AgroPageShell';
import { BrazilUfSelect } from '../components/territorial/BrazilUfSelect';
import { httpClient } from '../services/http/client';

/**
 * Catálogo de Holdings & Grupos Econômicos
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
      const params: any = { page: 1, page_size: 20 };
      if (search) params.search = search;
      if (uf) params.uf = uf;
      const res = await httpClient.get('/agro/holdings', { params });
      setItems(res.data?.items || []);
    } catch (err: any) {
      setError(err?.userMessage || err?.message || 'Falha ao carregar holdings');
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
      title="Holdings & Grupos Econômicos"
      subtitle="Empresas com vínculo societário a propriedades rurais. Sempre com fonte documental — não por similaridade de nome."
      loading={loading} error={error} onRetry={loadData}
      empty={empty} emptyMessage="Nenhuma holding encontrada com os filtros atuais."
    >
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

      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: 8, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, textAlign: 'left' }}>
          <thead>
            <tr style={{ background: '#0B132B', color: '#94A3B8', borderBottom: '1px solid #1E293B' }}>
              <th style={{ padding: 12 }}>Razão Social / CNPJ</th>
              <th style={{ padding: 12 }}>CNAE / Segmento</th>
              <th style={{ padding: 12 }}>Município / UF</th>
              <th style={{ padding: 12 }}>Vínculo Agro</th>
              <th style={{ padding: 12 }}>Força da Relação</th>
              <th style={{ padding: 12 }}>Fonte</th>
              <th style={{ padding: 12 }}>Detalhe</th>
            </tr>
          </thead>
          <tbody>
            {items.map((h: any, i: number) => (
              <tr key={i} style={{ borderBottom: '1px solid #1E293B' }}>
                <td style={{ padding: 12 }}>
                  <strong style={{ color: '#F8FAFC', display: 'block' }}>{h.razao || h.razao_social || 'Razão social não informada'}</strong>
                  <span style={{ fontSize: 11, fontFamily: 'monospace', color: '#64748B' }}>{h.cnpj14 || h.cnpj || '—'}</span>
                </td>
                <td style={{ padding: 12, color: '#3B82F6', fontSize: 12 }}>{h.cnae_principal || h.cnae || '—'}</td>
                <td style={{ padding: 12, color: '#CBD5E1' }}>{h.municipio || '—'} / {h.uf || '—'}</td>
                <td style={{ padding: 12, color: '#22C55E', fontSize: 12 }}>
                  {h.nome_socio_comum || h.propriedades_relacionadas ? 'Sim — vínculo documental' : 'Em análise'}
                </td>
                <td style={{ padding: 12 }}>
                  <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 4,
                    background: (h.score || 0) >= 80 ? 'rgba(34,197,94,0.15)' : (h.score || 0) >= 50 ? 'rgba(245,158,11,0.15)' : 'rgba(148,163,184,0.1)',
                    color: (h.score || 0) >= 80 ? '#22C55E' : (h.score || 0) >= 50 ? '#F59E0B' : '#94A3B8' }}>
                    {h.score !== undefined ? `${Math.round(h.score)}/100` : 'N/D'}
                  </span>
                </td>
                <td style={{ padding: 12, fontSize: 11, color: '#94A3B8' }}>{h.fonte || 'RFB / QSA'}</td>
                <td style={{ padding: 12 }}>
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
