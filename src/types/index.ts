export type Role = 'admin' | 'gestor' | 'analista' | 'comercial' | 'viewer';

export type Permission = 'engenharia' | 'logistica' | 'agro' | 'saude' | 'empresa360' | 'comercial' | 'relatorios';

export interface User {
  id: string;
  name: string;
  email: string;
  roles: Role[];
  permissions: Permission[];
}

export interface Event {
  id: string;
  titulo: string;
  tipo: string;
  subTipo?: string;
  severidade: 'baixa' | 'media' | 'alta' | 'critica';
  dataInicio: string;
  dataFim?: string | null;
  local: string;
  valor?: string;
  verticais: ('agro' | 'logistica' | 'engenharia' | 'saude')[];
  status: 'Identificado' | 'Em análise' | 'Em prospecção' | 'Em andamento' | 'Concluído';
  relevancia: number;
  confianca: number;
  description: string;
}

export interface Company {
  cnpj: string;
  nome: string;
  cidade: string;
  uf: string;
  setor: string;
  receita: string;
  funcionarios: number;
  status: 'Ativa' | 'Inativa';
  verticais: string[];
  score: number;
}

export interface Opportunity {
  id: string;
  score: number;
  demanda: string;
  valor: string;
  justification: string;
  local: string;
  stage: 'identificada' | 'contato' | 'proposta' | 'negociacao' | 'ganha' | 'perdida';
  cnpjAssociado?: string;
  eventOriginId?: string;
}

export interface Territory {
  cidade: string;
  potencial: number;
  empresasAbertas: number;
  empregosGerados: number;
  investimentos: string;
}

export interface Indicator {
  municipio: string;
  leitos: number;
  medicos: number;
  coberturaESF: string;
  hospitais: number;
}

export interface VerticalImpact {
  module: string;
  value: string;
  detail: string;
  color: string;
  icon: string;
}

export interface TimelineItem {
  date: string;
  title: string;
  location: string;
  severity: string;
  color: string;
  icon: string;
  relevance: number;
}
