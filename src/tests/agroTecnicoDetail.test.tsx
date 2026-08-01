import {describe,it,expect} from 'vitest';import fs from 'node:fs';import path from 'node:path';
const src=fs.readFileSync(path.resolve(__dirname,'../pages/AgroTecnicoDetailApproved.tsx'),'utf8');
describe('Ficha do Canal Técnico',()=>{it('mostra cadastro, origem, contatos, limitações e geografia indisponível',()=>{for(const value of ['Cadastro','Origem e contatos','Conselho informado','situação oficial não validada','Geografia indisponível','Fazendas próximas: Não disponível','Limitações'])expect(src).toContain(value)})});
