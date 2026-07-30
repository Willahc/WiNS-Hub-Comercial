import { httpClient } from './http/client';

export interface AgroImovel {
  source_id: string;
  codigo_car: string;
  nome_imovel?: string;
  nome_proprietario?: string;
  cpf_cnpj?: string;
  municipio: string;
  uf: string;
  area_total_ha?: number;
  area_pasto_ha?: number;
  fonte_principal: string;
  source_updated_at?: string;
  confidenceLevel: string;
  provenance: any;
}

export interface AgroTecnico {
  source_id: string;
  nome: string;
  titulo?: string;
  registro_crea?: string;
  municipio: string;
  uf: string;
  situacao?: string;
  fonte?: string;
  source_updated_at?: string;
  confidenceLevel: string;
  provenance: any;
}

export interface LogisticaTransportador {
  source_id: string;
  nome_transportador: string;
  numero_rntrc: string;
  categoria_transportador?: string;
  cpfcnpjtransportador?: string;
  situacao_rntrc?: string;
  municipio: string;
  uf: string;
  source_updated_at?: string;
  confidenceLevel: string;
  provenance: any;
}

export interface SaudeEstabelecimento {
  source_id: string;
  cnes_id: number;
  cnpj?: string;
  razao_social?: string;
  nome_fantasia?: string;
  uf: string;
  municipio?: string;
  telefone?: string;
  email?: string;
  tem_internacao?: boolean;
  tem_cirurgia?: boolean;
  atende_sus?: boolean;
  decisor_nome?: string;
  decisor_cargo?: string;
  source_updated_at?: string;
  confidenceLevel: string;
  provenance: any;
}

export interface RelationshipGraph {
  entity: { cnpj?: string; workId?: string; municipality?: string; uf?: string };
  nodes: { id: string; type: string; label: string; sub: string; source: string; updatedAt: string }[];
  edges: any[];
  crossVerticalSummary: {
    engenharia_logistica: RelationshipLink[];
    engenharia_agro: RelationshipLink[];
    agro_logistica: RelationshipLink[];
    agro_saude: RelationshipLink[];
  };
}

export interface RelationshipLink {
  title: string;
  detail: string;
  relation_type: string;
  evidence_type: string;
  source: string;
  confidence: 'CONFIRMADO' | 'PROVÁVEL' | 'POTENCIAL' | 'NÃO IDENTIFICADO';
  updated_at?: string | null;
}

export const realHubService = {
  async getAgroImoveis(params?: { page?: number; page_size?: number; search?: string; municipality?: string; uf?: string }) {
    const res = await httpClient.get<{ items: AgroImovel[]; meta: any }>('/agro/imoveis', { params });
    return res.data;
  },
  async getAgroTecnicos(params?: { page?: number; page_size?: number; search?: string; municipality?: string; uf?: string }) {
    const res = await httpClient.get<{ items: AgroTecnico[]; meta: any }>('/agro/tecnicos', { params });
    return res.data;
  },
  async getAgroVeterinariaClassificacao() {
    const res = await httpClient.get('/agro/veterinaria/classificacao');
    return res.data;
  },
  async getAgroImovel(id: string) {
    const res = await httpClient.get(`/agro/imoveis/${encodeURIComponent(id)}`);
    return res.data;
  },
  async getAgroReprodutores(params?: { page?: number; page_size?: number; search?: string; breed?: string; uf?: string }) {
    const res = await httpClient.get('/agro/reprodutores', { params });
    return res.data;
  },
  async getAgroReprodutor(id: string) {
    const res = await httpClient.get(`/agro/reprodutores/${encodeURIComponent(id)}`);
    return res.data;
  },
  async getAgroGenealogia(id: string) {
    const res = await httpClient.get(`/agro/genealogia/${encodeURIComponent(id)}`);
    return res.data;
  },
  async getAgroDoadoras() {
    const res = await httpClient.get('/agro/doadoras');
    return res.data;
  },
  async getAgroEmbrioes() {
    const res = await httpClient.get('/agro/embrioes');
    return res.data;
  },
  async getLogisticaTransportadores(params?: { page?: number; page_size?: number; search?: string; municipality?: string; uf?: string }) {
    const res = await httpClient.get<{ items: LogisticaTransportador[]; meta: any }>('/logistica/transportadores', { params });
    return res.data;
  },
  async getSaudeEstabelecimentos(params?: { page?: number; page_size?: number; search?: string; municipality?: string; uf?: string }) {
    const res = await httpClient.get<{ items: SaudeEstabelecimento[]; meta: any }>('/saude/estabelecimentos', { params });
    return res.data;
  },
  async getSaudeEstabelecimento(cnes: string) {
    const [detail, capacidade, profissionais, equipamentos] = await Promise.all([
      httpClient.get(`/saude/estabelecimentos/${encodeURIComponent(cnes)}`),
      httpClient.get(`/saude/estabelecimentos/${encodeURIComponent(cnes)}/capacidade`),
      httpClient.get(`/saude/estabelecimentos/${encodeURIComponent(cnes)}/profissionais`),
      httpClient.get(`/saude/estabelecimentos/${encodeURIComponent(cnes)}/equipamentos`),
    ]);
    return { detail: detail.data, capacidade: capacidade.data, profissionais: profissionais.data, equipamentos: equipamentos.data };
  },
  async getRelacionamentos(params?: { cnpj?: string; municipality?: string; uf?: string; work_id?: string }) {
    const res = await httpClient.get<RelationshipGraph>('/relacionamentos', { params });
    return res.data;
  },
  async getObra(id: string) {
    const res = await httpClient.get(`/engenharia/obras/${id}`);
    return res.data;
  }
};
