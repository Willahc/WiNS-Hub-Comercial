# WiNS Hub — Gate final da Onda 1

## Parecer: REQUER AJUSTES

O staging isolado está publicado, a autenticação Keycloak E2E foi aprovada, os dez endpoints da Onda 1 estão protegidos e paginados, a reconciliação fecha com as fontes e o frontend de staging usa os adapters reais sem fallback silencioso. Produção, raiz pública, dados e índices não foram alterados.

O gate não pode receber parecer de prontidão porque duas metas obrigatórias de performance não foram atingidas:

1. fornecedores: p95 5,98s versus meta <2s;
2. Empresa 360°: p95 4,19s versus meta <3s.

As consultas e planos foram analisados, e as propostas de índice/reescrita, custo, impacto de escrita e rollback estão em `WINS_HUB_ONDA1_PERFORMANCE_FINAL.md`. Por determinação do gate, nenhuma proposta foi executada sem aprovação.

## Itens aprovados

- staging TLS isolado, sem porta Uvicorn pública e sem alteração no Nginx de produção;
- CORS restrito, payload máximo, rate limiting, timeouts, request ID e health sanitizado;
- login, logout, refresh, expiração, 401, 403, roles e acesso direto;
- token ausente do `localStorage`;
- contagens finais e filtros reconciliados;
- obras/mapa distinguem centroide municipal de localização exata/ausente;
- projetos marcados como projeção e view mestre vazia declarada;
- oportunidades sem valor comercial não homologado;
- Onda 2 não iniciada e nenhum cutover realizado.

## Pendências para novo gate

- aprovar ou rejeitar formalmente as propostas de índice/reescrita;
- aplicar somente a opção aprovada em staging e repetir p50/p95/p99, páginas profundas, filtros combinados e concorrência;
- confirmar p95 <2s em fornecedores e <3s em Empresa 360° antes de alterar o parecer.
