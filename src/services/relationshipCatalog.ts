export interface CatalogEntity {
  id: string;
  name: string;
  type: 'empresa' | 'obra' | 'transportador' | 'imovel_car' | 'estabelecimento_cnes' | 'municipio' | 'oportunidade' | 'evento';
  identifier: string;
  mun: string;
  uf: string;
  source: string;
  route?: string;
}

export interface ScoreComponent {
  nome: string;
  peso: number;
  contribuicao: number;
  valor: number;
  fonte: string;
  justificativa: string;
}

export interface CatalogEdge {
  id: string;
  source: string;
  sourceType: string;
  target: string;
  targetType: string;
  label: string;
  tipo_relacao: string;
  confidence: number;
  classification: 'CONFIRMADO' | 'PROVÁVEL' | 'POTENCIAL';
  score_components?: ScoreComponent[];
  evidence: string;
  fonte: string;
  tipo_fonte: 'documental' | 'cadastral' | 'algoritmica' | 'territorial' | 'setorial' | 'contextual';
  sourceSystem: string;
  updatedAt: string;
  calculado_em: string;
  verificado_em: string | null;
  versao_regra: string;
  limitacoes: string;
  status_revisao: 'pendente' | 'concluida' | 'dispensada';
  provenance: string;
}

// DEPRECATED: MASTER_ENTITY_CATALOG removed at runtime. Entity search now uses real-time API via relationshipsService.
// DEPRECATED: MASTER_EDGES_DATASET removed at runtime. Cross-domain relationships come from public.relationship_edges table via API.
