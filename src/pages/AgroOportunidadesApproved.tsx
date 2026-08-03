import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ChevronDown, Copy, Filter, Lock, MapPin, Search, SlidersHorizontal } from 'lucide-react';
import AgroPageShell from '../components/AgroPageShell';
import { BrazilUfSelect } from '../components/territorial/BrazilUfSelect';
import { httpClient } from '../services/http/client';
import { AGRO_API } from './agroApiEndpoints';
import { isRetryableError } from './agroOportunidadesContract';

type Tab = 'sinais' | 'candidatas' | 'validacao' | 'validadas' | 'regras';
type RadarListStage = 'SIGNAL' | 'CANDIDATE';

const LIST_STAGE_BY_TAB = {
  sinais: 'SIGNAL',
  candidatas: 'CANDIDATE',
} as const satisfies Partial<Record<Tab, RadarListStage>>;

type RadarListRequestParams = {
  stage: RadarListStage;
  page: number;
  page_size: number;
  sort?: string;
  order?: string;
  q?: string;
  uf?: string;
  municipio?: string;
  classification?: string;
  priority?: string;
};

const TABS: Array<[Tab, string]> = [
  ['sinais', 'Sinais'],
  ['candidatas', 'Candidatas'],
  ['validacao', 'Em validação'],
  ['validadas', 'Validadas'],
  ['regras', 'Regras do motor'],
];

const CLASS_LABEL: Record<string, string> = {
  DESERTO_VET: 'Deserto Vet',
  BAIXA_COBERTURA: 'Baixa Cobertura',
  NORMAL: 'Normal',
};

type Filters = { q: string; uf: string; municipio: string; classification: string; priority: string };
const defaults: Filters = { q: '', uf: '', municipio: '', classification: '', priority: '' };

const fmt = (v: any): string =>
  typeof v === 'number' && Number.isFinite(v) ? v.toLocaleString('pt-BR') : v === null || v === undefined ? 'Não disponível' : String(v);

const nfmt = (v: any): string =>
  typeof v === 'number' && Number.isFinite(v) ? v.toLocaleString('pt-BR') : '—';

function fromUrl(p: URLSearchParams): Filters {
  const f = { ...defaults };
  Object.keys(f).forEach((k) => ((f as any)[k] = p.get(k) || ''));
  return f;
}

