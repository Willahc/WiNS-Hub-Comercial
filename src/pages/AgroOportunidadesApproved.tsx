import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Filter, Target } from 'lucide-react';
import AgroPageShell from '../components/AgroPageShell';
import { BrazilUfSelect } from '../components/territorial/BrazilUfSelect';
import { httpClient } from '../services/http/client';

/**
 * Fila Comercial & Oportunidades Calculadas
 * Rota: /agro/oportunidades
 * Endpoint: GET /agro/oportunidades/calculadas
 */
export default function AgroOportunidadesApproved() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uf, setUf] = useState(searchParams.get('uf') || '');
  const [category, setCategory] = useState(searchParams.get('categoria') || '');

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: any = { min_score: 70 };
      if (uf) params.uf = uf;
      if (category) params.categoria = category;
      const res = await httpClient.get('/agro/oportunidades/calculadas', { params });
      setItems(res.data?.oportunidades || []);
    } catch (err: any) {
      setError(err?.userMessage || err?.message || 'Falha ao carregar oportunidades');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [uf, category]);

  useEffect(() => { loadData(); }, [loadData]);
  useEffect(() => {
    const p: Record<string, string> = {};
    if (uf) p.uf = uf;
    if (category) p.categoria = category;
    setSearchParams(p, { replace: true });
  }, [uf, category, setSearchParams]);

  const empty = !loading && !error && items.length === 0;
  const categorias = ['insumos', 'armazenagem', 'máquinas', 'irrigação', 'genética', 'logística'];

  return (
    <AgroPageShell
      title="Fila Comercial & Oportunidades"
      subtitle={items.length > 0 ? `${items.length} oportunidades priorizadas pelo motor comercial` : 'Oportunidades calculadas a partir de dados reais'}
      loading={loading} error={error} onRetry={loadData}
      empty={empty} emptyMessage="Nenhuma oportunidade calculada no recorte atual. Isso pode ser um resultado legítimo — o motor comercial só gera oportunidades quando há evidência suficiente."
    >
      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: 8, padding: 12, display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
        <BrazilUfSelect value={uf} onChange={v => setUf(v)} showAllLabel="Todas as UFs" />
        <select value={category} onChange={e => setCategory(e.target.value)}
          style={{ background: 'var(--bg-base)', border: '1px solid var(--border-subtle)', color: '#F8FAFC', padding: '7px 12px', borderRadius: 6, fontSize: 12 }}>
          <option value="">Todas as categorias</option>
          {categorias.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <button onClick={loadData} style={{ background: '#22C55E', color: '#FFF', border: 'none', padding: '7px 16px', borderRadius: 6, fontWeight: 700, fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
          <Filter size={12} /> Filtrar
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 16 }}>
        {items.map((opp: any, idx: number) => (
          <div key={idx} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: 8, padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 4, background: 'rgba(59,130,246,0.15)', color: '#3B82F6' }}>{opp.categoria || 'Não categorizado'}</span>
              <span style={{ fontSize: 12, fontWeight: 800, background: 'rgba(34,197,94,0.15)', color: '#22C55E', padding: '2px 8px', borderRadius: 4 }}>Score: {opp.score || '—'}</span>
            </div>
            <strong style={{ fontSize: 15, color: '#F8FAFC' }}>{opp.titulo || 'Oportunidade sem título'}</strong>
            <div style={{ fontSize: 12, color: '#CBD5E1', background: '#0B132B', padding: 10, borderRadius: 6 }}>
              <strong>Ativo:</strong> {opp.imovel || '—'}<br />
              <strong>Empresa:</strong> {opp.empresa_alvo || '—'}{opp.cnpj ? ` (${opp.cnpj})` : ''} · {opp.municipio || '—'}/{opp.uf || '—'}
            </div>
            {opp.justificativa && <p style={{ fontSize: 12, color: '#94A3B8', margin: 0 }}><strong>Justificativa:</strong> {opp.justificativa}</p>}
            {opp.evidencia && <p style={{ fontSize: 11, color: '#64748B', margin: 0 }}><strong>Evidência:</strong> {opp.evidencia}</p>}
            {opp.produto_recomendado && (
              <div style={{ fontSize: 12, color: '#22C55E', background: 'rgba(34,197,94,0.08)', padding: 8, borderRadius: 4 }}>
                <strong>Produto:</strong> {opp.produto_recomendado}
              </div>
            )}
            <div style={{ fontSize: 11, color: '#94A3B8', borderTop: '1px solid #1E293B', paddingTop: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Decisor: <strong style={{ color: '#F8FAFC' }}>{opp.decisor_nome || 'Não identificado'}{opp.decisor_cargo ? ` (${opp.decisor_cargo})` : ''}</strong></span>
              <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: opp.status === 'ativo' ? 'rgba(34,197,94,0.12)' : 'rgba(148,163,184,0.1)', color: opp.status === 'ativo' ? '#22C55E' : '#94A3B8' }}>
                {opp.status || 'Pendente'}
              </span>
            </div>
          </div>
        ))}
      </div>
    </AgroPageShell>
  );
}
