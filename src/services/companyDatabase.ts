export interface CompanyRecord {
  id: string;
  cnpj: string; // Properly formatted CNPJ
  cnpjClean: string;
  legalName: string; // Razão Social
  tradeName: string; // Nome Fantasia
  type: 'MATRIZ' | 'FILIAL';
  status: 'ATIVA' | 'INAPTA' | 'SUSPENSA' | 'BAIXADA';
  size: 'MEI' | 'ME' | 'EPP' | 'DEMAIS';
  legalNature: string;
  openingDate: string;
  capitalSocial: number;
  economicGroup?: {
    name: string;
    parentCnpj?: string;
    parentName?: string;
    branchesCount: number;
    relatedCompanies: { cnpj: string; name: string; relation: string; conf: number }[];
  };
  address: {
    street: string;
    number: string;
    neighborhood: string;
    municipality: string;
    uf: string;
    cep: string;
    lat: number;
    lng: number;
  };
  cnaeMain: { code: string; text: string };
  cnaeSecondary: { code: string; text: string }[];
  contacts: { phone: string; email: string; website?: string };
  dominantSegment: 'Engenharia e Construção' | 'Logística e Transportes' | 'Agronegócio' | 'Saúde e Equipamentos' | 'Holding & Participações';
  verticals: ('Engenharia' | 'Agro' | 'Logística' | 'Saúde')[];
  qualityScore: number; // 0..100
  updatedAt: string;

  // Rich Sub-entities & Relations
  people: {
    id: string;
    name: string;
    role: string;
    category: 'Vínculo Societário Confirmado' | 'Cargo Institucional' | 'Pessoa Provável' | 'Contato Comercial Inferido';
    source: string;
    updatedAt: string;
    confidence: number;
  }[];

  works: {
    id: string;
    name: string;
    role: 'Executora Confirmada' | 'Participante Licitação' | 'Fornecedora Recomendada' | 'Coincidência Territorial';
    municipality: string;
    uf: string;
    phase: string;
    capex: number;
    evidence: string;
    updatedAt: string;
  }[];

  logistics: {
    rntrc: string;
    category: 'CTC - Coop' | 'ETC - Empresa' | 'TAC - Autônomo';
    fleetCount: number;
    municipality: string;
    uf: string;
    status: string;
  }[];

  agro: {
    carCode: string;
    propertyName: string;
    municipality: string;
    uf: string;
    areaHa: number;
    landUse: string;
  }[];

  health: {
    cnesId: string;
    unitName: string;
    mantenedora: string;
    unitType: string;
    municipality: string;
    uf: string;
  }[];

  opportunities: {
    id: string;
    title: string;
    vertical: string;
    score: number;
    classification: 'CONFIRMADO' | 'PROVÁVEL' | 'POTENCIAL';
    rationale: string;
    evidence: string;
    municipality: string;
    validUntil: string;
    recommendedAction: string;
  }[];

  provenance: {
    sources: string[];
    lastUpdate: string;
    missingFields: string[];
    discrepancies: { field: string; sourceA: string; valA: string; sourceB: string; valB: string }[];
    duplicatesFound: number;
    coveragePct: number;
    algorithmVersion: string;
  };

  insights: {
    title: string;
    rationale: string;
    evidence: string;
    confidence: number;
    source: string;
    limitations: string;
    date: string;
  }[];
}

