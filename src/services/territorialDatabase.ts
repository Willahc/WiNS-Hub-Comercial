export interface MunicipalityProfile {
  ibge: string;
  name: string;
  uf: string;
  region: string; // Região imediata / intermediária
  neighboringMun: string[];
  areaKm2: number;
  population2026: string;
  lat: number;
  lng: number;

  // Verticals Separated Metrics (Visíveis vs Catálogo Físico vs CAPEX vs Entidades)
  engenharia: {
    visibleWorksCount: number;
    physicalCatalogCount: number;
    capexHomologated: number;
    capexPublished: number;
    capexEstimated: number;
    executingCompaniesCount: number;
    qualifiedOpportunitiesCount: number;
  };

  agro: {
    uniqueCarPropertiesCount: number;
    physicalRecordsCount: number;
    validGeometryCount: number;
    totalAreaHa: number;
    pastureHa: number;
    agricultureHa: number;
    vegetationHa: number;
    agroCompaniesCount: number;
  };

  logistica: {
    uniqueCarriersCount: number;
    activeRntrcsCount: number;
    carrierCompaniesCount: number;
    autonomousDriversCount: number;
    registeredFleetCount: number;
    caminhaoVazioOffersCount: number;
    logisticsOpportunitiesCount: number;
  };

  saude: {
    uniqueFacilitiesCount: number;
    activeFacilitiesCount: number;
    hospitalsCount: number;
    basicCareCount: number;
    totalBedsCount: number;
    utiBedsCount: number;
    mantenedorasCount: number;
    healthOpportunitiesCount: number;
  };

  // Highlighting & Cross-domain
  highlightObras: { id: string; name: string; phase: string; capex: number }[];
  highlightEmpresas: { id: string; name: string; type: string; quality: number }[];
  highlightTransportadores: { rntrc: string; name: string; fleet: number }[];
  highlightCar: { code: string; name: string; areaHa: number }[];
  highlightCnes: { cnesId: string; name: string; beds: number }[];
  highlightOpportunities: { id: string; title: string; score: number; rationale: string }[];
  highlightEvents: { id: string; title: string; date: string }[];

  qualityProvenance: {
    sources: string[];
    lastUpdateVerticals: { engenharia: string; agro: string; logistica: string; saude: string };
    missingIbgeCount: number;
    approxGeocodingCount: number;
    duplicatesCount: number;
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
    suggestedAction: string;
  }[];
}

export interface TerritorialMarker {
  id: string;
  name: string;
  type: 'obra' | 'empresa' | 'transportador' | 'imovel_car' | 'estabelecimento_cnes' | 'oportunidade' | 'evento';
  vertical: 'Engenharia' | 'Agro' | 'Logística' | 'Saúde';
  municipality: string;
  uf: string;
  ibge: string;
  lat: number;
  lng: number;
  metricLabel: string;
  metricValue: string;
  source: string;
  updatedAt: string;
  classification?: 'CONFIRMADO' | 'PROVÁVEL' | 'POTENCIAL';
}

