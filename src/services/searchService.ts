import { httpClient } from './http/client';
import { MASTER_SEARCH_INDEX } from './globalSearchDatabase';
import { ALL_27_UFS } from './canonicalTerritorialService';

export interface ServerSearchResponse {
  query: string;
  detected_types: string[];
  ambiguity_message?: string;
  total: number;
  counts_by_type: {
    empresas: number;
    obras: number;
    transportadores: number;
    imoveis_car: number;
    estabelecimentos_cnes: number;
    municipios: number;
    oportunidades: number;
    eventos: number;
  };
  facets: {
    verticals: Record<string, number>;
    ufs: Record<string, number>;
  };
  page: number;
  page_size: number;
  results: ServerSearchResult[];
}

export interface ServerSearchResult {
  entity_id: string;
  entity_type: 'empresa' | 'obra' | 'transportador' | 'imovel_car' | 'estabelecimento_cnes' | 'municipio' | 'oportunidade' | 'evento' | 'pessoa';
  primary_label: string;
  secondary_label: string;
  identifier: string;
  identifier_type: string;
  municipality: string;
  uf: string;
  ibge: string;
  verticals: string[];
  source: string;
  updated_at: string;
  match_type: string;
  match_score: number;
  match_reason: string;
  destination_route: string;
  quality_score: number;
  status: string;
}

export interface SuggestionItem {
  id: string;
  type: string;
  title: string;
  subtitle: string;
  identifier: string;
  municipality: string;
  uf: string;
  vertical: string;
  destination_route: string;
}

export const searchService = {
  async executeSearch(params: {
    q: string;
    types?: string;
    verticals?: string;
    uf?: string;
    municipality_id?: string;
    page?: number;
    page_size?: number;
    sort?: string;
  }): Promise<ServerSearchResponse> {
    try {
      const res = await httpClient.get<ServerSearchResponse>('/search', { params });
      return res.data;
    } catch (e) {
      // Server-side fallback contract matching /api/v1/search
      return this.localSearchFallback(params);
    }
  },

  async suggest(q: string): Promise<{ query: string; suggestions: SuggestionItem[] }> {
    try {
      const res = await httpClient.get<{ query: string; suggestions: SuggestionItem[] }>('/search/suggest', { params: { q } });
      return res.data;
    } catch (e) {
      const res = this.localSearchFallback({ q, page: 1, page_size: 6 });
      return {
        query: q,
        suggestions: res.results.map(r => ({
          id: r.entity_id,
          type: r.entity_type,
          title: r.primary_label,
          subtitle: r.secondary_label,
          identifier: r.identifier,
          municipality: r.municipality,
          uf: r.uf,
          vertical: r.verticals[0] || 'Geral',
          destination_route: r.destination_route
        }))
      };
    }
  },

  async fetchDetail(id: string): Promise<ServerSearchResult> {
    try {
      const res = await httpClient.get<ServerSearchResult>('/search/detail', { params: { id } });
      return res.data;
    } catch (e) {
      const item = MASTER_SEARCH_INDEX.find(i => i.id === id || i.identifier === id);
      if (item) {
        return {
          entity_id: item.id,
          entity_type: item.type,
          primary_label: item.title,
          secondary_label: item.subtitle,
          identifier: item.identifier,
          identifier_type: item.identifierType.toLowerCase(),
          municipality: item.municipality,
          uf: item.uf,
          ibge: item.ibge,
          verticals: [item.vertical],
          source: item.source,
          updated_at: item.updatedAt,
          match_type: item.matchType,
          match_score: item.matchConfidence,
          match_reason: 'Match validado por identificador',
          destination_route: item.navigationUrl,
          quality_score: item.qualityScore,
          status: item.status
        };
      }
      throw e;
    }
  },

  localSearchFallback(params: {
    q: string;
    types?: string;
    verticals?: string;
    uf?: string;
    municipality_id?: string;
    page?: number;
    page_size?: number;
    sort?: string;
  }): ServerSearchResponse {
    const q = (params.q || '').trim().toLowerCase();
    const cleanDigits = q.replace(/\D/g, '');

    const detected_types: string[] = [];
    if (cleanDigits.length === 14) detected_types.push('cnpj');
    if (cleanDigits.length === 11) detected_types.push('cpf');
    if (cleanDigits.length === 7 && '12345'.includes(cleanDigits[0])) detected_types.push('ibge');
    if (cleanDigits.length === 7 && '235'.includes(cleanDigits[0])) detected_types.push('cnes');
    if (q.includes('rntrc') || (cleanDigits.length >= 6 && cleanDigits.length <= 8 && !detected_types.length)) detected_types.push('rntrc');

    const ambiguity_message = detected_types.length > 1 ? 'Encontramos possíveis correspondências em diferentes categorias.' : undefined;

    const filtered = MASTER_SEARCH_INDEX.filter(item => {
      const matchesQ =
        item.title.toLowerCase().includes(q) ||
        item.subtitle.toLowerCase().includes(q) ||
        item.identifier.toLowerCase().includes(q) ||
        item.municipality.toLowerCase().includes(q) ||
        item.ibge.includes(q);

      if (!matchesQ) return false;

      if (params.types && item.type !== params.types) return false;
      if (params.uf && item.uf !== params.uf) return false;
      return true;
    });

    const page = params.page || 1;
    const page_size = params.page_size || 20;
    const start = (page - 1) * page_size;
    const paginated = filtered.slice(start, start + page_size);

    return {
      query: params.q,
      detected_types,
      ambiguity_message,
      total: filtered.length,
      counts_by_type: {
        empresas: filtered.filter(i => i.type === 'empresa').length,
        obras: filtered.filter(i => i.type === 'obra').length,
        transportadores: filtered.filter(i => i.type === 'transportador').length,
        imoveis_car: filtered.filter(i => i.type === 'imovel_car').length,
        estabelecimentos_cnes: filtered.filter(i => i.type === 'estabelecimento_cnes').length,
        municipios: filtered.filter(i => i.type === 'municipio').length,
        oportunidades: filtered.filter(i => i.type === 'oportunidade').length,
        eventos: filtered.filter(i => i.type === 'evento').length
      },
      facets: {
        verticals: { Engenharia: filtered.length, Logística: filtered.length, Agro: filtered.length, Saúde: filtered.length },
        ufs: Object.fromEntries(ALL_27_UFS.map(u => [u.sigla, filtered.filter(i => i.uf === u.sigla).length]))
      },
      page,
      page_size,
      results: paginated.map(i => ({
        entity_id: i.id,
        entity_type: i.type,
        primary_label: i.title,
        secondary_label: i.subtitle,
        identifier: i.identifier,
        identifier_type: i.identifierType.toLowerCase(),
        municipality: i.municipality,
        uf: i.uf,
        ibge: i.ibge,
        verticals: [i.vertical],
        source: i.source,
        updated_at: i.updatedAt,
        match_type: i.matchType,
        match_score: i.matchConfidence,
        match_reason: `Match validado para ${i.identifierType}`,
        destination_route: i.navigationUrl,
        quality_score: i.qualityScore,
        status: i.status
      }))
    };
  }
};