export default function AgroOportunidadesApproved() {
  const [sp, setSp] = useSearchParams();
  const initial = useMemo(() => fromUrl(sp), []);
  const [tab, setTab] = useState<Tab>((sp.get('tab') as Tab) || 'sinais');
  const [form, setForm] = useState<Filters>(initial);
  const [filters, setFilters] = useState<Filters>(initial);
  const [page, setPage] = useState(Number(sp.get('page')) || 1);
  const [pageSize, setPageSize] = useState(Number(sp.get('page_size')) || 25);
  const [sort, setSort] = useState(sp.get('sort') || 'priority');
  const [order, setOrder] = useState(sp.get('order') || 'desc');

  const [items, setItems] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(0);
  const [universe, setUniverse] = useState<any>({});
  const [funnel, setFunnel] = useState<any>({});
  const [rules, setRules] = useState<any[]>([]);
  const [rulesSummary, setRulesSummary] = useState<any>({});
  const [stages, setStages] = useState<any[]>([]);
  const [engineStatus, setEngineStatus] = useState<string>('');
  const [sources, setSources] = useState<string[]>([]);
  const [limitations, setLimitations] = useState<string[]>([]);
  const [status, setStatus] = useState<string>('ok');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [metaError, setMetaError] = useState<string | null>(null);
  const [stageError, setStageError] = useState<string | null>(null);
  const [rulesError, setRulesError] = useState<string | null>(null);
  const [stageLoading, setStageLoading] = useState(false);
  const [rulesLoading, setRulesLoading] = useState(false);
  const [ruleQuery, setRuleQuery] = useState('');
  const [ruleStatus, setRuleStatus] = useState('');
  const [ruleStage, setRuleStage] = useState('');
  const [ruleEntity, setRuleEntity] = useState('');
  const [expandedRule, setExpandedRule] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);

  const loadList = useCallback(async () => {
    abort.current?.abort();
    const c = new AbortController();
    abort.current = c;
    const listStage = LIST_STAGE_BY_TAB[tab as keyof typeof LIST_STAGE_BY_TAB];
    if (!listStage) {
      setItems([]);
      setTotal(0);
      setPages(0);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const params: RadarListRequestParams = { stage: listStage, page, page_size: pageSize };
      if (tab === 'sinais') {
        params.sort = sort;
        params.order = order;
        (Object.entries(filters) as Array<[keyof Filters, string]>).forEach(([key, value]) => {
          if (value) params[key] = value;
        });
      }
      const r = await httpClient.get(AGRO_API.oportunidades, { params, signal: c.signal });
      setItems(r.data?.items || []);
      setTotal(r.data?.filtered_total || 0);
      setPages(r.data?.total_pages || 0);
      setUniverse(r.data?.universe || {});
      setEngineStatus(r.data?.engine_status || '');
      setSources(r.data?.sources || []);
      setLimitations(r.data?.limitations || []);
      setStatus(r.data?.status || 'ok');
    } catch (e: any) {
      if (e?.name === 'CanceledError' || e?.name === 'AbortError') return;
      setError(tab === 'sinais' ? 'Não foi possível carregar o Radar de Sinais Agro.' : 'Não foi possível carregar o diagnóstico de candidatas.');
      setItems([]);
    } finally {
      if (!c.signal.aborted) setLoading(false);
    }
  }, [tab, page, pageSize, sort, order, filters]);

  const loadMeta = useCallback(async () => {
    setMetaError(null);
    try {
      const [st, fu] = await Promise.all([
        httpClient.get(AGRO_API.oportunidadesStatus),
        httpClient.get(AGRO_API.oportunidadesFunil),
      ]);
      if (st.data?.engine_status) setEngineStatus(st.data.engine_status);
      setFunnel(fu.data || {});
    } catch {
      setMetaError('Não foi possível atualizar o status e o funil. Os dados da aba permanecem independentes.');
    }
  }, []);

  const loadStages = useCallback(async () => {
    setStageLoading(true);
    setStageError(null);
    try {
      const response = await httpClient.get(AGRO_API.oportunidadesEstagios);
      setStages(response.data?.stages || []);
      if (response.data?.engine_status) setEngineStatus(response.data.engine_status);
    } catch {
      setStageError('Não foi possível carregar a prontidão dos estágios.');
    } finally {
      setStageLoading(false);
    }
  }, []);

  const loadRules = useCallback(async () => {
    setRulesLoading(true);
    setRulesError(null);
    try {
      const response = await httpClient.get(AGRO_API.oportunidadesRegras);
      setRules(response.data?.rules || []);
      setRulesSummary(response.data?.summary || {});
    } catch {
      setRulesError('Não foi possível carregar o catálogo de regras.');
    } finally {
      setRulesLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMeta();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadList();
    return () => abort.current?.abort();
  }, [loadList]);

  useEffect(() => {
    if (tab !== 'sinais') loadStages();
    if (tab === 'regras') loadRules();
  }, [tab, loadRules, loadStages]);

  useEffect(() => {
    const p: Record<string, string> = { tab };
    Object.entries(filters).forEach(([k, v]) => v && (p[k] = v));
    page > 1 && (p.page = String(page));
    pageSize !== 25 && (p.page_size = String(pageSize));
    sort !== 'priority' && (p.sort = sort);
    order !== 'desc' && (p.order = order);
    setSp(p, { replace: true });
  }, [tab, filters, page, pageSize, sort, order, setSp]);

  const set = (k: keyof Filters, v: string) => setForm((x) => ({ ...x, [k]: v }));
  const apply = () => {
    setFilters(form);
    setPage(1);
  };
  const clear = () => {
    setForm(defaults);
    setFilters(defaults);
    setPage(1);
  };
  const changeTab = (x: Tab) => {
    abort.current?.abort();
    setTab(x);
    setPage(1);
  };
  const active = Object.values(filters).filter(Boolean).length;

  const copyRecorte = async (s: any) => {
    const text = `${s.signal_id} · ${s.municipio}/${s.uf} · ${s.classification} · ${s.priority}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(s.signal_id);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      /* clipboard indisponível */
    }
  };

  const funnelStages = [
    ['Municípios avaliados', funnel.municipalities_evaluated],
    ['Sinais identificados', funnel.signals_total],
    ['Candidatas', funnel.candidates_total],
    ['Em validação', funnel.validation_total],
    ['Validadas', funnel.validated_total],
  ] as const;

  const funnelReasons = [
    ['Cobertura normal', funnel.discarded_or_not_promoted?.normal_coverage],
    ['Entidade não identificada', funnel.discarded_or_not_promoted?.missing_entity],
    ['Contato indisponível', funnel.discarded_or_not_promoted?.missing_contact],
    ['Decisor não comprovado', funnel.discarded_or_not_promoted?.missing_decision_evidence],
    ['Sinais sem regra de promoção', funnel.discarded_or_not_promoted?.promotion_unavailable],
  ] as const;

  const kpis = [
    ['Municípios avaliados', funnel.municipalities_evaluated],
    ['Sinais identificados', funnel.signals_total],
    ['Deserto Veterinário', funnel.deserto_vet_signals],
    ['Baixa cobertura', funnel.low_coverage_signals],
    ['Candidatas', funnel.candidates_total],
    ['Em validação', funnel.validation_total],
    ['Validadas', funnel.validated_total],
  ] as const;

  const errorMessage = error ? (typeof error === 'string' ? error : 'Não foi possível carregar o Radar de Sinais Agro.') : null;
  const retryable = isRetryableError(error);
  const partial = status === 'partial';
  const currentStage = stages.find((stage) => stage.stage === ({ candidatas: 'CANDIDATE', validacao: 'VALIDATION', validadas: 'VALIDATED' } as Record<string, string>)[tab]);
  const filteredRules = rules.filter((rule) => {
    const text = `${rule.name || ''} ${rule.rule_id || ''} ${rule.description || ''}`.toLowerCase();
    return (!ruleQuery || text.includes(ruleQuery.toLowerCase())) &&
      (!ruleStatus || rule.status === ruleStatus) && (!ruleStage || rule.produces_stage === ruleStage) &&
      (!ruleEntity || rule.entity_type === ruleEntity);
  });
  const groupedRules = ['ACTIVE', 'UNAVAILABLE', 'PLANNED'].map((group) => ({ group, rules: filteredRules.filter((rule) => rule.status === group) }));

  const emptyMessage: Record<Tab, string> = {
    sinais: 'Nenhum sinal territorial identificado com os filtros atuais.',
    candidatas: 'Nenhuma candidata atende aos critérios documentais disponíveis.',
    validacao: 'A validação humana ainda não está disponível nesta versão.',
    validadas: 'Nenhuma oportunidade comercial foi validada.',
    regras: 'Nenhuma regra catalogada pelo motor.',
  };

  const stageExplanation: Record<Tab, string> = {
    sinais: 'Sinais territoriais reais calculados a partir da classificação municipal de cobertura técnica veterinária.',
    candidatas: 'Propriedades, empresas e canais com evidência documental completa para promoção a candidata.',
    validacao: 'Candidatas aguardando validação humana — recurso ainda não disponível nesta versão.',
    validadas: 'Oportunidades comerciais com validação humana e entidade acionável — nenhuma nesta versão.',
    regras: 'Regras do motor: o que gera sinais, o que produz candidatas e o que permanece planejado ou indisponível.',
  };

  return (
    <AgroPageShell
      title="Sinais e Oportunidades Agro"
      subtitle="Radar baseado em evidências territoriais reais: classificação municipal de cobertura técnica veterinária, funil de promoção e regras explícitas do motor. Nenhum dado ilustrativo é exibido."
      error={errorMessage}
      errorRetryable={retryable}
      onRetry={loadList}
      empty={!loading && !error && tab === 'sinais' && items.length === 0}
      emptyMessage={emptyMessage[tab]}
      statusBadge={engineStatus === 'ACTIVE' ? 'Motor ativo' : 'Motor em validação'}
    >
      {/* Loading */}
      {loading && (
        <div className="radar-loading">
          <div className="radar-spinner" />
          <p>Analisando sinais territoriais reais…</p>
        </div>
      )}
      {!loading && (<>
      {metaError && <div className="radar-partial">{metaError} <button className="radar-btn" onClick={loadMeta}>Tentar novamente</button></div>}
      {/* KPIs */}
      <section className="holding-kpis radar-kpis">
        {kpis.map(([l, v]) => (
          <div key={l}>
            <small>{l}</small>
            <strong>{fmt(v)}</strong>
          </div>
        ))}
      </section>

      {/* Funil visual */}
      <section className="radar-funnel">
        <div className="radar-funnel-head">
          <strong>Funil de sinais</strong>
          <span>{fmt(funnel.municipalities_evaluated)} municípios avaliados · {fmt(funnel.signals_total)} sinais</span>
        </div>
        <div className="radar-funnel-bars">
          {funnelStages.map(([label, value], idx) => {
            const base = Number(funnel.municipalities_evaluated) || 0;
            const numeric = typeof value === 'number' && Number.isFinite(value) ? value : null;
            const width = numeric === null || numeric === 0 || base === 0 ? 0 : idx === 0 ? 100 : Math.round((numeric / base) * 100);
            return (
              <div key={label} className="radar-funnel-bar">
                <span className="radar-funnel-label">{label}</span>
                <div className="radar-funnel-track">
                  {numeric !== null && <div className="radar-funnel-fill" data-value={numeric} style={{ width: `${width}%` }} />}
                </div>
                <span className="radar-funnel-value">{numeric === null ? 'Não calculável' : fmt(numeric)}</span>
              </div>
            );
          })}
        </div>
        <div className="radar-funnel-reasons">
          <small>Motivos de não promoção</small>
          <div>
            {funnelReasons.map(([label, value]) => (
              <span key={label}>
                {label}: {value === null || value === undefined ? 'Não calculável' : fmt(value)}
              </span>
            ))}
          </div>
        </div>
        {partial && <div className="radar-partial">Algumas métricas ou fontes complementares não estão disponíveis.</div>}
      </section>

      {/* Abas */}
      <nav className="holding-tabs radar-tabs" aria-label="Etapas do Radar" role="tablist">
        {TABS.map(([v, l], index) => (
          <button
            key={v} id={`radar-tab-${v}`} role="tab" aria-controls={`radar-panel-${v}`}
            aria-selected={tab === v} aria-current={tab === v ? 'page' : undefined}
            tabIndex={tab === v ? 0 : -1} className={tab === v ? 'active' : ''}
            onClick={() => changeTab(v)}
            onKeyDown={(event) => {
              if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
              event.preventDefault();
              const delta = event.key === 'ArrowRight' ? 1 : -1;
              const next = TABS[(index + delta + TABS.length) % TABS.length][0];
              changeTab(next);
              requestAnimationFrame(() => document.getElementById(`radar-tab-${next}`)?.focus());
            }}
          >
            {l}
          </button>
        ))}
      </nav>

      {/* Filtros (apenas Sinais) */}
      {tab === 'sinais' && (
        <section className="holding-filters radar-filters">
          <div className="holding-filter-grid radar-filter-grid">
            <label>
              <Search size={15} />
              <input aria-label="Busca municipal" placeholder="Busca municipal" value={form.q} onChange={(e) => set('q', e.target.value)} />
            </label>
            <BrazilUfSelect value={form.uf} onChange={(v) => set('uf', v)} showAllLabel="Todas as UFs" />
            <input aria-label="Município" placeholder="Município" value={form.municipio} onChange={(e) => set('municipio', e.target.value)} />
            <select aria-label="Classificação" value={form.classification} onChange={(e) => set('classification', e.target.value)}>
              <option value="">Toda classificação</option>
              {['DESERTO_VET', 'BAIXA_COBERTURA'].map((v) => (
                <option key={v} value={v}>{CLASS_LABEL[v] || v}</option>
              ))}
            </select>
            <select aria-label="Prioridade" value={form.priority} onChange={(e) => set('priority', e.target.value)}>
              <option value="">Toda prioridade</option>
              <option value="ALTA">Prioridade Alta</option>
              <option value="MEDIA">Prioridade Média</option>
            </select>
          </div>
          <div className="holding-actions radar-actions">
            <button onClick={clear}>Limpar</button>
            <button className="primary" onClick={apply}>
              <Filter size={14} /> Aplicar filtros
            </button>
            <span>{active} filtros ativos</span>
          </div>
        </section>
      )}

      {/* Ordenação e paginação por página de Sinais */}
      {tab === 'sinais' && items.length > 0 && (
        <div className="radar-list-toolbar">
          <div className="radar-list-meta">
            <span>
              Exibindo {total ? (page - 1) * pageSize + 1 : 0}–{Math.min(page * pageSize, total)} de {fmt(total)} sinais
            </span>
            {universe.description && <span>· {universe.description}</span>}
            <span>· {fmt(universe.total_evaluated)} municípios avaliados</span>
            {sources.length > 0 && <span>· Fonte: {sources.join(' · ')}</span>}
          </div>
          <div className="radar-sort">
            <select aria-label="Ordenar por" value={sort} onChange={(e) => { setSort(e.target.value); setPage(1); }}>
              <option value="priority">Prioridade</option>
              <option value="municipio">Município</option>
              <option value="uf">UF</option>
              <option value="rebanho_bovino">Rebanho bovino</option>
              <option value="bovinos_por_tecnico">Bovinos por técnico</option>
              <option value="calculated_at">Calculado em</option>
            </select>
            <select aria-label="Ordem" value={order} onChange={(e) => { setOrder(e.target.value); setPage(1); }}>
              <option value="desc">Decrescente</option>
              <option value="asc">Crescente</option>
            </select>
          </div>
        </div>
      )}

      {/* Cards de Sinais */}
      {tab === 'sinais' && !loading && !error && items.length > 0 && (
        <div className="radar-cards">
          {items.map((s: any) => (
            <article key={s.signal_id} className={`radar-card ${s.classification === 'DESERTO_VET' ? 'deserto' : 'baixa'}`}>
              <div className="radar-card-top">
                <span className="radar-chip classification">{CLASS_LABEL[s.classification] || s.classification}</span>
                <span className="radar-chip priority">{s.priority === 'ALTA' ? 'Prioridade Alta' : 'Prioridade Média'}</span>
              </div>
              <h3>
                {s.municipio} <small>· {s.uf}</small>
              </h3>
              <p className="radar-evidence">{s.evidence_summary}</p>
              <div className="radar-metrics">
                <span><strong>{nfmt(s.metrics?.rebanho_bovino)}</strong> cabeças</span>
                <span><strong>{nfmt(s.metrics?.tecnicos_regionais)}</strong> técnicos em {s.metrics?.raio_km ?? 75} km</span>
                <span><strong>{nfmt(s.metrics?.bovinos_por_tecnico)}</strong> bov./técnico regional</span>
              </div>
              <div className="radar-rule">
                <small>Regra</small>
                <strong>{s.rule?.rule_id}</strong>
                <span>v{s.rule?.version} · {s.rule?.description}</span>
              </div>
              <div className="radar-next">{s.next_step}</div>
              <div className="radar-sources">
                <small>Fontes: {Array.isArray(s.sources) ? s.sources.join(' · ') : '—'}</small>
                {Array.isArray(s.limitations) && s.limitations.length > 0 && (
                  <small className="radar-limitation">{s.limitations[0]}</small>
                )}
              </div>
              <div className="radar-actions">
                <Link className="radar-btn" to="/agro/deserto-veterinario">
                  <MapPin size={13} /> Deserto Veterinário
                </Link>
                <Link className="radar-btn" to={`/agro/propriedades?uf=${encodeURIComponent(s.uf)}&municipio=${encodeURIComponent(s.municipio)}`}>
                  <MapPin size={13} /> Propriedades
                </Link>
                <button className="radar-btn" onClick={() => copyRecorte(s)}>
                  <Copy size={13} /> {copied === s.signal_id ? 'Copiado!' : 'Copiar recorte'}
                </button>
                <button className="radar-btn" onClick={() => changeTab('regras')}>
                  <SlidersHorizontal size={13} /> Ver regra
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      {stageLoading && tab !== 'sinais' && <div className="radar-loading"><div className="radar-spinner" /><p>Carregando contrato da etapa…</p></div>}
      {stageError && tab !== 'sinais' && <div className="radar-partial">{stageError} <button className="radar-btn" onClick={loadStages}>Tentar novamente</button></div>}

      {tab === 'candidatas' && !stageLoading && (
        <section id="radar-panel-candidatas" role="tabpanel" aria-labelledby="radar-tab-candidatas" className="radar-stage-diagnostic">
          <header><div><small>Total atual</small><strong>{fmt(currentStage?.record_count ?? total)}</strong></div><span className="radar-status unavailable">{currentStage?.status || 'UNAVAILABLE'}</span></header>
          <h2>Candidatas: diagnóstico fail-closed</h2>
          <p>{currentStage?.description || stageExplanation.candidatas}</p>
          <div className="radar-diagnostic-grid">
            <article><h3>Critérios necessários</h3><ul>{(currentStage?.entry_criteria || []).map((item: string) => <li key={item}>{item}</li>)}</ul></article>
            <article><h3>O que já está disponível</h3><ul>{['8.291.331 propriedades persistidas', 'CAR único e código IBGE presentes', 'Detalhe canônico por identificador persistido', 'Classificação territorial publicada'].map((item) => <li key={item}>{item}</li>)}</ul></article>
            <article><h3>Blockers</h3>{(currentStage?.blockers || []).map((blocker: any) => <div className="radar-blocker" key={blocker.code}><strong>{blocker.code}</strong><p>{blocker.description}</p></div>)}</article>
            <article><h3>Fontes auditadas</h3><ul>{['prospeccao.fazenda_deserto', 'prospeccao.fazenda_ibge', 'prospeccao.imovel_rural', 'prospeccao.v_white_space_pecuaria', AGRO_API.imoveis].map((item) => <li key={item}>{item}</li>)}</ul></article>
          </div>
          <div className="radar-integrity"><Lock size={16} /> Nenhum registro foi fabricado. A promoção permanece bloqueada até a consulta cumprir a meta de desempenho.</div>
        </section>
      )}

      {tab === 'validacao' && !stageLoading && (
        <section id="radar-panel-validacao" role="tabpanel" aria-labelledby="radar-tab-validacao" className="radar-stage-diagnostic">
          <header><div><small>Total atual</small><strong>{fmt(currentStage?.record_count ?? 0)}</strong></div><span className="radar-status unavailable">INDISPONÍVEL</span></header>
          <h2>Prontidão da validação humana</h2><p>{currentStage?.description || stageExplanation.validacao}</p>
          <div className="radar-facts"><span>Validação humana: não</span><span>Fila persistida: não</span><span>Responsável: indisponível</span><span>Histórico: indisponível</span></div>
          <h3>Checklist de prontidão</h3><div className="radar-checklist">{(currentStage?.readiness || []).map((item: any) => <div key={item.item}><span>{item.item}</span><b className={`radar-status ${String(item.status).toLowerCase()}`}>{item.status}</b></div>)}</div>
          <button type="button" className="radar-disabled-action" disabled aria-describedby="validation-disabled-help">Fluxo de validação ainda indisponível</button>
          <small id="validation-disabled-help">Ações de aprovar, rejeitar, atribuir e editar só serão habilitadas após existir persistência auditável.</small>
        </section>
      )}

      {tab === 'validadas' && !stageLoading && (
        <section id="radar-panel-validadas" role="tabpanel" aria-labelledby="radar-tab-validadas" className="radar-stage-diagnostic">
          <header><div><small>Total validado</small><strong>{fmt(currentStage?.record_count ?? 0)}</strong></div><span className="radar-status unavailable">INDISPONÍVEL</span></header>
          <h2>Por que ainda não existem oportunidades validadas?</h2>
          <p>Este zero é uma política de integridade dos dados, não um erro do sistema.</p>
          <div className="radar-facts"><span>Fila comercial: não</span><span>Contatos acionáveis validados: zero</span><span>Decisores comprovados: zero</span><span>Necessidades confirmadas: zero</span></div>
          <div className="radar-diagnostic-grid"><article><h3>Critérios obrigatórios</h3><ul>{(currentStage?.entry_criteria || []).map((item: string) => <li key={item}>{item}</li>)}</ul></article><article><h3>Impedimentos atuais</h3>{(currentStage?.blockers || []).map((blocker: any) => <div className="radar-blocker" key={blocker.code}><strong>{blocker.code}</strong><p>{blocker.description}</p></div>)}</article></div>
          <div className="radar-integrity"><Lock size={16} /> Nenhuma abordagem, exportação ou promoção automática está disponível.</div>
        </section>
      )}

      {/* Aba Regras do motor */}
      {tab === 'regras' && (
        <section id="radar-panel-regras" role="tabpanel" aria-labelledby="radar-tab-regras" className="radar-rules">
          <p className="radar-rules-intro">{stageExplanation.regras}</p>
          <section className="radar-rule-kpis">{[
            ['Regras totais', rulesSummary.total], ['Ativas', rulesSummary.active], ['Indisponíveis', rulesSummary.unavailable],
            ['Planejadas', rulesSummary.planned], ['Sinais gerados', rulesSummary.signals_generated], ['Candidatas geradas', rulesSummary.candidates_generated],
          ].map(([label, value]) => <div key={label}><small>{label}</small><strong>{fmt(value)}</strong></div>)}</section>
          <div className="radar-rule-filters">
            <label><Search size={14} /><input aria-label="Buscar regra" value={ruleQuery} onChange={(event) => setRuleQuery(event.target.value)} placeholder="Buscar regra" /></label>
            <select aria-label="Filtrar status" value={ruleStatus} onChange={(event) => setRuleStatus(event.target.value)}><option value="">Todos os status</option><option>ACTIVE</option><option>UNAVAILABLE</option><option>PLANNED</option></select>
            <select aria-label="Filtrar estágio produzido" value={ruleStage} onChange={(event) => setRuleStage(event.target.value)}><option value="">Todos os estágios</option><option>SIGNAL</option><option>CANDIDATE</option></select>
            <select aria-label="Filtrar tipo de entidade" value={ruleEntity} onChange={(event) => setRuleEntity(event.target.value)}><option value="">Todas as entidades</option>{Array.from(new Set(rules.map((rule) => rule.entity_type))).map((entity) => <option key={entity}>{entity}</option>)}</select>
          </div>
          {rulesLoading && <div className="radar-loading"><div className="radar-spinner" /><p>Carregando catálogo operacional…</p></div>}
          {rulesError && <div className="radar-partial">{rulesError} <button className="radar-btn" onClick={loadRules}>Tentar novamente</button></div>}
          {filteredRules.length === 0 && !rulesLoading && !rulesError && <div className="radar-stage-empty"><p>{emptyMessage.regras}</p></div>}
          {groupedRules.map(({ group, rules: groupItems }) => groupItems.length > 0 && (
            <section className="radar-rule-group" key={group}><h3>{group === 'ACTIVE' ? 'Regras ativas' : group === 'UNAVAILABLE' ? 'Regras indisponíveis' : 'Regras planejadas'}</h3><div className="radar-rules-grid">
              {groupItems.map((r: any) => {
                const open = expandedRule === r.rule_id;
                return <article key={r.rule_id} className={`radar-rule-card ${r.status}`}>
                  <div className="radar-rule-top"><strong>{r.rule_id}</strong><span className={`radar-status ${String(r.status).toLowerCase()}`}>{r.status}</span></div>
                  <h4>{r.name}</h4><small>v{r.version} · produz {r.produces_stage} · {r.entity_type}</small><p>{r.description}</p>
                  <div className="radar-rule-metrics"><span>Produzidos: <b>{fmt(r.produced_count)}</b></span><span>Última avaliação: {r.last_evaluated_at || 'Não executada'}</span><span>Duração: {r.last_duration_ms === null || r.last_duration_ms === undefined ? 'Não calculável' : `${fmt(r.last_duration_ms)} ms`}</span></div>
                  {r.unavailable_reason && <p className="radar-unavailable">{r.unavailable_reason}</p>}
                  <button className="radar-btn" aria-expanded={open} aria-controls={`rule-${r.rule_id}`} onClick={() => setExpandedRule(open ? null : r.rule_id)}><ChevronDown size={14} /> {open ? 'Recolher detalhe' : 'Expandir detalhe'}</button>
                  {open && <div id={`rule-${r.rule_id}`} className="radar-rule-detail">
                    <p><b>Contrato produzido:</b> {r.output_contract || 'Não disponível nesta versão'}</p>
                    <h5>Critérios de entrada</h5><ul>{(r.criteria || []).map((item: string) => <li key={item}>{item}</li>)}</ul>
                    <h5>Critérios de exclusão</h5><ul>{(r.exclusion_criteria || []).map((item: string) => <li key={item}>{item}</li>)}</ul>
                    <p><b>Campos obrigatórios:</b> {(r.required_fields || []).join(', ') || 'Não definidos'}</p>
                    <p><b>Métricas:</b> {(r.metrics || []).join(', ') || 'Nenhuma'}</p>
                    <p><b>Fontes:</b> {(r.sources || []).join(' · ') || 'Ainda não definidas'}</p>
                    {(r.blockers || []).map((blocker: any) => <div className="radar-blocker" key={blocker.code}><strong>{blocker.code}</strong><p>{blocker.description}</p></div>)}
                    <p><b>Exemplo estrutural:</b> contrato sem dados fictícios; quantidade real produzida: {fmt(r.produced_count)}.</p>
                  </div>}
                </article>;
              })}
            </div></section>
          ))}
        </section>
      )}

      {/* Paginação */}
      {tab === 'sinais' && !loading && !error && total > 0 && (
        <div className="holding-pagination radar-pagination">
          <span>
            Página {page} de {fmt(pages)} · {fmt(total)} sinais
          </span>
          <div>
            <button disabled={page <= 1} onClick={() => setPage((x) => x - 1)}>Anterior</button>
            <b>Página {page} de {fmt(pages)}</b>
            <button disabled={page >= pages} onClick={() => setPage((x) => x + 1)}>Próxima</button>
            <select aria-label="Itens por página" value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}>
              {[25, 50, 100].map((n) => <option key={n}>{n}</option>)}
            </select>
          </div>
        </div>
      )}

      {/* Notas */}
      <section className="radar-notes">
        <p>O motor está em validação: os sinais são reais (classificação territorial de cobertura técnica veterinária), mas nenhuma candidata, contato, decisor ou oportunidade comercial é fabricado.</p>
        <p>Sinal municipal não comprova demanda individual, ausência absoluta de profissionais nem comprador ou decisor. Promoção a candidata exige evidência documental completa — regra PROPERTY_IN_TECHNICAL_GAP_V1 indisponível nesta versão.</p>
        {Array.isArray(limitations) && limitations.length > 0 && limitations.map((l) => <p key={l}>· {l}</p>)}
      </section>
      </>)}
    </AgroPageShell>
  );
}
