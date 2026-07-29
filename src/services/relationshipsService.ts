import { httpClient } from './http/client';
import { realHubService } from './realHubService';
import type { CatalogEntity, CatalogEdge } from './relationshipCatalog';

export interface RelationshipsApiParams {
  entidade?: string;
  tipo?: string;
  classificacao?: string;
  confianca_min?: number;
  vertical_origem?: string;
  vertical_destino?: string;
  uf?: string;
  tipo_relacao?: string;
  fonte?: string;
  revisao_pendente?: boolean;
  limite_nos?: number;
  page?: number;
  page_size?: number;
}

export interface RelationshipsApiResponse {
  entity: {
    id: string;
    nome: string;
    tipo: string;
    documento: string;
    municipio: string;
    uf: string;
    vertical: string;
    rota: string | null;
    atualizado_em: string;
  };
  nodes: CatalogEntity[];
  edges: CatalogEdge[];
  meta: {
    total_entidades: number;
    total_relacoes: number;
    exibindo: number;
    confirmadas: number;
    provaveis: number;
    potenciais: number;
    revisao_pendente: number;
    confianca_media: number;
    metodo_calculo: string;
    pagina: number;
    page_size: number;
    cache_key: string;
  };
}

export interface EntitySearchResult {
  id: string;
  nome: string;
  tipo: string;
  documento: string;
  municipio: string;
  uf: string;
  fonte: string;
  rota: string | null;
}

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const CACHE_TTL = 5 * 60 * 1000;
const cache = new Map<string, CacheEntry<any>>();

class RelationshipsService {
  private currentAbortController: AbortController | null = null;

  private getCacheKey(params: RelationshipsApiParams): string {
    return JSON.stringify(params);
  }

  async searchEntities(
    query: string,
    abortSignal?: AbortSignal
  ): Promise<EntitySearchResult[]> {
    const cacheKey = `search:${query}`;
    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.data;
    }

