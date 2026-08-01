import React,{useCallback,useEffect,useState} from 'react';
import {Link} from 'react-router-dom';
import AgroPageShell from '../components/AgroPageShell';
import {httpClient} from '../services/http/client';
import {AGRO_API} from './agroApiEndpoints';

const labels:Record<string,string>={PROFISSIONAL_NOMINAL:'Profissional nominal',ESTABELECIMENTO_VETERINARIO:'Estabelecimento',PROVAVEL_POR_CNAE:'Provável por CNAE',REPRODUCAO_MANEJO:'Reprodução/manejo',AGRONOMO_CREA:'CREA',ORIGEM_ABCZ:'ABCZ'};
const box:React.CSSProperties={background:'var(--bg-surface)',border:'1px solid var(--border-default)',borderRadius:8,padding:12};
export default function AgroTecnicaApproved(){
 const [items,setItems]=useState<any[]>([]),[stats,setStats]=useState<any>({}),[loading,setLoading]=useState(true),[error,setError]=useState<string|null>(null),[page,setPage]=useState(1),[totalPages,setTotalPages]=useState(0);
 const [f,setF]=useState<any>({q:'',uf:'',municipio:'',profissao:'',origem:'',confianca:'',com_crmv:'',contato:'',atividade:''});
 const load=useCallback(async()=>{setLoading(true);setError(null);try{const params:any={page,page_size:25};Object.entries(f).forEach(([k,v])=>{if(v)params[k==='contato'?'com_telefone':k]=v});const [a,b]=await Promise.all([httpClient.get(AGRO_API.tecnicos,{params}),httpClient.get(AGRO_API.tecnicosStats)]);setItems(a.data.items||[]);setTotalPages(a.data.total_pages||0);setStats(b.data||{});}catch(e:any){setError(e?.message||'Falha ao carregar o Canal Técnico');setItems([])}finally{setLoading(false)}},[f,page]);
 useEffect(()=>{load()},[load]); const change=(k:string,v:string)=>{setPage(1);setF((x:any)=>({...x,[k]:v}))};
 const kpis=[['Total no canal',stats.total],['Profissionais nominais',stats.profissionais_nominais],['Estabelecimentos',stats.estabelecimentos_veterinarios],['Veterinários',stats.veterinarios],['Zootecnistas',stats.zootecnistas],['Reprodução/manejo',stats.reproducao_manejo],['CRMV informado',stats.com_crmv_informado],['Com telefone/e-mail',(stats.com_telefone||0)+(stats.com_email||0)]];
 return <AgroPageShell title="Canal Técnico" subtitle="Cadastros integrados com tipo, origem e confiança explícitos" loading={loading} error={error} onRetry={load} empty={!loading&&!error&&!items.length} emptyMessage="Nenhum cadastro no recorte atual.">
  <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(145px,1fr))',gap:8}}>{kpis.map(([l,v])=><div style={box} key={l}><small>{l}</small><strong style={{display:'block',fontSize:22}}>{Number(v||0).toLocaleString('pt-BR')}</strong></div>)}</div>
  <div aria-label="Filtros do Canal Técnico" style={{...box,display:'flex',gap:8,flexWrap:'wrap'}}>
   <input aria-label="Busca" placeholder="Nome, CNPJ ou município" value={f.q} onChange={e=>change('q',e.target.value)}/><input aria-label="UF" placeholder="UF" value={f.uf} onChange={e=>change('uf',e.target.value.toUpperCase())}/><input aria-label="Município" placeholder="Município" value={f.municipio} onChange={e=>change('municipio',e.target.value)}/>
   {['profissao','origem','confianca','atividade'].map(k=><input key={k} aria-label={k} placeholder={k[0].toUpperCase()+k.slice(1)} value={f[k]} onChange={e=>change(k,e.target.value)}/>)}
   <select aria-label="CRMV informado" value={f.com_crmv} onChange={e=>change('com_crmv',e.target.value)}><option value="">CRMV: todos</option><option value="true">Com CRMV informado</option></select><select aria-label="Contato disponível" value={f.contato} onChange={e=>change('contato',e.target.value)}><option value="">Contato: todos</option><option value="true">Com telefone</option></select>
  </div>
  <div style={{...box,overflowX:'auto'}}><table><thead><tr>{['Nome / razão social','Tipo','Profissão','Confiança','Atividade / CNAE','Município / UF','CRMV','Contato','Fonte','Score',''].map(x=><th key={x}>{x}</th>)}</tr></thead><tbody>{items.map(i=><tr key={i.id}><td>{i.nome}</td><td><span className="badge">{labels[i.entidade_tipo]||i.entidade_tipo}</span></td><td>{i.profissao||'Não informado'}</td><td>{i.confianca_profissao}</td><td>{i.atividade||'—'}{i.cnae?` · ${i.cnae}`:''}</td><td>{i.municipio||'—'} / {i.uf||'—'}</td><td>{i.crmv_numero?<span>CRMV {i.crmv_numero} — situação não validada</span>:'Não informado'}</td><td>{i.telefone||i.email||'Não disponível'}</td><td>{(i.fontes||[]).join(', ')}</td><td>{typeof i.score_canal==='number'?i.score_canal:'Não disponível'}</td><td><Link to={`/agro/tecnica/${encodeURIComponent(i.id)}`}>Ver ficha</Link></td></tr>)}</tbody></table></div>
  <div style={{display:'flex',gap:8,justifyContent:'center'}}><button disabled={page<=1} onClick={()=>setPage(p=>p-1)}>Anterior</button><span>Página {page} de {totalPages}</span><button disabled={page>=totalPages} onClick={()=>setPage(p=>p+1)}>Próxima</button></div>
 </AgroPageShell>
}
