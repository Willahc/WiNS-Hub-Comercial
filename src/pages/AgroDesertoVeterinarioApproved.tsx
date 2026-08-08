import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Circle, MapContainer, TileLayer, Tooltip } from 'react-leaflet';
import { AlertTriangle, Info, MapPin, ShieldAlert } from 'lucide-react';
import AgroPageShell from '../components/AgroPageShell';
import { httpClient } from '../services/http/client';
import { AGRO_API } from './agroApiEndpoints';
import 'leaflet/dist/leaflet.css';

type Tab = 'resumo' | 'municipios' | 'mapa' | 'metodologia';

const color: Record<string, string> = {
  DESERTO_VET: '#EF4444',
  BAIXA_COBERTURA: '#EAB308',
  NORMAL: '#22C55E',
};

const labels: Record<string, string> = {
  DESERTO_VET: 'Deserto Veterinário',
  BAIXA_COBERTURA: 'Baixa cobertura',
  NORMAL: 'Cobertura normal',
};

const BRAZIL_BOUNDS: [[number, number], [number, number]] = [
  [-33.75, -73.99],
  [5.27, -34.79],
];

const cardStyle: React.CSSProperties = {
  background: 'var(--bg-surface, #0F172A)',
  border: '1px solid var(--border-default, #1E293B)',
  borderRadius: 10,
  padding: 14,
};

const fmt = (v: unknown) =>
  typeof v === 'number' && Number.isFinite(v) ? v.toLocaleString('pt-BR') : 'Não disponível';

const fmtRatio = (item: { ratio?: number | null; carga_regional?: number | null; ratio_status?: string; tecnicos_75km?: number }) => {
  if (item.ratio_status === 'NOT_CALCULABLE_ZERO_DENOMINATOR' || item.tecnicos_75km === 0) {
    return 'Não calculável (denominador zero)';
  }
  const value = item.ratio ?? item.carga_regional;
  return typeof value === 'number' && Number.isFinite(value) ? value.toLocaleString('pt-BR') : 'Não disponível';
};

const isWithinBrazil = (lat?: number, lng?: number) =>
  typeof lat === 'number' &&
  typeof lng === 'number' &&
  Number.isFinite(lat) &&
  Number.isFinite(lng) &&
  lat >= -33.75 &&
  lat <= 5.27 &&
  lng >= -73.99 &&
  lng <= -34.79 &&
  !(lat === 0 && lng === 0);

