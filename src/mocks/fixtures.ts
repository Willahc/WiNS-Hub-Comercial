import type { Event, Company, Opportunity, Territory, Indicator, VerticalImpact, TimelineItem, User } from '../types';

export const MOCK_USERS: Record<string, User> = {
  admin: {
    id: 'usr_admin',
    name: 'Rodrigo Almeida (Admin)',
    email: 'rodrigo.almeida@winshub.com.br',
    roles: ['admin'],
    permissions: ['engenharia', 'logistica', 'agro', 'saude', 'empresa360', 'comercial', 'relatorios']
  },
  comercial: {
    id: 'usr_comercial',
    name: 'Carolina Mendes (Comercial)',
    email: 'carolina.mendes@winshub.com.br',
    roles: ['comercial'],
    permissions: ['comercial', 'empresa360']
  },
  analista_agro: {
    id: 'usr_analista_agro',
    name: 'Mateus Silveira (Agro)',
    email: 'mateus.silveira@winshub.com.br',
    roles: ['analista'],
    permissions: ['agro', 'empresa360', 'relatorios']
  }
};

export const MOCK_KPIS = [
  { label: 'Eventos Ativos', value: '47', change: '↑ 12%', icon: 'events' },
  { label: 'Empresas Mapeadas', value: '1.234', change: '↑ 5%', icon: 'empresas' },
  { label: 'Oportunidades Abertas', value: '89', change: '↑ 20%', icon: 'oportunidades' },
  { label: 'Impacto Total', value: 'R$ 2.4B', change: '↑ 15%', icon: 'valor' },
  { label: 'WiNS Score Território', value: '78', change: '↑ 8%', icon: 'wins' }
];

export const MOCK_TIMELINE: TimelineItem[] = [
  { date: '20/07', title: 'Enchente Vale do Taquari', location: 'Lajeado, RS', severity: 'Alta', color: '#ef4444', icon: '🔴', relevance: 96 },
  { date: '22/07', title: 'Leilão de Bloco ANP', location: 'Rio de Janeiro, RJ', severity: 'Média', color: '#f59e0b', icon: '🟡', relevance: 91 },
  { date: '25/07', title: 'Greve de Transportes - Portos', location: 'Santos, SP', severity: 'Alta', color: '#ef4444', icon: '🔴', relevance: 88 },
  { date: '28/07', title: 'Plantio de Safra Recorde', location: 'Sorriso, MT', severity: 'Baixa', color: '#22c55e', icon: '🟢', relevance: 85 },
  { date: '30/07', title: 'Foco de Gripe Aviária', location: 'Passo Fundo, RS', severity: 'Crítica', color: '#ef4444', icon: '🔴', relevance: 94 }
];

export const MOCK_FEATURED_EVENT = {
  title: 'Enchente RS (Vale do Taquari)',
  severity: 'Alta',
  startDate: '15/07/2026',
  location: 'Vale do Taquari, RS',
  value: 'R$ 1.2 bilhões',
  phase: 'Monitoramento',
  phaseColor: '#ef4444',
  endDate: 'Em andamento',
  companies: ['Cooperativa Agro Taquari', 'Transportes Sul Ltda', 'Metalúrgica Lajeado S.A.'],
  description: 'Inundação de grandes proporções afetando infraestrutura de transporte (pontes, rodovias), silos de grãos e unidades de saúde. O gateway unificado mapeou impactos diretos e oportunidades de reestruturação.'
};

export const MOCK_VERTICAL_IMPACTS: VerticalImpact[] = [
  { module: 'Agro', value: 'R$ 800M', detail: 'Perda de safras e silos', color: '#22c55e', icon: 'agro' },
  { module: 'Logística', value: 'R$ 200M', detail: 'Rotas e pontes bloqueadas', color: '#06b6d4', icon: 'logistica' },
  { module: 'Saúde', value: 'R$ 50M', detail: 'Unidades afetadas', color: '#ef4444', icon: 'saude' },
  { module: 'Engenharia', value: 'R$ 150M', detail: 'Danos a estruturas urbanas', color: '#3b82f6', icon: 'engenharia' }
];

export const MOCK_OPPORTUNITIES: Opportunity[] = [
  { id: 'opp_001', score: 95, demanda: 'Reconstrução de Pontes', valor: 'R$ 50M', justification: 'Reconstrução de pontes e bueiros no Vale do Taquari', local: 'Lajeado, RS', stage: 'identificada', cnpjAssociado: '12.345.678/0001-90', eventOriginId: 'evt_001' },
  { id: 'opp_002', score: 89, demanda: 'Fornecimento de Agroinsumos', valor: 'R$ 12M', justification: 'Recuperação de solo e reposição de sementes', local: 'Região Sul', stage: 'contato', cnpjAssociado: '98.765.432/0001-10', eventOriginId: 'evt_004' },
  { id: 'opp_003', score: 82, demanda: 'Logística Emergencial', valor: 'R$ 8M', justification: 'Rotas alternativas e transporte de suprimentos', local: 'Porto Alegre, RS', stage: 'proposta', cnpjAssociado: '55.666.777/0001-88', eventOriginId: 'evt_001' },
  { id: 'opp_004', score: 78, demanda: 'Fornecimento de Equipamento Médico', valor: 'R$ 5M', justification: 'Reposição de respiradores e leitos de UTI', local: 'Passo Fundo, RS', stage: 'negociacao', cnpjAssociado: '44.333.222/0001-00', eventOriginId: 'evt_005' },
  { id: 'opp_005', score: 91, demanda: 'Obra de Pavimentação Rodoviária', valor: 'R$ 120M', justification: 'Fase de duplicação da BR-101 após erosão', local: 'Joinville, SC', stage: 'ganha', cnpjAssociado: '12.345.678/0001-90', eventOriginId: 'evt_006' }
];