export const MASTER_MUNICIPALITIES: MunicipalityProfile[] = [
  {
    ibge: '4106902',
    name: 'Curitiba',
    uf: 'PR',
    region: 'Região Geográfica Imediata de Curitiba',
    neighboringMun: ['Araucária', 'São José dos Pinhais', 'Campo Largo', 'Pinhais', 'Colombo'],
    areaKm2: 434.9,
    population2026: '1.773.733 hab. (IBGE 2026)',
    lat: -25.4297,
    lng: -49.2719,
    engenharia: {
      visibleWorksCount: 124,
      physicalCatalogCount: 35690,
      capexHomologated: 184000000,
      capexPublished: 320000000,
      capexEstimated: 450000000,
      executingCompaniesCount: 42,
      qualifiedOpportunitiesCount: 18
    },
    agro: {
      uniqueCarPropertiesCount: 852,
      physicalRecordsCount: 852190,
      validGeometryCount: 780,
      totalAreaHa: 14200,
      pastureHa: 3100,
      agricultureHa: 6800,
      vegetationHa: 4300,
      agroCompaniesCount: 15
    },
    logistica: {
      uniqueCarriersCount: 2410,
      activeRntrcsCount: 636404,
      carrierCompaniesCount: 890,
      autonomousDriversCount: 1520,
      registeredFleetCount: 18400,
      caminhaoVazioOffersCount: 340,
      logisticsOpportunitiesCount: 26
    },
    saude: {
      uniqueFacilitiesCount: 1890,
      activeFacilitiesCount: 341968,
      hospitalsCount: 48,
      basicCareCount: 112,
      totalBedsCount: 6840,
      utiBedsCount: 1250,
      mantenedorasCount: 340,
      healthOpportunitiesCount: 14
    },
    highlightObras: [
      { id: 'OBR-2026-PR01', name: 'Alvará Curitiba - Pavimentação LUMINA', phase: 'Em Execução', capex: 18400000 },
      { id: 'OBR-2026-PR04', name: 'Duplicação Contorno Leste Curitiba', phase: 'Licitação Aberta', capex: 42000000 }
    ],
    highlightEmpresas: [
      { id: 'emp-001', name: 'LUMINA GESTAO DE OBRAS LTDA', type: 'MATRIZ', quality: 98 },
      { id: 'emp-004', name: 'LOGISTICA CORREDOR SUL LTDA', type: 'MATRIZ', quality: 97 }
    ],
    highlightTransportadores: [
      { rntrc: 'RNTRC 482109', name: 'LOGISTICA CORREDOR SUL', fleet: 65 }
    ],
    highlightCar: [
      { code: 'PR-4106902-8812', name: 'FAZENDA VALE VERDE - CAR', areaHa: 1420 }
    ],
    highlightCnes: [
      { cnesId: 'CNES 2784102', name: 'HOSPITAL MUNICIPAL DE CURITIBA', beds: 380 }
    ],
    highlightOpportunities: [
      { id: 'OP-101', title: 'Fornecimento de Cimento Pavimentação Contorno Leste', score: 96, rationale: 'Compatibilidade de CNAE e presença na zona da obra' }
    ],
    highlightEvents: [
      { id: 'EVT-01', title: 'Interdição Temporária BR-277 km 42', date: '24/07/2026' }
    ],
    qualityProvenance: {
      sources: ['IBGE 2026', 'SNIRH', 'SICAR MMA', 'ANTT RNTRC', 'DATASUS CNES', 'PNCP', 'Receita Federal RFB'],
      lastUpdateVerticals: { engenharia: '24/07/2026', agro: '23/07/2026', logistica: '24/07/2026', saude: '22/07/2026' },
      missingIbgeCount: 0,
      approxGeocodingCount: 12,
      duplicatesCount: 0,
      coveragePct: 98.4,
      algorithmVersion: 'v2.4.0-stable'
    },
    insights: [
      {
        title: 'Alta Concentração Viária e Demanda Logística em Curitiba',
        rationale: 'Identificada sobreposição de 124 obras ativas de infraestrutura com hub logístico de 2.410 transportadores habilitados.',
        evidence: 'Geofence municipal auditado com 18.400 veículos de carga registrados.',
        confidence: 98,
        source: 'PNCP + ANTT',
        limitations: 'Alguns trechos viários dependem de liberação de desvio da PRF.',
        date: '24/07/2026',
        suggestedAction: 'Conectar transportadores autônomos locais às empreiteiras homologadas.'
      }
    ]
  },
  {
    ibge: '4101804',
    name: 'Araucária',
    uf: 'PR',
    region: 'Região Geográfica Imediata de Curitiba',
    neighboringMun: ['Curitiba', 'Contenda', 'Lapa', 'Campo Largo'],
    areaKm2: 469.2,
    population2026: '151.666 hab. (IBGE 2026)',
    lat: -25.5921,
    lng: -49.4102,
    engenharia: {
      visibleWorksCount: 48,
      physicalCatalogCount: 12400,
      capexHomologated: 89000000,
      capexPublished: 140000000,
      capexEstimated: 190000000,
      executingCompaniesCount: 19,
      qualifiedOpportunitiesCount: 9
    },
    agro: {
      uniqueCarPropertiesCount: 1240,
      physicalRecordsCount: 310000,
      validGeometryCount: 1180,
      totalAreaHa: 28400,
      pastureHa: 9800,
      agricultureHa: 12600,
      vegetationHa: 6000,
      agroCompaniesCount: 22
    },
    logistica: {
      uniqueCarriersCount: 1120,
      activeRntrcsCount: 240000,
      carrierCompaniesCount: 410,
      autonomousDriversCount: 710,
      registeredFleetCount: 9200,
      caminhaoVazioOffersCount: 190,
      logisticsOpportunitiesCount: 14
    },
    saude: {
      uniqueFacilitiesCount: 410,
      activeFacilitiesCount: 98000,
      hospitalsCount: 8,
      basicCareCount: 32,
      totalBedsCount: 940,
      utiBedsCount: 180,
      mantenedorasCount: 85,
      healthOpportunitiesCount: 6
    },
    highlightObras: [
      { id: 'OBR-2026-PR02', name: 'Construção Viária Trecho Sul', phase: 'Em Execução', capex: 34500000 }
    ],
    highlightEmpresas: [
      { id: 'emp-002', name: 'ENGENHARIA E CONSTRUCOES PARANA S/A', type: 'MATRIZ', quality: 96 }
    ],
    highlightTransportadores: [
      { rntrc: 'RNTRC 391024', name: 'FROTA AGRO LOGISTICA', fleet: 19 }
    ],
    highlightCar: [
      { code: 'PR-4101804-9921', name: 'ESTANCIA SANTA RITA - CAR', areaHa: 2400 }
    ],
    highlightCnes: [
      { cnesId: 'CNES 3918201', name: 'UPA 24H CENTRO ARAUCARIA', beds: 45 }
    ],
    highlightOpportunities: [
      { id: 'OP-102', title: 'Subcontratação de Brita e Terraplanagem Trecho Sul', score: 94, rationale: 'Proximidade de 8km com jazidas e frota disponível' }
    ],
    highlightEvents: [],
    qualityProvenance: {
      sources: ['IBGE 2026', 'SICAR MMA', 'ANTT RNTRC', 'PNCP'],
      lastUpdateVerticals: { engenharia: '24/07/2026', agro: '23/07/2026', logistica: '24/07/2026', saude: '21/07/2026' },
      missingIbgeCount: 0,
      approxGeocodingCount: 4,
      duplicatesCount: 0,
      coveragePct: 97.2,
      algorithmVersion: 'v2.4.0-stable'
    },
    insights: [
      {
        title: 'Forte Adjacência Agro ↔ Logística Industrial',
        rationale: 'Elevado volume de produção agrícola em 28.400 ha com polo de transporte pesado.',
        evidence: '22 empresas do agronegócio conectadas a 1.120 transportadores cadastrados.',
        confidence: 96,
        source: 'SICAR + ANTT',
        limitations: 'Capacidade de armazenagem de grãos requer expansão.',
        date: '24/07/2026',
        suggestedAction: 'Oferecer soluções de frete direto do Caminhão Vazio para escoamento.'
      }
    ]
  },
  {
    ibge: '4125506',
    name: 'São José dos Pinhais',
    uf: 'PR',
    region: 'Região Geográfica Imediata de Curitiba',
    neighboringMun: ['Curitiba', 'Araucária', 'Fazenda Rio Grande', 'Tijucas do Sul'],
    areaKm2: 946.4,
    population2026: '342.920 hab. (IBGE 2026)',
    lat: -25.5341,
    lng: -49.2012,
    engenharia: {
      visibleWorksCount: 64,
      physicalCatalogCount: 18900,
      capexHomologated: 112000000,
      capexPublished: 195000000,
      capexEstimated: 260000000,
      executingCompaniesCount: 28,
      qualifiedOpportunitiesCount: 12
    },
    agro: {
      uniqueCarPropertiesCount: 1890,
      physicalRecordsCount: 450000,
      validGeometryCount: 1760,
      totalAreaHa: 42000,
      pastureHa: 14000,
      agricultureHa: 18500,
      vegetationHa: 9500,
      agroCompaniesCount: 31
    },
    logistica: {
      uniqueCarriersCount: 1980,
      activeRntrcsCount: 420000,
      carrierCompaniesCount: 680,
      autonomousDriversCount: 1300,
      registeredFleetCount: 14200,
      caminhaoVazioOffersCount: 280,
      logisticsOpportunitiesCount: 21
    },
    saude: {
      uniqueFacilitiesCount: 680,
      activeFacilitiesCount: 142000,
      hospitalsCount: 14,
      basicCareCount: 48,
      totalBedsCount: 1450,
      utiBedsCount: 290,
      mantenedorasCount: 120,
      healthOpportunitiesCount: 9
    },
    highlightObras: [
      { id: 'OBR-2026-PR03', name: 'Ampliação Terminal Aeroportuário', phase: 'Em Execução', capex: 29000000 }
    ],
    highlightEmpresas: [
      { id: 'emp-003', name: 'CONSTRUTORA HORIZONTE LTDA', type: 'MATRIZ', quality: 94 }
    ],
    highlightTransportadores: [
      { rntrc: 'RNTRC 519203', name: 'CARGO EXPRESS PARANA', fleet: 42 }
    ],
    highlightCar: [
      { code: 'PR-4125506-1102', name: 'PROPRIEDADE RURAL GUARANI - CAR', areaHa: 1800 }
    ],
    highlightCnes: [
      { cnesId: 'CNES 5819203', name: 'CLINICA DIAGNOSTICOS AVANCADOS', beds: 20 }
    ],
    highlightOpportunities: [
      { id: 'OP-103', title: 'Manutenção e Sinalização Viária Acesso Aeroporto', score: 92, rationale: 'Ampliação de terminal de carga com edital publicado' }
    ],
    highlightEvents: [],
    qualityProvenance: {
      sources: ['IBGE 2026', 'INFRAERO', 'ANTT RNTRC', 'SICAR MMA'],
      lastUpdateVerticals: { engenharia: '24/07/2026', agro: '24/07/2026', logistica: '24/07/2026', saude: '22/07/2026' },
      missingIbgeCount: 0,
      approxGeocodingCount: 6,
      duplicatesCount: 0,
      coveragePct: 96.8,
      algorithmVersion: 'v2.4.0-stable'
    },
    insights: [
      {
        title: 'Hub de Conectividade Aeroportuária & Carga Pesada',
        rationale: 'Presença do Aeroporto Afonso Pena combinada com 1.980 transportadores rodoviários.',
        evidence: 'Contrato de ampliação de terminal de carga de R$ 29M.',
        confidence: 97,
        source: 'INFRAERO + ANTT',
        limitations: 'Tráfego urbano pesado restrito em horário de pico.',
        date: '24/07/2026',
        suggestedAction: 'Ativar ofertas de transporte de carga seca e fracionada.'
      }
    ]
  }
];

