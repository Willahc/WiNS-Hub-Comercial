export type WorkStatus = 'Em andamento' | 'Prevista' | 'Concluída' | 'Paralisada';
export type WorkPhase = 'Projeto' | 'Licenciamento' | 'Mobilização' | 'Execução' | 'Entrega';
export type Sector = 'Rodovias' | 'Saneamento' | 'Energia' | 'Mobilidade' | 'Hospitalar' | 'Educação' | 'Habitação' | 'Industrial' | 'Petróleo e Gás';
export type OpportunityStage = 'Identificada' | 'Qualificação' | 'Proposta' | 'Negociação';

export type Classification = 'CONFIRMADO' | 'PROVÁVEL' | 'POTENCIAL';
export type ExecutorPapel = 'EXECUTOR_PRINCIPAL' | 'PRESTADOR_SERVICO' | 'SUBCONTRATADO';
export type FornecedorTipo = 'FABRICANTE' | 'DISTRIBUIDOR' | 'REVENDEDOR';

export interface DecisionMaker {
  id: string;
  nome: string;
  cargo: string;
  email?: string;
  telefone?: string;
  linkedinUrl?: string;
  fonte: string;
  qualidadeLead: number;
  qualidadeLeadRaw?: string;
  qualidadeContatoNormalizada?: number;
  qualidadeContato?: 'alta' | 'média' | 'baixa' | 'não classificada';
  confiancaVinculoObra?: number;
  vinculoObra?: 'validado' | 'não comprovado' | 'sugerido';
  statusValidacao?: 'DECISOR_VALIDADO' | 'CONTATO_VALIDADO' | 'CONTATO_SUGERIDO';
  dataVerificacao?: string;
  updatedAt: string;
}

export interface EngineeringWork {
  id: string;
  name: string;
  description: string;
  municipality: string;
  state: string;
  coordinates: [number, number];
  geoPrecision?: 'exact' | 'municipality' | 'unknown';
  status: WorkStatus;
  phase: WorkPhase;
  sector: Sector;
  investment?: number;
  investmentHomologated?: boolean;
  progress: number;
  startDate: string;
  deadline: string;
  company?: { name?: string; cnpj?: string };
  companyIds: string[];
  companyName?: string;
  companyCnpj?: string;
  companyRole?: string;
  capexTaxonomy?: string;
  commercialPriority?: string;
  source?: string;
  sourceType?: string;
  priority: 'Alta' | 'Média' | 'Baixa';
  indicators: { label: string; value: string }[];
  events: { date: string; title: string; detail: string }[];
  decisionMakers?: DecisionMaker[];
}

export interface EngineeringCompany {
  id: string;
  name: string;
  tradeName: string;
  cnpj: string;
  segment: string;
  municipality: string;
  state: string;
  founded: string;
  employees: number;
  revenue: number;
  score: number;
  workIds: string[];
  opportunityIds: string[];
  territories: string[];
  links: { type: string; name: string }[];
  history: { date: string; title: string; detail: string }[];
}

export interface EngineeringOpportunity {
  id: string;
  title: string;
  sector: Sector;
  municipality: string;
  estimatedValue: number;
  stage: OpportunityStage;
  companyId: string;
  workId: string;
  score: number;
  justification: string;
}

export interface EngineeringExecutor {
  id: string;
  cnpj: string;
  razaoSocial: string;
  nomeFantasia: string;
  papel: ExecutorPapel;
  especialidades: string[];
  cnaes: string[];
  municipality: string;
  state: string;
  territories: string[];
  worksConfirmed: { workId: string; workName: string; sector: Sector; phase: WorkPhase }[];
  worksProvaveis: { workId: string; workName: string; sector: Sector }[];
  porte: string;
  score: number;
  classification: Classification;
  evidence: string;
  source: string;
  updatedAt: string;
  supplierInputIds: string[];
}

export interface EngineeringDisciplina {
  id: string;
  nome: string;
  descricao: string;
  fase: WorkPhase;
  status: string;
  executorIdentificado?: { executorId: string; nome: string; classification: Classification };
  empresasCompativeis: { empresaId: string; nome: string }[];
  evidence: string;
}