export const MOCK_EVENTS: Event[] = [
  { id: 'evt_001', titulo: 'Enchente Histórica no Vale do Taquari', tipo: 'Desastre Natural', severidade: 'alta', dataInicio: '2026-07-15', local: 'Vale do Taquari, RS', valor: 'R$ 1.2B', verticais: ['agro', 'logistica', 'engenharia', 'saude'], status: 'Em andamento', relevancia: 96, confianca: 94, description: 'Inundação grave afetando pontes e rodovias federais.' },
  { id: 'evt_002', titulo: 'Leilão do Porto de Paranaguá', tipo: 'Leilão', severidade: 'media', dataInicio: '2026-07-22', local: 'Paranaguá, PR', valor: 'R$ 850M', verticais: ['logistica', 'engenharia'], status: 'Em análise', relevancia: 91, confianca: 89, description: 'Concessão de terminais de contêineres e grãos.' },
  { id: 'evt_003', titulo: 'Paralisação dos Caminhoneiros', tipo: 'Logístico', severidade: 'alta', dataInicio: '2026-07-25', local: 'Santos, SP', valor: 'R$ 200M/dia', verticais: ['logistica'], status: 'Em prospecção', relevancia: 88, confianca: 92, description: 'Bloqueio nas vias de acesso ao Porto de Santos.' },
  { id: 'evt_004', titulo: 'Quebra de Safra de Milho - Região Sul', tipo: 'Climático', severidade: 'media', dataInicio: '2026-07-28', local: 'Região Sul', valor: 'R$ 3.4B', verticais: ['agro'], status: 'Identificado', relevancia: 85, confianca: 78, description: 'Estiagem prolongada prejudicando o milho safrinha.' },
  { id: 'evt_005', titulo: 'Surtos de Dengue - Região Sudeste', tipo: 'Epidemia', severidade: 'critica', dataInicio: '2026-07-30', local: 'Campinas, SP', valor: 'R$ 80M', verticais: ['saude'], status: 'Em andamento', relevancia: 94, confianca: 90, description: 'Aumento expressivo nas internações hospitalares.' }
];

export const MOCK_COMPANIES: Company[] = [
  { cnpj: '12.345.678/0001-90', nome: 'Metalúrgica Lajeado S.A.', cidade: 'Lajeado', uf: 'RS', setor: 'Construção Civil', receita: 'R$ 250M', funcionarios: 1200, status: 'Ativa', verticais: ['Engenharia'], score: 92 },
  { cnpj: '98.765.432/0001-10', nome: 'Cooperativa Agro Taquari', cidade: 'Estrela', uf: 'RS', setor: 'Agroindústria', receita: 'R$ 1.2B', funcionarios: 4500, status: 'Ativa', verticais: ['Agro'], score: 89 },
  { cnpj: '55.666.777/0001-88', nome: 'Transportes Sul Ltda', cidade: 'Porto Alegre', uf: 'RS', setor: 'Logística', receita: 'R$ 450M', funcionarios: 2300, status: 'Ativa', verticais: ['Logística'], score: 84 },
  { cnpj: '44.333.222/0001-00', nome: 'Equipamentos Médicos do Brasil', cidade: 'São Paulo', uf: 'SP', setor: 'Saúde', receita: 'R$ 180M', funcionarios: 850, status: 'Ativa', verticais: ['Saúde'], score: 81 },
  { cnpj: '11.222.333/0001-44', nome: 'Construtora do Norte S.A.', cidade: 'Manaus', uf: 'AM', setor: 'Construção Civil', receita: 'R$ 980M', funcionarios: 3200, status: 'Ativa', verticais: ['Engenharia', 'Logística'], score: 87 }
];

export const MOCK_TERRITORIES: Territory[] = [
  { cidade: 'Lajeado, RS', potencial: 96, empresasAbertas: 3450, empregosGerados: 12400, investimentos: 'R$ 1.2B' },
  { cidade: 'Santos, SP', potencial: 88, empresasAbertas: 8900, empregosGerados: 45200, investimentos: 'R$ 3.5B' },
  { cidade: 'Sorriso, MT', potencial: 91, empresasAbertas: 2100, empregosGerados: 8500, investimentos: 'R$ 2.8B' }
];

export const MOCK_INDICATORS: Indicator[] = [
  { municipio: 'Lajeado, RS', leitos: 320, medicos: 650, coberturaESF: '84%', hospitais: 3 },
  { municipio: 'Passo Fundo, RS', leitos: 1100, medicos: 2400, coberturaESF: '71%', hospitais: 8 },
  { municipio: 'Sorriso, MT', leitos: 180, medicos: 320, coberturaESF: '92%', hospitais: 2 }
];