export default function AgroDesertoVeterinarioApproved() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = (searchParams.get('tab') as Tab) || 'resumo';
  const setTab = (next: Tab) => {
    const params = new URLSearchParams(searchParams);
    params.set('tab', next);
    setSearchParams(params, { replace: true });
  };

  const [stats, setStats] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [mapItems, setMapItems] = useState<any[]>([]);
  const [methodology, setMethodology] = useState<any>(null);
  const [detail, setDetail] = useState<any>(null);

  const [statsError, setStatsError] = useState<string | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [mapError, setMapError] = useState<string | null>(null);
  const [methodError, setMethodError] = useState<string | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);

  const [loadingStats, setLoadingStats] = useState(true);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingMap, setLoadingMap] = useState(false);
  const [loadingMethod, setLoadingMethod] = useState(false);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [pages, setPages] = useState(0);
  const [total, setTotal] = useState(0);
  const [q, setQ] = useState('');
  const [uf, setUf] = useState('');
  const [classe, setClasse] = useState('');
  const [selectedIbge, setSelectedIbge] = useState<string | null>(null);

  const loadStats = useCallback(async () => {
    setLoadingStats(true);
    setStatsError(null);
    try {
      const res = await httpClient.get(AGRO_API.desertoVeterinarioResumo);
      setStats(res.data);
    } catch (e: any) {
      setStatsError(e?.userMessage || e?.message || 'Resumo indisponível');
      setStats(null);
    } finally {
      setLoadingStats(false);
    }
  }, []);

  const loadList = useCallback(async () => {
    setLoadingList(true);
    setListError(null);
    try {
      const res = await httpClient.get(AGRO_API.desertoVeterinarioMunicipios, {
        params: {
          page,
          page_size: pageSize,
          q: q || undefined,
          uf: uf || undefined,
          classificacao: classe || undefined,
        },
      });
      setItems(res.data.items || []);
      setPages(res.data.total_pages || 0);
      setTotal(typeof res.data.total === 'number' ? res.data.total : 0);
    } catch (e: any) {
      setListError(e?.userMessage || e?.message || 'Lista municipal indisponível');
      setItems([]);
      setPages(0);
      setTotal(0);
    } finally {
      setLoadingList(false);
    }
  }, [page, pageSize, q, uf, classe]);

  const loadMap = useCallback(async () => {
    setLoadingMap(true);
    setMapError(null);
    try {
      const res = await httpClient.get(AGRO_API.desertoVeterinarioMapa, {
        params: {
          page: 1,
          page_size: 5000,
          uf: uf || undefined,
          classificacao: classe || undefined,
        },
      });
      setMapItems(res.data.items || []);
    } catch (e: any) {
      setMapError(e?.userMessage || e?.message || 'Mapa indisponível');
      setMapItems([]);
    } finally {
      setLoadingMap(false);
    }
  }, [uf, classe]);

  const loadMethod = useCallback(async () => {
    setLoadingMethod(true);
    setMethodError(null);
    try {
      const res = await httpClient.get(AGRO_API.desertoVeterinarioMetodologia);
      setMethodology(res.data);
    } catch (e: any) {
      setMethodError(e?.userMessage || e?.message || 'Metodologia indisponível');
      setMethodology(null);
    } finally {
      setLoadingMethod(false);
    }
  }, []);

  const loadDetail = useCallback(async (codigo: string) => {
    setDetailError(null);
    setSelectedIbge(codigo);
    try {
      const res = await httpClient.get(AGRO_API.desertoVeterinarioDetalhe(codigo));
      setDetail(res.data);
    } catch (e: any) {
      setDetail(null);
      setDetailError(e?.userMessage || e?.message || 'Detalhe municipal indisponível');
    }
  }, []);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  useEffect(() => {
    if (tab === 'municipios' || tab === 'resumo') loadList();
  }, [tab, loadList]);

  useEffect(() => {
    if (tab === 'mapa') loadMap();
  }, [tab, loadMap]);

  useEffect(() => {
    if (tab === 'metodologia') loadMethod();
  }, [tab, loadMethod]);

  const validMap = useMemo(
    () => mapItems.filter((x) => isWithinBrazil(Number(x.latitude), Number(x.longitude))),
    [mapItems],
  );

  const shellLoading =
    (tab === 'resumo' && loadingStats && !stats) ||
    (tab === 'municipios' && loadingList && !items.length) ||
    (tab === 'mapa' && loadingMap && !mapItems.length) ||
    (tab === 'metodologia' && loadingMethod && !methodology);

  const shellError =
    (tab === 'resumo' && statsError && !stats) ||
    (tab === 'municipios' && listError && !items.length) ||
    (tab === 'mapa' && mapError && !mapItems.length) ||
    (tab === 'metodologia' && methodError && !methodology)
      ? statsError || listError || mapError || methodError
      : null;

  const cards = [
    ['Municípios avaliados', stats?.municipios_avaliados ?? stats?.total_municipios],
    ['Deserto Veterinário', stats?.deserto_vet ?? stats?.deserto_vet_municipios],
    ['Baixa cobertura', stats?.baixa_cobertura ?? stats?.baixa_cobertura_municipios],
    ['Cobertura normal', stats?.cobertura_normal ?? stats?.normal_municipios],
    ['Rebanho no recorte', stats?.rebanho_no_recorte],
    [
      'Municípios sem presença técnica conhecida',
      stats?.presenca_tecnica_conhecida?.municipios_sem_presenca_conhecida,
    ],
  ] as const;

  const tabs: { id: Tab; label: string }[] = [
    { id: 'resumo', label: 'Visão Geral' },
    { id: 'municipios', label: 'Municípios' },
    { id: 'mapa', label: 'Mapa' },
    { id: 'metodologia', label: 'Metodologia' },
  ];

  return (
    <AgroPageShell
      title="Deserto Veterinário"
      subtitle="Carga bovina regional por presença técnica conhecida (CNAE elegível) em raio de 75 km — não comprova disponibilidade de atendimento."
      statusBadge="Presença técnica conhecida · PPM 2023"
      loading={shellLoading}
      error={shellError}
      onRetry={() => {
        loadStats();
        loadList();
        if (tab === 'mapa') loadMap();
        if (tab === 'metodologia') loadMethod();
      }}
      empty={false}
    >
      <div
        style={{
          ...cardStyle,
          display: 'flex',
          gap: 8,
          flexWrap: 'wrap',
          alignItems: 'center',
          background: 'rgba(245,158,11,0.08)',
          borderColor: 'rgba(245,158,11,0.35)',
        }}
      >
        <ShieldAlert size={18} color="#F59E0B" />
        <p style={{ margin: 0, fontSize: 12, color: '#CBD5E1', lineHeight: 1.5 }}>
          <strong>Aviso semântico:</strong> o denominador mede <em>presença técnica conhecida na base</em>{' '}
          (estabelecimentos CNPJ ativos com CNAEs elegíveis no raio municipal), não veterinários
          habilitados individualmente. Ausência na base ≠ ausência real de profissionais no território.
          CRMV informado permanece <code>NOT_VALIDATED</code> e não entra nesta regra. Rebanho: IBGE PPM{' '}
          {stats?.cattle_reference_year || 2023} (não é rebanho em tempo real).
        </p>
      </div>

      <nav style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }} aria-label="Abas Deserto Veterinário">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            style={{
              padding: '8px 14px',
              borderRadius: 8,
              border: tab === t.id ? '1px solid #3B82F6' : '1px solid #1E293B',
              background: tab === t.id ? 'rgba(59,130,246,0.15)' : '#0F172A',
              color: '#F8FAFC',
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {tab === 'resumo' && (
        <section style={{ display: 'grid', gap: 12 }}>
          {statsError && stats && (
            <div style={{ ...cardStyle, borderColor: '#F59E0B55' }}>{statsError}</div>
          )}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
              gap: 8,
            }}
          >
            {cards.map(([label, value]) => (
              <div className="card" key={label} style={cardStyle}>
                <b style={{ fontSize: 11, color: '#94A3B8' }}>{label}</b>
                <strong style={{ display: 'block', fontSize: 22, color: '#F8FAFC' }}>{fmt(value)}</strong>
              </div>
            ))}
          </div>
          <div style={cardStyle}>
            <b>Referência</b>
            <p style={{ margin: '8px 0 0', fontSize: 13, color: '#CBD5E1' }}>
              Fonte rebanho: {stats?.cattle_source || 'IBGE PPM'} · Ano:{' '}
              {stats?.cattle_reference_year || stats?.competencia || 'Não disponível'} · Versão da regra:{' '}
              {stats?.rule_version || 'deserto-regional-v3'} · Escopo técnico:{' '}
              {stats?.technical_scope || 'KNOWN_TECHNICAL_PRESENCE'} · Método:{' '}
              {stats?.geographic_method || 'centroides municipais / 75 km'}
            </p>
            {stats?.soma_classes_ok === false && (
              <p style={{ color: '#EF4444' }}>Inconsistência: soma das classes ≠ total avaliado.</p>
            )}
          </div>
          <div style={cardStyle}>
            <b>Amostra da lista</b>
            {listError ? (
              <p>{listError}</p>
            ) : (
              <div style={{ overflowX: 'auto', marginTop: 8 }}>
                <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      {['Município/UF', 'Rebanho', 'Presença técnica', 'Razão', 'Classificação', 'Motivo'].map(
                        (h) => (
                          <th key={h} style={{ textAlign: 'left', padding: 6, color: '#94A3B8' }}>
                            {h}
                          </th>
                        ),
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {items.slice(0, 10).map((x) => (
                      <tr key={x.codigo_ibge}>
                        <td style={{ padding: 6 }}>
                          <button
                            type="button"
                            onClick={() => loadDetail(String(x.codigo_ibge))}
                            style={{ background: 'none', border: 'none', color: '#60A5FA', cursor: 'pointer' }}
                          >
                            {x.municipio}/{x.uf}
                          </button>
                        </td>
                        <td style={{ padding: 6 }}>{fmt(x.cattle_total ?? x.bovinos_municipio)}</td>
                        <td style={{ padding: 6 }}>{fmt(x.known_technical_count ?? x.tecnicos_75km)}</td>
                        <td style={{ padding: 6 }}>{fmtRatio(x)}</td>
                        <td style={{ padding: 6, color: color[x.classification || x.classificacao] }}>
                          {labels[x.classification || x.classificacao] || x.classificacao}
                        </td>
                        <td style={{ padding: 6, fontSize: 11 }}>{x.classification_reason || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      )}

      {tab === 'municipios' && (
        <section style={{ display: 'grid', gap: 12 }}>
          <div style={{ ...cardStyle, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <input
              aria-label="Busca municipal"
              placeholder="Buscar município"
              value={q}
              onChange={(e) => {
                setPage(1);
                setQ(e.target.value);
              }}
            />
            <input
              aria-label="UF"
              placeholder="UF"
              value={uf}
              maxLength={2}
              onChange={(e) => {
                setPage(1);
                setUf(e.target.value.toUpperCase());
              }}
              style={{ width: 64 }}
            />
            <select
              aria-label="Classificação"
              value={classe}
              onChange={(e) => {
                setPage(1);
                setClasse(e.target.value);
              }}
            >
              <option value="">Todas</option>
              <option value="DESERTO_VET">Deserto Veterinário</option>
              <option value="BAIXA_COBERTURA">Baixa cobertura</option>
              <option value="NORMAL">Cobertura normal</option>
            </select>
            <select
              aria-label="Itens por página"
              value={pageSize}
              onChange={(e) => {
                setPage(1);
                setPageSize(Number(e.target.value));
              }}
            >
              {[25, 50, 100].map((n) => (
                <option key={n} value={n}>
                  {n} / página
                </option>
              ))}
            </select>
          </div>
          {listError && <div style={cardStyle}>{listError}</div>}
          <div className="card" style={{ ...cardStyle, overflowX: 'auto' }}>
            <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {[
                    'Município / UF',
                    'Código IBGE',
                    'Rebanho',
                    'Presença técnica conhecida',
                    'Razão',
                    'Classificação',
                    'Motivo',
                    'Referência',
                  ].map((h) => (
                    <th key={h} style={{ textAlign: 'left', padding: 6, color: '#94A3B8' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.map((x) => (
                  <tr key={x.codigo_ibge}>
                    <td style={{ padding: 6 }}>
                      <button
                        type="button"
                        onClick={() => loadDetail(String(x.codigo_ibge))}
                        style={{ background: 'none', border: 'none', color: '#60A5FA', cursor: 'pointer' }}
                      >
                        {x.municipio}/{x.uf}
                      </button>
                    </td>
                    <td style={{ padding: 6 }}>{x.codigo_ibge}</td>
                    <td style={{ padding: 6 }}>{fmt(x.cattle_total ?? x.bovinos_municipio)}</td>
                    <td style={{ padding: 6 }}>{fmt(x.known_technical_count ?? x.tecnicos_75km)}</td>
                    <td style={{ padding: 6 }}>{fmtRatio(x)}</td>
                    <td style={{ padding: 6, color: color[x.classification || x.classificacao] }}>
                      {labels[x.classification || x.classificacao] || x.classificacao}
                    </td>
                    <td style={{ padding: 6, fontSize: 11 }} title={x.classification_reason_text}>
                      {x.classification_reason || '—'}
                    </td>
                    <td style={{ padding: 6, fontSize: 11 }}>
                      PPM {x.cattle_reference_year || 2023}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              Anterior
            </button>
            <span>
              Página {page} de {pages || 1} · {fmt(total)} municípios
            </span>
            <button type="button" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>
              Próxima
            </button>
          </div>
        </section>
      )}

      {tab === 'mapa' && (
        <section style={{ display: 'grid', gap: 12 }}>
          {mapError && <div style={cardStyle}>{mapError}</div>}
          <div style={cardStyle}>
            <h3 style={{ marginTop: 0 }}>Mapa municipal</h3>
            <p style={{ fontSize: 12, color: '#94A3B8' }}>
              Agregação MUNICIPAL · bounds Brasil · sem pontos individuais de profissionais · retornados:{' '}
              {fmt(validMap.length)}
            </p>
            <MapContainer
              center={[-14.2, -51.9]}
              zoom={4}
              minZoom={3}
              maxBounds={BRAZIL_BOUNDS}
              style={{ height: 420, width: '100%' }}
            >
              <TileLayer
                attribution="&copy; OpenStreetMap"
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              {validMap.map((x) => (
                <Circle
                  key={x.codigo_ibge}
                  center={[Number(x.latitude), Number(x.longitude)]}
                  radius={Math.max(3000, Math.sqrt(Number(x.bovinos_municipio || x.cattle_total) || 0) * 45)}
                  pathOptions={{
                    color: color[x.classification || x.classificacao] || '#64748B',
                    fillColor: color[x.classification || x.classificacao] || '#64748B',
                    fillOpacity: 0.55,
                  }}
                  eventHandlers={{
                    click: () => loadDetail(String(x.codigo_ibge)),
                  }}
                >
                  <Tooltip>
                    <b>
                      {x.municipio}/{x.uf}
                    </b>
                    <br />
                    Rebanho (PPM {x.cattle_reference_year || 2023}): {fmt(x.cattle_total ?? x.bovinos_municipio)}
                    <br />
                    Presença técnica conhecida (75 km): {fmt(x.known_technical_count ?? x.tecnicos_75km)}
                    <br />
                    Razão: {fmtRatio(x)}
                    <br />
                    Classe: {labels[x.classification || x.classificacao] || x.classificacao}
                    <br />
                    Motivo: {x.classification_reason || '—'}
                  </Tooltip>
                </Circle>
              ))}
            </MapContainer>
            <div aria-label="Legenda" style={{ marginTop: 8, fontSize: 12 }}>
              🔴 Deserto Vet · 🟡 Baixa Cobertura · 🟢 Normal
            </div>
          </div>
        </section>
      )}

      {tab === 'metodologia' && (
        <section style={{ display: 'grid', gap: 12 }}>
          {methodError && <div style={cardStyle}>{methodError}</div>}
          {methodology && (
            <>
              <div style={cardStyle}>
                <h3 style={{ marginTop: 0 }}>Regra {methodology.rule_version}</h3>
                <p style={{ fontSize: 13, color: '#CBD5E1' }}>{methodology.summary}</p>
                <p style={{ fontSize: 12 }}>
                  Status da auditoria: <b>{methodology.rule_status}</b> · CLASSIFICATION_RULE_CHANGED ={' '}
                  {String(methodology.classification_rule_changed)}
                </p>
                <ol style={{ fontSize: 12, color: '#CBD5E1' }}>
                  {(methodology.rule?.order || []).map((line: string) => (
                    <li key={line}>{line}</li>
                  ))}
                </ol>
              </div>
              <div style={cardStyle}>
                <h3 style={{ marginTop: 0 }}>Rebanho</h3>
                <p style={{ fontSize: 13 }}>
                  Fonte: {methodology.cattle?.source} · Ano: {methodology.cattle?.year} · Espécie:{' '}
                  {methodology.cattle?.species} · Objeto: <code>{methodology.cattle?.object}</code>
                </p>
                <p style={{ fontSize: 12, color: '#F59E0B' }}>Não é rebanho atual/em tempo real.</p>
              </div>
              <div style={cardStyle}>
                <h3 style={{ marginTop: 0 }}>Presença técnica (denominador)</h3>
                <p style={{ fontSize: 13 }}>
                  Definição: <b>{methodology.technical_presence?.definition}</b> (não{' '}
                  {methodology.technical_presence?.not})
                </p>
                <p style={{ fontSize: 12 }}>CNAEs que entram (peso 1 cada estabelecimento ativo):</p>
                <ul style={{ fontSize: 12 }}>
                  {(methodology.technical_presence?.cnaes_included || []).map((c: any) => (
                    <li key={c.cnae}>
                      {c.cnae} — {c.label}
                    </li>
                  ))}
                </ul>
                <p style={{ fontSize: 12 }}>Excluídos da regra:</p>
                <ul style={{ fontSize: 12 }}>
                  {(methodology.technical_presence?.types_excluded || []).map((t: string) => (
                    <li key={t}>{t}</li>
                  ))}
                </ul>
                <p style={{ fontSize: 12 }}>
                  CRMV: {methodology.technical_presence?.crmv} · Deduplicação:{' '}
                  {methodology.technical_presence?.deduplication}
                </p>
              </div>
              <div style={cardStyle}>
                <h3 style={{ marginTop: 0 }}>Geografia — 75 km</h3>
                <p style={{ fontSize: 13 }}>
                  Método: {methodology.geography?.method}
                  <br />
                  Implementação: {methodology.geography?.implementation}
                  <br />
                  Pontos: {methodology.geography?.points}
                  <br />
                  mv_tecnico_geo: {methodology.geography?.mv_tecnico_geo} · distância individual de
                  profissional: {String(methodology.geography?.individual_professional_distance)}
                </p>
              </div>
              <div style={cardStyle}>
                <h3 style={{ marginTop: 0 }}>Limitações</h3>
                <ul style={{ fontSize: 12 }}>
                  {(methodology.limitations || []).map((l: string) => (
                    <li key={l}>{l}</li>
                  ))}
                </ul>
                <p style={{ fontSize: 12, color: '#F59E0B' }}>
                  {methodology.semantics?.absence_language}
                </p>
              </div>
            </>
          )}
        </section>
      )}

      {(detail || detailError) && (
        <aside style={{ ...cardStyle, borderColor: '#3B82F655' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
            <h3 style={{ margin: 0 }}>
              Detalhe {detail ? `${detail.municipio}/${detail.uf}` : selectedIbge}
            </h3>
            <button type="button" onClick={() => { setDetail(null); setDetailError(null); setSelectedIbge(null); }}>
              Fechar
            </button>
          </div>
          {detailError && <p>{detailError}</p>}
          {detail && (
            <div style={{ fontSize: 13, color: '#CBD5E1', display: 'grid', gap: 6, marginTop: 8 }}>
              <p>
                <b>Classificação:</b>{' '}
                <span style={{ color: color[detail.classification] }}>
                  {detail.classification_label || detail.classification}
                </span>
              </p>
              <p>
                <b>Motivo:</b> {detail.classification_reason} — {detail.classification_reason_text}
              </p>
              <p>
                <b>Versão da regra:</b> {detail.rule_version}
              </p>
              <p>
                <b>Rebanho municipal:</b> {fmt(detail.cattle_total)} (PPM {detail.cattle_reference_year})
              </p>
              <p>
                <b>Presença técnica conhecida (75 km):</b> {fmt(detail.known_technical_count)} ·{' '}
                {detail.known_technical_definition}
              </p>
              <p>
                <b>Razão:</b> {fmtRatio(detail)} ({detail.ratio_status})
              </p>
              <p>
                <b>Thresholds:</b> piso {detail.thresholds?.piso_bovinos_municipio} · deserto ≥{' '}
                {detail.thresholds?.carga_deserto} · baixa ≥ {detail.thresholds?.carga_baixa} · raio{' '}
                {detail.radius_km} km
              </p>
              <p>
                <b>Método territorial:</b> {detail.geographic_method}
              </p>
              <p>
                <b>CRMV:</b> {detail.crmv_policy} (não usado na regra)
              </p>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
                <Link className="radar-btn" to="/agro/tecnicos">
                  <MapPin size={13} /> Canal Técnico
                </Link>
                <Link className="radar-btn" to="/agro/propriedades">
                  Propriedades
                </Link>
                <Link className="radar-btn" to="/agro/oportunidades">
                  Radar de Oportunidades
                </Link>
                <Link className="radar-btn" to="/agro/logistica">
                  Agro-Logística
                </Link>
              </div>
              <p style={{ fontSize: 11, color: '#64748B' }}>
                Links contextuais — nenhum implica vínculo comercial.
              </p>
              <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start', marginTop: 4 }}>
                <Info size={14} color="#94A3B8" />
                <span style={{ fontSize: 11 }}>
                  {(detail.limitations || []).slice(0, 3).join(' · ')}
                </span>
              </div>
            </div>
          )}
        </aside>
      )}

      <aside style={cardStyle}>
        <b>Nota metodológica</b>
        <p style={{ fontSize: 12, color: '#94A3B8', lineHeight: 1.55 }}>
          A classificação utiliza a carga bovina regional por técnico em um raio de 75 km. Ela representa
          cobertura potencial da base disponível e não comprova disponibilidade, vínculo contratual ou
          atuação efetiva do profissional. Fonte: prospeccao.v_white_space_pecuaria · competência{' '}
          {stats?.competencia || 'IBGE PPM 2023'}.
        </p>
        {!stats && !loadingStats && (
          <p style={{ fontSize: 12, color: '#F59E0B', display: 'flex', gap: 6, alignItems: 'center' }}>
            <AlertTriangle size={14} /> KPIs de resumo indisponíveis neste momento.
          </p>
        )}
      </aside>
    </AgroPageShell>
  );
}
