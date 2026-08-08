import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AlertTriangle, Database, Dna, Info, ShieldAlert, X } from 'lucide-react';
import AgroPageShell from '../components/AgroPageShell';
import { httpClient } from '../services/http/client';
import { AGRO_API } from './agroApiEndpoints';

type Tab = 'resumo' | 'reprodutores' | 'caracteristicas' | 'matrizes' | 'prontidao' | 'metodologia';

const fmt = (value: unknown) =>
  typeof value === 'number' && Number.isFinite(value) ? value.toLocaleString('pt-BR') : '—';

const cardStyle: React.CSSProperties = {
  background: 'var(--bg-surface, #0F172A)',
  border: '1px solid var(--border-default, #1E293B)',
  borderRadius: 10,
  padding: 14,
};

const directionLabel = (code?: string) => {
  if (code === 'HIGHER_BETTER') return 'Maior valor geralmente desejável';
  if (code === 'LOWER_BETTER') return 'Menor valor geralmente desejável';
  return 'Direção não documentada';
};

const pedigreeLabel = (q?: string) => {
  const map: Record<string, string> = {
    PEDIGREE_ID_RESOLVED: 'IDs de pai e mãe resolvidos',
    PEDIGREE_PARTIAL_ID: 'ID parcial',
    PEDIGREE_TEXT_BOTH_PARENTS: 'Pai e mãe informados em texto',
    PEDIGREE_NAME_ONLY: 'Pai/mãe informados em texto',
    PEDIGREE_TEXT_PARTIAL: 'Pedigree textual parcial',
    PEDIGREE_UNAVAILABLE: 'Pedigree não informado',
  };
  return map[q || ''] || q || '—';
};

