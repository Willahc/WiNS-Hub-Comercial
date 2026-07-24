import type { HubCompany, HubDataset, HubEvent, HubOpportunity, OverviewEntity, TerritoryProfile, VerticalAsset, VerticalKey } from '../../types/hub';
import { httpClient } from '../http/client';

type Page<T>={items:T[];meta?:{total?:number}};
type ApiCompany={source_id:string;razao_social?:string;nome_fantasia?:string;municipio?:string;uf?:string;porte?:string;capital_social?:number;qualityScore:number;source_updated_at?:string};
type ApiOpportunity={source_id:string;obra_id:string;cnpj:string;score:number;obra_nome:string;municipio?:string;uf?:string;fornecedor?:string};
async function loadHubData():Promise<HubDataset>{
  const [companiesResponse,opportunitiesResponse,eventsResponse,worksResponse,ruralResponse,carrierResponse,healthResponse]=await Promise.all([
    httpClient.get<Page<ApiCompany>>('/empresas',{params:{page_size:100,active:true,sort:'updated_desc'}}),
    httpClient.get<Page<ApiOpportunity>>('/oportunidades',{params:{page_size:100,min_score:70}}),
    httpClient.get<any[]>('/eventos'),
    httpClient.get<Page<any>>('/engenharia/obras',{params:{page:1,page_size:25,sort:'updated_desc'}}),
    httpClient.get<Page<any>>('/diretorios/agro/imoveis',{params:{page:1,page_size:25,sort:'updated_desc'}}),
    httpClient.get<Page<any>>('/diretorios/logistica/transportadores',{params:{page:1,page_size:25,sort:'updated_desc'}}),
    httpClient.get<Page<any>>('/diretorios/saude/estabelecimentos',{params:{page:1,page_size:25,sort:'updated_desc'}})
  ]);
  const mapResponse=await httpClient.get<{items:any[]}>('/visao-geral/mapa');
  const events:HubEvent[]=(eventsResponse.data||[]).map((e:any)=>({id:e.id,title:e.titulo||e.title||'Evento de Engenharia',type:e.tipo||'obra',territory:e.territorio||e.municipio||'—',status:e.status||'ativo',value:Number(e.valor)||0,severity:e.severidade||'media',verticals:e.verticals||['engenharia'],companyIds:e.companyIds||[],opportunityIds:e.opportunityIds||[],assetIds:e.assetIds||[],coordinates:e.coordinates||[-15.78, -47.92],date:e.data||e.date||'—',description:e.descricao||'',source:e.fonte||'wins_agro.engenharia.obras'}));
  const companies:HubCompany[]=companiesResponse.data.items.map(c=>({id:c.source_id,name:c.razao_social||'Sem razão social',tradeName:c.nome_fantasia||c.razao_social||'Empresa',cnpj:c.source_id,segment:c.porte||'Engenharia',territory:`${c.municipio||'Município não informado'}, ${c.uf||'—'}`,verticals:['engenharia'],score:Number(c.qualityScore)||50,revenue:Number(c.capital_social)||0,employees:0,relationships:[],eventIds:[],opportunityIds:[],history:[{date:c.source_updated_at?new Date(c.source_updated_at).toLocaleDateString('pt-BR'):'Sem data',title:'Cadastro real atualizado'}],sources:['wins_agro.core.empresa']}));
  const opportunities:HubOpportunity[]=opportunitiesResponse.data.items.map(o=>({id:o.source_id,title:`Fornecedor relacionado a ${o.obra_nome}`,vertical:'engenharia',territory:`${o.municipio||'Não informado'}, ${o.uf||'—'}`,value:0,stage:Number(o.score)>=85?'Qualificação':'Identificada',companyId:o.cnpj,eventId:'',score:Math.round(Number(o.score)||0),justification:`Match real da Engenharia com score ${o.score}. Valor ainda não homologado.`,owner:'Engenharia',nextStep:'Validar oportunidade comercial'}));
  for(const o of opportunities){const c=companies.find(x=>x.id===o.companyId);if(c)c.opportunityIds.push(o.id)}
  let entities:OverviewEntity[]=[];
  const add=(rows:any[],vertical:OverviewEntity['vertical'],kind:string,path:(r:any)=>string)=>rows.forEach(r=>{
    const municipality=r.municipio||r.municipio_nome||r.municipio_atuacao||'Município não informado';
    const uf=r.uf||r.uf_atuacao||'';
    entities.push({id:String(r.source_id||r.id||r.numero_rntrc||r.cnes_id),name:r.display_name||r.nome||r.nome_imovel||r.nome_transportador||r.nome_fantasia||r.razao_social||kind,vertical,kind,municipality,uf,territory:`${municipality}${uf?`, ${uf}`:''}`,source:r.source||r.fonte||r.fonte_principal||'Fonte oficial',updatedAt:r.source_updated_at||r.atualizado_em||r.data_atualizacao_cnes,detailPath:path(r),latitude:0,longitude:0,geoPrecision:'municipality'});
  });
  add(worksResponse.data.items||[],'engenharia','Obra',r=>`/engenharia/obras/${r.source_id||r.id}`);
  add(ruralResponse.data.items||[],'agro','Imóvel rural',r=>`/agro/diretorios/imoveis/${r.source_id}`);
  add(carrierResponse.data.items||[],'logistica','Transportador RNTRC',r=>`/logistica/diretorios/transportadores/${r.source_id}`);
  add(healthResponse.data.items||[],'saude','Estabelecimento CNES',r=>`/saude/estabelecimentos/${r.cnes_id||r.source_id}`);
  opportunities.slice(0,25).forEach(o=>entities.push({id:o.id,name:o.title,vertical:'oportunidades',kind:'Oportunidade',municipality:o.territory.split(',')[0],uf:o.territory.split(',')[1]?.trim()||'',territory:o.territory,source:'Engenharia · matches_v2',detailPath:`/engenharia/oportunidades/${o.id}`,latitude:0,longitude:0,geoPrecision:'municipality'}));
  entities=(mapResponse.data.items||[]).map((x:any)=>({...x,territory:`${x.municipality}${x.uf?`, ${x.uf}`:''}`,latitude:Number(x.latitude),longitude:Number(x.longitude)}));
  const workRows=worksResponse.data.items||[];
  return {events,companies,opportunities,assets:[],territories:[],overview:{counts:{works:Number(worksResponse.data.meta?.total||workRows.length),companies:Number(companiesResponse.data.meta?.total||companies.length),ruralProperties:Number(ruralResponse.data.meta?.total||0),carriers:Number(carrierResponse.data.meta?.total||0),healthEstablishments:Number(healthResponse.data.meta?.total||0),opportunities:Number(opportunitiesResponse.data.meta?.total||opportunities.length),confirmedRelations:workRows.filter((r:any)=>r.cnpj||r.empresa_cnpj).length,potentialRelations:new Set(entities.filter(x=>x.municipality!=='Município não informado').map(x=>`${x.municipality}/${x.uf}`)).size},entities}};
}
export const hubService={
 load:loadHubData,
 async getEvents():Promise<HubEvent[]>{return (await loadHubData()).events},
 async getEvent(id:string):Promise<HubEvent|undefined>{return (await loadHubData()).events.find(x=>x.id===id)},
 async getCompanies():Promise<HubCompany[]>{return (await loadHubData()).companies},
 async getCompany(id:string):Promise<HubCompany|undefined>{
   const {data}=await httpClient.get(`/empresas/${id}`);return {id:data.cnpj,name:data.legalName||'Sem razão social',tradeName:data.tradeName||data.legalName||'Empresa',cnpj:data.cnpj,segment:data.supplierProfile?.segment||'Engenharia',territory:`${data.address?.municipality||'Não informado'}, ${data.address?.state||'—'}`,verticals:['engenharia'],score:Number(data.qualityScore)||50,revenue:Number(data.capital)||0,employees:0,relationships:(data.works||[]).map((w:{nome:string})=>w.nome),eventIds:[],opportunityIds:[],history:[{date:data.lastUpdatedAt?new Date(data.lastUpdatedAt).toLocaleDateString('pt-BR'):'Sem data',title:'Cadastro real consolidado'}],sources:[`${data.provenance?.sourceSchema}.${data.provenance?.sourceTable}`]}
 },
 async getOpportunities():Promise<HubOpportunity[]>{return (await loadHubData()).opportunities},
 async getAssets(vertical?:VerticalKey):Promise<VerticalAsset[]>{const x=(await loadHubData()).assets;return vertical?x.filter(a=>a.vertical===vertical):x},
 async getTerritories():Promise<TerritoryProfile[]>{return (await loadHubData()).territories},
};
