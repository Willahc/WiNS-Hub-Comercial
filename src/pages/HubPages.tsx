import React,{useCallback,useEffect,useState} from 'react';
import {Link,useParams} from 'react-router-dom';
import {Activity,AlertCircle,ArrowLeft,ArrowUpRight,BarChart3,Building2,CalendarDays,ChevronRight,CircleDollarSign,Clock3,Database,Globe2,HardHat,HeartPulse,Layers3,LogOut,Map as MapIcon,MapPin,Network,RefreshCw,RotateCcw,Search,Settings as SettingsIcon,ShieldCheck,Sprout,Target,TrendingUp,Truck,Users,X} from 'lucide-react';
import {hubService} from '../services/hub';
import type {HubCompany,HubDataset,VerticalKey} from '../types/hub';
import {useAuth} from '../services/auth';
import {OverviewTerritoryMap} from './OverviewTerritoryMap';
import {ALL_27_UFS} from '../services/canonicalTerritorialService';

const colors:Record<VerticalKey,string>={engenharia:'#3b82f6',logistica:'#06b6d4',agro:'#22c55e',saude:'#ef4444'};
const icons:Record<VerticalKey,React.ElementType>={engenharia:HardHat,logistica:Truck,agro:Sprout,saude:HeartPulse};
const labels:Record<VerticalKey,string>={engenharia:'Engenharia',logistica:'Logística',agro:'Agro',saude:'Saúde'};
const money=(v:number)=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL',notation:'compact',maximumFractionDigits:1}).format(v);
const badge=(value:string)=>value==='Crítica'||value==='Paralisada'?'badge-red':value==='Alta'||value==='Atenção'?'badge-orange':value==='Resolvido'||value==='Ganha'?'badge-green':value==='Negociação'||value==='Monitorando'?'badge-blue':'badge-purple';
function useHub(){const [data,setData]=useState<HubDataset|null>(null);const [error,setError]=useState<string|null>(null);const [loading,setLoading]=useState(true);const load=useCallback(()=>{let active=true;setLoading(true);setError(null);const timeoutId=setTimeout(()=>{if(active){setError('Tempo limite excedido ao consolidar dados');setLoading(false)}},30000);hubService.load().then(x=>{if(active){setData(x);setLoading(false);clearTimeout(timeoutId)}}).catch(e=>{if(active){setData(null);setError(e?.response?.data?.message||e?.message||'Falha ao carregar dados do WiNS Hub');setLoading(false);clearTimeout(timeoutId)}});return()=>{active=false;clearTimeout(timeoutId)}},[]);useEffect(()=>load(),[load]);return{data,error,loading,retry:load}}
const Loading=()=> <div className="loading-container"><div className="spinner"/><p>Consolidando dados do WiNS Hub...</p></div>;
const StateError=({error,reset}:{error:string;reset:()=>void})=>{
  const auth = useAuth();
  const is401 = error.includes('Sua sessão não pôde ser validada') || error.includes('401') || error.includes('expirada');
  return (
    <div className="state-error">
      <AlertCircle size={34}/>
      <h3>Falha no carregamento</h3>
      <p>{is401 ? 'Sua sessão não pôde ser validada. Entre novamente.' : error}</p>
      {is401 && auth?.login ? (
        <button className="btn btn-primary" onClick={auth.login}><LogOut size={14}/> Entrar novamente</button>
      ) : (
        <button className="btn btn-outline" onClick={reset}><RefreshCw size={14}/> Tentar novamente</button>
      )}
    </div>
  );
};
const Head=({title,subtitle,children}:{title:string;subtitle:string;children?:React.ReactNode})=><div className="screen-header hub-head"><div><div className="eyebrow"><Globe2 size={12}/> WiNS Hub unificado</div><h1>{title}</h1><p>{subtitle}</p></div>{children&&<div className="screen-actions">{children}</div>}</div>;
const VerticalPills=({values}:{values:VerticalKey[]})=><div className="vertical-pills">{values.map(v=>{const I=icons[v];return <span key={v} style={{color:colors[v],borderColor:`${colors[v]}45`,background:`${colors[v]}12`}}><I size={11}/>{labels[v]}</span>})}</div>;

const formatCount=(value:number)=>new Intl.NumberFormat('pt-BR').format(value);
const safeText=(value:unknown,fallback:string)=>value&&String(value).trim()&&String(value).trim()!=='—'?String(value):fallback;
const overviewColors={...colors,oportunidades:'#f59e0b'};

import VisaoGeralApproved from './VisaoGeralApproved';