export interface EngineeringInsumo {
  id: string;
  categoria: string;
  subcategoria: string;
  unidade: string;
  quantidade?: number;
  faseNecessidade: WorkPhase;
  especificacao: string;
  fonteDemanda: string;
  confiabilidade: 'real' | 'inferido';
  workId: string;
}

export interface FonteEvidencia {
  tipo: string;
  nome: string;
  referencia: string;
  data_consulta: string;
  nivel: string;
  descricao: string;
}

export interface EngineeringInputSupplier {
  id: string;
  cnpj: string;
  razaoSocial: string;
  nomeFantasia: string;
  categoria: string;
  papel: string;
  municipio: string;
  uf: string;
  cnaePrincipal: string;
  cnaesSecundarios: string[];
  nivelEvidencia: string;
  fontes: FonteEvidencia[];
  dataVerificacao: string;
  confianca: number;
  produtos: string[];
  grupo: string;
}

export type InputSupplierAvailability = 'AVAILABLE';

export interface EngineeringInputSupplierResponseMeta {
  total: number;
  page: number;
  pageSize: number;
  source: string;
  lastUpdatedAt?: string;
  partialData: boolean;
}

export interface EngineeringInputSupplierResponse {
  availability: InputSupplierAvailability;
  items: EngineeringInputSupplier[];
  meta: EngineeringInputSupplierResponseMeta;
  message?: string;
}

export interface EngineeringInputSuppliersSummary {
  total_evidenced: number;
  categories: string[];
  roles: string[];
  ufs: string[];
  coverage_status: string;
  updated_at: string;
  summary: {
    fabricantes: number;
    distribuidores: number;
    revendedores: number;
    locadoras: number;
    evidenced_by_level: Record<string, number>;
    ufs_covered: number;
    ex_separated: boolean;
    non_evidenced_hidden: boolean;
    total_unique_empresas: number;
  };
}

export interface EngineeringInputSuppliersFacets {
  categories: string[];
  roles: string[];
  ufs: string[];
  total_evidenced: number;
}

export interface EngineeringSupplyChainLink {
  workId: string;
  workName: string;
  disciplina: string;
  servico: string;
  insumo: string;
  executor?: { id: string; name: string; papel: ExecutorPapel };
  fornecedorInsumo?: { id: string; name: string; tipo: FornecedorTipo };
  classification: Classification;
  confidence: number;
  rule: string;
  source: string;
  updatedAt: string;
}

export interface EngineeringDistribution { label:string;value:number }
export interface EngineeringTerritory { municipality:string;uf:string;worksCount:number;investmentTotal?:number;investmentUnavailableCount:number;companyCount:number;opportunityCount:number;updatedAt?:string }
export interface EngineeringOpportunityMetrics { opportunitiesTotal:number;opportunitiesActiveTotal:number;matchesTotal:number;opportunitiesLinked:number;opportunitiesActive:number;matchesLinked:number;worksWithOpportunity:number;worksWithoutOpportunity:number;activeRule:string }
export interface EngineeringAggregates { worksTotal:number; investmentTotal?:number; investmentRecordsCount:number; investmentMissingCount:number; investmentUnhomologatedCount:number; investmentStatus:'complete'|'partial'|'unavailable'; financialCoveragePct:number;municipalityCount:number; companyCount:number; missingMunicipalityCount:number;missingCompanyCount:number;statusCounts:EngineeringDistribution[];phaseCounts:EngineeringDistribution[];territories:EngineeringTerritory[];opportunities:EngineeringOpportunityMetrics;lastUpdatedAt?:string }
export interface EngineeringFilters { search?:string;status?:string;phase?:string;sector?:string;priority?:string;capexClass?:string;source?:string;municipality?:string;uf?:string;company?:string;investmentMin?:number;investmentMax?:number;periodStart?:string;periodEnd?:string;hasSupplier?:boolean;hasDecisionMaker?:boolean;hasOpportunity?:boolean;hasInputs?:boolean;hasSupplyChain?:boolean;capexHomologado?:boolean;sort?:string }
export interface EngineeringDataset {
  works: EngineeringWork[];
  companies: EngineeringCompany[];
  opportunities: EngineeringOpportunity[];
  meta?: { source: string; lastUpdatedAt?: string; partialData: boolean; totalWorks: number; page?:number;pageSize?:number;appliedFilters?:EngineeringFilters;aggregates?:EngineeringAggregates;realData: boolean; error?: string };
}