export const MASTER_COMPANIES_DATABASE: CompanyRecord[] = [
  {
    id: 'emp-001',
    cnpj: '00.000.000/0001-91',
    cnpjClean: '00000000000191',
    legalName: 'LUMINA GESTAO DE OBRAS LTDA',
    tradeName: 'LUMINA ENGENHARIA E INFRAESTRUTURA',
    type: 'MATRIZ',
    status: 'ATIVA',
    size: 'DEMAIS',
    legalNature: '206-2 - Sociedade Empresária Limitada',
    openingDate: '14/03/2012',
    capitalSocial: 15500000,
    economicGroup: {
      name: 'Grupo Lumina Infraestrutura S/A',
      parentCnpj: '00.000.000/0001-91',
      parentName: 'LUMINA HOLDING E PARTICIPAÇÕES',
      branchesCount: 4,
      relatedCompanies: [
        { cnpj: '00.000.000/0002-72', name: 'LUMINA GESTAO DE OBRAS (Filial Araucária)', relation: 'Filial Cadastrada RFB', conf: 100 },
        { cnpj: '00.000.000/0003-53', name: 'LUMINA GESTAO DE OBRAS (Filial SJP)', relation: 'Filial Cadastrada RFB', conf: 100 },
        { cnpj: '11.222.333/0001-44', name: 'ENGENHARIA E CONSTRUCOES PARANA S/A', relation: 'Consórcio Operacional Viário', conf: 94 }
      ]
    },
    address: {
      street: 'Av. Cândido de Abreu',
      number: '526',
      neighborhood: 'Centro Cívico',
      municipality: 'Curitiba',
      uf: 'PR',
      cep: '80530-000',
      lat: -25.4195,
      lng: -49.2689
    },
    cnaeMain: { code: '42.11-1-00', text: 'Construção de rodovias e ferrovias' },
    cnaeSecondary: [
      { code: '42.99-5-01', text: 'Obras de engenharia civil não especificadas anteriormente' },
      { code: '71.12-0-00', text: 'Serviços de engenharia' }
    ],
    contacts: { phone: '(41) 3321-4800', email: 'contato@luminaengenharia.com.br', website: 'https://luminaengenharia.com.br' },
    dominantSegment: 'Engenharia e Construção',
    verticals: ['Engenharia', 'Logística', 'Agro'],
    qualityScore: 98,
    updatedAt: '24/07/2026',
    people: [
      { id: 'P1', name: 'CARLOS EDUARDO ALMEIDA', role: 'Sócio-Administrador', category: 'Vínculo Societário Confirmado', source: 'Receita Federal RFB (QSA)', updatedAt: '24/07/2026', confidence: 99 },
      { id: 'P2', name: 'MARIANA VASCONCELOS SILVA', role: 'Diretora de Operações de Engenharia', category: 'Cargo Institucional', source: 'Ata de Eleição JUCEPAR', updatedAt: '24/07/2026', confidence: 97 },
      { id: 'P3', name: 'ENG. ROBERTO MENDES', role: 'Engenheiro Responsável Técnico (CREA 48190-D)', category: 'Vínculo Societário Confirmado', source: 'CREA-PR', updatedAt: '23/07/2026', confidence: 98 },
      { id: 'P4', name: 'RICARDO FERREIRA DE SOUZA', role: 'Gerente de Compras & Suprimentos Logísticos', category: 'Contato Comercial Inferido', source: 'Mapeamento Comercial WiNS', updatedAt: '20/07/2026', confidence: 85 }
    ],
    works: [
      { id: 'OBR-2026-PR01', name: 'Alvará Curitiba - Pavimentação LUMINA', role: 'Executora Confirmada', municipality: 'Curitiba', uf: 'PR', phase: 'Em Execução', capex: 18400000, evidence: 'Termo de homologação PNCP nº 049/2026 e contrato RFB idêntico', updatedAt: '24/07/2026' },
      { id: 'OBR-2026-PR04', name: 'Duplicação Contorno Leste Curitiba', role: 'Participante Licitação', municipality: 'Curitiba', uf: 'PR', phase: 'Licitação Aberta', capex: 42000000, evidence: 'Ata de habilitação de proposta técnica PNCP', updatedAt: '24/07/2026' }
    ],
    logistics: [
      { rntrc: 'RNTRC 482109', category: 'ETC - Empresa', fleetCount: 28, municipality: 'Curitiba', uf: 'PR', status: 'Ativo ANTT' }
    ],
    agro: [
      { carCode: 'PR-4106902-8812', propertyName: 'FAZENDA VALE VERDE - CAR', municipality: 'Curitiba', uf: 'PR', areaHa: 1420, landUse: 'Reserva & Suprimento de Jazida' }
    ],
    health: [],
    opportunities: [
      {
        id: 'OP-101',
        title: 'Fornecimento de Cimento e Massa Asfáltica Obras Sul',
        vertical: 'Engenharia',
        score: 96,
        classification: 'CONFIRMADO',
        rationale: 'A empresa possui CNAE 42.11-1-00 ativo, sede em Curitiba/PR e contrato vigente de pavimentação homologado no PNCP.',
        evidence: 'Edital oficial PE-049/2026 e registro ativo no CREA-PR.',
        municipality: 'Curitiba',
        validUntil: '15/08/2026',
        recommendedAction: 'Iniciar abordagem comercial para fornecimento de insumos pavimentadores.'
      }
    ],
    provenance: {
      sources: ['Receita Federal RFB', 'PNCP', 'CREA-PR', 'ANTT RNTRC', 'SICAR MMA'],
      lastUpdate: '24/07/2026',
      missingFields: ['Inscrição Estadual Secundária'],
      discrepancies: [
        { field: 'Razão Social', sourceA: 'RFB', valA: 'LUMINA GESTAO DE OBRAS LTDA', sourceB: 'PNCP', valB: 'LUMINA ENGENHARIA E GESTAO DE OBRAS S/A' }
      ],
      duplicatesFound: 0,
      coveragePct: 98,
      algorithmVersion: 'v2.4.0-stable'
    },
    insights: [
      {
        title: 'Atuação Integrada Engenharia ↔ Logística',
        rationale: 'Identificada correspondência direta entre alvará de obra viária e frota RNTRC de transporte de agregados.',
        evidence: 'RNTRC 482109 cadastrado sob o mesmo CNPJ raiz 00.000.000.',
        confidence: 98,
        source: 'RFB + ANTT',
        limitations: 'Não há contrato de frete subcontratado com terceiros registrado.',
        date: '24/07/2026'
      }
    ]
  },
  {
    id: 'emp-002',
    cnpj: '11.222.333/0001-44',
    cnpjClean: '11222333000144',
    legalName: 'ENGENHARIA E CONSTRUCOES PARANA S/A',
    tradeName: 'PARANA CONSTRUCOES',
    type: 'MATRIZ',
    status: 'ATIVA',
    size: 'DEMAIS',
    legalNature: '205-4 - Sociedade Anônima Fechada',
    openingDate: '08/09/2008',
    capitalSocial: 38000000,
    economicGroup: {
      name: 'Grupo Construções Paraná',
      branchesCount: 2,
      relatedCompanies: [
        { cnpj: '00.000.000/0001-91', name: 'LUMINA GESTAO DE OBRAS LTDA', relation: 'Consórcio Operacional', conf: 94 }
      ]
    },
    address: {
      street: 'Rua Marechal Deodoro',
      number: '869',
      neighborhood: 'Centro',
      municipality: 'Curitiba',
      uf: 'PR',
      cep: '80060-010',
      lat: -25.4312,
      lng: -49.2654
    },
    cnaeMain: { code: '42.12-0-00', text: 'Construção de obras de arte especiais' },
    cnaeSecondary: [
      { code: '41.20-4-00', text: 'Construção de edifícios' }
    ],
    contacts: { phone: '(41) 3233-9000', email: 'contato@paranaconstrucoes.com.br', website: 'https://paranaconstrucoes.com.br' },
    dominantSegment: 'Engenharia e Construção',
    verticals: ['Engenharia', 'Logística', 'Saúde'],
    qualityScore: 96,
    updatedAt: '24/07/2026',
    people: [
      { id: 'P5', name: 'HECTOR BASTOS', role: 'Diretor Presidente', category: 'Vínculo Societário Confirmado', source: 'Junta Comercial JUCEPAR', updatedAt: '24/07/2026', confidence: 99 }
    ],
    works: [
      { id: 'OBR-2026-PR02', name: 'Construção Viária Trecho Sul', role: 'Executora Confirmada', municipality: 'Araucária', uf: 'PR', phase: 'Em Execução', capex: 34500000, evidence: 'Termo DER-PR 418/2025', updatedAt: '24/07/2026' }
    ],
    logistics: [
      { rntrc: 'RNTRC 391024', category: 'ETC - Empresa', fleetCount: 19, municipality: 'Araucária', uf: 'PR', status: 'Ativo ANTT' }
    ],
    agro: [],
    health: [
      { cnesId: 'CNES 3918201', unitName: 'UPA 24H CENTRO ARAUCARIA', mantenedora: 'Prefeitura Araucária', unitType: 'Pronto Atendimento', municipality: 'Araucária', uf: 'PR' }
    ],
    opportunities: [],
    provenance: {
      sources: ['Receita Federal RFB', 'PNCP', 'DER-PR'],
      lastUpdate: '24/07/2026',
      missingFields: [],
      discrepancies: [],
      duplicatesFound: 0,
      coveragePct: 96,
      algorithmVersion: 'v2.4.0-stable'
    },
    insights: []
  },
  {
    id: 'emp-003',
    cnpj: '22.333.444/0001-55',
    cnpjClean: '22333444000155',
    legalName: 'CONSTRUTORA HORIZONTE LTDA',
    tradeName: 'HORIZONTE ENGENHARIA',
    type: 'MATRIZ',
    status: 'ATIVA',
    size: 'DEMAIS',
    legalNature: '206-2 - Sociedade Empresária Limitada',
    openingDate: '19/05/2015',
    capitalSocial: 12000000,
    address: {
      street: 'Av. das Américas',
      number: '1200',
      neighborhood: 'Parque da Fonte',
      municipality: 'São José dos Pinhais',
      uf: 'PR',
      cep: '83050-000',
      lat: -25.5341,
      lng: -49.2012
    },
    cnaeMain: { code: '41.20-4-00', text: 'Construção de edifícios' },
    cnaeSecondary: [],
    contacts: { phone: '(41) 3382-1000', email: 'contato@horizonteengenharia.com.br' },
    dominantSegment: 'Engenharia e Construção',
    verticals: ['Engenharia', 'Saúde'],
    qualityScore: 94,
    updatedAt: '24/07/2026',
    people: [
      { id: 'P6', name: 'ANA PAULA FERREIRA', role: 'Sócia-Gerente', category: 'Vínculo Societário Confirmado', source: 'RFB QSA', updatedAt: '24/07/2026', confidence: 98 }
    ],
    works: [
      { id: 'OBR-2026-PR03', name: 'Ampliação Terminal Aeroportuário', role: 'Executora Confirmada', municipality: 'São José dos Pinhais', uf: 'PR', phase: 'Em Execução', capex: 29000000, evidence: 'INFRAERO / SJP', updatedAt: '24/07/2026' }
    ],
    logistics: [],
    agro: [],
    health: [
      { cnesId: 'CNES 5819203', unitName: 'CLINICA DIAGNOSTICOS AVANCADOS', mantenedora: 'Grupo Saúde SJP', unitType: 'Clínica Especializada', municipality: 'São José dos Pinhais', uf: 'PR' }
    ],
    opportunities: [],
    provenance: {
      sources: ['Receita Federal RFB', 'INFRAERO'],
      lastUpdate: '24/07/2026',
      missingFields: [],
      discrepancies: [],
      duplicatesFound: 0,
      coveragePct: 94,
      algorithmVersion: 'v2.4.0-stable'
    },
    insights: []
  },
  {
    id: 'emp-004',
    cnpj: '33.444.555/0001-66',
    cnpjClean: '33444555000166',
    legalName: 'LOGISTICA CORREDOR SUL LTDA',
    tradeName: 'CORREDOR SUL LOGISTICA',
    type: 'MATRIZ',
    status: 'ATIVA',
    size: 'DEMAIS',
    legalNature: '206-2 - Sociedade Empresária Limitada',
    openingDate: '11/01/2010',
    capitalSocial: 8500000,
    address: {
      street: 'Rodovia BR-277',
      number: 'km 74',
      neighborhood: 'Industrial',
      municipality: 'Curitiba',
      uf: 'PR',
      cep: '81500-000',
      lat: -25.4601,
      lng: -49.2104
    },
    cnaeMain: { code: '49.30-2-02', text: 'Transporte rodoviário de carga, exceto produtos perigosos e mudanças, intermunicipal, interestadual e internacional' },
    cnaeSecondary: [],
    contacts: { phone: '(41) 3366-5000', email: 'atendimento@corredorsul.com.br' },
    dominantSegment: 'Logística e Transportes',
    verticals: ['Logística', 'Agro', 'Engenharia'],
    qualityScore: 97,
    updatedAt: '24/07/2026',
    people: [
      { id: 'P7', name: 'LUIZ GUSTAVO ROCHA', role: 'Diretor de Logística', category: 'Cargo Institucional', source: 'ANTT', updatedAt: '24/07/2026', confidence: 99 }
    ],
    works: [],
    logistics: [
      { rntrc: 'RNTRC 482109', category: 'ETC - Empresa', fleetCount: 65, municipality: 'Curitiba', uf: 'PR', status: 'Ativo ANTT' }
    ],
    agro: [
      { carCode: 'PR-4106902-8812', propertyName: 'FAZENDA VALE VERDE - CAR', municipality: 'Curitiba', uf: 'PR', areaHa: 1420, landUse: 'Escoamento Agrícola' }
    ],
    health: [],
    opportunities: [],
    provenance: {
      sources: ['Receita Federal RFB', 'ANTT RNTRC'],
      lastUpdate: '24/07/2026',
      missingFields: [],
      discrepancies: [],
      duplicatesFound: 0,
      coveragePct: 97,
      algorithmVersion: 'v2.4.0-stable'
    },
    insights: []
  },
  {
    id: 'emp-005',
    cnpj: '44.555.666/0001-77',
    cnpjClean: '44555666000177',
    legalName: 'AGROPECUARIA VALE DO SOL S/A',
    tradeName: 'VALE DO SOL AGRO',
    type: 'MATRIZ',
    status: 'ATIVA',
    size: 'DEMAIS',
    legalNature: '205-4 - Sociedade Anônima Fechada',
    openingDate: '03/07/2005',
    capitalSocial: 45000000,
    address: {
      street: 'Estrada Rural da Graciosa',
      number: 's/n',
      neighborhood: 'Zona Rural',
      municipality: 'Curitiba',
      uf: 'PR',
      cep: '82590-000',
      lat: -25.3891,
      lng: -49.1902
    },
    cnaeMain: { code: '01.11-6-01', text: 'Cultivo de arroz' },
    cnaeSecondary: [
      { code: '01.15-1-00', text: 'Cultivo de soja' }
    ],
    contacts: { phone: '(41) 3672-2000', email: 'contato@valedosolagro.com.br' },
    dominantSegment: 'Agronegócio',
    verticals: ['Agro', 'Logística'],
    qualityScore: 95,
    updatedAt: '24/07/2026',
    people: [
      { id: 'P8', name: 'FERNANDO VALE DO SOL', role: 'Diretor Presidente', category: 'Vínculo Societário Confirmado', source: 'RFB QSA', updatedAt: '24/07/2026', confidence: 99 }
    ],
    works: [],
    logistics: [],
    agro: [
      { carCode: 'PR-4106902-8812', propertyName: 'FAZENDA VALE VERDE - CAR', municipality: 'Curitiba', uf: 'PR', areaHa: 1420, landUse: 'Cultivo de Grãos' }
    ],
    health: [],
    opportunities: [],
    provenance: {
      sources: ['Receita Federal RFB', 'SICAR MMA'],
      lastUpdate: '24/07/2026',
      missingFields: [],
      discrepancies: [],
      duplicatesFound: 0,
      coveragePct: 95,
      algorithmVersion: 'v2.4.0-stable'
    },
    insights: []
  },
  {
    id: 'emp-006',
    cnpj: '55.666.777/0001-88',
    cnpjClean: '55666777000188',
    legalName: 'BIOSAUDE EQUIPAMENTOS HOSPITALARES LTDA',
    tradeName: 'BIOSAUDE MEDICAL',
    type: 'MATRIZ',
    status: 'ATIVA',
    size: 'EPP',
    legalNature: '206-2 - Sociedade Empresária Limitada',
    openingDate: '22/11/2018',
    capitalSocial: 3200000,
    address: {
      street: 'Rua Sete de Setembro',
      number: '3100',
      neighborhood: 'Batel',
      municipality: 'Curitiba',
      uf: 'PR',
      cep: '80240-000',
      lat: -25.4412,
      lng: -49.2801
    },
    cnaeMain: { code: '32.50-7-01', text: 'Fabricação de instrumentos não-eletrônicos e utensílios para uso médico, cirúrgico, odontológico e de laboratório' },
    cnaeSecondary: [],
    contacts: { phone: '(41) 3019-8000', email: 'vendas@biosaumedical.com.br' },
    dominantSegment: 'Saúde e Equipamentos',
    verticals: ['Saúde', 'Engenharia'],
    qualityScore: 92,
    updatedAt: '24/07/2026',
    people: [
      { id: 'P9', name: 'DRA. BEATRIZ NOGUEIRA', role: 'Diretora Técnica', category: 'Vínculo Societário Confirmado', source: 'CRF-PR', updatedAt: '24/07/2026', confidence: 97 }
    ],
    works: [],
    logistics: [],
    agro: [],
    health: [
      { cnesId: 'CNES 2784102', unitName: 'HOSPITAL MUNICIPAL DE CURITIBA', mantenedora: 'Prefeitura Curitiba', unitType: 'Hospital Geral', municipality: 'Curitiba', uf: 'PR' }
    ],
    opportunities: [],
    provenance: {
      sources: ['Receita Federal RFB', 'DATASUS CNES'],
      lastUpdate: '24/07/2026',
      missingFields: [],
      discrepancies: [],
      duplicatesFound: 0,
      coveragePct: 92,
      algorithmVersion: 'v2.4.0-stable'
    },
    insights: []
  }
];
