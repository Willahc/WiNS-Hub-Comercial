import type { HubCompany, HubEvent, HubOpportunity, TerritoryProfile, VerticalAsset, VerticalKey } from '../types/hub';

const co=(id:string,name:string,tradeName:string,cnpj:string,segment:string,territory:string,verticals:VerticalKey[],score:number,revenue:number,employees:number,eventIds:string[],opportunityIds:string[]):HubCompany=>({id,name,tradeName,cnpj,segment,territory,verticals,score,revenue,employees,eventIds,opportunityIds,relationships:['Fornecedor homologado','Consórcio regional','Entidade setorial'],history:[{date:'18 jul 2026',title:'Score territorial atualizado'},{date:'03 jul 2026',title:'Novo vínculo comercial identificado'},{date:'12 jun 2026',title:'Cadastro e fontes revisados'}],sources:['Receita Federal — dados cadastrais','Diários oficiais e licitações','Base territorial WiNS — atualização 20/07/2026']});
export const HUB_COMPANIES:HubCompany[]=[
 co('hub-co-01','Rota Sul Transportes Integrados','Rota Sul','42.109.886/0001-21','Transporte rodoviário','Porto Alegre, RS',['logistica'],91,680000000,2100,['evt-01','evt-03'],['hub-opp-01','hub-opp-09']),
 co('hub-co-02','Cooperativa Cerrado Forte','Cerrado Forte','18.544.320/0001-09','Agroindústria','Sorriso, MT',['agro','logistica'],94,2400000000,4800,['evt-04'],['hub-opp-02']),
 co('hub-co-03','Rede Vitalis Hospitais S.A.','Vitalis','07.322.410/0001-87','Serviços hospitalares','Campinas, SP',['saude'],89,1150000000,6200,['evt-05'],['hub-opp-03','hub-opp-10']),
 co('hub-co-04','Terminais Atlântico Brasil','TAB','30.866.517/0001-55','Operação portuária','Santos, SP',['logistica'],92,1780000000,3500,['evt-02','evt-03'],['hub-opp-04']),
 co('hub-co-05','AgroNorte Insumos e Tecnologia','AgroNorte','25.711.908/0001-34','Insumos agrícolas','Rio Verde, GO',['agro'],87,890000000,1700,['evt-04','evt-08'],['hub-opp-05']),
 co('hub-co-06','Diagnósticos Horizonte Ltda.','DiagHorizonte','53.101.286/0001-70','Diagnóstico médico','Belo Horizonte, MG',['saude'],86,420000000,980,['evt-05','evt-09'],['hub-opp-06']),
 co('hub-co-07','FrioLog Cadeia Integrada','FrioLog','14.299.603/0001-46','Logística refrigerada','Curitiba, PR',['logistica','saude','agro'],90,720000000,1450,['evt-06'],['hub-opp-07']),
 co('hub-co-08','Sementes Aurora do Brasil','Aurora Sementes','09.188.735/0001-65','Produção de sementes','Sorriso, MT',['agro'],93,1320000000,2600,['evt-08'],['hub-opp-08']),
];

