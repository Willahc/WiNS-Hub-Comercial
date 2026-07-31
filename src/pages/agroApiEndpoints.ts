export const AGRO_API = {
  kpis: '/agro/kpis',
  distribuicao: '/agro/distribuicao',
  mapa: '/agro/mapa',
  oportunidades: '/agro/oportunidades',
  relacoes: '/agro/relacoes',
  oportunidadesCalculadas: '/agro/oportunidades/calculadas',
  logisticaCorrelacao: '/agro/logistica/correlacao',
  geneticaSimulador: '/agro/genetica/simulador',
  decisores: '/agro/decisores',
  holdings: '/agro/holdings',
  imoveis: '/agro/imoveis',
  imovel: (id: string) => `/agro/imoveis/${encodeURIComponent(id)}`,
} as const;
