export type VerticalKey = 'engenharia' | 'logistica' | 'agro' | 'saude';
export type HubEntityKind = 'evento' | 'ativo' | 'empresa' | 'oportunidade';

export interface HubEvent {
  id:string; title:string; type:string; date:string; territory:string; verticals:VerticalKey[];
  severity:'Crítica'|'Alta'|'Média'|'Baixa'; status:'Monitorando'|'Em análise'|'Resolvido';
  description:string; value:number; companyIds:string[]; opportunityIds:string[]; coordinates:[number,number]; source:string;
}
export interface HubCompany {
  id:string; name:string; tradeName:string; cnpj:string; segment:string; territory:string; verticals:VerticalKey[];
  score:number; revenue:number; employees:number; relationships:string[]; eventIds:string[]; opportunityIds:string[];
  history:{date:string;title:string}[]; sources:string[];
}
export interface HubOpportunity {
  id:string; title:string; vertical:VerticalKey; territory:string; value:number;
  stage:'Identificada'|'Qualificação'|'Proposta'|'Negociação'|'Ganha'; companyId:string; eventId:string;
  score:number; justification:string; owner:string; nextStep:string;
}
export interface VerticalAsset {
  id:string; vertical:VerticalKey; name:string; type:string; territory:string; status:string;
  capacity:string; utilization:number; companyId:string; coordinates:[number,number]; detail:string;
}
export interface TerritoryProfile {
  id:string; name:string; state:string; population:number; gdp:number; score:number;
  companies:number; jobs:number; verticalPresence:Record<VerticalKey,number>; indicators:{label:string;value:string;trend:string}[];
}
export interface OverviewEntity {
  id:string; name:string; vertical:VerticalKey|'oportunidades'; kind:string; territory:string;
  uf:string; municipality:string; source:string; updatedAt?:string; detailPath:string; latitude:number; longitude:number; geoPrecision:'exact'|'municipality';
}
export interface HubOverview {
  counts:{works:number;companies:number;ruralProperties:number;carriers:number;healthEstablishments:number;opportunities:number;confirmedRelations:number;potentialRelations:number};
  entities:OverviewEntity[];
}
export interface HubDataset { events:HubEvent[]; companies:HubCompany[]; opportunities:HubOpportunity[]; assets:VerticalAsset[]; territories:TerritoryProfile[]; overview:HubOverview }