export const GlobalOverview = VisaoGeralApproved;
export const GlobalOverviewLegacy: React.FC = () => {
  const { data, error, loading, retry } = useHub();
  const [vertical, setVertical] = useState('Todas');
  const [uf, setUf] = useState('Todas');
  const [municipality, setMunicipality] = useState('Todos');
  const [kind, setKind] = useState('Todos');
  const [selected, setSelected] = useState('');
  const [resetKey, setResetKey] = useState(0);

  if (loading) return <Loading />;
  if (error) return <StateError error={error} reset={retry} />;
  if (!data) return <Loading />;

  const entities = data.overview.entities;
  const ufSet = new Set(entities.map(x => x.uf).filter(Boolean));
  const ufs = ALL_27_UFS.filter(u => ufSet.has(u.sigla)).map(u => u.sigla);
  const municipalities = [...new Set(entities.filter(x => uf === 'Todas' || x.uf === uf).map(x => x.municipality).filter(x => x && x !== 'Município não informado'))].sort();
  const kinds = [...new Set(entities.map(x => x.kind).filter(Boolean))].sort();

  const filtered = entities.filter(x =>
    (vertical === 'Todas' || x.vertical === vertical) &&
    (uf === 'Todas' || x.uf === uf) &&
    (municipality === 'Todos' || x.municipality === municipality) &&
    (kind === 'Todos' || x.kind === kind)
  );

  const clusters = (Object.values(filtered.reduce((acc: any, item) => {
    const key = item.territory;
    (acc[key] ??= { key, vertical: item.vertical, territory: item.territory, items: [] }).items.push(item);
    return acc;
  }, {})) as any[]).sort((a, b) => b.items.length - a.items.length);

  const selectedCluster = clusters.find((x: any) => x.key === selected);

  // Active filters counter
  let activeFiltersCount = 0;
  if (vertical !== 'Todas') activeFiltersCount++;
  if (uf !== 'Todas') activeFiltersCount++;
  if (municipality !== 'Todos') activeFiltersCount++;
  if (kind !== 'Todos') activeFiltersCount++;

  const handleResetMap = () => {
    setVertical('Todas');
    setUf('Todas');
    setMunicipality('Todos');
    setKind('Todos');
    setSelected('');
    setResetKey(prev => prev + 1);
  };

  // Reconciled KPIs Grid (8 Cards)
  const counts = data.overview.counts;
  const kpis = [
    {
      title: 'Obras visíveis',
      value: formatCount(counts.works),
      path: '/engenharia/obras',
      Icon: HardHat,
      concept: 'Obras públicas e privadas no recorte ativo da Engenharia',
      universe: '16.633 no recorte — de 35.690 registros físicos',
      source: 'wins_agro.engenharia.obras',
      coverage: '46.60% do catálogo de obras',
      updated: 'Julho/2026'
    },
    {
      title: 'Empresas ativas',
      value: '636.404',
      path: '/empresas',
      Icon: Building2,
      concept: 'Empresas ativas com cadastro corporativo consolidado (vivo = true)',
      universe: '636.404 ativas — de 4.825.673 registros físicos',
      source: 'wins_agro.core.empresa',
      coverage: '13.19% do cadastro corporativo',
      updated: 'Julho/2026'
    },
    {
      title: 'Imóveis CAR com coordenada',
      value: formatCount(counts.ruralProperties || 852190),
      path: '/agro/diretorios/imoveis',
      Icon: Sprout,
      concept: 'Imóveis rurais CAR no recorte ativo 4-verticais',
      universe: '852.190 no recorte — de 8.291.331 registros físicos',
      source: 'wins_agro.prospeccao.imovel_rural',
      coverage: '10.28% de cobertura geográfica',
      updated: 'Julho/2026'
    },
    {
      title: 'Transportadores RNTRC ativos no recorte',
      value: formatCount(counts.carriers || 241920),
      path: '/logistica/diretorios/transportadores',
      Icon: Truck,
      concept: 'Transportadores de carga com RNTRC ativo no recorte',
      universe: '241.920 ativos no recorte — de 1.124.684 registros físicos',
      source: 'caminhao_vazio_staging.public.rntrc_transportadores',
      coverage: '21.51% dos registros físicos RNTRC',
      updated: 'Julho/2026'
    },
    {
      title: 'Estabelecimentos CNES ativos no recorte',
      value: formatCount(counts.healthEstablishments || 387410),
      path: '/saude/diretorios/estabelecimentos',
      Icon: HeartPulse,
      concept: 'Unidades de saúde e hospitais CNES no recorte ativo',
      universe: '387.410 ativos no recorte — de 623.208 registros físicos',
      source: 'wins_saude_staging.public.estabelecimentos',
      coverage: '62.16% dos registros físicos CNES',
      updated: 'Julho/2026'
    },
    {
      title: 'Oportunidades no recorte',
      value: '641.968',
      path: '/oportunidades',
      Icon: Target,
      concept: 'Matches com score >= 70 vinculados às 16.633 obras visíveis',
      universe: '641.968 de 1.210.670 ativos score >= 70 (687.087 brutos nas obras)',
      source: 'wins_agro.engenharia.matches_v2',
      coverage: '53.03% dos matches ativos (1.314.135 brutos no banco)',
      updated: 'Julho/2026'
    },
    {
      title: 'Relações confirmadas em destaque',
      value: '3.576',
      path: '/relacionamentos?type=confirmed',
      Icon: Network,
      concept: 'Amostra de destaque (2.384 obra-executora, 1.192 CNES-mantenedora com CNPJ de 14 dígitos validado)',
      universe: '3.576 relações confirmadas selecionadas para destaque; não representam o universo total (133.696 disponíveis)',
      source: 'Cruzamento CNPJ & CNES',
      coverage: '100% dos vínculos exibidos possuem chave explícita de identidade',
      updated: 'Julho/2026'
    },
    {
      title: 'Relações potenciais',
      value: '610 / 827',
      path: '/relacionamentos?type=potential',
      Icon: Layers3,
      concept: '610 municípios no recorte atual, de 827 com presença nas quatro verticais.',
      universe: '827 municípios 4-verticais (de 5.570 municípios IBGE no Brasil)',
      source: 'referencia.municipio',
      coverage: '73.76% dos municípios 4-verticais',
      updated: 'Julho/2026'
    }
  ];

  // 5 Explicit Real Connection Examples
  const first = (v: string) => entities.find(x => x.vertical === v);
  const relations = [
    {
      title: 'Obra → empresa executora / proprietária',
      classification: 'CONFIRMADO',
      confidence: '100% (Chave CNPJ Documental)',
      source: 'Engenharia · CNPJ e obra_id explícito',
      updated: 'Julho/2026',
      relatedCount: '2.000 obras',
      path: first('engenharia')?.detailPath || '/engenharia/obras'
    },
    {
      title: 'Obra → fornecedor recomendado (Match score >= 85)',
      classification: 'PROVÁVEL',
      confidence: 'Predição Algorítmica (Alta Aderência)',
      source: 'Algoritmo Matcher · Predição sem Contrato Assinado',
      updated: 'Julho/2026',
      relatedCount: '641.968 matches',
      path: '/oportunidades'
    },
    {
      title: 'Município → obras, imóveis, transportadores e saúde',
      classification: 'POTENCIAL',
      confidence: 'Presunção Espacial (Sem Vínculo Contratual)',
      source: 'IBGE · Coincidência Territorial (Não representa contrato ou relação operacional)',
      updated: 'Julho/2026',
      relatedCount: '827 municípios',
      path: '/territorial'
    },
    {
      title: 'CNES → mantenedora → Empresa 360°',
      classification: 'CONFIRMADO',
      confidence: '100% (Chave CNPJ Documental)',
      source: 'CNES & CNPJ Mantenedor explícito',
      updated: 'Julho/2026',
      relatedCount: '1.000 estabelecimentos',
      path: first('saude')?.detailPath || '/saude/diretorios/estabelecimentos'
    },
    {
      title: 'Reprodutor → avaliações → genealogia',
      classification: 'CONFIRMADO',
      confidence: '100% (Registro RGD)',
      source: 'RGD & Base Genética Agro',
      updated: 'Julho/2026',
      relatedCount: '45.200 reprodutores',
      path: '/agro/diretorios/reprodutores'
    }
  ];

  // Dynamically select complete featured event
  const featured = data.events.find(e => e.territory && e.territory !== 'Município não informado' && e.value > 0) || data.events[0];

  // Vertical counts breakdown for territory summary
  const verticalCounts = {
    engenharia: filtered.filter(x => x.vertical === 'engenharia').length,
    agro: filtered.filter(x => x.vertical === 'agro').length,
    logistica: filtered.filter(x => x.vertical === 'logistica').length,
    saude: filtered.filter(x => x.vertical === 'saude').length,
    oportunidades: filtered.filter(x => x.vertical === 'oportunidades').length,
  };

  return (
    <div className="hub-page overview-integrated" data-testid="integrated-overview">
      <Head title="Visão Geral" subtitle="Plataforma Unificada de Inteligência Territorial entre Engenharia, Agro, Logística e Saúde" />

      {/* 1. RECONCILED KPIS GRID */}
      <div className="reconciled-kpi-grid" data-testid="overview-kpis">
        {kpis.map(kpi => (
          <Link to={kpi.path} className="reconciled-kpi-card" key={kpi.title}>
            <div className="reconciled-kpi-header">
              <span>{kpi.title}</span>
              <kpi.Icon size={16} />
            </div>
            <div className="reconciled-kpi-value">{kpi.value}</div>
            <div className="reconciled-kpi-def">{kpi.concept}</div>
            <small style={{ fontSize: '9.5px', color: 'var(--color-text-tertiary)', marginTop: '2px' }}>{kpi.universe}</small>
            <div className="reconciled-kpi-coverage">
              <strong>{kpi.source}</strong> · {kpi.coverage}
            </div>
          </Link>
        ))}
      </div>

      {/* 2. CONNECTED DATA GRID */}
      <section className="card connected-now" data-testid="connected-now">
        <div className="card-header">
          <div>
            <h3 className="card-title">Dados conectados agora</h3>
            <p className="card-subtitle">Vínculos identificados com classificação, confiança %, fonte e regra explícitas</p>
          </div>
          <Link to="/relacionamentos" className="btn btn-outline" style={{ fontSize: '11px', padding: '4px 10px' }}>
            Ver relacionamentos <ArrowUpRight size={13} />
          </Link>
        </div>
        <div className="reconciled-connection-grid">
          {relations.map(r => (
            <div className="reconciled-connection-card" key={r.title}>
              <div className="reconciled-connection-header">
                <div className="reconciled-connection-title">
                  <strong>{r.title}</strong>
                  <small>{r.source}</small>
                </div>
                <span className={`relation-status ${r.classification === 'CONFIRMADO' ? 'confirmed' : 'potential'}`}>
                  {r.classification}
                </span>
              </div>
              <div className="reconciled-connection-metrics">
                <div><span>Confiança</span><strong>{r.confidence}</strong></div>
                <div><span>Entidades</span><strong>{r.relatedCount}</strong></div>
                <div><span>Fonte</span><strong>{r.source.split('·')[0]}</strong></div>
                <div><span>Atualização</span><strong>{r.updated}</strong></div>
              </div>
              <div className="reconciled-connection-footer">
                <span>
                  {r.classification === 'CONFIRMADO'
                    ? 'Relação confirmada por chave documental explícita.'
                    : r.classification === 'PROVÁVEL'
                      ? 'Correspondência algorítmica — não confirma contrato, vínculo ou fornecimento.'
                      : 'Coincidência territorial — não representa vínculo contratual ou operacional.'}
                </span>
                <Link to={r.path} className="btn btn-outline" style={{ fontSize: '10px', padding: '3px 8px' }}>
                  Explorar conexão <ChevronRight size={12} />
                </Link>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 3. MAP + TERRITORIAL SUMMARY PANEL */}
      <div className="overview-focus-grid">
        <section className="overview-map territorial-overview" data-testid="territorial-map">
          <div className="card-header">
            <div>
              <h3 className="card-title">Recorte territorial integrado</h3>
              <p className="card-subtitle">Mapa geográfico enquadrado no Brasil com coordenadas da fonte ou centroide municipal IBGE</p>
            </div>
          </div>

          <div className="overview-map-toolbar">
            <div className="overview-map-filters-grid">
              <div className="overview-filter-field">
                <label htmlFor="filter-vertical">Vertical</label>
                <select id="filter-vertical" value={vertical} onChange={e => { setVertical(e.target.value); setSelected(''); }}>
                  <option value="Todas">Todas as verticais</option>
                  <option value="engenharia">Engenharia</option>
                  <option value="agro">Agro</option>
                  <option value="logistica">Logística</option>
                  <option value="saude">Saúde</option>
                  <option value="oportunidades">Oportunidades</option>
                </select>
              </div>

              <div className="overview-filter-field">
                <label htmlFor="filter-uf">UF</label>
                <select id="filter-uf" value={uf} onChange={e => { setUf(e.target.value); setMunicipality('Todos'); setSelected(''); }}>
                  <option value="Todas">Todas as UFs</option>
                  {ufs.map(x => <option key={x} value={x}>{x}</option>)}
                </select>
              </div>

              <div className="overview-filter-field">
                <label htmlFor="filter-municipality">Município</label>
                <select id="filter-municipality" value={municipality} onChange={e => { setMunicipality(e.target.value); setSelected(''); }}>
                  <option value="Todos">Todos os municípios</option>
                  {municipalities.map(x => <option key={x} value={x}>{x}</option>)}
                </select>
              </div>

              <div className="overview-filter-field">
                <label htmlFor="filter-kind">Tipo de Entidade</label>
                <select id="filter-kind" value={kind} onChange={e => { setKind(e.target.value); setSelected(''); }}>
                  <option value="Todos">Todos os tipos</option>
                  {kinds.map(x => <option key={x} value={x}>{x}</option>)}
                </select>
              </div>
            </div>

            <div className="overview-map-actions">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button className="btn btn-outline" onClick={handleResetMap} style={{ fontSize: '11px', padding: '4px 10px' }}>
                  <RotateCcw size={13} style={{ marginRight: '4px' }} /> Redefinir mapa
                </button>
                {activeFiltersCount > 0 && (
                  <button className="btn btn-outline" onClick={handleResetMap} style={{ fontSize: '11px', padding: '4px 10px', color: '#ef4444', borderColor: 'rgba(239,68,68,0.3)' }}>
                    Limpar filtros
                  </button>
                )}
              </div>

              <span className="filter-active-badge">
                {activeFiltersCount > 0 ? `${activeFiltersCount} ${activeFiltersCount === 1 ? 'filtro ativo' : 'filtros ativos'}` : 'Filtros limpos'}
              </span>
            </div>
          </div>

          <OverviewTerritoryMap clusters={clusters} selected={selected} onSelect={setSelected} resetKey={resetKey} />

          <div className="territorial-legend" style={{ marginTop: '10px' }}>
            {Object.entries(overviewColors).map(([key, color]) => (
              <span key={key}>
                <i style={{ background: color }} />
                {key === 'oportunidades' ? 'Oportunidades' : labels[key as VerticalKey] || key}
              </span>
            ))}
          </div>
          <p className="approximate-location" style={{ marginTop: '6px' }}>
            Pontos sem coordenada exata usam o centroide oficial do município IBGE e são identificados no tooltip.
          </p>
        </section>

        {/* TERRITORIAL SUMMARY SIDE PANEL */}
        <aside className="territory-summary-panel" aria-live="polite">
          {selectedCluster ? (
            <>
              <div style={{ borderBottom: '1px solid var(--color-border-subtle)', paddingBottom: '8px' }}>
                <span className="eyebrow">Resumo do Território Selecionado</span>
                <h3 style={{ fontSize: '16px', margin: '4px 0 0 0' }}>{selectedCluster.territory}</h3>
                <small style={{ color: 'var(--color-text-tertiary)' }}>
                  {selectedCluster.items.length} entidades reais neste cluster
                </small>
              </div>

              <div className="vertical-breakdown-list">
                <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text-secondary)' }}>Entidades por vertical:</span>
                {Object.entries(overviewColors).map(([vKey, vColor]) => {
                  const count = selectedCluster.items.filter((x: any) => x.vertical === vKey).length;
                  if (count === 0) return null;
                  return (
                    <div className="vertical-breakdown-item" key={vKey}>
                      <span><i style={{ background: vColor }} />{vKey === 'oportunidades' ? 'Oportunidades' : labels[vKey as VerticalKey] || vKey}</span>
                      <strong>{count}</strong>
                    </div>
                  );
                })}
              </div>

              <div className="territory-entity-list" style={{ flex: 1, overflowY: 'auto' }}>
                <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text-secondary)' }}>Entidades reais:</span>
                {selectedCluster.items.slice(0, 5).map((item: any) => (
                  <Link to={item.detailPath} key={`${item.vertical}-${item.id}`} style={{ padding: '6px 8px', borderRadius: '6px', background: 'var(--color-bg-primary)', margin: '4px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: 'inherit', textDecoration: 'none', border: '1px solid var(--color-border-subtle)' }}>
                    <div>
                      <strong style={{ fontSize: '11px', display: 'block' }}>{item.name}</strong>
                      <small style={{ fontSize: '9px', color: 'var(--color-text-tertiary)' }}>{item.kind} · {item.source}</small>
                    </div>
                    <ChevronRight size={13} />
                  </Link>
                ))}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: 'auto' }}>
                <Link className="btn btn-outline" to={`/territorial?municipality=${encodeURIComponent(selectedCluster.items[0]?.municipality || '')}&uf=${selectedCluster.items[0]?.uf || ''}`} style={{ fontSize: '11px' }}>
                  Abrir inteligência territorial
                </Link>
                <button className="btn btn-outline" onClick={() => setSelected('')} style={{ fontSize: '10px', color: 'var(--color-text-tertiary)' }}>
                  Voltar ao resumo do recorte
                </button>
              </div>
            </>
          ) : (
            <>
              <div style={{ borderBottom: '1px solid var(--color-border-subtle)', paddingBottom: '8px' }}>
                <span className="eyebrow">Resumo do Recorte Territorial</span>
                <h3 style={{ fontSize: '15px', margin: '4px 0 0 0' }}>Visão Consolidada do Filtro</h3>
                <small style={{ color: 'var(--color-text-tertiary)' }}>
                  Estatísticas gerais dos dados exibidos no mapa
                </small>
              </div>

              <div className="territory-metrics-list">
                <div className="territory-metric-row">
                  <span>Pontos carregados no mapa:</span>
                  <strong>{clusters.length} clusters ({filtered.length} pontos)</strong>
                </div>
                <div className="territory-metric-row">
                  <span>Total de entidades representadas:</span>
                  <strong>{formatCount(filtered.length)}</strong>
                </div>
                <div className="territory-metric-row">
                  <span>Municípios mapeados:</span>
                  <strong>{new Set(filtered.map(x => x.municipality)).size}</strong>
                </div>
              </div>

              <div className="vertical-breakdown-list">
                <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text-secondary)' }}>Distribuição por vertical:</span>
                <div className="vertical-breakdown-item">
                  <span><i style={{ background: overviewColors.engenharia }} />Engenharia</span>
                  <strong>{verticalCounts.engenharia}</strong>
                </div>
                <div className="vertical-breakdown-item">
                  <span><i style={{ background: overviewColors.agro }} />Agro</span>
                  <strong>{verticalCounts.agro}</strong>
                </div>
                <div className="vertical-breakdown-item">
                  <span><i style={{ background: overviewColors.logistica }} />Logística</span>
                  <strong>{verticalCounts.logistica}</strong>
                </div>
                <div className="vertical-breakdown-item">
                  <span><i style={{ background: overviewColors.saude }} />Saúde</span>
                  <strong>{verticalCounts.saude}</strong>
                </div>
                <div className="vertical-breakdown-item">
                  <span><i style={{ background: overviewColors.oportunidades }} />Oportunidades</span>
                  <strong>{verticalCounts.oportunidades}</strong>
                </div>
              </div>

              <div className="territory-metrics-list">
                <div className="territory-metric-row">
                  <span>Relações confirmadas:</span>
                  <strong>3.576</strong>
                </div>
                <div className="territory-metric-row">
                  <span>Relações potenciais:</span>
                  <strong>610 / 827 municípios</strong>
                </div>
                <div className="territory-metric-row">
                  <span>Coordenada exata da fonte:</span>
                  <strong>68%</strong>
                </div>
                <div className="territory-metric-row">
                  <span>Centroide municipal IBGE:</span>
                  <strong>32%</strong>
                </div>
              </div>

              <p style={{ fontSize: '10px', color: 'var(--color-text-tertiary)', marginTop: 'auto', textAlign: 'center' }}>
                Clique em um marcador no mapa para detalhar os ativos, fontes e relações do município.
              </p>
            </>
          )}
        </aside>
      </div>

      {/* 4. EVENTO RELEVANTE EM DESTAQUE */}
      {featured && (
        <section className="featured-event featured-event-compact" data-testid="featured-event">
          <div className="featured-top">
            <small>Evento relevante em destaque</small>
            <span className={`badge ${badge(featured.severity)}`}>{safeText(featured.status, 'Status não informado')}</span>
          </div>
          <h2>{featured.title}</h2>
          {featured.description && <p>{featured.description}</p>}
          <div className="featured-facts">
            <span><b>Município/UF</b>{safeText(featured.territory, 'Município não informado')}</span>
            <span><b>Fase/Status</b>{safeText(featured.type || featured.status, 'Fase não informada')}</span>
            <span><b>Data de Identificação</b>{safeText(featured.date, 'Data não informada')}</span>
            <span><b>CAPEX Estimado</b>{featured.value > 0 ? money(featured.value) : 'Valor não informado'}</span>
            <span><b>Fonte Principal</b>{safeText(featured.source, 'Fonte não informada')}</span>
          </div>
          <p style={{ fontSize: '10px', color: 'var(--color-text-tertiary)', marginTop: '8px' }}>
            Critério de seleção: Evento de maior relevância técnica com município, empresa, fase e CAPEX disponível.
          </p>
          <div style={{ marginTop: '12px' }}>
            <Link className="btn btn-outline" to={`/eventos/${featured.id}`}>
              Abrir evento completo <ChevronRight size={14} />
            </Link>
          </div>
        </section>
      )}
    </div>
  );
};

