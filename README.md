# Gerenciador de Acoes Web

## Visao Geral
Frontend em Next.js para consumir a API NestJS do Gerenciador de Acoes.

O objetivo do frontend e permitir que o usuario cadastre e acompanhe carteiras, compras, vendas, posicoes, performance e fluxos de autenticacao. As telas devem ser tratadas como produto utilizavel, organizadas por dominio, e nao como testadores de endpoints.

## Relacao com o Backend
O backend em `../gerenciador-acoes` e a fonte de verdade para regras de dominio e contrato de API.

Antes de criar ou alterar uma chamada em `src/lib/api.ts`, validar:

- se o endpoint existe no backend;
- se o endpoint esta previsto no README do backend;
- se o nome da rota, payload e resposta seguem o contrato atual;
- se a tela exposta ao usuario nao promete funcionalidade inexistente.

## Configuracao
Arquivo local esperado:

```bash
.env
```

Variaveis:

```bash
API_URL=http://localhost:3000
# NEXT_PUBLIC_API_URL=http://localhost:3000
```

Uso recomendado:

- `API_URL`: usada pelo proxy interno do Next em `/api/*`.
- `API_URL` deve apontar para o backend NestJS e nao pode ser a mesma origem do frontend; quando isso acontecer, o proxy retorna erro de configuracao para evitar loop.
- `NEXT_PUBLIC_API_URL`: opcional; so usar quando chamadas diretas do navegador forem desejadas e CORS estiver configurado.

## Comandos

```bash
npm run dev
npm run test
npm run lint
npm run build
```

Na raiz do workspace tambem existe:

```bash
npm run frontend:lint
npm run frontend:build
npm run check
```

## Dominios e Rotas Atuais
- `/`: visao geral autenticada com resumo de posicoes e performance.
- `/auth/login`: entrada na conta e redirecionamento para a area principal.
- `/auth/register`: cadastro de usuario.
- `/auth/password/forgot`: solicitacao de recuperacao de senha.
- `/auth/password/reset`: redefinicao de senha com token manual ou por query string.
- `/auth/me`: dados da conta e logout.
- `/acoes`: gerenciamento operacional de acoes com compras, vendas, lote, posicoes, performance, historico, resultado de vendas, tickers e acoes avulsas.
- `/carteiras`: gerenciamento operacional de carteiras com criacao, listagem, detalhe, exclusao, vinculacao de acoes avulsas, remocao para avulsas, movimentacao entre carteiras e performance por carteira usando os endpoints atuais do backend.
- `/carteiras/ajuste`: projecao de rebalanceamento de carteira com lista alvo de acoes, saldo livre, percentuais opcionais, compras/vendas projetadas e exclusao de projecoes.
- `/admin/login`: entrada administrativa.
- `/admin`: administracao de eventos corporativos, importacao de eventos por XLSX e criacao de administradores.

## Estado Atual
Implementado:

- Fluxos de autenticacao com linguagem de produto.
- Proxy interno para a API.
- Token salvo em `localStorage` e cookie simples.
- Shell visual para areas autenticadas.
- Visao geral autenticada.
- Painel operacional de acoes usando endpoints reais do backend.
- Importacao de arquivo XLSX de negociacao da B3 pela area de acoes usando o fluxo backend de revisao, distribuicao entre carteiras e persistencia.
- Tela operacional de carteiras usando endpoints reais do backend para criacao, listagem, detalhe, exclusao, vinculacao de acoes avulsas, remocao para avulsas, movimentacao entre carteiras e performance por carteira.
- Tela de ajuste de carteira para salvar projecoes de rebalanceamento, usando pesos iguais por padrao quando percentuais nao forem informados e exibindo vendas somente para ativos removidos da composicao alvo.
- Tela administrativa para cadastrar e editar eventos corporativos, incluindo alteracao de ticker, importar eventos por XLSX, criar novos administradores e complementar cadastro de tickers.
- Tela administrativa permite aplicar eventos corporativos cadastrados na base existente, processar evento individual e consultar auditoria de execucoes.
- Importacao de negociacoes da B3 usa o backend para normalizar tickers conforme eventos de alteracao cadastrados, revisar itens importados e vincular automaticamente operacoes por projecoes salvas quando nao houver conflito.
- Historico de operacoes na tela de acoes consumindo paginacao `limit`/`offset` do backend, com navegacao de pagina e carregamento proprio.
- Carregamento inicial da tela de acoes prioriza resumo/posicoes e carrega historico/resultados/tickers/importacao como dados secundarios.
- Testes automatizados do frontend cobrindo cliente de API, chamadas de autenticacao, acoes, carteiras, administracao, parser de eventos corporativos e regras de fluxo das telas de autenticacao, acoes, carteiras e administracao.
- Lint do frontend passando.
- Build do frontend passando com `next build`.

