import {describe,it,expect} from 'vitest';import fs from 'node:fs';import path from 'node:path';
const src=fs.readFileSync(path.resolve(__dirname,'../services/auth.tsx'),'utf8');
describe('autenticação publicada',()=>{it('reconhece sessão protegida pelo nginx somente no bundle de produção',()=>{expect(src).toContain("import.meta.env.MODE === 'production'");expect(src).toContain("id: 'maintenance-session'");expect(src).toContain("'agro'")})});