export const HUB_EVENTS:HubEvent[]=[
 {id:'evt-01',title:'Cheias no Vale do Taquari',type:'Climático',date:'20 jul 2026',territory:'Lajeado, RS',verticals:['engenharia','logistica','agro','saude'],severity:'Crítica',status:'Monitorando',description:'Interdições viárias, risco a propriedades rurais e pressão sobre a rede assistencial.',value:1200000000,companyIds:['hub-co-01'],opportunityIds:['hub-opp-01'],coordinates:[-29.4669,-51.9614],source:'Defesa Civil RS · atualização controlada'},
 {id:'evt-02',title:'Leilão de terminais portuários',type:'Regulatório',date:'22 jul 2026',territory:'Santos, SP',verticals:['logistica','engenharia'],severity:'Alta',status:'Em análise',description:'Nova rodada de concessões amplia capacidade portuária e demanda por retroárea.',value:850000000,companyIds:['hub-co-04'],opportunityIds:['hub-opp-04'],coordinates:[-23.9608,-46.3336],source:'ANTAQ · agenda pública'},
 {id:'evt-03',title:'Restrição de acesso ao Porto de Santos',type:'Operacional',date:'19 jul 2026',territory:'Santos, SP',verticals:['logistica'],severity:'Alta',status:'Monitorando',description:'Fila de caminhões e queda de fluidez no corredor de exportação.',value:200000000,companyIds:['hub-co-01','hub-co-04'],opportunityIds:['hub-opp-09'],coordinates:[-23.947,-46.302],source:'Monitoramento logístico WiNS'},
 {id:'evt-04',title:'Estiagem no cinturão do milho',type:'Climático',date:'18 jul 2026',territory:'Sorriso, MT',verticals:['agro','logistica'],severity:'Alta',status:'Monitorando',description:'Redução projetada de produtividade e ajuste de armazenagem.',value:3400000000,companyIds:['hub-co-02','hub-co-05'],opportunityIds:['hub-opp-02','hub-opp-05'],coordinates:[-12.5425,-55.7211],source:'INMET e inteligência agrícola WiNS'},
 {id:'evt-05',title:'Aumento de internações por dengue',type:'Sanitário',date:'17 jul 2026',territory:'Campinas, SP',verticals:['saude'],severity:'Crítica',status:'Monitorando',description:'Ocupação de leitos clínicos acima da faixa de atenção.',value:80000000,companyIds:['hub-co-03','hub-co-06'],opportunityIds:['hub-opp-03','hub-opp-06'],coordinates:[-22.9056,-47.0608],source:'DATASUS · recorte demonstrativo'},
 {id:'evt-06',title:'Nova exigência de cadeia fria',type:'Regulatório',date:'15 jul 2026',territory:'Curitiba, PR',verticals:['saude','logistica','agro'],severity:'Média',status:'Em análise',description:'Adequação de rastreabilidade para medicamentos e alimentos sensíveis.',value:150000000,companyIds:['hub-co-07'],opportunityIds:['hub-opp-07'],coordinates:[-25.4284,-49.2733],source:'ANVISA · consolidação WiNS'},
 {id:'evt-07',title:'Licença do corredor metropolitano',type:'Infraestrutura',date:'13 jul 2026',territory:'Salvador, BA',verticals:['engenharia','logistica'],severity:'Média',status:'Resolvido',description:'Licença prévia aprovada para novo eixo de mobilidade.',value:520000000,companyIds:[],opportunityIds:[],coordinates:[-12.9777,-38.5016],source:'Diário Oficial BA'},
 {id:'evt-08',title:'Abertura da janela de plantio',type:'Produtivo',date:'11 jul 2026',territory:'Rio Verde, GO',verticals:['agro'],severity:'Baixa',status:'Em análise',description:'Demanda antecipada por sementes, fertilizantes e crédito.',value:680000000,companyIds:['hub-co-05','hub-co-08'],opportunityIds:['hub-opp-08'],coordinates:[-17.7923,-50.9192],source:'Calendário agrícola controlado'},
 {id:'evt-09',title:'Expansão da atenção diagnóstica',type:'Investimento',date:'09 jul 2026',territory:'Belo Horizonte, MG',verticals:['saude','engenharia'],severity:'Média',status:'Em análise',description:'Rede regional planeja três novas unidades de diagnóstico.',value:95000000,companyIds:['hub-co-06'],opportunityIds:['hub-opp-10'],coordinates:[-19.9167,-43.9345],source:'Plano de investimento homologado'},
];

const opp=(id:string,title:string,vertical:VerticalKey,territory:string,value:number,stage:HubOpportunity['stage'],companyId:string,eventId:string,score:number,owner:string,nextStep:string):HubOpportunity=>({id,title,vertical,territory,value,stage,companyId,eventId,score,owner,nextStep,justification:`Aderência territorial de ${score}% combinada a capacidade operacional, histórico setorial e janela de demanda.`});
export const HUB_OPPORTUNITIES:HubOpportunity[]=[
 opp('hub-opp-01','Rotas emergenciais e última milha','logistica','Lajeado, RS',18000000,'Proposta','hub-co-01','evt-01',94,'Carolina Mendes','Validar capacidade dedicada'),
 opp('hub-opp-02','Recuperação de solo e sementes','agro','Sorriso, MT',32000000,'Qualificação','hub-co-02','evt-04',91,'Mateus Silveira','Agendar visita técnica'),
 opp('hub-opp-03','Expansão temporária de leitos','saude','Campinas, SP',14500000,'Negociação','hub-co-03','evt-05',96,'Laura Prado','Fechar escopo assistencial'),
 opp('hub-opp-04','Automação de gate portuário','logistica','Santos, SP',27000000,'Identificada','hub-co-04','evt-02',89,'Carolina Mendes','Mapear decisores'),
 opp('hub-opp-05','Irrigação inteligente por pivô','agro','Rio Verde, GO',22000000,'Proposta','hub-co-05','evt-04',87,'Mateus Silveira','Revisar proposta financeira'),
 opp('hub-opp-06','Equipamentos de diagnóstico rápido','saude','Campinas, SP',8600000,'Qualificação','hub-co-06','evt-05',92,'Laura Prado','Homologar equipamentos'),
 opp('hub-opp-07','Telemetria de cadeia fria','logistica','Curitiba, PR',11800000,'Negociação','hub-co-07','evt-06',90,'Carolina Mendes','Aprovar piloto regional'),
 opp('hub-opp-08','Sementes de alta tolerância','agro','Rio Verde, GO',19300000,'Ganha','hub-co-08','evt-08',95,'Mateus Silveira','Planejar implantação'),
 opp('hub-opp-09','Otimização Caminhão Vazio','logistica','Santos, SP',7400000,'Proposta','hub-co-01','evt-03',93,'Carolina Mendes','Conectar embarcadores âncora'),
 opp('hub-opp-10','Implantação de unidade diagnóstica','saude','Belo Horizonte, MG',36000000,'Identificada','hub-co-03','evt-09',88,'Laura Prado','Qualificar terreno e demanda'),
];

