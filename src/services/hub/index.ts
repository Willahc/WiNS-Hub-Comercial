import type { HubCompany, HubOpportunity, HubEvent, VerticalAsset, TerritoryProfile, VerticalKey, HubFilters, HubDataset, OverviewEntity } from '../../types/hub';
import { httpClient } from '../http/client';

export interface Page<T> {
  items: T[];
  meta?: { page: number; pageSize: number; total: number; returned: number; source?: string; lastUpdatedAt?: string };
}

interface ApiCompany {
  source_id: string;
  razao_social: string;
  nome_fantasia?: string;
  porte?: string;
  capital_social?: number;
  qualityScore?: number;
  municipio?: string;
  uf?: string;
  source_updated_at?: string;
}

interface ApiOpportunity {
  source_id: string;
  cnpj: string;
  obra_nome: string;
  municipio?: string;
  uf?: string;
  score?: number;
}

async function loadHubData(filters?: HubFilters): Promise<HubDataset> {
  const scope = filters?.scope || 'BR';
  const uf = filters?.uf || '';
  const baseParams: Record<string, any> = { page: 1, page_size: 50 };
  if (scope === 'UF' && uf) baseParams.uf = uf;

  const reqs = [
    httpClient.get<Page<ApiCompany>>('/empresas', { params: { ...baseParams, active: true } }),
    httpClient.get<Page<ApiOpportunity>>('/oportunidades', { params: { page_size: 100, min_score: 70, ...(uf ? { uf } : {}) } }),
    httpClient.get<any[]>('/eventos', { params: uf ? { uf } : {} }),
    httpClient.get<Page<any>>('/engenharia/obras', { params: { page: 1, page_size: 25, sort: 'updated_desc', ...(uf ? { uf } : {}) } }),
    httpClient.get<Page<any>>('/diretorios/agro/imoveis', { params: { page: 1, page_size: 25, sort: 'updated_desc', ...(uf ? { uf } : {}) } }),
    httpClient.get<Page<any>>('/diretorios/logistica/transportadores', { params: { page: 1, page_size: 25, sort: 'updated_desc', ...(uf ? { uf } : {}) } }),
    httpClient.get<Page<any>>('/diretorios/saude/estabelecimentos', { params: { page: 1, page_size: 25, sort: 'updated_desc', ...(uf ? { uf } : {}) } }),
    httpClient.get<{ items: any[] }>('/visao-geral/mapa', { params: uf ? { uf } : {} }),
  ];

  const results = await Promise.allSettled(reqs);

  const getRes = <T>(idx: number, fallback: T): T => {
    const r = results[idx];
    if (r.status === 'fulfilled' && r.value && r.value.data) {
      return r.value.data as T;
    }
    return fallback;
  };

  const companiesData = getRes<Page<ApiCompany>>(0, { items: [] });
  const opportunitiesData = getRes<Page<ApiOpportunity>>(1, { items: [] });
  const eventsData = getRes<any[]>(2, []);
  const worksData = getRes<Page<any>>(3, { items: [] });
  const ruralData = getRes<Page<any>>(4, { items: [] });
  const carrierData = getRes<Page<any>>(5, { items: [] });
  const healthData = getRes<Page<any>>(6, { items: [] });
  const mapData = getRes<{ items: any[] }>(7, { items: [] });

  const events: HubEvent[] = (eventsData || []).map((e: any) => ({
    id: e.id,
    title: e.titulo || e.title || 'Evento de Engenharia',
    type: e.tipo || 'obra',
    territory: e.territorio || e.municipio || '—',
    status: e.status || 'ativo',
    value: Number(e.valor) || 0,
    severity: e.severidade || 'media',
    verticals: e.verticals || ['engenharia'],
    companyIds: e.companyIds || [],
    opportunityIds: e.opportunityIds || [],
    assetIds: e.assetIds || [],
    coordinates: e.coordinates || [-15.78, -47.92],
    date: e.data || e.date || '—',
    description: e.descricao || '',
    source: e.fonte || 'wins_agro.engenharia.obras',
  }));

  const companies: HubCompany[] = (companiesData.items || []).map(c => ({
    id: c.source_id,
    name: c.razao_social || 'Sem razão social',
    tradeName: c.nome_fantasia || c.razao_social || 'Empresa',
    cnpj: c.source_id,
    segment: c.porte || 'Engenharia',
    territory: `${c.municipio || 'Município não informado'}, ${c.uf || '—'}`,
    verticals: ['engenharia'],
    score: Number(c.qualityScore) || 50,
    revenue: Number(c.capital_social) || 0,
    employees: 0,
    relationships: [],
    eventIds: [],
    opportunityIds: [],
    history: [{ date: c.source_updated_at ? new Date(c.source_updated_at).toLocaleDateString('pt-BR') : 'Sem data', title: 'Cadastro real atualizado' }],
    sources: ['wins_agro.core.empresa'],
  }));

  const opportunities: HubOpportunity[] = (opportunitiesData.items || []).map(o => ({
    id: o.source_id,
    title: `Fornecedor relacionado a ${o.obra_nome}`,
    vertical: 'engenharia',
    territory: `${o.municipio || 'Não informado'}, ${o.uf || '—'}`,
    value: 0,
    stage: Number(o.score) >= 85 ? 'Qualificação' : 'Identificada',
    companyId: o.cnpj,
    eventId: '',
    score: Math.round(Number(o.score) || 0),
    justification: `Match real da Engenharia com score ${o.score}. Valor estimado por predição algorítmica.`,
    owner: 'Engenharia',
    nextStep: 'Validar oportunidade comercial',
  }));

  for (const o of opportunities) {
    const c = companies.find(x => x.id === o.companyId);
    if (c) c.opportunityIds.push(o.id);
  }

  let entities: OverviewEntity[] = [];
  const add = (rows: any[], vertical: OverviewEntity['vertical'], kind: string, path: (r: any) => string) =>
    (rows || []).forEach(r => {
      const municipality = r.municipio || r.municipio_nome || r.municipio_atuacao || 'Município não informado';
      const ufVal = r.uf || r.uf_atuacao || '';
      entities.push({
        id: String(r.source_id || r.id || r.numero_rntrc || r.cnes_id),
        name: r.display_name || r.nome || r.nome_imovel || r.nome_transportador || r.nome_fantasia || r.razao_social || kind,
        vertical,
        kind,
        municipality,
        uf: ufVal,
        territory: `${municipality}${ufVal ? `, ${ufVal}` : ''}`,
        source: r.source || r.fonte || r.fonte_principal || 'Fonte oficial',
        updatedAt: r.source_updated_at || r.atualizado_em || r.data_atualizacao_cnes,
        detailPath: path(r),
        latitude: 0,
        longitude: 0,
        geoPrecision: 'municipality',
      });
    });

  add(worksData.items || [], 'engenharia', 'Obra', r => `/engenharia/obras/${r.source_id || r.id}`);
  add(ruralData.items || [], 'agro', 'Imóvel rural', r => `/agro/diretorios/imoveis/${r.source_id}`);
  add(carrierData.items || [], 'logistica', 'Transportador RNTRC', r => `/logistica/diretorios/transportadores/${r.source_id}`);
  add(healthData.items || [], 'saude', 'Estabelecimento CNES', r => `/saude/estabelecimentos/${r.cnes_id || r.source_id}`);

  opportunities.slice(0, 25).forEach(o => entities.push({
    id: o.id,
    name: o.title,
    vertical: 'oportunidades',
    kind: 'Oportunidade',
    municipality: o.territory.split(',')[0],
    uf: o.territory.split(',')[1]?.trim() || '',
    territory: o.territory,
    source: 'Engenharia · matches_v2',
    detailPath: `/engenharia/oportunidades/${o.id}`,
    latitude: 0,
    longitude: 0,
    geoPrecision: 'municipality',
  }));

  if (mapData.items && mapData.items.length > 0) {
    entities = mapData.items.map((x: any) => ({
      ...x,
      territory: `${x.municipality}${x.uf ? `, ${x.uf}` : ''}`,
      latitude: Number(x.latitude),
      longitude: Number(x.longitude),
    }));
  }

  const workRows = worksData.items || [];
  return {
    events,
    companies,
    opportunities,
    assets: [],
    territories: [],
    overview: {
      counts: {
        works: Number(worksData.meta?.total || workRows.length),
        companies: Number(companiesData.meta?.total || companies.length),
        ruralProperties: Number(ruralData.meta?.total || 0),
        carriers: Number(carrierData.meta?.total || 0),
        healthEstablishments: Number(healthData.meta?.total || 0),
        opportunities: Number(opportunitiesData.meta?.total || opportunities.length),
        confirmedRelations: workRows.filter((r: any) => r.cnpj || r.empresa_cnpj).length,
        potentialRelations: new Set(entities.filter(x => x.municipality !== 'Município não informado').map(x => `${x.municipality}/${x.uf}`)).size,
      },
      entities,
    },
    appliedFilters: { scope, uf },
  };
}