export const EventsPage:React.FC=()=>{const{data,error,loading,retry}=useHub();const[query,setQuery]=useState('');const[vertical,setVertical]=useState('Todas');const[territory,setTerritory]=useState('Todos');const[type,setType]=useState('Todos');if(loading)return<Loading/>;if(error)return<StateError error={error} reset={retry}/>;if(!data)return<Loading/>;const territories=[...new Set(data.events.map(e=>e.territory))];const types=[...new Set(data.events.map(e=>e.type))];const items=data.events.filter(e=>(e.title+e.description).toLowerCase().includes(query.toLowerCase())&&(vertical==='Todas'||e.verticals.includes(vertical as VerticalKey))&&(territory==='Todos'||e.territory===territory)&&(type==='Todos'||e.type===type));return <div className="hub-page"><Head title="Eventos" subtitle="Monitoramento temporal de sinais com impacto territorial e comercial"><Link className="btn btn-outline" to="/mapa"><MapIcon size={14}/> Ver no mapa</Link></Head><div className="module-toolbar"><label><Search size={14}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Buscar evento, tipo ou impacto..."/></label><select value={vertical} onChange={e=>setVertical(e.target.value)}><option>Todas</option>{Object.keys(labels).map(x=><option key={x}>{x}</option>)}</select><select value={territory} onChange={e=>setTerritory(e.target.value)}><option>Todos</option>{territories.map(x=><option key={x}>{x}</option>)}</select><select value={type} onChange={e=>setType(e.target.value)}><option>Todos</option>{types.map(x=><option key={x}>{x}</option>)}</select><select aria-label="Período"><option>Últimos 30 dias</option><option>Últimos 7 dias</option><option>Próximos 30 dias</option></select></div><div className="events-layout"><div className="events-list">{items.map(e=><Link to={`/eventos/${e.id}`} key={e.id}><div className="event-date"><strong>{e.date.split(' ')[0]}</strong><span>{e.date.split(' ').slice(1).join(' ')}</span></div><div className="event-body"><div><span className={`badge ${badge(e.severity)}`}>{e.severity}</span><span className="event-type">{e.type}</span></div><h3>{e.title}</h3><p>{e.description}</p><VerticalPills values={e.verticals}/></div></Link>)}</div><EventsSide featuredEvent={data.events[0]}/></div></div>};

export const EventDetail:React.FC=()=>{const {id}=useParams();const{data,error,loading,retry}=useHub();if(loading)return<Loading/>;if(error)return<StateError error={error} reset={retry}/>;if(!data)return<Loading/>;const event=data.events.find(e=>e.id===id);if(!event)return<Empty title="Evento não encontrado"/>;const companies=data.companies.filter(c=>event.companyIds.includes(c.id));const opps=data.opportunities.filter(o=>event.opportunityIds.includes(o.id));return <div className="hub-page"><div className="detail-back"><Link to="/eventos"><ArrowLeft size={13}/> Todos os eventos</Link><span>Proveniência: {event.source}</span></div><div className="event-detail-hero"><div><span className={`badge ${badge(event.severity)}`}>{event.severity}</span><span className="event-type">{event.type}</span><h1>{event.title}</h1><p>{event.description}</p><VerticalPills values={event.verticals}/></div><div className="event-score"><strong>{event.status}</strong><span>Relevância 94/100</span></div></div><div className="detail-metrics"><Metric icon={MapPin} label="Território" value={event.territory}/><Metric icon={CalendarDays} label="Identificado em" value={event.date}/><Metric icon={CircleDollarSign} label="Impacto estimado" value={money(event.value)}/><Metric icon={Database} label="Fonte" value={event.source.split('·')[0]}/></div><div className="event-detail-grid"><section className="card"><div className="card-header"><h3 className="card-title">Contexto territorial</h3><Link to="/mapa">Abrir no mapa</Link></div><HubMapCanvas data={{...data,events:[event]}} onSelect={()=>{}}/><div className="context-note"><Globe2 size={18}/><p>O território reúne sinais das quatro verticais, vínculos empresariais e capacidade instalada que sustentam a priorização.</p></div></section><aside><RelatedCompanies companies={companies}/><section className="card"><div className="card-header"><h3 className="card-title">Oportunidades relacionadas</h3><span>{opps.length}</span></div>{opps.map(o=><Link className="related-row" to={`/oportunidades/${o.id}`} key={o.id}><Target size={15}/><span><strong>{o.title}</strong><small>{o.stage} · {money(o.value)}</small></span></Link>)}</section></aside></div></div>};

const HubMapCanvas=({data,onSelect}:{data:HubDataset;onSelect:(x:{kind:string;id:string})=>void})=><div className="hub-map-canvas"><svg viewBox="0 0 900 520"><path d="M210 34 388 25 505 72 660 60 795 175 747 303 654 355 620 460 507 508 400 470 318 400 188 372 123 250 158 130Z"/><path d="m163 140 184 93 158-161M347 233l53 237M505 72l6 176 236 55M511 248l143 107"/></svg>{data.events.map((e,i)=><button aria-label={e.title} onClick={()=>onSelect({kind:'evento',id:e.id})} key={e.id} className="hub-pin" style={{left:`${18+(Math.abs(e.coordinates[1])*3+i*11)%68}%`,top:`${15+(Math.abs(e.coordinates[0])*4+i*7)%67}%`,background:colors[e.verticals[0]]}}><span>{e.verticals.length}</span></button>)}</div>;

export const GlobalMap:React.FC=()=>{const{data,error,loading,retry}=useHub();const[layers,setLayers]=useState<VerticalKey[]>(['engenharia','logistica','agro','saude']);const[territory,setTerritory]=useState('Todos');const[selected,setSelected]=useState<{kind:string;id:string}|null>(null);const[state,setState]=useState<'content'|'loading'|'empty'|'error'>('content');if(loading)return<Loading/>;if(error)return<StateError error={error} reset={retry}/>;if(!data)return<Loading/>;const filtered={...data,events:state==='empty'?[]:data.events.filter(e=>(territory==='Todos'||e.territory===territory)&&e.verticals.some(v=>layers.includes(v)))};const event=selected?data.events.find(e=>e.id===selected.id):undefined;return <div className="hub-page global-map-page"><Head title="Mapa Global" subtitle="Camadas unificadas de eventos, ativos, empresas e oportunidades"><div className="map-state-controls"><button onClick={()=>setState('loading')}>Loading</button><button onClick={()=>setState('empty')}>Vazio</button><button onClick={()=>setState('error')}>Erro</button><button onClick={()=>setState('content')}>Mapa</button></div></Head><div className="global-map-toolbar"><div className="layer-toggles">{(Object.keys(labels) as VerticalKey[]).map(v=>{const I=icons[v];return <button className={layers.includes(v)?'active':''} key={v} style={{'--vcolor':colors[v]} as React.CSSProperties} onClick={()=>setLayers(x=>x.includes(v)?x.filter(k=>k!==v):[...x,v])}><I size={13}/>{labels[v]}</button>})}</div><select value={territory} onChange={e=>setTerritory(e.target.value)}><option>Todos</option>{[...new Set(data.events.map(e=>e.territory))].map(x=><option key={x}>{x}</option>)}</select><span>{filtered.events.length} marcadores</span></div><div className="global-map-layout"><div className="global-map-stage">{state==='loading'?<Loading/>:state==='error'?<StateError error="Falha simulada no mapa" reset={()=>setState('content')}/>:filtered.events.length?<HubMapCanvas data={filtered} onSelect={setSelected}/>:<Empty title="Nenhum resultado para as camadas selecionadas"/>}</div><aside className="global-map-side">{event?<><button className="map-side-close" onClick={()=>setSelected(null)}><X size={16}/></button><h3>{event.title}</h3><VerticalPills values={event.verticals}/><div className="map-side-meta"><MapPin size={14}/>{event.territory}<CalendarDays size={14}/>{event.date}<CircleDollarSign size={14}/>{money(event.value)}</div><span className={`badge ${badge(event.severity)}`}>{event.severity}</span><p>{event.description}</p><Link className="btn btn-outline" to={`/eventos/${event.id}`}><ArrowUpRight size={14}/> Detalhes</Link></>:<div className="empty-state"><MapIcon size={34}/><h3>Selecione um marcador</h3><p>Toque em qualquer ponto do mapa para ver detalhes do evento.</p></div>}</aside></div></div>};

export const OpportunitiesPage:React.FC=()=>{const{data,error,loading,retry}=useHub();const[query,setQuery]=useState('');const[vertical,setVertical]=useState('Todas');const[stage,setStage]=useState('Todos');if(loading)return<Loading/>;if(error)return<StateError error={error} reset={retry}/>;if(!data)return<Loading/>;const items=data.opportunities.filter(o=>(o.title+o.territory).toLowerCase().includes(query.toLowerCase())&&(vertical==='Todas'||o.vertical===vertical)&&(stage==='Todos'||o.stage===stage));return <div className="hub-page"><Head title="Oportunidades" subtitle="Pipeline transversal explicado por sinais territoriais e empresariais"/><div className="opportunity-topline"><Metric icon={CircleDollarSign} label="Pipeline total" value={money(items.reduce((s,o)=>s+o.value,0))}/><Metric icon={Target} label="Oportunidades" value={String(items.length)}/><Metric icon={TrendingUp} label="Aderência média" value={`${Math.round(items.reduce((s,o)=>s+o.score,0)/Math.max(items.length,1))}%`}/></div><div className="module-toolbar"><label><Search size={14}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Buscar oportunidade ou território..."/></label><select value={vertical} onChange={e=>setVertical(e.target.value)}><option>Todas</option>{Object.keys(labels).map(x=><option key={x}>{x}</option>)}</select><select value={stage} onChange={e=>setStage(e.target.value)}><option>Todos</option>{['Identificada','Qualificação','Proposta','Negociação','Ganha'].map(x=><option key={x}>{x}</option>)}</select></div><div className="opportunity-table card"><div className="table-wrap"><table><thead><tr><th>Match</th><th>Oportunidade</th><th>Vertical / território</th><th>Empresa relacionada</th><th>Estágio</th><th>Valor</th><th></th></tr></thead><tbody>{items.map(o=>{const c=data.companies.find(x=>x.id===o.companyId);return <tr key={o.id}><td><span className="match-score">{o.score}%</span></td><td><strong>{o.title}</strong><small>{o.justification}</small></td><td><VerticalPills values={[o.vertical]}/><small>{o.territory}</small></td><td><Link to={`/empresas/${c?.id}`}>{c?.tradeName||'---'}</Link></td><td><span className={`badge ${badge(o.stage)}`}>{o.stage}</span></td><td><strong>{money(o.value)}</strong></td><td><ChevronRight size={14}/></td></tr>})}</tbody></table></div></div></div>};

export const OpportunityDetail:React.FC=()=>{const{data,error,loading,retry}=useHub();const{id}=useParams();if(loading)return<Loading/>;if(error)return<StateError error={error} reset={retry}/>;if(!data)return<Loading/>;const o=data.opportunities.find(x=>x.id===id);if(!o)return<Empty title="Oportunidade não encontrada"/>;const company=data.companies.find(x=>x.id===o.companyId);const event=data.events.find(x=>x.id===o.eventId);return <div className="hub-page"><div className="detail-back"><Link to="/oportunidades"><ArrowLeft size={13}/> Pipeline completo</Link><span>ID {o.id}</span></div><div className="opportunity-detail-hero"><div className="opp-score-block"><strong>{o.score}%</strong><span>aderência</span></div><div><VerticalPills values={[o.vertical]}/><h1>{o.title}</h1><p>{o.justification}</p></div><div><span className={`badge ${badge(o.stage)}`}>{o.stage}</span><strong>{money(o.value)}</strong></div></div><div className="detail-metrics"><Metric icon={MapPin} label="Território" value={o.territory}/><Metric icon={Users} label="Responsável" value={o.owner}/><Metric icon={Clock3} label="Próximo passo" value={o.nextStep}/><Metric icon={Building2} label="Empresa potencial" value={company?.tradeName||'Em qualificação'}/></div><div className="grid-2"><section className="card"><div className="card-header"><h3 className="card-title">Empresa potencial</h3></div>{company&&<Link className="company-detail-link" to={`/empresas/${company.id}`}><b>{company.tradeName.slice(0,2)}</b><span><strong>{company.name}</strong><small>{company.segment} · Score {company.score}</small></span><ArrowUpRight size={15}/></Link>}</section><section className="card"><div className="card-header"><h3 className="card-title">Evento de origem</h3></div>{event&&<Link className="event-origin" to={`/eventos/${event.id}`}><Activity size={20}/><span><strong>{event.title}</strong><small>{event.territory} · {event.severity}</small></span><ChevronRight size={15}/></Link>}</section></div></div>};

export const CompaniesPage:React.FC=()=>{const{data,error,loading,retry}=useHub();const[query,setQuery]=useState('');const[vertical,setVertical]=useState('Todas');if(loading)return<Loading/>;if(error)return<StateError error={error} reset={retry}/>;if(!data)return<Loading/>;const companies=data.companies.filter(c=>(c.name+c.cnpj+c.territory+c.segment).toLowerCase().includes(query.toLowerCase())&&(vertical==='Todas'||c.verticals.includes(vertical as VerticalKey)));return <div className="hub-page"><Head title="Empresas e Pessoas" subtitle="Base corporativa, territorial e relacional do WiNS Hub"/><div className="module-toolbar"><label><Search size={14}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Buscar nome, CNPJ, segmento ou território..."/></label><select value={vertical} onChange={e=>setVertical(e.target.value)}><option>Todas</option>{Object.keys(labels).map(x=><option key={x}>{x}</option>)}</select><select><option>Todos os segmentos</option></select><select><option>Score: maior primeiro</option></select></div><div className="company-directory">{companies.map(c=><Link to={`/empresas/${c.id}`} key={c.id}><div className="directory-logo">{c.tradeName.slice(0,2)}</div><div className="directory-main"><h3>{c.name}</h3><p>{c.cnpj} · {c.segment}</p><span><MapPin size={11}/>{c.territory}</span><VerticalPills values={c.verticals}/></div><div className="directory-stats"><span><strong>{c.score}</strong>Score WiNS</span><span><strong>{c.opportunityIds.length}</strong>Oportunidades</span><span><strong>{c.relationships.length}</strong>Vínculos</span></div><ChevronRight size={17}/></Link>)}</div></div>};

export const UnifiedCompany360:React.FC=()=>{const{data,error,loading,retry}=useHub();const{id}=useParams();const[realCompany,setRealCompany]=useState<HubCompany>();useEffect(()=>{if(id)hubService.getCompany(id).then(setRealCompany).catch(()=>setRealCompany(undefined))},[id]);if(loading)return<Loading/>;if(error)return<StateError error={error} reset={retry}/>;if(!data)return<Loading/>;const c=realCompany||data.companies.find(x=>x.id===id);if(!c)return<Empty title="Empresa não encontrada"/>;const events=data.events.filter(e=>c.eventIds.includes(e.id));const opps=data.opportunities.filter(o=>o.companyId===c.id||c.opportunityIds.includes(o.id));return <div className="hub-page"><div className="detail-back"><Link to="/empresas"><ArrowLeft size={13}/> Empresas e Pessoas</Link><span>Empresa 360° · visão transversal</span></div><div className="company360-hero"><div className="directory-logo large">{c.tradeName.slice(0,2)}</div><div><div className="eyebrow">Cadastro empresarial consolidado</div><h1>{c.name}</h1><p>{c.tradeName} · {c.cnpj} · {c.segment}</p><span><MapPin size={13}/>{c.territory}</span><VerticalPills values={c.verticals}/></div><div className="company360-score"><strong>{c.score}</strong><span>Qualidade</span></div></div><div className="detail-metrics"><Metric icon={CircleDollarSign} label="Capital informado" value={money(c.revenue)}/><Metric icon={Users} label="Pessoas públicas" value="Restrito"/><Metric icon={Layers3} label="Obras relacionadas" value={String(c.relationships.length)}/><Metric icon={Target} label="Oportunidades" value={String(opps.length)}/></div><div className="company360-layout"><section className="card"><BlockTitle title="Atuação territorial" icon={Globe2}/><div className="territorial-presence"><MapIcon size={40}/><div><strong>{c.territory}</strong><span>Localização cadastral da fonte real</span></div></div><BlockTitle title="Obras e vínculos" icon={Users}/><div className="relationship-list">{c.relationships.map((x,i)=><div key={`${x}-${i}`}><i/><span><strong>{x}</strong><small>Vínculo por CNPJ · fonte Engenharia</small></span></div>)}</div></section><section className="card company360-events"><BlockTitle title="Eventos no território" icon={Activity}/>{events.map(e=><Link to={`/eventos/${e.id}`} key={e.id}><Activity size={16}/><span><strong>{e.title}</strong><small>{e.territory}</small></span><ChevronRight size={14}/></Link>)}</section></div><div className="company360-opps"><BlockTitle title="Oportunidades vinculadas" icon={Target}/><div className="opp-table">{opps.map(o=><Link to={`/oportunidades/${o.id}`} key={o.id}><small>{o.stage}</small><span>{o.title}</span><strong>{money(o.value)}</strong><span className={`badge ${badge(o.stage)}`}>{o.owner}</span></Link>)}</div></div></div>};

export const CommercialPage:React.FC=()=>{const{data,error,loading,retry}=useHub();const[owner,setOwner]=useState('Todos');if(loading)return<Loading/>;if(error)return<StateError error={error} reset={retry}/>;if(!data)return<Loading/>;const owners=[...new Set(data.opportunities.map(o=>o.owner))];const items=data.opportunities.filter(o=>owner==='Todos'||o.owner===owner);const stages=['Identificada','Qualificação','Proposta','Negociação','Ganha'];return <div className="hub-page"><Head title="Comercial" subtitle="Pipeline, contas e atividades conectados à inteligência territorial"><select className="header-select" value={owner} onChange={e=>setOwner(e.target.value)}><option>Todos</option>{owners.map(x=><option key={x}>{x}</option>)}</select></Head><div className="commercial-kpis"><Metric icon={CircleDollarSign} label="Pipeline aberto" value={money(items.filter(o=>o.stage!=='Ganha').reduce((s,o)=>s+o.value,0))}/><Metric icon={Target} label="Contas ativas" value={String(new Set(items.map(o=>o.companyId)).size)}/><Metric icon={TrendingUp} label="Conversão projetada" value="31,8%"/><Metric icon={Clock3} label="Atividades na semana" value="24"/></div><div className="commercial-grid"><div className="sales-kanban">{stages.map(stage=><section key={stage}><div className="kanban-head"><span>{stage}</span><b>{items.filter(o=>o.stage===stage).length}</b></div>{items.filter(o=>o.stage===stage).map(o=>{const c=data.companies.find(x=>x.id===o.companyId);return <Link to={`/oportunidades/${o.id}`} key={o.id}><VerticalPills values={[o.vertical]}/><h3>{o.title}</h3><p>{c?.tradeName} · {o.territory}</p><strong>{money(o.value)}</strong><div><span>{o.owner}</span><b>{o.score}%</b></div></Link>})}</section>)}</div><aside className="card commercial-activities"><BlockTitle title="Próximas atividades" icon={CalendarDays}/>{items.slice(0,6).map((o,i)=><div key={o.id}><i className={i<2?'urgent':''}/><span><strong>{o.nextStep}</strong><small>{o.owner} · {o.territory}</small></span><b>{i+22}/07</b></div>)}</aside></div></div>};

export const TerritorialPage:React.FC=()=>{const{data,error,loading,retry}=useHub();const[selected,setSelected]=useState('terr-sp');const[compare,setCompare]=useState('terr-mt');if(loading)return<Loading/>;if(error)return<StateError error={error} reset={retry}/>;if(!data)return<Loading/>;const territory=data.territories.find(t=>t.id===selected)!;const other=data.territories.find(t=>t.id===compare)!;const relatedEvents=data.events.filter(e=>e.territory.includes(territory.name));const relatedCompanies=data.companies.filter(c=>c.territory.includes(territory.name));return <div className="hub-page"><Head title="Inteligência Territorial" subtitle="Comparação multidimensional de territórios e presença das quatro verticais"><div className="territory-selectors"><select value={selected} onChange={e=>setSelected(e.target.value)}>{data.territories.map(t=><option value={t.id} key={t.id}>{t.name}, {t.state}</option>)}</select><span>versus</span><select value={compare} onChange={e=>setCompare(e.target.value)}>{data.territories.filter(t=>t.id!==selected).map(t=><option value={t.id} key={t.id}>{t.name}, {t.state}</option>)}</select></div></Head><div className="territory-hero"><div><span>WiNS Score territorial</span><strong>{territory.score}</strong><small>{territory.name}, {territory.state}</small></div><div className="territory-map-mini"><MapIcon size={38}/><span>{territory.name}<small>{territory.population.toLocaleString('pt-BR')} habitantes</small></span></div>{territory.indicators.map(i=><div key={i.label}><span>{i.label}</span><strong>{i.value}</strong><em>{i.trend}</em></div>)}</div><div className="territorial-grid"><section className="card"><BlockTitle title="Presença das quatro verticais" icon={Layers3}/><div className="presence-bars">{(Object.keys(labels) as VerticalKey[]).map(v=><div key={v}><span><i style={{background:colors[v]}}/>{labels[v]}<b>{territory.verticalPresence[v]}</b></span><div><i style={{width:`${territory.verticalPresence[v]}%`,background:colors[v]}}/></div></div>)}</div></section><section className="card"><BlockTitle title={`Comparação com ${other.name}`} icon={BarChart3}/><div className="compare-row"><span>População</span><b>{territory.population.toLocaleString('pt-BR')}</b><span>{other.population.toLocaleString('pt-BR')}</span></div><div className="compare-row"><span>PIB</span><b>{money(territory.gdp)}</b><span>{money(other.gdp)}</span></div><div className="compare-row"><span>Empresas</span><b>{territory.companies.toLocaleString('pt-BR')}</b><span>{other.companies.toLocaleString('pt-BR')}</span></div><div className="compare-row"><span>Empregos</span><b>{territory.jobs.toLocaleString('pt-BR')}</b><span>{other.jobs.toLocaleString('pt-BR')}</span></div></section><section className="card"><BlockTitle title="Indicadores territoriais" icon={Activity}/><div className="territory-indicators">{territory.indicators.map(i=><div key={i.label}><span>{i.label}</span><div><div style={{width:`${parseInt(i.value)||50}%`}}/></div></div>)}</div></section><section className="card"><BlockTitle title="Eventos no território" icon={Activity}/>{relatedEvents.slice(0,4).map(e=><Link to={`/eventos/${e.id}`} key={e.id}><i style={{background:colors[e.verticals[0]]}}/><strong>{e.title}</strong><small>{e.date}</small></Link>)}</section><section className="card"><BlockTitle title="Empresas presentes" icon={Building2}/>{relatedCompanies.slice(0,4).map(c=><Link to={`/empresas/${c.id}`} key={c.id}><i/><strong>{c.name}</strong><small>{c.segment}</small></Link>)}</section></div></div>};

export const ReportsPage:React.FC=()=>{const{data,error,loading,retry}=useHub();if(loading)return<Loading/>;if(error)return<StateError error={error} reset={retry}/>;if(!data)return<Loading/>;return <div className="hub-page"><Head title="Relatórios" subtitle="Visões executivas prontas para exportação controlada"/><div className="report-grid">{['Panorama executivo nacional','Carteira de oportunidades','Eventos territoriais críticos','Empresas e vínculos','Desempenho das quatro verticais','Inteligência territorial comparada'].map((x,i)=><article key={x}><BarChart3 size={24}/><h3>{x}</h3><p>Atualizado em 21 jul 2026 · {12+i*3} páginas</p><button className="btn btn-outline">Preparar visualização</button></article>)}</div></div>};

export const AccessDeniedPage:React.FC=()=><div className="hub-page access-denied"><ShieldCheck size={48}/><span>HTTP 403 · acesso controlado</span><h1>Acesso não autorizado</h1><p>O perfil atual não possui permissão para consultar este módulo. Solicite a revisão de acesso ao administrador do WiNS Hub.</p><div><Link className="btn btn-primary" to="/visao-geral">Voltar à Visão Geral</Link><Link className="btn btn-outline" to="/configuracoes">Ver permissões</Link></div></div>;

const EventsSide=({featuredEvent}:{featuredEvent:any})=><aside>{featuredEvent&&<section className="card"><div className="card-header"><h3 className="card-title">Evento em destaque</h3></div><div className="featured-event-side"><small>{featuredEvent.territory} · {featuredEvent.date}</small><h3>{featuredEvent.title}</h3><p>{featuredEvent.description?.slice(0,120)}...</p><VerticalPills values={featuredEvent.verticals}/><Link to={`/eventos/${featuredEvent.id}`}>Detalhes completos <ChevronRight size={13}/></Link></div></section>}<section className="card"><div className="card-header"><h3 className="card-title">Guia rápido</h3></div><div className="guide-links"><Link to="/oportunidades"><Target size={15}/>Oportunidades</Link><Link to="/empresas"><Building2 size={15}/>Empresas</Link><Link to="/engenharia"><HardHat size={15}/>Engenharia</Link><Link to="/comercial"><ShieldCheck size={15}/>Comercial</Link></div></section></aside>;

const Metric=({icon:Icon,label,value}:{icon:React.ElementType;label:string;value:string})=><div className="hub-metric"><span><Icon size={16}/></span><small>{label}</small><strong>{value}</strong></div>;
const BlockTitle=({title,icon:Icon}:{title:string;icon:React.ElementType})=><div className="block-title"><h3>{title}</h3><Icon size={16}/></div>;
const RelatedCompanies=({companies}:{companies:HubCompany[]})=><section className="card"><div className="card-header"><h3 className="card-title">Empresas relacionadas</h3><span>{companies.length}</span></div>{companies.map(c=><Link className="related-row" to={`/empresas/${c.id}`} key={c.id}><Building2 size={15}/><span><strong>{c.tradeName}</strong><small>{c.segment} · Score {c.score}</small></span><ChevronRight size={14}/></Link>)}</section>;
const Empty=({title}:{title:string})=><div className="empty-state hub-empty"><Search size={34}/><h3>{title}</h3><p>Ajuste os filtros ou retorne à visão consolidada.</p></div>;

export const SettingsPage:React.FC=()=>{const {user,logout}=useAuth();const [theme,setTheme]=useState(document.body.classList.contains('light')?'light':'dark');const applyTheme=(v:string)=>{setTheme(v);document.body.classList.toggle('light',v==='light');localStorage.setItem('wins-theme',v)};return <div className="hub-page"><Head title="Configurações" subtitle="Perfil, aparência, preferências e estados da sessão"/><div className="settings-layout"><aside className="settings-nav"><button className="active"><Users size={15}/>Perfil e sessão</button><button><SettingsIcon size={15}/>Preferências</button><button><ShieldCheck size={15}/>Permissões</button></aside><div><section className="card settings-profile"><BlockTitle title="Perfil" icon={Users}/><div className="profile-row"><div className="profile-avatar">{user?.name?.charAt(0)}</div><div><h3>{user?.name}</h3><p>{user?.email}</p><span className="badge badge-green">Sessão ativa</span></div></div></section><section className="card"><BlockTitle title="Aparência e preferências" icon={SettingsIcon}/><div className="setting-row"><div><strong>Tema da interface</strong><span>Alterna todas as superfícies da SPA.</span></div><div className="segmented"><button className={theme==='dark'?'active':''} onClick={()=>applyTheme('dark')}>Dark</button><button className={theme==='light'?'active':''} onClick={()=>applyTheme('light')}>Light</button></div></div></section><section className="card"><BlockTitle title="Sessão" icon={LogOut}/><div className="setting-row"><div><strong>Sair do sistema</strong><span>Encerra a sessão atual e redireciona ao login.</span></div><button className="btn btn-outline" onClick={logout} style={{color:'var(--color-danger)'}}><LogOut size={14}/> Logout</button></div></section></div></div></div>};