export default function AgroGeneticaApproved() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = ((searchParams.get('tab') as Tab) || 'resumo');
  const setTab = (next: Tab) => {
    const p = new URLSearchParams(searchParams);
    p.set('tab', next);
    setSearchParams(p, { replace: true });
  };

  const [summary, setSummary] = useState<any>(null);
  const [catalog, setCatalog] = useState<any>(null);
  const [traits, setTraits] = useState<any>(null);
  const [readiness, setReadiness] = useState<any>(null);
  const [matrices, setMatrices] = useState<any>(null);
  const [methodology, setMethodology] = useState<any>(null);
  const [detail, setDetail] = useState<any>(null);

  const [errSummary, setErrSummary] = useState<string | null>(null);
  const [errCatalog, setErrCatalog] = useState<string | null>(null);
  const [errTraits, setErrTraits] = useState<string | null>(null);
  const [errReadiness, setErrReadiness] = useState<string | null>(null);
  const [errMatrices, setErrMatrices] = useState<string | null>(null);
  const [errMethod, setErrMethod] = useState<string | null>(null);
  const [errDetail, setErrDetail] = useState<string | null>(null);

  const [loadingSummary, setLoadingSummary] = useState(true);
  const [loadingCatalog, setLoadingCatalog] = useState(false);
  const [loadingTraits, setLoadingTraits] = useState(false);
  const [loadingReadiness, setLoadingReadiness] = useState(true);
  const [loadingMatrices, setLoadingMatrices] = useState(false);
  const [loadingMethod, setLoadingMethod] = useState(false);

  // catalog filters
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [q, setQ] = useState('');
  const [raca, setRaca] = useState('');
  const [hasEval, setHasEval] = useState('');
  const [pedigree, setPedigree] = useState('');
  const [hasOffer, setHasOffer] = useState('');
  const [sort, setSort] = useState('avaliacoes_count');

  // trait filters
  const [traitQ, setTraitQ] = useState('');
  const [traitDir, setTraitDir] = useState('');

  const loadSummary = useCallback(async () => {
    setLoadingSummary(true); setErrSummary(null);
    try {
      setSummary((await httpClient.get(AGRO_API.geneticaResumo)).data);
    } catch (e: any) {
      setErrSummary(e?.userMessage || e?.message || 'Resumo indisponível');
      setSummary(null);
    } finally { setLoadingSummary(false); }
  }, []);

  const loadReadiness = useCallback(async () => {
    setLoadingReadiness(true); setErrReadiness(null);
    try {
      setReadiness((await httpClient.get(AGRO_API.geneticaAcasalamentoProntidao)).data);
    } catch (e: any) {
      setErrReadiness(e?.userMessage || e?.message || 'Prontidão indisponível');
      setReadiness(null);
    } finally { setLoadingReadiness(false); }
  }, []);

  const loadCatalog = useCallback(async () => {
    setLoadingCatalog(true); setErrCatalog(null);
    try {
      const res = await httpClient.get(AGRO_API.geneticaReprodutores, {
        params: {
          page, page_size: pageSize, q: q || undefined, raca: raca || undefined,
          pedigree_status: pedigree || undefined,
          has_evaluation: hasEval === '' ? undefined : hasEval === '1',
          has_semen_offer: hasOffer === '' ? undefined : hasOffer === '1',
          sort, order: sort === 'nome' || sort === 'registro' || sort === 'raca' ? 'asc' : 'desc',
        },
      });
      setCatalog(res.data);
    } catch (e: any) {
      setErrCatalog(e?.userMessage || e?.message || 'Catálogo indisponível');
      setCatalog(null);
    } finally { setLoadingCatalog(false); }
  }, [page, pageSize, q, raca, pedigree, hasEval, hasOffer, sort]);

  const loadTraits = useCallback(async () => {
    setLoadingTraits(true); setErrTraits(null);
    try {
      setTraits((await httpClient.get(AGRO_API.geneticaCaracteristicas)).data);
    } catch (e: any) {
      setErrTraits(e?.userMessage || e?.message || 'Características indisponíveis');
      setTraits(null);
    } finally { setLoadingTraits(false); }
  }, []);

  const loadMatrices = useCallback(async () => {
    setLoadingMatrices(true); setErrMatrices(null);
    try {
      setMatrices((await httpClient.get(AGRO_API.geneticaMatrizes)).data);
    } catch (e: any) {
      setErrMatrices(e?.userMessage || e?.message || 'Matrizes indisponíveis');
      setMatrices(null);
    } finally { setLoadingMatrices(false); }
  }, []);

  const loadMethod = useCallback(async () => {
    setLoadingMethod(true); setErrMethod(null);
    try {
      setMethodology((await httpClient.get(AGRO_API.geneticaMetodologia)).data);
    } catch (e: any) {
      setErrMethod(e?.userMessage || e?.message || 'Metodologia indisponível');
      setMethodology(null);
    } finally { setLoadingMethod(false); }
  }, []);

  const loadDetail = useCallback(async (id: string) => {
    setErrDetail(null);
    try {
      setDetail((await httpClient.get(AGRO_API.geneticaReprodutor(id))).data);
    } catch (e: any) {
      setDetail(null);
      setErrDetail(e?.userMessage || e?.message || 'Detalhe indisponível');
    }
  }, []);

  useEffect(() => { loadSummary(); loadReadiness(); }, [loadSummary, loadReadiness]);
  useEffect(() => {
    if (tab === 'reprodutores' || tab === 'resumo') loadCatalog();
  }, [tab, loadCatalog]);
  useEffect(() => {
    if (tab === 'caracteristicas' || tab === 'resumo') loadTraits();
  }, [tab, loadTraits]);
  useEffect(() => {
    if (tab === 'matrizes' || tab === 'prontidao') loadMatrices();
  }, [tab, loadMatrices]);
  useEffect(() => {
    if (tab === 'metodologia') loadMethod();
  }, [tab, loadMethod]);

  const counts = summary?.counts || {};
  const matingStatus = readiness?.mating_status || (readiness?.eligible_matrices_count > 0 ? 'AVAILABLE' : 'NOT_CALCULABLE');
  const matingAvailable = matingStatus === 'AVAILABLE' && (readiness?.eligible_matrices_count || 0) > 0;
  const metrics = readiness?.metrics || {};

  const filteredTraits = useMemo(() => {
    let list = (traits?.caracteristicas || []).filter((t: any) => (t.total_avaliacoes || 0) > 0);
    if (traitQ) {
      const qq = traitQ.toLowerCase();
      list = list.filter((t: any) =>
        String(t.sigla || '').toLowerCase().includes(qq) ||
        String(t.nome || '').toLowerCase().includes(qq));
    }
    if (traitDir) list = list.filter((t: any) => t.selection_direction === traitDir);
    return list;
  }, [traits, traitQ, traitDir]);

  const shellLoading =
    (tab === 'resumo' && loadingSummary && !summary && loadingReadiness && !readiness) ||
    (tab === 'reprodutores' && loadingCatalog && !catalog) ||
    (tab === 'caracteristicas' && loadingTraits && !traits) ||
    (tab === 'matrizes' && loadingMatrices && !matrices) ||
    (tab === 'prontidao' && loadingReadiness && !readiness) ||
    (tab === 'metodologia' && loadingMethod && !methodology);

  const shellError =
    (tab === 'resumo' && errSummary && !summary) ||
    (tab === 'reprodutores' && errCatalog && !catalog) ||
    (tab === 'caracteristicas' && errTraits && !traits) ||
    (tab === 'matrizes' && errMatrices && !matrices) ||
    (tab === 'prontidao' && errReadiness && !readiness) ||
    (tab === 'metodologia' && errMethod && !methodology)
      ? (errSummary || errCatalog || errTraits || errMatrices || errReadiness || errMethod)
      : null;

  const tabs: { id: Tab; label: string }[] = [
    { id: 'resumo', label: 'Visão Geral' },
    { id: 'reprodutores', label: 'Reprodutores' },
    { id: 'caracteristicas', label: 'Características & DEPs' },
    { id: 'matrizes', label: 'Matrizes / Lotes' },
    { id: 'prontidao', label: 'Prontidão de Acasalamento' },
    { id: 'metodologia', label: 'Metodologia' },
  ];

  const totalPages = catalog?.meta?.total_pages || catalog?.meta?.pages ||
    (catalog?.meta?.total && pageSize ? Math.ceil(catalog.meta.total / pageSize) : 0);

  return (
    <AgroPageShell
      title="Genética & Pecuária"
      subtitle="Catálogo real, DEPs e prontidão de acasalamento com evidência persistida — sem recomendações artificiais"
      statusBadge="Fail-closed · PPM de DEPs de mercado"
      loading={!!shellLoading}
      error={shellError}
      onRetry={() => { loadSummary(); loadReadiness(); loadCatalog(); loadTraits(); loadMatrices(); loadMethod(); }}
    >
      <style>{`
        @media (max-width: 700px) {
          .genetica-catalogo th:nth-child(n+4), .genetica-catalogo td:nth-child(n+4) { display: none; }
          .genetica-caracteristicas th:nth-child(3), .genetica-caracteristicas td:nth-child(3),
          .genetica-caracteristicas th:nth-child(5), .genetica-caracteristicas td:nth-child(5) { display: none; }
          .genetica-matrix th:nth-child(n+4), .genetica-matrix td:nth-child(n+4) { display: none; }
        }
      `}</style>

      {/* Banner acionável */}
      <div style={{ ...cardStyle, display: 'flex', gap: 12, alignItems: 'flex-start', borderColor: matingAvailable ? '#22C55E55' : '#F59E0B55' }}>
        {matingAvailable ? <Dna size={22} color="#22C55E" /> : <ShieldAlert size={22} color="#F59E0B" />}
        <div style={{ flex: 1 }}>
          <strong style={{ color: '#F8FAFC', display: 'block' }}>
            Acasalamento: {matingAvailable ? 'AVAILABLE' : 'NOT_CALCULABLE'}
          </strong>
          <span style={{ color: '#94A3B8', fontSize: 12, display: 'block', marginTop: 4, lineHeight: 1.5 }}>
            {matingAvailable
              ? 'Há matriz elegível com identidade, raça e registros exatos de pai e mãe para triagem fail-closed.'
              : (
                <>
                  {fmt(metrics.registered_farm_females ?? counts.femeas_cadastradas)} fêmeas cadastradas em fazenda ·{' '}
                  {fmt(metrics.operational_farm_females ?? counts.femeas_operacionais)} operacionais ·{' '}
                  {fmt(readiness?.matrizes_count)} no universo de prontidão ·{' '}
                  {fmt(readiness?.eligible_matrices_count)} elegíveis.
                  {readiness?.primary_blocker ? ` Principal bloqueio: ${readiness.primary_blocker}.` : ''}
                  {' '}Nenhuma matriz tem hoje identidade com registro, raça e registros exatos de pai e mãe completos.
                </>
              )}
          </span>
          <button
            type="button"
            onClick={() => setTab('prontidao')}
            style={{ marginTop: 8, fontSize: 12, color: '#60A5FA', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
          >
            Ver diagnóstico de prontidão →
          </button>
        </div>
      </div>

      <nav style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }} aria-label="Abas Genética">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            style={{
              padding: '8px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer',
              border: tab === t.id ? '1px solid #3B82F6' : '1px solid #1E293B',
              background: tab === t.id ? 'rgba(59,130,246,0.15)' : '#0F172A', color: '#F8FAFC',
            }}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {tab === 'resumo' && (
        <section style={{ display: 'grid', gap: 14 }}>
          {errSummary && summary && <div style={cardStyle}>{errSummary}</div>}
          <div>
            <h3 style={{ margin: '0 0 8px', color: '#94A3B8', fontSize: 12 }}>Catálogo</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 8 }}>
              {[
                ['Reprodutores', counts.total_reprodutores, 'mercado.reprodutor'],
                ['Com avaliação', counts.reprodutores_com_avaliacao, 'reprodutores distintos'],
                ['Características', counts.total_caracteristicas, `${fmt(counts.caracteristicas_densas)} densas`],
                ['Raças com reprodutor', counts.racas_com_reprodutor, `${fmt(counts.total_racas_cadastradas)} no catálogo`],
              ].map(([l, v, n]) => (
                <div key={String(l)} style={cardStyle}>
                  <span style={{ color: '#94A3B8', fontSize: 11 }}>{l}</span>
                  <strong style={{ display: 'block', fontSize: 22, color: '#F8FAFC' }}>{fmt(v)}</strong>
                  <small style={{ color: '#64748B' }}>{n}</small>
                </div>
              ))}
            </div>
          </div>
          <div>
            <h3 style={{ margin: '0 0 8px', color: '#94A3B8', fontSize: 12 }}>Mercado</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 8 }}>
              <div style={cardStyle}>
                <span style={{ color: '#94A3B8', fontSize: 11 }}>Ofertas registradas</span>
                <strong style={{ display: 'block', fontSize: 22, color: '#F8FAFC' }}>{fmt(counts.ofertas_semen)}</strong>
                <small style={{ color: '#64748B' }}>registros persistidos — não “disponível para compra”</small>
              </div>
              <div style={cardStyle}>
                <span style={{ color: '#94A3B8', fontSize: 11 }}>Avaliações / DEPs</span>
                <strong style={{ display: 'block', fontSize: 22, color: '#F8FAFC' }}>{fmt(counts.total_avaliacoes)}</strong>
                <small style={{ color: '#64748B' }}>mercado.avaliacao</small>
              </div>
              <div style={cardStyle}>
                <span style={{ color: '#94A3B8', fontSize: 11 }}>Pedigree textual (pai+mãe)</span>
                <strong style={{ display: 'block', fontSize: 22, color: '#F8FAFC' }}>{fmt(counts.com_pedigree_pai_mae)}</strong>
                <small style={{ color: '#64748B' }}>declarado; não implica ID resolvido ({fmt(counts.pedigree_id_resolvido)})</small>
              </div>
            </div>
          </div>
          <div>
            <h3 style={{ margin: '0 0 8px', color: '#94A3B8', fontSize: 12 }}>Acasalamento</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 8 }}>
              <div style={cardStyle}>
                <span style={{ color: '#94A3B8', fontSize: 11 }}>Fêmeas cadastradas (fazenda)</span>
                <strong style={{ display: 'block', fontSize: 22, color: '#F8FAFC' }}>{fmt(counts.femeas_cadastradas)}</strong>
                <small style={{ color: '#64748B' }}>inclui descarte</small>
              </div>
              <div style={cardStyle}>
                <span style={{ color: '#94A3B8', fontSize: 11 }}>Fêmeas operacionais</span>
                <strong style={{ display: 'block', fontSize: 22, color: '#F8FAFC' }}>{fmt(counts.femeas_operacionais ?? metrics.operational_farm_females)}</strong>
                <small style={{ color: '#64748B' }}>status ≠ descarte</small>
              </div>
              <div style={cardStyle}>
                <span style={{ color: '#94A3B8', fontSize: 11 }}>Universo de prontidão</span>
                <strong style={{ display: 'block', fontSize: 22, color: '#F8FAFC' }}>{fmt(readiness?.matrizes_count)}</strong>
                <small style={{ color: '#64748B' }}>operacionais + doadoras</small>
              </div>
              <div style={cardStyle}>
                <span style={{ color: '#94A3B8', fontSize: 11 }}>Elegíveis</span>
                <strong style={{ display: 'block', fontSize: 22, color: '#F8FAFC' }}>{fmt(readiness?.eligible_matrices_count)}</strong>
                <small style={{ color: '#64748B' }}>{matingStatus}</small>
              </div>
            </div>
            <p style={{ fontSize: 11, color: '#64748B', marginTop: 8 }}>
              Por que “{fmt(readiness?.matrizes_count)} matrizes” e “{fmt(counts.femeas_cadastradas)} fêmeas”?{' '}
              {metrics.explanation_13_vs_8?.note ||
                'O card conta só fazenda.animal; o banner soma fêmeas operacionais + doadoras de catálogo.'}
            </p>
          </div>
        </section>
      )}

      {tab === 'reprodutores' && (
        <section style={{ display: 'grid', gap: 12 }}>
          <div style={{ ...cardStyle, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <input aria-label="Busca RGD/nome" placeholder="Busca RGD/nome" value={q} onChange={(e) => { setPage(1); setQ(e.target.value); }} />
            <input aria-label="Raça" placeholder="Raça" value={raca} onChange={(e) => { setPage(1); setRaca(e.target.value); }} />
            <select aria-label="Com avaliação" value={hasEval} onChange={(e) => { setPage(1); setHasEval(e.target.value); }}>
              <option value="">Avaliação: todas</option>
              <option value="1">Com avaliação</option>
              <option value="0">Sem avaliação</option>
            </select>
            <select aria-label="Pedigree" value={pedigree} onChange={(e) => { setPage(1); setPedigree(e.target.value); }}>
              <option value="">Pedigree: todos</option>
              <option value="declared">Textual pai+mãe</option>
              <option value="partial">Parcial</option>
              <option value="none">Sem pedigree</option>
            </select>
            <select aria-label="Oferta de sêmen" value={hasOffer} onChange={(e) => { setPage(1); setHasOffer(e.target.value); }}>
              <option value="">Oferta sêmen: todas</option>
              <option value="1">Com oferta registrada</option>
              <option value="0">Sem oferta</option>
            </select>
            <select aria-label="Ordenação" value={sort} onChange={(e) => setSort(e.target.value)}>
              <option value="avaliacoes_count">Mais avaliações</option>
              <option value="nome">Nome</option>
              <option value="registro">RGD</option>
              <option value="raca">Raça</option>
            </select>
            <select aria-label="Página size" value={pageSize} onChange={(e) => { setPage(1); setPageSize(Number(e.target.value)); }}>
              {[25, 50, 100].map((n) => <option key={n} value={n}>{n}/página</option>)}
            </select>
          </div>
          {errCatalog && <div style={cardStyle}>{errCatalog}</div>}
          <div style={{ ...cardStyle, overflowX: 'auto' }}>
            <h3 style={{ margin: '0 0 12px', color: '#F8FAFC', fontSize: 14 }}>
              <Database size={15} style={{ verticalAlign: 'middle', marginRight: 6 }} />
              Catálogo real de reprodutores
            </h3>
            <table className="genetica-catalogo" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, minWidth: 760 }}>
              <thead>
                <tr style={{ color: '#94A3B8', borderBottom: '1px solid #334155' }}>
                  <th style={{ padding: 9, textAlign: 'left' }}>RGD / Nome</th>
                  <th>Raça</th><th>Pedigree</th><th>DEPs</th><th>Ofertas</th><th>Origem</th><th>Localidade</th>
                </tr>
              </thead>
              <tbody>
                {(catalog?.items || []).map((item: any) => (
                  <tr key={item.id} style={{ borderBottom: '1px solid #1E293B', color: '#CBD5E1' }}>
                    <td style={{ padding: 9 }}>
                      <button type="button" onClick={() => loadDetail(String(item.id))}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', padding: 0 }}>
                        <strong style={{ color: '#F8FAFC', display: 'block' }}>{item.nome || '—'}</strong>
                        <span style={{ color: '#EC4899' }}>{item.registro || '—'}</span>
                      </button>
                    </td>
                    <td style={{ textAlign: 'center' }}>{item.raca_nome || '—'}</td>
                    <td style={{ textAlign: 'center', fontSize: 11 }} title={item.pedigree_quality}>{pedigreeLabel(item.pedigree_quality)}</td>
                    <td style={{ textAlign: 'center' }}>{fmt(item.avaliacoes_count)}</td>
                    <td style={{ textAlign: 'center' }}>{fmt(item.semen_offers_count)}</td>
                    <td style={{ textAlign: 'center' }}>{item.fonte_programa || '—'}</td>
                    <td style={{ textAlign: 'center' }}>{[item.municipio, item.uf].filter(Boolean).join(' / ') || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 10, flexWrap: 'wrap' }}>
              <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Anterior</button>
              <span style={{ fontSize: 12, color: '#94A3B8' }}>
                Página {page}{totalPages ? ` de ${totalPages}` : ''} · {fmt(catalog?.meta?.total)} registros
              </span>
              <button type="button" disabled={totalPages ? page >= totalPages : (catalog?.items || []).length < pageSize} onClick={() => setPage((p) => p + 1)}>Próxima</button>
            </div>
          </div>
        </section>
      )}

      {tab === 'caracteristicas' && (
        <section style={{ display: 'grid', gap: 12 }}>
          <div style={{ ...cardStyle, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <input aria-label="Busca característica" placeholder="Busca sigla/nome" value={traitQ} onChange={(e) => setTraitQ(e.target.value)} />
            <select aria-label="Direção" value={traitDir} onChange={(e) => setTraitDir(e.target.value)}>
              <option value="">Direção: todas</option>
              <option value="HIGHER_BETTER">Maior geralmente desejável</option>
              <option value="LOWER_BETTER">Menor geralmente desejável</option>
              <option value="UNKNOWN">Não documentada</option>
            </select>
          </div>
          {errTraits && <div style={cardStyle}>{errTraits}</div>}
          <div style={{ ...cardStyle, fontSize: 12, color: '#94A3B8' }}>
            <Info size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} />
            {traits?.median_definition || 'Mediana dos valores de avaliação no universo persistido.'}
            {' '}A direção documentada depende do objetivo de seleção e não é universalmente melhor.
          </div>
          <div style={{ ...cardStyle, overflowX: 'auto' }}>
            <table className="genetica-caracteristicas" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, minWidth: 700 }}>
              <thead>
                <tr style={{ color: '#94A3B8', borderBottom: '1px solid #334155' }}>
                  <th style={{ padding: 9, textAlign: 'left' }}>Característica</th>
                  <th>Avaliações</th><th>Reprodutores</th><th>Mediana</th><th>Unidade</th><th>Direção documentada</th><th>Cobertura</th>
                </tr>
              </thead>
              <tbody>
                {filteredTraits.map((item: any) => (
                  <tr key={item.id} style={{ borderBottom: '1px solid #1E293B', color: '#CBD5E1' }}>
                    <td style={{ padding: 9 }}>
                      <strong style={{ color: '#F8FAFC' }}>{item.sigla}</strong> — {item.nome}
                      {item.descricao ? <div style={{ fontSize: 11, color: '#64748B' }}>{item.descricao}</div> : null}
                    </td>
                    <td style={{ textAlign: 'center' }}>{fmt(item.total_avaliacoes)}</td>
                    <td style={{ textAlign: 'center' }}>{fmt(item.total_reprodutores)}</td>
                    <td style={{ textAlign: 'center' }}>{item.mediana_valor ?? '—'}</td>
                    <td style={{ textAlign: 'center' }}>{item.unidade || '—'}</td>
                    <td style={{ textAlign: 'center', fontSize: 11 }} title={item.selection_direction}>
                      {directionLabel(item.selection_direction)}
                      <div style={{ color: '#64748B' }}>{item.selection_direction}</div>
                    </td>
                    <td style={{ textAlign: 'center', fontSize: 11 }}>
                      {item.total_avaliacoes >= 10000 ? 'Densa' : 'Parcial'}
                      {item.categoria ? ` · ${item.categoria}` : ''}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {tab === 'matrizes' && (
        <section style={{ display: 'grid', gap: 12 }}>
          <div style={cardStyle}>
            <p style={{ margin: 0, fontSize: 13, color: '#CBD5E1' }}>
              Matrizes do universo de prontidão (fêmeas operacionais + doadoras de catálogo).
              Lotes operacionais ainda não estão integrados — não há inventário de lotes nesta base.
            </p>
          </div>
          {errMatrices && <div style={cardStyle}>{errMatrices}</div>}
          <div style={{ ...cardStyle, overflowX: 'auto' }}>
            <table className="genetica-matrix" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, minWidth: 800 }}>
              <thead>
                <tr style={{ color: '#94A3B8', borderBottom: '1px solid #334155' }}>
                  {['Identificação', 'Tipo', 'Raça', 'Status', 'Pedigree textual', 'Pedigree resolvido', 'Perfil genético', 'Elegibilidade', 'Motivos'].map((h) => (
                    <th key={h} style={{ padding: 8, textAlign: 'left' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(matrices?.items || readiness?.matrizes || []).map((m: any) => (
                  <tr key={m.id} style={{ borderBottom: '1px solid #1E293B', color: '#CBD5E1' }}>
                    <td style={{ padding: 8 }}>
                      <strong style={{ color: '#F8FAFC' }}>{m.nome || '—'}</strong>
                      <div style={{ fontSize: 11, color: '#64748B' }}>{m.registro || m.brinco || 'sem registro'}</div>
                    </td>
                    <td style={{ fontSize: 11 }}>{m.tipo}</td>
                    <td>{m.raca || '—'}</td>
                    <td>{m.status || '—'}</td>
                    <td style={{ fontSize: 11 }}>{m.pedigree_text_status || '—'}</td>
                    <td style={{ fontSize: 11 }}>{m.pedigree_resolved_status || '—'}</td>
                    <td style={{ fontSize: 11 }}>{m.genetic_profile_status || 'UNAVAILABLE'}</td>
                    <td style={{ color: m.mating_eligible ? '#22C55E' : '#F59E0B' }}>
                      {m.mating_eligible ? 'Elegível' : 'Bloqueada'}
                    </td>
                    <td style={{ fontSize: 10 }}>{(m.blockers || m.ineligible_reasons || []).join(', ') || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {tab === 'prontidao' && (
        <section style={{ display: 'grid', gap: 12 }}>
          {errReadiness && <div style={cardStyle}>{errReadiness}</div>}
          <div style={cardStyle}>
            <h3 style={{ marginTop: 0, color: '#F8FAFC' }}>
              Status: {matingStatus} · Elegíveis: {fmt(readiness?.eligible_matrices_count)}
            </h3>
            <p style={{ fontSize: 12, color: '#94A3B8' }}>
              {readiness?.next_requirement || 'Sem requisitos adicionais informados.'}
            </p>
            <p style={{ fontSize: 11, color: '#64748B' }}>
              MATING_STATUS_CHANGED = {String(readiness?.MATING_STATUS_CHANGED ?? false)}
            </p>
          </div>

          <div style={cardStyle}>
            <h3 style={{ marginTop: 0, fontSize: 14, color: '#F8FAFC' }}>Funil de prontidão</h3>
            <ol style={{ margin: 0, paddingLeft: 18, color: '#CBD5E1', fontSize: 13 }}>
              {(readiness?.funnel || []).map((s: any) => (
                <li key={s.stage} style={{ marginBottom: 8 }}>
                  <strong>{s.stage}</strong>: {fmt(s.count)} · {s.status}
                  <div style={{ fontSize: 11, color: '#64748B' }}>{s.definition}</div>
                  {(s.limitations || []).map((l: string) => (
                    <div key={l} style={{ fontSize: 11, color: '#F59E0B' }}>{l}</div>
                  ))}
                </li>
              ))}
            </ol>
          </div>

          <div style={cardStyle}>
            <h3 style={{ marginTop: 0, fontSize: 14, color: '#F8FAFC' }}>Bloqueios agregados</h3>
            {(readiness?.blocker_summary || []).length === 0 ? (
              <p style={{ color: '#94A3B8', fontSize: 13 }}>Nenhum bloqueio agregado (ou universo vazio).</p>
            ) : (
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: '#CBD5E1' }}>
                {(readiness?.blocker_summary || []).map((b: any) => (
                  <li key={b.reason}><code>{b.reason}</code>: {fmt(b.count)} — {b.definition}</li>
                ))}
              </ul>
            )}
          </div>

          <div style={cardStyle}>
            <h3 style={{ marginTop: 0, fontSize: 14, color: '#F8FAFC' }}>Contratos de capacidade</h3>
            <ul style={{ fontSize: 12, color: '#94A3B8' }}>
              <li>Consanguinidade formal: {readiness?.contracts?.inbreeding_status || readiness?.contracts?.inbreeding_coefficient_status} ({readiness?.contracts?.inbreeding_reason})</li>
              <li>Parentescos imediatos (quando elegível): {readiness?.contracts?.kinship_check_status}</li>
              <li>Valor econômico: {readiness?.contracts?.economic_value_status}</li>
              <li>Bezerro previsto: {readiness?.contracts?.predicted_calf_status}</li>
              <li>Lotes: {readiness?.contracts?.lot_management_status || 'PLANNED'}</li>
            </ul>
          </div>

          {readiness?.future_input_schema && (
            <div style={cardStyle}>
              <h3 style={{ marginTop: 0, fontSize: 14, color: '#F8FAFC' }}>Schema futuro de entrada (documental)</h3>
              <p style={{ fontSize: 12, color: '#94A3B8' }}>{readiness.future_input_schema.purpose}</p>
              <p style={{ fontSize: 12, color: '#CBD5E1' }}><b>Obrigatórios:</b></p>
              <ul style={{ fontSize: 12, color: '#94A3B8' }}>
                {(readiness.future_input_schema.required_fields || []).map((f: any) => (
                  <li key={f.field}><code>{f.field}</code> — {f.description}</li>
                ))}
              </ul>
              <p style={{ fontSize: 11, color: '#64748B' }}>
                Sem DDL, sem upload e sem persistência nesta release.
              </p>
            </div>
          )}
        </section>
      )}

      {tab === 'metodologia' && (
        <section style={{ display: 'grid', gap: 12 }}>
          {errMethod && <div style={cardStyle}>{errMethod}</div>}
          {methodology && (
            <>
              <div style={cardStyle}>
                <h3 style={{ marginTop: 0 }}>Definições</h3>
                <ul style={{ fontSize: 12, color: '#CBD5E1' }}>
                  {Object.entries(methodology.definitions || {}).map(([k, v]) => (
                    <li key={k} style={{ marginBottom: 6 }}><b>{k}:</b> {String(v)}</li>
                  ))}
                </ul>
              </div>
              <div style={cardStyle}>
                <h3 style={{ marginTop: 0 }}>Métricas 13 vs 8</h3>
                <ul style={{ fontSize: 12, color: '#94A3B8' }}>
                  {Object.entries(methodology.metric_explanations || {}).map(([k, v]) => (
                    <li key={k}><b>{k}:</b> {String(v)}</li>
                  ))}
                </ul>
              </div>
              <div style={cardStyle}>
                <h3 style={{ marginTop: 0 }}>Limitações</h3>
                <ul style={{ fontSize: 12, color: '#F59E0B' }}>
                  {(methodology.limitations || []).map((l: string) => <li key={l}>{l}</li>)}
                </ul>
              </div>
            </>
          )}
        </section>
      )}

      {/* Drawer detalhe reprodutor */}
      {(detail || errDetail) && (
        <aside style={{ ...cardStyle, borderColor: '#3B82F655', position: 'relative' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
            <h3 style={{ margin: 0 }}>{detail?.nome || 'Detalhe do reprodutor'}</h3>
            <button type="button" aria-label="Fechar" onClick={() => { setDetail(null); setErrDetail(null); }}>
              <X size={16} />
            </button>
          </div>
          {errDetail && <p>{errDetail}</p>}
          {detail && (
            <div style={{ fontSize: 13, color: '#CBD5E1', display: 'grid', gap: 6, marginTop: 10 }}>
              <p><b>RGD:</b> {detail.registro || '—'} · <b>Raça:</b> {detail.raca_nome || '—'} · <b>Origem:</b> {detail.fonte_programa || '—'}</p>
              <p><b>Localidade:</b> {[detail.municipio, detail.uf].filter(Boolean).join(' / ') || '—'}</p>
              <p><b>Pedigree:</b> {pedigreeLabel(detail.pedigree_quality)} · Pai: {detail.pai_nome || detail.pai_registro || '—'} · Mãe: {detail.mae_nome || detail.mae_registro || '—'}</p>
              <p><b>Oferta de sêmen registrada:</b> {detail.oferta_nome_comercial || '—'}
                {detail.preco_dose_brl != null ? ` · preço cadastrado R$ ${fmt(detail.preco_dose_brl)}` : ''}
                {detail.central_nome ? ` · ${detail.central_nome}` : ''}
                <span style={{ color: '#64748B' }}> (registro persistido, não disponibilidade atual garantida)</span>
              </p>
              <p><b>Avaliações:</b> {fmt(detail.total_avaliacoes)}</p>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', fontSize: 11, borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ color: '#94A3B8' }}>
                      <th style={{ textAlign: 'left', padding: 4 }}>Característica</th>
                      <th>DEP</th><th>Unidade</th><th>Direção</th><th>Acurácia</th><th>Percentil</th><th>Programa</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(detail.avaliacoes || []).slice(0, 40).map((a: any) => (
                      <tr key={a.avaliacao_id || `${a.sigla}-${a.valor}`} style={{ borderTop: '1px solid #1E293B' }}>
                        <td style={{ padding: 4 }}>{a.sigla} — {a.caracteristica_nome}</td>
                        <td style={{ textAlign: 'center' }}>{a.valor ?? '—'}</td>
                        <td style={{ textAlign: 'center' }}>{a.unidade || '—'}</td>
                        <td style={{ textAlign: 'center' }} title={a.selection_direction}>{directionLabel(a.selection_direction)}</td>
                        <td style={{ textAlign: 'center' }}>{a.acuracia ?? '—'}</td>
                        <td style={{ textAlign: 'center' }}>{a.percentil ?? '—'}</td>
                        <td style={{ textAlign: 'center' }}>{a.programa_nome || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Link to={`/agro/genetica/reprodutores/${encodeURIComponent(detail.id)}`} style={{ fontSize: 12, color: '#60A5FA' }}>
                Abrir rota de detalhe
              </Link>
            </div>
          )}
        </aside>
      )}

      <div style={{ ...cardStyle, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
        <AlertTriangle size={18} color="#F59E0B" style={{ flexShrink: 0 }} />
        <small style={{ color: '#94A3B8' }}>
          Pai e mãe textuais são “pedigree imediato declarado”, não árvore genealógica resolvida.
          A página não calcula coeficiente formal de consanguinidade, prenhez, ganho econômico, ROI ou fenótipo previsto.
          Null não é convertido em zero. Atualização mais recente informada pelo banco: {summary?.updated_at || 'não disponível'}.
        </small>
      </div>
    </AgroPageShell>
  );
}