export const hubService = {
  load: loadHubData,
  async getEvents(filters?: HubFilters): Promise<HubEvent[]> { return (await loadHubData(filters)).events; },
  async getEvent(id: string): Promise<HubEvent | undefined> { return (await loadHubData()).events.find((x: HubEvent) => x.id === id); },
  async getCompanies(): Promise<HubCompany[]> { return (await loadHubData()).companies; },
  async getCompany(id: string): Promise<HubCompany | undefined> {
    const { data } = await httpClient.get(`/empresas/${id}`);
    return {
      id: data.cnpj,
      name: data.legalName || 'Sem razão social',
      tradeName: data.tradeName || data.legalName || 'Empresa',
      cnpj: data.cnpj,
      segment: data.supplierProfile?.segment || 'Engenharia',
      territory: `${data.address?.municipality || 'Não informado'}, ${data.address?.state || '—'}`,
      verticals: ['engenharia'],
      score: Number(data.qualityScore) || 50,
      revenue: Number(data.capital) || 0,
      employees: 0,
      relationships: (data.works || []).map((w: { nome: string }) => w.nome),
      eventIds: [],
      opportunityIds: [],
      history: [{ date: data.lastUpdatedAt ? new Date(data.lastUpdatedAt).toLocaleDateString('pt-BR') : 'Sem data', title: 'Cadastro real consolidado' }],
      sources: [`${data.provenance?.sourceSchema}.${data.provenance?.sourceTable}`],
    };
  },
  async getOpportunities(): Promise<HubOpportunity[]> { return (await loadHubData()).opportunities; },
  async getAssets(vertical?: VerticalKey): Promise<VerticalAsset[]> { const x = (await loadHubData()).assets; return vertical ? x.filter((a: VerticalAsset) => a.vertical === vertical) : x; },
  async getTerritories(): Promise<TerritoryProfile[]> { return (await loadHubData()).territories; },
};
