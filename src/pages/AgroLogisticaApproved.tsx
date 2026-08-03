import React, { useCallback, useEffect, useState } from 'react';
import { CircleMarker, MapContainer, TileLayer, Tooltip } from 'react-leaflet';
import { AlertTriangle, Building2, Database, MapPinned, Phone, Route, Truck } from 'lucide-react';
import AgroPageShell from '../components/AgroPageShell';
import { BrazilUfSelect } from '../components/territorial/BrazilUfSelect';
import { httpClient } from '../services/http/client';
import { AGRO_API } from './agroApiEndpoints';
import 'leaflet/dist/leaflet.css';

type CoverageStatus = 'COBERTURA_CONHECIDA_ALTA' | 'COBERTURA_CONHECIDA_MEDIA' | 'COBERTURA_CONHECIDA_BAIXA' | 'DADOS_INSUFICIENTES';
type Summary = {
  status: 'PARTIAL' | 'UNAVAILABLE';
  coverage_scope: { represented_ufs?: number; represented_municipalities?: number };
  transporters: { total?: number; with_rntrc?: number; geocoded?: number; with_institutional_contact?: number };
  operational_records: { total?: number; with_distance?: number; semantic_label?: string };
  national_rntrc: { status: string };
  storage: { status: string; reason: string };
  updated_at?: string;
  sources: string[];
  limitations: string[];
};
type Municipality = {
  municipio: string; uf: string; codigo_ibge?: number; latitude?: number; longitude?: number;
  transporters: number; with_rntrc: number; geocoded: number; institutional_contacts?: number;
  operational_records?: number; properties?: number | null; livestock?: number;
  territorial_classification?: string; coverage_status: CoverageStatus;
  territorial_link_quality: 'IBGE_EXACT' | 'MUNICIPAL_NAME_NORMALIZED'; sources?: string[]; limitations?: string[];
};
type PageResponse = { status: string; items: Municipality[]; page: number; page_size: number; total: number; pages: number };

const panel: React.CSSProperties = { background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: 10, padding: 16 };
const fmt = (value: unknown) => typeof value === 'number' && Number.isFinite(value) ? new Intl.NumberFormat('pt-BR').format(value) : 'Não calculável';
const coverageLabel: Record<CoverageStatus, string> = {
  COBERTURA_CONHECIDA_ALTA: 'Cobertura conhecida alta', COBERTURA_CONHECIDA_MEDIA: 'Cobertura conhecida média',
  COBERTURA_CONHECIDA_BAIXA: 'Cobertura conhecida baixa', DADOS_INSUFICIENTES: 'Dados insuficientes',
};
const colors: Record<CoverageStatus, string> = {
  COBERTURA_CONHECIDA_ALTA: '#22C55E', COBERTURA_CONHECIDA_MEDIA: '#F59E0B',
  COBERTURA_CONHECIDA_BAIXA: '#F97316', DADOS_INSUFICIENTES: '#64748B',
};

