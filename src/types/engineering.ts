export type WorkStatus = 'Em andamento' | 'Prevista' | 'Concluída' | 'Paralisada';
export type WorkPhase = 'Projeto' | 'Licenciamento' | 'Mobilização' | 'Execução' | 'Entrega';
export type Sector = 'Rodovias' | 'Saneamento' | 'Energia' | 'Mobilidade';
export type OpportunityStage = 'Identificada' | 'Qualificação' | 'Proposta' | 'Negociação';

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
  companyIds: string[];
  priority: 'Alta' | 'Média' | 'Baixa';
  indicators: { label: string; value: string }[];
  events: { date: string; title: string; detail: string }[];
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

export interface EngineeringDistribution { label:string;value:number }
export interface EngineeringTerritory { municipality:string;uf:string;worksCount:number;investmentTotal?:number;investmentUnavailableCount:number;companyCount:number;opportunityCount:number;updatedAt?:string }
export interface EngineeringOpportunityMetrics { opportunitiesTotal:number;opportunitiesActiveTotal:number;matchesTotal:number;opportunitiesLinked:number;opportunitiesActive:number;matchesLinked:number;worksWithOpportunity:number;worksWithoutOpportunity:number;activeRule:string }
export interface EngineeringAggregates { worksTotal:number; investmentTotal?:number; investmentRecordsCount:number; investmentMissingCount:number; investmentUnhomologatedCount:number; investmentStatus:'complete'|'partial'|'unavailable'; financialCoveragePct:number;municipalityCount:number; companyCount:number; missingMunicipalityCount:number;missingCompanyCount:number;statusCounts:EngineeringDistribution[];phaseCounts:EngineeringDistribution[];territories:EngineeringTerritory[];opportunities:EngineeringOpportunityMetrics;lastUpdatedAt?:string }
export interface EngineeringFilters { search?:string;status?:string;phase?:string;sector?:string;municipality?:string;uf?:string;company?:string;investmentMin?:number;investmentMax?:number;periodStart?:string;periodEnd?:string;hasSupplier?:boolean;hasDecisionMaker?:boolean;hasOpportunity?:boolean;capexHomologado?:boolean;sort?:string }
export interface EngineeringDataset {
  works: EngineeringWork[];
  companies: EngineeringCompany[];
  opportunities: EngineeringOpportunity[];
  meta?: { source: string; lastUpdatedAt?: string; partialData: boolean; totalWorks: number; page?:number;pageSize?:number;appliedFilters?:EngineeringFilters;aggregates?:EngineeringAggregates;realData: boolean; error?: string };
}
