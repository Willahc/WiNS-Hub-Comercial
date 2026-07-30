export const OPPORTUNITY_LABELS = {
  matchesBrutosGlobais: {
    titulo: 'Matches brutos globais',
    descricao: 'Total de correspondências no banco, sem filtro de score mínimo',
    cobertura: 'Base completa — wins_agro.engenharia.matches_v2',
  },
  matchesGlobaisScore70: {
    titulo: 'Matches globais ativos (score ≥ 70)',
    descricao: 'Correspondências com score ≥ 70, antes do recorte por obras visíveis',
    cobertura: 'Base nacional deduplicada, score ≥ 70',
  },
  matchesQualificadosRecorte: {
    titulo: 'Matches qualificados no recorte',
    descricao: 'Score ≥ 70 vinculados às obras visíveis do recorte ativo',
    cobertura: 'Obras visíveis com oportunidade',
  },
  obrasComOportunidade: {
    titulo: 'Obras com oportunidade',
    descricao: 'Obras do recorte que possuem ao menos um match qualificado',
  },
} as const;