const asset=(id:string,vertical:VerticalKey,name:string,type:string,territory:string,status:string,capacity:string,utilization:number,companyId:string,coordinates:[number,number],detail:string):VerticalAsset=>({id,vertical,name,type,territory,status,capacity,utilization,companyId,coordinates,detail});
export const HUB_ASSETS:VerticalAsset[]=[
 asset('log-01','logistica','Corredor Santos–Campinas','Corredor','Santos, SP','Atenção','18,4 mil t/dia',86,'hub-co-01',[-23.72,-46.52],'Fluxo exportador e importador integrado'),
 asset('log-02','logistica','Terminal Atlântico 3','Terminal','Santos, SP','Operacional','2,8 mi TEU/ano',78,'hub-co-04',[-23.96,-46.33],'Contêineres e carga geral'),
 asset('log-03','logistica','Frota Rota Sul','Frota','Porto Alegre, RS','Operacional','640 veículos',72,'hub-co-01',[-30.03,-51.23],'112 veículos disponíveis para retorno'),
 asset('log-04','logistica','Hub Frio Curitiba','Centro logístico','Curitiba, PR','Operacional','28 mil posições',81,'hub-co-07',[-25.43,-49.27],'Cadeia fria multissetorial'),
 asset('agro-01','agro','Fazenda Horizonte','Propriedade','Sorriso, MT','Safra ativa','18.400 ha',74,'hub-co-02',[-12.54,-55.72],'Soja e milho segunda safra'),
 asset('agro-02','agro','Unidade Rio Verde','Armazém','Rio Verde, GO','Operacional','310 mil t',88,'hub-co-05',[-17.79,-50.92],'Recebimento, secagem e expedição'),
 asset('agro-03','agro','Campo Experimental Aurora','Pesquisa','Sorriso, MT','Monitorando','1.200 ha',63,'hub-co-08',[-12.61,-55.66],'Genética tolerante a estresse hídrico'),
 asset('agro-04','agro','Cooperativa Cerrado — Unidade 7','Beneficiamento','Sorriso, MT','Operacional','220 mil t/ano',79,'hub-co-02',[-12.49,-55.68],'Processamento de grãos'),
 asset('sau-01','saude','Hospital Vitalis Campinas','Hospital','Campinas, SP','Atenção','420 leitos',91,'hub-co-03',[-22.91,-47.06],'Referência regional em alta complexidade'),
 asset('sau-02','saude','Centro DiagHorizonte','Diagnóstico','Belo Horizonte, MG','Operacional','1.800 exames/dia',76,'hub-co-06',[-19.92,-43.94],'Imagem e análises clínicas'),
 asset('sau-03','saude','UPA Campo Grande','Urgência','Campinas, SP','Crítico','34 leitos',96,'hub-co-03',[-22.93,-47.12],'Alta demanda por síndrome febril'),
 asset('sau-04','saude','Centro de Distribuição FrioLog','Suprimentos','Curitiba, PR','Operacional','8,5 mi doses',67,'hub-co-07',[-25.47,-49.31],'Medicamentos e imunobiológicos'),
];

export const HUB_TERRITORIES:TerritoryProfile[]=[
 {id:'terr-sp',name:'Campinas',state:'SP',population:1220000,gdp:72000000000,score:91,companies:48800,jobs:541000,verticalPresence:{engenharia:78,logistica:92,agro:64,saude:95},indicators:[{label:'PIB per capita',value:'R$ 59 mil',trend:'+4,2%'},{label:'Empregos formais',value:'541 mil',trend:'+2,8%'},{label:'Cobertura de saúde',value:'87%',trend:'+1,1 p.p.'}]},
 {id:'terr-mt',name:'Sorriso',state:'MT',population:120000,gdp:14800000000,score:94,companies:8900,jobs:47200,verticalPresence:{engenharia:62,logistica:84,agro:98,saude:58},indicators:[{label:'Produção de grãos',value:'4,3 mi t',trend:'+6,4%'},{label:'Capacidade estática',value:'3,1 mi t',trend:'+3,0%'},{label:'Área cultivada',value:'1,2 mi ha',trend:'+2,1%'}]},
 {id:'terr-rs',name:'Lajeado',state:'RS',population:92000,gdp:7200000000,score:86,companies:6400,jobs:39100,verticalPresence:{engenharia:88,logistica:91,agro:89,saude:76},indicators:[{label:'Empresas ativas',value:'6,4 mil',trend:'+1,8%'},{label:'Investimento monitorado',value:'R$ 1,2 bi',trend:'+12%'},{label:'Cobertura ESF',value:'84%',trend:'+0,8 p.p.'}]},
 {id:'terr-pr',name:'Curitiba',state:'PR',population:1770000,gdp:98000000000,score:90,companies:106000,jobs:812000,verticalPresence:{engenharia:91,logistica:96,agro:72,saude:89},indicators:[{label:'PIB de serviços',value:'R$ 72 bi',trend:'+3,6%'},{label:'Densidade empresarial',value:'599/10k',trend:'+2,2%'},{label:'Índice logístico',value:'96/100',trend:'+4 pts'}]},
];
