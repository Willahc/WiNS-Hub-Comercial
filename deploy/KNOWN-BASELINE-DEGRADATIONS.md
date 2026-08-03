# Degradações conhecidas do baseline

Esta allowlist é temporária, explícita e limitada às três rotas abaixo. Ela não
aprova definitivamente as falhas, não autoriza criação de bases ou concessão de
permissões e só permite paridade comprovada com a produção.

| Rota | Causa | Primeira constatação | Comportamento esperado temporário | Critério para remoção |
|---|---|---|---|---|
| `/api/v1/diretorios/logistica/transportadores?page=1&page_size=25` | base lógica de Logística ausente ou não configurada | 2026-08-02, confirmada pela auditoria forense | mesmo HTTP 500, mesma causa e contrato de erro normalizados, sem traceback externo; ou melhoria para resposta funcional | base oficial disponível e rota aprovada como 2xx no baseline |
| `/api/v1/diretorios/saude/estabelecimentos?page=1&page_size=25` | base lógica de Saúde ausente ou não configurada | 2026-08-02, confirmada pela auditoria forense | mesmo HTTP 500, mesma causa e contrato de erro normalizados, sem traceback externo; ou melhoria para resposta funcional | base oficial disponível e rota aprovada como 2xx no baseline |
| `/api/v1/visao-geral/mapa` | dependência lógica preexistente de base/configuração ausente | 2026-08-02, confirmada pela auditoria forense | mesmo HTTP 500, mesma causa e contrato de erro normalizados, sem traceback externo; ou melhoria para resposta funcional | dependências oficiais disponíveis e rota aprovada como 2xx no baseline |

O relatório diferencial de cada execução registra status HTTP, tipo de exceção
normalizado quando externamente observável, mensagem sanitizada, base lógica
ausente, duração, presença de traceback externo e hash do contrato de erro
normalizado. Nenhum segredo deve ser registrado.
