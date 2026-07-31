import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, ShieldCheck } from 'lucide-react';
import AgroPageShell from '../components/AgroPageShell';
import { BrazilUfSelect } from '../components/territorial/BrazilUfSelect';
import { httpClient } from '../services/http/client';

/**
 * Catálogo de Leads & Decisores Rurais
 * Rota: /agro/leads
 * Endpoint: GET /agro/decisores
 */
export default function AgroLeadsApproved() {
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
      const res = await httpClient.get('/agro/decisores', { params });
      setItems(res.data?.items || []);
    } catch (err: any) {
      setError(err?.userMessage || err?.message || 'Falha ao carregar decisores');
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
      title="Leads & Decisores Rurais"
      subtitle="Contatos validados por evidência documental. QSA confirma vínculo pessoa–empresa, não decisão na fazenda."
      loading={loading} error={error} onRetry={loadData}
      empty={empty} emptyMessage="Nenhum decisor encontrado com os filtros atuais."
    >
      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: 8, padding: 12, display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 260, background: 'var(--bg-base)', border: '1px solid var(--border-subtle)', borderRadius: 6, padding: '6px 12px' }}>
          <Search size={16} color="#94A3B8" />
          <input type="text" placeholder="Buscar por nome, cargo, empresa ou município..." value={search}
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
              <th style={{ padding: 12 }}>Nome / Cargo</th>
              <th style={{ padding: 12 }}>Empresa / Propriedade</th>
              <th style={{ padding: 12 }}>Município / UF</th>
              <th style={{ padding: 12 }}>Contato</th>
              <th style={{ padding: 12 }}>Fonte / Validação</th>
              <th style={{ padding: 12 }}>Score</th>
            </tr>
          </thead>
          <tbody>
            {items.map((d: any, i: number) => (
              <tr key={i} style={{ borderBottom: '1px solid #1E293B' }}>
                <td style={{ padding: 12 }}>
                  <strong style={{ color: '#F8FAFC', display: 'block' }}>{d.nome || 'Nome não disponível'}</strong>
                  <span style={{ fontSize: 11, color: '#3B82F6' }}>{d.cargo || 'Cargo não informado'}</span>
                </td>
                <td style={{ padding: 12, color: '#CBD5E1' }}>{d.empresa_vinculada || '—'}</td>
                <td style={{ padding: 12, color: '#94A3B8' }}>{d.municipio || '—'} / {d.uf || '—'}</td>
                <td style={{ padding: 12, fontSize: 11 }}>
                  {d.contato_disponivel === true
                    ? <span style={{ color: '#22C55E', display: 'flex', alignItems: 'center', gap: 4 }}><ShieldCheck size={11} /> Disponível</span>
                    : d.email || d.whatsapp
                      ? <span style={{ color: '#22C55E' }}>{d.email || d.whatsapp}</span>
                      : <span style={{ color: '#64748B' }}>Contato sob consulta</span>}
                </td>
                <td style={{ padding: 12, fontSize: 11 }}>
                  <span style={{ display: 'block', color: '#94A3B8' }}>{d.fonte || 'RFB/QSA'}</span>
                  <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: d.validado ? 'rgba(34,197,94,0.12)' : 'rgba(245,158,11,0.12)', color: d.validado ? '#22C55E' : '#F59E0B' }}>
                    {d.validado ? 'Validado' : 'Sugerido'}
                  </span>
                </td>
                <td style={{ padding: 12 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: d.score !== undefined && d.score >= 80 ? '#22C55E' : d.score !== undefined && d.score >= 50 ? '#F59E0B' : '#94A3B8' }}>
                    {d.score !== undefined ? `${Math.round(d.score)}/100` : 'N/D'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AgroPageShell>
  );
}