export default function AgroLogisticaApproved() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [municipal, setMunicipal] = useState<PageResponse | null>(null);
  const [mapItems, setMapItems] = useState<Municipality[]>([]);
  const [loading, setLoading] = useState(true);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [tableError, setTableError] = useState<string | null>(null);
  const [mapError, setMapError] = useState<string | null>(null);
  const [uf, setUf] = useState(''); const [query, setQuery] = useState('');
  const [coverage, setCoverage] = useState(''); const [page, setPage] = useState(1);
  const [sort, setSort] = useState('transporters'); const [order, setOrder] = useState<'asc' | 'desc'>('desc');

  const load = useCallback(async () => {
    setLoading(true); setSummaryError(null); setTableError(null); setMapError(null);
    const common = uf ? { uf } : {};
    const [summaryResult, municipalResult, mapResult] = await Promise.allSettled([
      httpClient.get(AGRO_API.logisticaResumo, { params: common }),
      httpClient.get(AGRO_API.logisticaMunicipios, { params: { ...common, q: query || undefined, coverage_status: coverage || undefined, page, page_size: 25, sort, order } }),
      httpClient.get(AGRO_API.logisticaMapa, { params: { ...common, limit: 100 } }),
    ]);
    if (summaryResult.status === 'fulfilled') setSummary(summaryResult.value.data); else setSummaryError('O resumo canônico não pôde ser consultado.');
    if (municipalResult.status === 'fulfilled') setMunicipal(municipalResult.value.data); else setTableError('A tabela municipal não pôde ser consultada.');
    if (mapResult.status === 'fulfilled') setMapItems(mapResult.value.data?.items || []); else setMapError('O mapa agregado não pôde ser consultado.');
    setLoading(false);
  }, [uf, query, coverage, page, sort, order]);
  useEffect(() => { load(); }, [load]);

  const cards = summary ? [
    ['Transportadoras conhecidas', summary.transporters.total, Truck],
    ['Municípios cobertos', summary.coverage_scope.represented_municipalities, MapPinned],
    ['Com RNTRC', summary.transporters.with_rntrc, Building2],
    ['Geocodificadas', summary.transporters.geocoded, MapPinned],
    ['Contatos institucionais', summary.transporters.with_institutional_contact, Phone],
    ['Registros logísticos', summary.operational_records.total, Route],
  ] as const : [];

  return <AgroPageShell
    title="Agro-Logística & Cobertura Territorial"
    subtitle="Cruza produção Agro e cobertura logística conhecida para identificar territórios com maior ou menor presença de operadores. Não representa oferta de transporte, veículo ou capacidade disponível."
    loading={loading && !summary && !municipal}
    error={summaryError && !summary ? summaryError : null}
    onRetry={load}
    statusBadge={summary ? `Cobertura parcial — ${summary.coverage_scope.represented_ufs ?? 0} UFs` : 'Cobertura parcial'}
  >
    <section style={{ ...panel, background: 'rgba(59,130,246,.08)', borderColor: 'rgba(59,130,246,.35)', display: 'flex', gap: 10 }}>
      <Database size={20} color="#60A5FA" />
      <div><strong>Camada canônica disponível parcialmente</strong><div style={{ fontSize: 12, color: '#CBD5E1', marginTop: 4 }}>O RNTRC nacional foi localizado, mas ainda não integra o contrato canônico desta página. A cobertura abaixo usa somente a camada já promovida e acessível.</div></div>
    </section>

    <section aria-label="Resumo de cobertura" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))', gap: 12 }}>
      {cards.map(([label, value, Icon]) => <article key={label} style={panel}><Icon size={17} color="#22C55E" /><div style={{ fontSize: 22, fontWeight: 800, marginTop: 8 }}>{fmt(value)}</div><div style={{ fontSize: 11, color: '#94A3B8' }}>{label}</div></article>)}
    </section>

    <section style={panel} aria-label="Mapa territorial">
      <h3 style={{ marginTop: 0 }}>Mapa territorial agregado</h3>
      <p style={{ fontSize: 12, color: '#94A3B8' }}>Cobertura logística conhecida, propriedades quando calculáveis e classificação pecuária municipal.</p>
      {mapError ? <InlineError text={mapError} retry={load} /> : <MapContainer center={[-14.2, -51.9]} zoom={4} minZoom={3} maxBounds={[[-35.5,-75.5],[6.5,-32]]} style={{ height: 380, width: '100%', borderRadius: 8 }}>
        <TileLayer attribution="&copy; OpenStreetMap" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        {mapItems.filter(x => Number.isFinite(Number(x.latitude)) && Number.isFinite(Number(x.longitude))).map(x => <CircleMarker key={`${x.uf}-${x.municipio}`} center={[Number(x.latitude), Number(x.longitude)]} radius={Math.min(18, 4 + Math.log10(1 + x.transporters) * 2)} pathOptions={{ color: colors[x.coverage_status], fillColor: colors[x.coverage_status], fillOpacity: .65 }}><Tooltip><b>{x.municipio}/{x.uf}</b><br />Transportadoras: {fmt(x.transporters)}<br />Geocodificadas: {fmt(x.geocoded)}<br />Rebanho: {fmt(x.livestock)}<br />{coverageLabel[x.coverage_status]}</Tooltip></CircleMarker>)}
      </MapContainer>}
      <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 8 }}>🟢 Alta · 🟡 Média · 🟠 Baixa · ⚪ Dados insuficientes — sempre “cobertura conhecida na camada disponível”.</div>
    </section>

    <section style={panel} aria-label="Tabela municipal">
      <h3 style={{ marginTop: 0 }}>Cobertura por município</h3>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
        <input aria-label="Buscar município" value={query} onChange={e => { setQuery(e.target.value); setPage(1); }} placeholder="Buscar município" style={{ minWidth: 210 }} />
        <BrazilUfSelect value={uf} onChange={v => { setUf(v); setPage(1); }} showAllLabel="Todas as UFs" />
        <select aria-label="Cobertura" value={coverage} onChange={e => { setCoverage(e.target.value); setPage(1); }}><option value="">Todas as coberturas</option>{Object.entries(coverageLabel).map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select>
        <select aria-label="Ordenar" value={sort} onChange={e => setSort(e.target.value)}><option value="transporters">Transportadoras</option><option value="with_rntrc">Com RNTRC</option><option value="geocoded">Geocodificadas</option><option value="municipio">Município</option></select>
        <button onClick={() => setOrder(v => v === 'desc' ? 'asc' : 'desc')}>{order === 'desc' ? 'Maior primeiro' : 'Menor primeiro'}</button>
      </div>
      {tableError ? <InlineError text={tableError} retry={load} /> : <div style={{ overflowX: 'auto' }}><table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}><thead><tr>{['Município','Operadores','RNTRC','Geo','Contatos','Registros calculados','CAR','Rebanho','Classificação','Ligação'].map(h => <th key={h} style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid var(--border-default)' }}>{h}</th>)}</tr></thead><tbody>{municipal?.items.map(row => <tr key={`${row.uf}-${row.municipio}`}><td style={{ padding: 8 }}><b>{row.municipio}/{row.uf}</b><small style={{ display: 'block', color: '#64748B' }}>IBGE {row.codigo_ibge ?? 'não ligado'}</small></td><td>{fmt(row.transporters)}</td><td>{fmt(row.with_rntrc)}</td><td>{fmt(row.geocoded)}</td><td>{fmt(row.institutional_contacts)}</td><td>{fmt(row.operational_records)}</td><td>{fmt(row.properties)}</td><td>{fmt(row.livestock)}</td><td>{coverageLabel[row.coverage_status]}</td><td title="Ligação declarada, sem fuzzy matching silencioso">{row.territorial_link_quality === 'IBGE_EXACT' ? 'IBGE exato' : 'Nome normalizado + UF'}</td></tr>)}</tbody></table></div>}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12, alignItems: 'center' }}><span style={{ fontSize: 11 }}>{fmt(municipal?.total)} municípios no recorte</span><div><button disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Anterior</button><span style={{ margin: '0 10px' }}>{page} / {municipal?.pages || 0}</span><button disabled={!municipal || page >= municipal.pages} onClick={() => setPage(p => p + 1)}>Próxima</button></div></div>
      <p style={{ fontSize: 10, color: '#64748B' }}>Proveniência por linha: log.transportadora, log.match, SICAR/CAR, IBGE e IBGE PPM. A contagem CAR aparece como “Não calculável” quando a consulta excede a meta de desempenho.</p>
    </section>

    <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 12 }}>
      <article style={panel}><h3>Fontes da camada</h3>{['log.transportadora — operadores e cobertura territorial','log.match — registros logísticos previamente calculados','SICAR/CAR — propriedades rurais','IBGE — municípios','IBGE PPM — pecuária municipal'].map(x => <p key={x} style={{ fontSize: 12 }}>✓ {x}</p>)}</article>
      <article style={{ ...panel, borderColor: 'rgba(245,158,11,.35)' }}><h3><AlertTriangle size={17} /> Infraestrutura não integrada</h3>{['CONAB','Armazéns','Capacidade estática','Terminais','Portos'].map(x => <p key={x} style={{ fontSize: 12 }}>— {x}: indisponível no contrato canônico</p>)}</article>
    </section>

    <section style={{ ...panel, fontSize: 11, color: '#94A3B8' }}><strong>Limitações de uso</strong>{summary?.limitations.map(x => <p key={x}>• {x}</p>)}<p>Os registros de <code>log.match</code> são resultados previamente calculados; não comprovam relação comercial, frete aberto, viagem atual ou disponibilidade operacional.</p></section>
  </AgroPageShell>;
}

function InlineError({ text, retry }: { text: string; retry: () => void }) {
  return <div role="alert" style={{ padding: 16, color: '#FCA5A5' }}>{text} <button onClick={retry}>Tentar novamente</button></div>;
}
