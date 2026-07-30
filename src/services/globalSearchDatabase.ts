export interface GlobalSearchResultItem {
  id: string;
  type: 'empresa' | 'obra' | 'transportador' | 'imovel_car' | 'estabelecimento_cnes' | 'municipio' | 'oportunidade' | 'evento' | 'pessoa';
  title: string;
  subtitle: string;
  identifier: string;
  identifierType: 'CNPJ' | 'ID_OBRA' | 'RNTRC' | 'CAR' | 'CNES' | 'IBGE' | 'OP' | 'CPF';
  municipality: string;
  uf: string;
  ibge: string;
  vertical: 'Engenharia' | 'Agro' | 'Logística' | 'Saúde' | 'Multivertical' | 'Geral';
  status: string;
  qualityScore: number;
  source: string;
  updatedAt: string;
  matchType: 'EXATO' | 'RAZAO_SOCIAL' | 'NOME_FANTASIA' | 'TERRITORIAL' | 'SIMILARIDADE';
  matchConfidence: number;
  details: Record<string, any>;
  navigationUrl: string;
}

export const MASTER_SEARCH_INDEX: GlobalSearchResultItem[] = [
  // EMPRESAS
  {
    id: 'emp-001',
    type: 'empresa',
    title: 'LUMINA GESTAO DE OBRAS LTDA',
    subtitle: 'LUMINA ENGENHARIA E INFRAESTRUTURA · Matriz',
    identifier: '00.000.000/0001-91',
    identifierType: 'CNPJ',
    municipality: 'Curitiba',
    uf: 'PR',
    ibge: '4106902',
    vertical: 'Engenharia',
    status: 'ATIVA',
    qualityScore: 98,
    source: 'Receita Federal RFB',
    updatedAt: '24/07/2026',
    matchType: 'EXATO',
    matchConfidence: 99,
    details: {
      porte: 'DEMAIS',
      capitalSocial: 'R$ 15,5M',
      cnae: '42.11-1-00 (Construção de rodovias)',
      executivo: 'Carlos Eduardo Almeida (Sócio)',
      obrasContatadas: 2
    },
    navigationUrl: '/empresas/emp-001'
  },
  {
    id: 'emp-002',
    type: 'empresa',
    title: 'ENGENHARIA E CONSTRUCOES PARANA S/A',
    subtitle: 'PARANA CONSTRUCOES · S/A Fechada',
    identifier: '11.222.333/0001-44',
    identifierType: 'CNPJ',
    municipality: 'Araucária',
    uf: 'PR',
    ibge: '4101804',
    vertical: 'Engenharia',
    status: 'ATIVA',
    qualityScore: 96,
    source: 'Receita Federal RFB',
    updatedAt: '24/07/2026',
    matchType: 'RAZAO_SOCIAL',
    matchConfidence: 97,
    details: {
      porte: 'DEMAIS',
      capitalSocial: 'R$ 38,0M',
      cnae: '42.12-0-00 (Obras de arte especiais)',
      executivo: 'Hector Bastos (Diretor)'
    },
    navigationUrl: '/empresas/emp-002'
  },
  {
    id: 'emp-004',
    type: 'empresa',
    title: 'LOGISTICA CORREDOR SUL LTDA',
    subtitle: 'CORREDOR SUL LOGISTICA · Transportador Habilitado',
    identifier: '33.444.555/0001-66',
    identifierType: 'CNPJ',
    municipality: 'Curitiba',
    uf: 'PR',
    ibge: '4106902',
    vertical: 'Logística',
    status: 'ATIVA',
    qualityScore: 97,
    source: 'ANTT RNTRC',
    updatedAt: '24/07/2026',
    matchType: 'SIMILARIDADE',
    matchConfidence: 94,
    details: {
      rntrc: '482109',
      categoria: 'ETC - Empresa',
      frota: '65 veículos'
    },
    navigationUrl: '/empresas/emp-004'
  },

  // OBRAS
  {
    id: 'OBR-2026-PR01',
    type: 'obra',
    title: 'Alvará Curitiba - Pavimentação LUMINA',
    subtitle: 'Pavimentação e Recuperação Asfáltica Bairro Centro Cívico',
    identifier: 'OBR-2026-PR01',
    identifierType: 'ID_OBRA',
    municipality: 'Curitiba',
    uf: 'PR',
    ibge: '4106902',
    vertical: 'Engenharia',
    status: 'Em Execução',
    qualityScore: 99,
    source: 'PNCP / Prefeitura Curitiba',
    updatedAt: '24/07/2026',
    matchType: 'EXATO',
    matchConfidence: 99,
    details: {
      capex: 'R$ 18.400.000',
      executora: 'LUMINA GESTAO DE OBRAS LTDA',
      contrato: 'PE-049/2026'
    },
    navigationUrl: '/engenharia/obras/OBR-2026-PR01'
  },
  {
    id: 'OBR-2026-PR04',
    type: 'obra',
    title: 'Duplicação Contorno Leste Curitiba',
    subtitle: 'Obras de Arte Especiais e Duplicação Viária',
    identifier: 'OBR-2026-PR04',
    identifierType: 'ID_OBRA',
    municipality: 'Curitiba',
    uf: 'PR',
    ibge: '4106902',
    vertical: 'Engenharia',
    status: 'Licitação Aberta',
    qualityScore: 98,
    source: 'PNCP / DER-PR',
    updatedAt: '24/07/2026',
    matchType: 'RAZAO_SOCIAL',
    matchConfidence: 96,
    details: {
      capex: 'R$ 42.000.000',
      modalidade: 'Pregão Eletrônico'
    },
    navigationUrl: '/engenharia/obras/OBR-2026-PR04'
  },

  // TRANSPORTADORES
  {
    id: 'TRP-482109',
    type: 'transportador',
    title: 'CORREDOR SUL LOGISTICA E TRANSPORTES',
    subtitle: 'Transportador Rodoviário de Carga Seca e Granel',
    identifier: 'RNTRC 482109',
    identifierType: 'RNTRC',
    municipality: 'Curitiba',
    uf: 'PR',
    ibge: '4106902',
    vertical: 'Logística',
    status: 'Ativo ANTT',
    qualityScore: 97,
    source: 'ANTT RNTRC',
    updatedAt: '24/07/2026',
    matchType: 'EXATO',
    matchConfidence: 99,
    details: {
      categoria: 'ETC - Empresa de Transporte Rodoviário',
      frota: 65,
      cnpj: '33.444.555/0001-66'
    },
    navigationUrl: '/empresas/emp-004'
  },

  // IMOVEIS CAR
  {
    id: 'CAR-PR-4106902-8812',
    type: 'imovel_car',
    title: 'FAZENDA VALE VERDE - CAR',
    subtitle: 'Imóvel Rural para Reserva & Suprimento de Agrregados',
    identifier: 'PR-4106902-8812',
    identifierType: 'CAR',
    municipality: 'Curitiba',
    uf: 'PR',
    ibge: '4106902',
    vertical: 'Agro',
    status: 'Cadastrado SICAR',
    qualityScore: 96,
    source: 'SICAR MMA',
    updatedAt: '23/07/2026',
    matchType: 'EXATO',
    matchConfidence: 98,
    details: {
      areaHa: '1.420 ha',
      proprietario: 'Agropecuária Vale do Sol S/A',
      geometria: 'Válida Vetorial'
    },
    navigationUrl: '/territorial?ibge=4106902'
  },

  // SAUDE CNES
  {
    id: 'CNES-2784102',
    type: 'estabelecimento_cnes',
    title: 'HOSPITAL MUNICIPAL DE CURITIBA',
    subtitle: 'Hospital Geral com Atendimento de Urgência e Leitos UTI',
    identifier: 'CNES 2784102',
    identifierType: 'CNES',
    municipality: 'Curitiba',
    uf: 'PR',
    ibge: '4106902',
    vertical: 'Saúde',
    status: 'Ativo DATASUS',
    qualityScore: 98,
    source: 'DATASUS CNES',
    updatedAt: '22/07/2026',
    matchType: 'EXATO',
    matchConfidence: 99,
    details: {
      leitos: 380,
      leitosUti: 65,
      atendeSus: 'Sim',
      mantenedora: 'Prefeitura Municipal de Curitiba'
    },
    navigationUrl: '/saude/estabelecimentos/2784102'
  },

  // MUNICIPIOS
  {
    id: 'MUN-4106902',
    type: 'municipio',
    title: 'Curitiba / PR',
    subtitle: 'Capital do Estado do Paraná · Região Geográfica Imediata',
    identifier: '4106902',
    identifierType: 'IBGE',
    municipality: 'Curitiba',
    uf: 'PR',
    ibge: '4106902',
    vertical: 'Multivertical',
    status: 'Oficial IBGE 2026',
    qualityScore: 100,
    source: 'IBGE 2026',
    updatedAt: '24/07/2026',
    matchType: 'EXATO',
    matchConfidence: 100,
    details: {
      populacao: '1.773.733 hab.',
      areaKm2: '434,9 km²',
      obrasContadas: 124,
      transportadores: 2410
    },
    navigationUrl: '/territorial?ibge=4106902'
  },

  // OPORTUNIDADES
  {
    id: 'OP-101',
    type: 'oportunidade',
    title: 'Fornecimento de Cimento e Massa Asfáltica Obras Sul',
    subtitle: 'Oportunidade Comercial de Fornecimento de Insumos Pavimentadores',
    identifier: 'OP-101',
    identifierType: 'OP',
    municipality: 'Curitiba',
    uf: 'PR',
    ibge: '4106902',
    vertical: 'Engenharia',
    status: 'Aberta Comercial',
    qualityScore: 96,
    source: 'WiNS Match Engine',
    updatedAt: '24/07/2026',
    matchType: 'SIMILARIDADE',
    matchConfidence: 96,
    details: {
      score: 96,
      edital: 'PE-049/2026',
      acaoRecomendada: 'Iniciar abordagem comercial imediata'
    },
    navigationUrl: '/empresas/emp-001'
  }
];

export const RECENT_SEARCHES = [
  'LUMINA GESTAO DE OBRAS',
  'Curitiba/PR',
  '4106902',
  'RNTRC 482109',
  'CNES 2784102'
];

export const RECENTLY_ACCESSED_ENTITIES = [
  { id: 'emp-001', name: 'LUMINA GESTAO DE OBRAS LTDA', type: 'Empresa', cnpj: '00.000.000/0001-91', url: '/empresas/emp-001' },
  { id: 'OBR-2026-PR01', name: 'Alvará Curitiba - Pavimentação', type: 'Obra', capex: 'R$ 18,4M', url: '/engenharia/obras/OBR-2026-PR01' },
  { id: 'MUN-4106902', name: 'Curitiba / PR', type: 'Município', ibge: '4106902', url: '/territorial?ibge=4106902' }
];