export const MASTER_TERRITORIAL_MARKERS: TerritorialMarker[] = [
  { id: 'M1', name: 'Alvará Curitiba - Pavimentação LUMINA', type: 'obra', vertical: 'Engenharia', municipality: 'Curitiba', uf: 'PR', ibge: '4106902', lat: -25.4210, lng: -49.2650, metricLabel: 'CAPEX', metricValue: 'R$ 18,4M', source: 'PNCP', updatedAt: '24/07/2026', classification: 'CONFIRMADO' },
  { id: 'M2', name: 'Duplicação Contorno Leste Curitiba', type: 'obra', vertical: 'Engenharia', municipality: 'Curitiba', uf: 'PR', ibge: '4106902', lat: -25.4450, lng: -49.2100, metricLabel: 'CAPEX', metricValue: 'R$ 42,0M', source: 'PNCP', updatedAt: '24/07/2026', classification: 'CONFIRMADO' },
  { id: 'M3', name: 'LUMINA GESTAO DE OBRAS LTDA', type: 'empresa', vertical: 'Engenharia', municipality: 'Curitiba', uf: 'PR', ibge: '4106902', lat: -25.4195, lng: -49.2689, metricLabel: 'CNPJ', metricValue: '00.000.000/0001-91', source: 'RFB', updatedAt: '24/07/2026', classification: 'CONFIRMADO' },
  { id: 'M4', name: 'LOGISTICA CORREDOR SUL LTDA', type: 'transportador', vertical: 'Logística', municipality: 'Curitiba', uf: 'PR', ibge: '4106902', lat: -25.4601, lng: -49.2104, metricLabel: 'RNTRC', metricValue: '482109', source: 'ANTT', updatedAt: '24/07/2026', classification: 'PROVÁVEL' },
  { id: 'M5', name: 'FAZENDA VALE VERDE - CAR', type: 'imovel_car', vertical: 'Agro', municipality: 'Curitiba', uf: 'PR', ibge: '4106902', lat: -25.3891, lng: -49.1902, metricLabel: 'Área', metricValue: '1.420 ha', source: 'SICAR', updatedAt: '23/07/2026', classification: 'CONFIRMADO' },
  { id: 'M6', name: 'HOSPITAL MUNICIPAL DE CURITIBA', type: 'estabelecimento_cnes', vertical: 'Saúde', municipality: 'Curitiba', uf: 'PR', ibge: '4106902', lat: -25.4380, lng: -49.2780, metricLabel: 'CNES', metricValue: '2784102', source: 'DATASUS', updatedAt: '22/07/2026', classification: 'CONFIRMADO' },
  { id: 'M7', name: 'Oportunidade Pavimentação Leste', type: 'oportunidade', vertical: 'Engenharia', municipality: 'Curitiba', uf: 'PR', ibge: '4106902', lat: -25.4300, lng: -49.2400, metricLabel: 'Score', metricValue: '96/100', source: 'WiNS Engine', updatedAt: '24/07/2026', classification: 'PROVÁVEL' },
  { id: 'M8', name: 'Interdição Temporária BR-277 km 42', type: 'evento', vertical: 'Logística', municipality: 'Curitiba', uf: 'PR', ibge: '4106902', lat: -25.4500, lng: -49.1800, metricLabel: 'Status', metricValue: 'Ativo', source: 'PRF', updatedAt: '24/07/2026', classification: 'PROVÁVEL' },

  { id: 'M9', name: 'Construção Viária Trecho Sul', type: 'obra', vertical: 'Engenharia', municipality: 'Araucária', uf: 'PR', ibge: '4101804', lat: -25.5890, lng: -49.4050, metricLabel: 'CAPEX', metricValue: 'R$ 34,5M', source: 'DER-PR', updatedAt: '24/07/2026', classification: 'CONFIRMADO' },
  { id: 'M10', name: 'ENGENHARIA E CONSTRUCOES PARANA S/A', type: 'empresa', vertical: 'Engenharia', municipality: 'Araucária', uf: 'PR', ibge: '4101804', lat: -25.5921, lng: -49.4102, metricLabel: 'CNPJ', metricValue: '11.222.333/0001-44', source: 'RFB', updatedAt: '24/07/2026', classification: 'CONFIRMADO' },
  { id: 'M11', name: 'ESTANCIA SANTA RITA - CAR', type: 'imovel_car', vertical: 'Agro', municipality: 'Araucária', uf: 'PR', ibge: '4101804', lat: -25.6100, lng: -49.4300, metricLabel: 'Área', metricValue: '2.400 ha', source: 'SICAR', updatedAt: '23/07/2026', classification: 'CONFIRMADO' },
  { id: 'M12', name: 'UPA 24H CENTRO ARAUCARIA', type: 'estabelecimento_cnes', vertical: 'Saúde', municipality: 'Araucária', uf: 'PR', ibge: '4101804', lat: -25.5850, lng: -49.4000, metricLabel: 'CNES', metricValue: '3918201', source: 'DATASUS', updatedAt: '21/07/2026', classification: 'CONFIRMADO' },

  { id: 'M13', name: 'Ampliação Terminal Aeroportuário', type: 'obra', vertical: 'Engenharia', municipality: 'São José dos Pinhais', uf: 'PR', ibge: '4125506', lat: -25.5300, lng: -49.1980, metricLabel: 'CAPEX', metricValue: 'R$ 29,0M', source: 'INFRAERO', updatedAt: '24/07/2026', classification: 'CONFIRMADO' },
  { id: 'M14', name: 'CONSTRUTORA HORIZONTE LTDA', type: 'empresa', vertical: 'Engenharia', municipality: 'São José dos Pinhais', uf: 'PR', ibge: '4125506', lat: -25.5341, lng: -49.2012, metricLabel: 'CNPJ', metricValue: '22.333.444/0001-55', source: 'RFB', updatedAt: '24/07/2026', classification: 'CONFIRMADO' },
  { id: 'M15', name: 'PROPRIEDADE RURAL GUARANI - CAR', type: 'imovel_car', vertical: 'Agro', municipality: 'São José dos Pinhais', uf: 'PR', ibge: '4125506', lat: -25.5500, lng: -49.1800, metricLabel: 'Área', metricValue: '1.800 ha', source: 'SICAR', updatedAt: '24/07/2026', classification: 'CONFIRMADO' },
  { id: 'M16', name: 'CLINICA DIAGNOSTICOS AVANCADOS', type: 'estabelecimento_cnes', vertical: 'Saúde', municipality: 'São José dos Pinhais', uf: 'PR', ibge: '4125506', lat: -25.5280, lng: -49.2050, metricLabel: 'CNES', metricValue: '5819203', source: 'DATASUS', updatedAt: '22/07/2026', classification: 'CONFIRMADO' }
];
