# Relatório de Implementação: Autorização por Allowlist, Escrita Real & Auditoria Keycloak

> [!NOTE]
> **Resumo Executivo**
> Todos os requisitos de autorização por allowlist, escrita real no PostgreSQL de produção e auditoria de identidade Keycloak foram implementados no backend e validados com 100% de aprovação (20/20 testes E2E aprovados).

---

## 1. Autorização por Allowlist (Backend)

Substituição da lógica insegura baseada em subtração de papéis pela validação estrita baseada em allowlist explícita.

### Alteração no Backend (`apps/api/routes.py`)

- **Papéis Autorizados**: `admin`, `relationship_reviewer`.
- **Comportamento**:
  - Usuários com `admin` ou `relationship_reviewer` em suas roles Keycloak: **HTTP 200 OK** (Reclassificação permitida).
  - Usuários com `viewer`, papéis padrão (`default-roles-wins-hub-staging`, `uma_authorization`, `offline_access`) ou apenas papéis de leitura de verticais: **HTTP 403 Forbidden** com a mensagem `"Apenas usuários autorizados (admin, relationship_reviewer) podem reclassificar relações"`.

```python
# [routes.py] Validação por Allowlist Explícita
user_roles = set(user.get("roles", [])) if isinstance(user, dict) else set()
user_perms = set(user.get("permissions", [])) if isinstance(user, dict) else set()
user_all_roles = user_roles | user_perms

REVIEW_ALLOWED_ROLES = {"admin", "relationship_reviewer"}
if not bool(user_all_roles.intersection(REVIEW_ALLOWED_ROLES)):
    logger.warning(f"[{req_id}] Usuário sem papel de revisão (Allowlist) tentou reclassificar relação: {user.get('sub')}")
    raise HTTPException(status_code=403, detail="Apenas usuários autorizados (admin, relationship_reviewer) podem reclassificar relações")
```

---

## 2. Escrita Real no Banco de Dados & Auditoria Keycloak

- **Tabelas de Produção**:
  - `public.relationship_reviews`: Armazena a versão vigente da reclassificação da relação.
  - `public.review_audit_log`: Registra a trilha imutável de auditoria.
- **Identidade do Auditor**: Extraída exclusivamente dos claims criptográficos do token JWT assinado pelo Keycloak (`sub`, `preferred_username`, `roles`).

### Estrutura de Auditoria Registrada

| Campo no Banco | Origem / Valor Registrado |
| :--- | :--- |
| `relationship_id` | ID único da relação (ex: `controlled_rel_e2e_001`) |
| `classificacao_anterior` | Classificação antes da reclassificação (ex: `POTENCIAL`) |
| `classificacao_nova` | Nova classificação submetida (ex: `CONFIRMADO`) |
| `justificativa` | Motivo fornecido na revisão |
| `user_id` | Keycloak `sub` UUID (`5844b97a-df91-453a-95ca-e8f7f966b4e0`) |
| `username` | Keycloak `preferred_username` (`test_automation`) |
| `roles` | Lista dos papéis atribuídos no momento da escrita |
| `created_at` | Timestamp com timezone UTC |

---

## 3. Evidência da Reclassificação Controlada e Rollback

Foi executado o fluxo completo de teste automatizado de reclassificação e rollback sobre a relação `controlled_rel_e2e_001`:

1. **Estado Inicial**: `POTENCIAL`
2. **Reclassificação via API (POST `/review`)**:
   - Papel: `relationship_reviewer` / `admin`
   - Nova Classificação: `CONFIRMADO`
   - Justificativa: `"Reclassificação de teste E2E automatizado com auditoria Keycloak"`
   - Retorno API: `HTTP 200 OK`
   - **Verificação PostgreSQL**: Linha inserida em `public.relationship_reviews` com status `CONFIRMADO`.
   - **Verificação Audit Log**: Linha inserida em `public.review_audit_log` com identidade Keycloak do usuário.
3. **Rollback via API (POST `/review`)**:
   - Reversão para: `POTENCIAL`
   - Justificativa: `"Rollback de teste E2E automatizado para restaurar estado original POTENCIAL"`
   - Retorno API: `HTTP 200 OK`
   - **Verificação Audit Log**: Segunda linha inserida em `public.review_audit_log` registrando a transição `CONFIRMADO` → `POTENCIAL`.

---

## 4. Resultado da Suíte E2E Automatizada (Playwright + API)

O script [scratch/test_relacionamentos_e2e_final.py](file:///root/wins_hub_unificado/scratch/test_relacionamentos_e2e_final.py) foi executado em Chromium Headless (`--no-sandbox`) e validou 20 itens com 100% de sucesso:

```text
==================================================
 RESULTADO: 20 APROVADOS / 0 REPROVADOS
==================================================

=== 1. AUTENTICAÇÃO KEYCLOAK E VERIFICAÇÃO DE TOKENS OIDC ===
  ✓ Token Keycloak OIDC emitido para usuário VIEWER
  ✓ Token Keycloak OIDC emitido para usuário AUTORIZADO

=== 2. AUTORIZAÇÃO POR ALLOWLIST NO BACKEND (HTTP 403 vs HTTP 200) ===
  ✓ POST review por VIEWER bloqueado com HTTP 403 (Allowlist ativa)
  ✓ GET /relacionamentos sem token retorna HTTP 401 Unauthorized
  ✓ POST review por usuário AUTORIZADO retornou HTTP 200 OK: id=2

=== 3. ESCRITA REAL NO BANCO & AUDITORIA DE RECLASSIFICAÇÃO + ROLLBACK ===
  ✓ Persistência em public.relationship_reviews confirmada no Postgres: 'CONFIRMADO'
  ✓ Registro de auditoria com identidade Keycloak (user=test_automation, sub=5844b97a-df91-453a-95ca-e8f7f966b4e0) verificado em public.review_audit_log
  ✓ Rollback executado com sucesso via API para 'POTENCIAL'
  ✓ Auditoria do Rollback registrada com sucesso em public.review_audit_log: 'CONFIRMADO' → 'POTENCIAL'

=== 4. NAVEGAÇÃO E INTERAÇÃO FRONTEND E2E (PLAYWRIGHT) ===
  ✓ Login via Keycloak UI + PKCE efetuado com sucesso
  ✓ Página de relacionamentos /demo/relacionamentos carregada
  ✓ Autocomplete exibido com sugestões da API
  ✓ Grafo e KPIs carregados (58 conexões)
  ✓ Drawer de evidência aberto ao clicar na linha
  ✓ Drawer fechado com sucesso
  ✓ Filtro por classificação aplicado
  ✓ Tabela de conexões exibida corretamente
  ✓ Botão de exportação visível
  ✓ Página recarregada (F5) sem erros
  ✓ Zero erros HTTP 5xx durante a execução
```
