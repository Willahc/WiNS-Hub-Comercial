import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Search, Filter } from 'lucide-react';
import AgroPageShell from '../components/AgroPageShell';
import { BrazilUfSelect } from '../components/territorial/BrazilUfSelect';
import { httpClient } from '../services/http/client';
import { AGRO_API } from './agroApiEndpoints';

function fmt(n: number): string {
  return new Intl.NumberFormat('pt-BR').format(n);
}

/**
 * Catálogo de Propriedades Rurais — tabela server-side
 * Rota: /agro/propriedades
 * Endpoint: GET /agro/imoveis (httpClient adiciona /api/v1)
 */
export default function AgroPropriedadesApproved() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [items, setItems] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(Number(searchParams.get('page')) || 1);
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [uf, setUf] = useState(searchParams.get('uf') || '');
  const [minArea, setMinArea] = useState(searchParams.get('min_area') || '');
  const [sort, setSort] = useState(searchParams.get('sort') || '');
  const pageSize = 20;

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: any = { page, page_size: pageSize };
      if (search) params.search = search;
      if (uf) params.uf = uf;
      if (minArea) params.min_area = minArea;
      if (sort) params.sort = sort;
      const res = await httpClient.get(AGRO_API.imoveis, { params });
      setItems(res.data?.items || []);
      setTotal(res.data?.meta?.total || 0);
      if ((res.data?.items || []).length === 0) setError(null); // vazio legítimo
    } catch (err: any) {
      setError(err?.userMessage || err?.message || 'Falha ao carregar catálogo de propriedades');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [page, search, uf, minArea, sort]);

  useEffect(() => { loadData(); }, [loadData]);

  // Persiste filtros na URL
  useEffect(() => {
    const p: Record<string, string> = {};
    if (uf) p.uf = uf;
    if (search) p.search = search;
    if (minArea) p.min_area = minArea;
    if (sort) p.sort = sort;
    if (page > 1) p.page = String(page);
    setSearchParams(p, { replace: true });
  }, [uf, search, minArea, sort, page, setSearchParams]);

  const handleSearch = () => { setPage(1); loadData(); };
  const empty = !loading && !error && items.length === 0;
  const totalPages = Math.ceil(total / pageSize);

  return (
    <AgroPageShell
      title="Catálogo de Propriedades Rurais"
      subtitle={`${total.toLocaleString('pt-BR')} imóveis cadastrados no SICAR/CAR — dados declaratórios`}
      loading={loading}
      error={error}
      onRetry={loadData}
      empty={empty}
      emptyMessage="Nenhum imóvel encontrado com os filtros atuais. Tente ajustar a busca ou UF."
    >
      {/* Filtros */}
      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: 8, padding: 12, display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 260, background: 'var(--bg-base)', border: '1px solid var(--border-subtle)', borderRadius: 6, padding: '6px 12px' }}>
          <Search size={16} color="#94A3B8" />
          <input type="text" placeholder="Buscar por código CAR, imóvel, proprietário ou CNPJ..." value={search}
            onChange={e => setSearch(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') handleSearch(); }}
            style={{ background: 'none', border: 'none', color: '#F8FAFC', fontSize: 13, width: '100%', outline: 'none' }} />
        </div>
        <BrazilUfSelect value={uf} onChange={v => { setUf(v); setPage(1); }} showAllLabel="Todas as UFs" />
        <select value={minArea} onChange={e => { setMinArea(e.target.value); setPage(1); }}
          style={{ background: 'var(--bg-base)', border: '1px solid var(--border-subtle)', color: '#F8FAFC', padding: '7px 12px', borderRadius: 6, fontSize: 12 }}>
          <option value="">Todas as áreas</option>
          <option value="100">&gt; 100 ha</option>
          <option value="500">&gt; 500 ha</option>
          <option value="1000">&gt; 1.000 ha</option>
          <option value="5000">&gt; 5.000 ha</option>
        </select>
        <button onClick={handleSearch} style={{ background: '#22C55E', color: '#FFF', border: 'none', padding: '7px 16px', borderRadius: 6, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>Filtrar</button>
      </div>

      {/* Tabela */}
      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: 8, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, textAlign: 'left' }}>
          <thead>
            <tr style={{ background: '#0B132B', color: '#94A3B8', borderBottom: '1px solid #1E293B' }}>
              <th style={{ padding: 12 }}>Código CAR / Imóvel</th>
              <th style={{ padding: 12 }}>Proprietário / CNPJ</th>
              <th style={{ padding: 12 }}>Município / UF</th>
              <th style={{ padding: 12 }}>Área (ha)</th>
              <th style={{ padding: 12 }}>Bioma / Uso</th>
              <th style={{ padding: 12 }}>Ação</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item: any, idx: number) => (
              <tr key={idx} style={{ borderBottom: '1px solid #1E293B' }}>
                <td style={{ padding: 12 }}>
                  <strong style={{ color: '#F8FAFC', display: 'block' }}>{item.nome_imovel || `CAR ${(item.codigo_car || item.source_id || '').slice(0, 18)}`}</strong>
                  <span style={{ fontSize: 11, fontFamily: 'monospace', color: '#64748B' }}>{item.codigo_car || item.source_id}</span>
                </td>
                <td style={{ padding: 12 }}>
                  <span style={{ color: '#CBD5E1', display: 'block' }}>{item.nome_proprietario || 'Titular não identificado na fonte disponível'}</span>
                  <span style={{ fontSize: 11, color: '#64748B' }}>{item.cpf_cnpj || 'CPF/CNPJ sob sigilo legal no SICAR'}</span>
                </td>
                <td style={{ padding: 12, color: '#CBD5E1' }}>{item.municipio} / {item.uf}</td>
                <td style={{ padding: 12, fontWeight: 700, color: '#22C55E' }}>{item.area_total_ha ? fmt(Number(item.area_total_ha)) : '—'}</td>
                <td style={{ padding: 12, color: '#94A3B8', fontSize: 11 }}>{item.bioma || '—'} / {item.uso_solo || '—'}</td>
                <td style={{ padding: 12 }}>
                  <button onClick={() => navigate(`/agro/propriedades/${encodeURIComponent(item.source_id || item.codigo_car)}`)}
                    style={{ background: '#3B82F6', color: '#FFF', border: 'none', padding: '5px 12px', borderRadius: 4, fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                    Ficha 360°
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Paginação */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8, fontSize: 12 }}>
          <button disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))}
            style={{ padding: '6px 12px', background: page <= 1 ? 'var(--border-subtle)' : '#22C55E', color: '#FFF', border: 'none', borderRadius: 4, cursor: page <= 1 ? 'default' : 'pointer', opacity: page <= 1 ? 0.5 : 1 }}>Anterior</button>
          <span style={{ color: '#94A3B8' }}>Página {page} de {totalPages}</span>
          <button disabled={page >= totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            style={{ padding: '6px 12px', background: page >= totalPages ? 'var(--border-subtle)' : '#22C55E', color: '#FFF', border: 'none', borderRadius: 4, cursor: page >= totalPages ? 'default' : 'pointer', opacity: page >= totalPages ? 0.5 : 1 }}>Próxima</button>
        </div>
      )}
    </AgroPageShell>
  );
}
