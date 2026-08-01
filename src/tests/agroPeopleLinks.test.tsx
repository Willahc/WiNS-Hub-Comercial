import{describe,it,expect}from'vitest';import fs from'node:fs';import path from'node:path';
const list=fs.readFileSync(path.resolve('src/pages/AgroLeadsApproved.tsx'),'utf8');
const detail=fs.readFileSync(path.resolve('src/pages/AgroPersonDetailApproved.tsx'),'utf8');
const app=fs.readFileSync(path.resolve('src/App.tsx'),'utf8');
describe('Pessoas e vínculos societários Agro',()=>{
 it('usa título e semântica novos sem score comercial',()=>{expect(list).toContain('Pessoas e Vínculos Societários Agro');expect(list).not.toContain('title="Leads & Decisores Rurais"');expect(list).toContain('Evidência');expect(list).not.toContain('98/100')});
 it('agrupa pessoa e resume múltiplas empresas',()=>{for(const text of ['person_id','total_empresas','empresas_resumo','+ {p.total_empresas-3} outros vínculos'])expect(list).toContain(text)});
 it('expande vínculos por lazy loading',()=>{for(const text of ['const expand=async','AGRO_API.person(id)','Carregando vínculos','CNPJ {x.cnpj}'])expect(list).toContain(text)});
 it('não atribui contato institucional à pessoa',()=>{expect(list).toContain('Contato institucional da empresa');expect(list).toContain('Não atribuído à pessoa');expect(detail).toContain('não atribuído à pessoa')});
 it('mostra decisão não comprovada e notas metodológicas',()=>{expect(list).toContain('Evidência decisória');expect(list).toContain('não comprovam atuação operacional, poder de compra ou decisão na fazenda');expect(list).toContain('não devem ser interpretados automaticamente como contato pessoal')});
 it('implementa filtros principais e adicionais',()=>{for(const text of ['Tipo de vínculo','Motivo Agro','Evidência de decisão','Tipo de contato','Com várias empresas','Com CAR comprovado','Com contato pessoal','Somente contato institucional','Com grupo econômico','CNAE'])expect(list).toContain(text)});
 it('implementa paginação, URL e cancelamento',()=>{for(const text of ['Anterior','Próxima','Pessoas por página','setSp','AbortController','signal:c.signal'])expect(list).toContain(text)});
 it('possui ficha individual e rota própria',()=>{expect(app).toContain('AgroPersonDetailApproved');expect(detail).toContain('Poder decisório operacional não comprovado');expect(detail).toContain('Holdings ou grupos relacionados');expect(detail).toContain('Propriedades relacionadas')});
 it('declara estados de loading, vazio, erro e retry',()=>{expect(list).toContain('loading={loading}');expect(list).toContain('Nenhuma pessoa encontrada com os filtros atuais.');expect(list).toContain('Não foi possível carregar pessoas e vínculos societários.');expect(list).toContain('onRetry={load}')});
 it('oferece cards mobile sem tabela obrigatória',()=>{expect(list).toContain('people-mobile');expect(list).toContain('Ver ficha')});
});