Pendente tecnico:

- Adotar testes de renderizacao/interacao de componentes quando houver runner DOM/browser dedicado no frontend.
- Ajustar carregamento para consumir endpoint consolidado de resumo quando o backend centralizar posições/performance, reduzindo chamadas paralelas duplicadas.

Pendente funcional:

- Ajustar carteiras conforme o backend evoluir.
- Adicionar visualizacao detalhada de resultado por venda, caso necessario para o usuario final.

Pendente de performance:

- Reduzir chamadas duplicadas quando o backend expuser endpoint consolidado de resumo operacional.

## Endpoints que o Frontend Deve Priorizar
Disponiveis no backend atual:

- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/password/forgot`
- `POST /auth/password/reset`
- `GET /auth/me`
- `POST /acoes/compras`
- `POST /acoes/compras/lote`
- `POST /acoes/vendas`
- `POST /acoes/vendas/lote`
- `GET /acoes`
- `GET /acoes/:ticker`
- `GET /acoes/operacoes`
- `GET /acoes/vendas/resultado`
- `GET /acoes/performance`
- `GET /acoes/avulsas`
- `GET /acoes/tickers`
- `POST /acoes/importacoes/b3`
- `GET /acoes/importacoes/b3/ultima`
- `POST /acoes/importacoes/b3/ultima/distribuicao`
- `GET /admin/eventos-corporativos`
- `POST /admin/eventos-corporativos`
- `POST /admin/eventos-corporativos/processar`
- `PATCH /admin/eventos-corporativos/:eventoId`
- `POST /admin/eventos-corporativos/:eventoId/processar`
- `GET /admin/eventos-corporativos/:eventoId/execucoes`
- `PATCH /admin/acoes/tickers/:ticker`
- `POST /admin/usuarios/admins`
- `POST /carteiras`
- `GET /carteiras`
- `GET /carteiras/:carteiraId`
- `GET /carteiras/:carteiraId/performance`
- `DELETE /carteiras/:carteiraId`
- `POST /carteiras/:carteiraId/acoes`
- `DELETE /carteiras/:carteiraId/acoes/:posicaoId`
- `POST /carteiras/movimentacoes`
- `POST /carteiras/:carteiraId/projecoes`
- `GET /carteiras/:carteiraId/projecoes`
- `DELETE /carteiras/:carteiraId/projecoes/:projecaoId`

Previstos, mas dependentes do backend:

- Aprimorar UX da distribuicao automatica da importacao B3 quando houver o mesmo ticker em projecoes ativas de mais de uma carteira.

## Criterios de Done
Uma mudanca no frontend so deve ser considerada pronta quando:

- `npm run lint` passa.
- `npm run test` passa.
- `npm run build` passa, exceto quando a tarefa for explicitamente registrar ou corrigir a quebra atual.
- Chamadas de API estao alinhadas ao README do backend.
- O README foi atualizado quando o estado funcional mudou.
- Fluxos criticos novos possuem teste ou pendencia registrada.
