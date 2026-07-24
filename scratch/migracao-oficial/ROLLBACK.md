# Procedimento de Rollback de Emergência

Caso ocorra qualquer falha crítica na migração para a rota raiz oficial, execute a seguinte sequência exata de comandos para restaurar o estado original:

```bash
# 1. Restaurar configuração Nginx anterior
cp /root/wins_hub_unificado/scratch/migracao-oficial/NGINX_BEFORE.conf /root/wins_hub_unificado/staging/nginx-host.conf

# 2. Recarregar Nginx
nginx -s reload -c /root/wins_hub_unificado/staging/nginx-host.conf

# 3. Restaurar dist anterior no staging-root se necessário
rm -rf /root/wins_hub_unificado/dist
cp -r /root/wins_hub_unificado/scratch/migracao-oficial/dist_before /root/wins_hub_unificado/dist

# 4. Checkout da tag Git de pré-migração
cd /root/wins_hub_unificado
git checkout pre-migration-checkpoint-20260724

# 5. Recompilar build para /demo/
npm run build:gate
```

## Validação pós-rollback
- Executar: `curl -k -s https://winshubcomercial.com.br:18443/healthz`
- Confirmar retorno: `{"status":"ok"}`
