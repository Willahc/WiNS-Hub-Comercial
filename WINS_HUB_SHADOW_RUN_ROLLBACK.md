# WiNS Hub — Shadow Run — Plano de Rollback

> Documento validado antes do cutover. Rollback não executado — apenas validado.

---

## Premissas

- O shadow run não substitui o sistema legado
- O legado continua operando normalmente em produção
- Rollback = desativar o ambiente shadow + apontar usuários de volta ao legado (já estão)

---

## Passos de Rollback

### 1. Desativar Nginx de Staging

```bash
kill -TERM $(cat /root/wins_hub_unificado/staging/nginx.pid)
```

**Tempo estimado:** < 1s

### 2. Parar API Wave 1

```bash
kill -TERM [PID da API wave1]
```

**Tempo estimado:** < 2s

### 3. Remover Frontend de Staging

```bash
rm -rf /root/wins_hub_unificado/staging-root/demo/
```

**Tempo estimado:** < 1s

### 4. Preservar Logs

```bash
cp /root/wins_hub_unificado/staging/api.log /root/backups/shadow_run_logs_$(date +%Y%m%d_%H%M).log
cp /root/wins_hub_unificado/staging/access.log /root/backups/shadow_run_access_$(date +%Y%m%d_%H%M).log
```

**Tempo estimado:** < 5s

### 5. Retorno ao Portal Legado

Usuários acessam `https://winshubagro.cloud` normalmente — o legado nunca foi desativado.

**Tempo estimado:** 0 (já está no ar)

### 6. Reversão de Banco (se aplicável)

Nenhuma alteração de schema foi feita em produção.
As únicas alterações (índices e view) foram em staging.
Nenhum rollback de banco é necessário.

---

## Tempo Total Estimado de Rollback

| Etapa | Tempo |
|:------|:-----:|
| Parar Nginx | < 1s |
| Parar API | < 2s |
| Remover Frontend | < 1s |
| Preservar Logs | < 5s |
| **Total** | **< 10s** |

---

## Verificação Pós-Rollback

- [ ] Porta 18443 não responde mais
- [ ] Porta 18085 não responde mais
- [ ] Logs preservados
- [ ] Legado continua operando normalmente
- [ ] Nenhum dado foi perdido
- [ ] Nenhuma configuração de produção foi alterada

---

## Observações

- O DNS não foi alterado — `winshubagro.cloud` continua apontando para produção
- A raiz oficial não foi substituída
- Nenhum sistema legado foi desativado
- O rollback pode ser executado em segundos por qualquer pessoa com acesso ao servidor