    try {
      const res = await httpClient.get<{ query: string; suggestions: {
        id: string; type: string; title: string; subtitle: string;
        identifier: string; municipality: string; uf: string;
        vertical: string; destination_route: string;
      }[] }>('/search/suggest', {
        params: { q: query },
        signal: abortSignal,
      });

      const result: EntitySearchResult[] = (res.data.suggestions || []).map(s => ({
        id: s.id,
        nome: s.title,
        tipo: s.type,
        documento: s.identifier,
        municipio: s.municipality,
        uf: s.uf,
        fonte: s.vertical,
        rota: s.destination_route || null,
      }));

      cache.set(cacheKey, { data: result, timestamp: Date.now() });
      return result;
    } catch {
      return [];
    }
  }

  async getRelacionamentos(
    params: RelationshipsApiParams & { signal?: AbortSignal }
  ): Promise<RelationshipsApiResponse> {
    if (this.currentAbortController) {
      this.currentAbortController.abort();
    }

    const cacheKey = this.getCacheKey(params);
    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.data;
    }

    this.currentAbortController = new AbortController();
    const signal = params.signal || this.currentAbortController.signal;

    const pageSize = params.page_size || 25;
    const page = params.page || 1;

    const timeoutMs = 20000;
    let timedOut = false;
    const timeoutId = setTimeout(() => {
      timedOut = true;
      this.currentAbortController?.abort();
    }, timeoutMs);

    try {
      const apiParams: any = {};
      if (params.entidade) apiParams.cnpj = params.entidade;
      if (params.uf) apiParams.municipality = params.uf;
      if (params.vertical_origem) apiParams.work_id = params.vertical_origem;
      apiParams.page = page;
      apiParams.page_size = pageSize;

      const response = await realHubService.getRelacionamentos(apiParams);

      if (timedOut) {
        throw new Error('Serviço temporariamente indisponível.');
      }

      const nodes: CatalogEntity[] = (response.nodes || []).map((n: any) => ({
        id: n.id || n.entity_id,
        name: n.label || n.nome,
        type: (n.type || n.tipo || 'empresa') as CatalogEntity['type'],
        identifier: n.sub || n.documento || n.identifier || '',
        mun: n.municipality || n.municipio || '',
        uf: n.uf || '',
        source: n.source || n.fonte || 'API',
        route: n.route || n.rota || undefined,
      }));

      const edges: CatalogEdge[] = (response.edges || []).map((e: any) => ({
        id: e.id || e.relationship_id,
        source: e.source || e.source_id,
        sourceType: e.sourceType || e.tipo_origem || 'empresa',
        target: e.target || e.target_id,
        targetType: e.targetType || e.tipo_destino || 'empresa',
        label: e.label || e.tipo_relacao || 'relacionamento',
        tipo_relacao: e.tipo_relacao || e.label || '',
        confidence: e.confidence ?? e.score ?? 0,
        classification: (e.classification || e.classificacao || 'POTENCIAL') as 'CONFIRMADO' | 'PROVÁVEL' | 'POTENCIAL',
        score_components: e.score_components || e.componentes_score || [],
        evidence: e.evidence || e.evidencia || '',
        fonte: e.fonte || e.sourceSystem || '',
        tipo_fonte: (e.tipo_fonte || 'contextual') as any,
        sourceSystem: e.sourceSystem || e.fonte || '',
        updatedAt: e.updatedAt || e.atualizado_em || e.updated_at || '',
        calculado_em: e.calculado_em || e.calculadoEm || '',
        verificado_em: e.verificado_em || e.verificadoEm || null,
        versao_regra: e.versao_regra || e.versaoRegra || 'regra-cruzamento-v1.0',
        limitacoes: e.limitacoes || '',
        status_revisao: (e.status_revisao || e.statusRevisao || 'pendente') as any,
        provenance: e.provenance || `${e.sourceType || 'api'}.${e.targetType || 'api'}`,
      }));

      const meta = response.meta || {
        total_entidades: nodes.length,
        total_relacoes: edges.length,
        exibindo: edges.length,
        confirmadas: edges.filter((ed: CatalogEdge) => ed.classification === 'CONFIRMADO').length,
        provaveis: edges.filter((ed: CatalogEdge) => ed.classification === 'PROVÁVEL').length,
        potenciais: edges.filter((ed: CatalogEdge) => ed.classification === 'POTENCIAL').length,
        revisao_pendente: edges.filter((ed: CatalogEdge) => ed.status_revisao === 'pendente').length,
        confianca_media: edges.length > 0
          ? edges.reduce((s: number, ed: CatalogEdge) => s + ed.confidence, 0) / edges.length
          : 0,
        metodo_calculo: 'media_aritmetica_simples',
        pagina: page,
        page_size: pageSize,
        cache_key: cacheKey,
      };

      const result: RelationshipsApiResponse = {
        entity: {
          id: response.entity?.cnpj || response.entity?.work_id || params.entidade || '',
          nome: nodes[0]?.name || '',
          tipo: nodes[0]?.type || 'empresa',
          documento: response.entity?.cnpj || '',
          municipio: response.entity?.municipality || '',
          uf: response.entity?.uf || '',
          vertical: nodes[0]?.type || '',
          rota: nodes[0]?.route || null,
          atualizado_em: new Date().toISOString(),
        },
        nodes,
        edges,
        meta: meta as any,
      };

      cache.set(cacheKey, { data: result, timestamp: Date.now() });

      return result;
    } catch (err: any) {
      if (err?.name === 'AbortError' || err?.code === 'ERR_CANCELED') {
        throw err;
      }
      clearTimeout(timeoutId);
      throw err;
    } finally {
      clearTimeout(timeoutId);
      if (this.currentAbortController?.signal.aborted === false) {
        this.currentAbortController = null;
      }
    }
  }

  async updateReviewStatus(
    relationshipId: string,
    novaClassificacao: 'CONFIRMADO' | 'PROVÁVEL' | 'POTENCIAL',
    justificativa: string
  ): Promise<void> {
    const payload = {
      relationship_id: relationshipId,
      classificacao_nova: novaClassificacao,
      justificativa,
    };

    await httpClient.post(`/relacionamentos/${relationshipId}/review`, payload);
  }

  clearCache(): void {
    cache.clear();
  }

  cancelRequest(): void {
    if (this.currentAbortController) {
      this.currentAbortController.abort();
      this.currentAbortController = null;
    }
  }
}

export const relationshipsService = new RelationshipsService();
