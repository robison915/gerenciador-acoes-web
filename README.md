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
- `NEXT_PUBLIC_API_URL`: opcional; so usar quando chamadas diretas do navegador forem desejadas e CORS estiver configurado.

## Comandos

```bash
npm run dev
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
- `/carteiras`: gerenciamento operacional de carteiras com criacao, listagem, detalhe e exclusao usando os endpoints atuais do backend.
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
- Leitura de arquivo XLSX de negociacao da B3 na area de lote de acoes, convertendo compras e vendas para os endpoints existentes e considerando eventos corporativos cadastrados para validar saldo.
- Tela operacional de carteiras usando endpoints reais do backend.
- Tela administrativa para cadastrar eventos corporativos, incluindo alteracao de ticker, importar eventos por XLSX e criar novos administradores.
- Tela administrativa permite aplicar eventos corporativos cadastrados na base existente, incluindo alteracoes de ticker ja importadas.
- Importacao de negociacoes da B3 normaliza tickers conforme eventos de alteracao cadastrados, permitindo que compras no ticker antigo sejam conciliadas com vendas no ticker novo.
- Lint do frontend passando.
- Build do frontend passando.

Pendente tecnico:

- Adicionar testes automatizados de frontend.
- Revisar fallback de `API_URL` para evitar loop quando backend e frontend usarem a mesma porta.
- Adaptar telas para paginação de histórico de operações quando o backend expuser `limit`/`offset` ou cursor.
- Ajustar carregamento para consumir endpoint consolidado de resumo quando o backend centralizar posições/performance, reduzindo chamadas paralelas duplicadas.

Pendente funcional:

- Ajustar carteiras conforme o backend evoluir: adicionar/remover acoes, movimentar entre carteiras e performance.
- Adicionar visualizacao detalhada de resultado por venda, caso necessario para o usuario final.
- Adicionar testes automatizados para autenticacao e acoes.

Pendente de performance:

- Exibir histórico de operações paginado, com navegação de página e estado de carregamento por página.
- Separar carregamento inicial crítico de dados secundários, priorizando resumo/posições e carregando histórico/resultados depois quando necessário.

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
- `GET /admin/eventos-corporativos`
- `POST /admin/eventos-corporativos`
- `POST /admin/eventos-corporativos/processar`
- `POST /admin/usuarios/admins`
- `POST /carteiras`
- `GET /carteiras`
- `GET /carteiras/:carteiraId`
- `DELETE /carteiras/:carteiraId`

Previstos, mas dependentes do backend:

- CRUD completo de carteiras.
- Acoes avulsas.
- Movimentacao entre carteiras.
- Importacao B3.
- Administracao de eventos corporativos.

## Criterios de Done
Uma mudanca no frontend so deve ser considerada pronta quando:

- `npm run lint` passa.
- `npm run build` passa, exceto quando a tarefa for explicitamente registrar ou corrigir a quebra atual.
- Chamadas de API estao alinhadas ao README do backend.
- O README foi atualizado quando o estado funcional mudou.
- Fluxos criticos novos possuem teste ou pendencia registrada.
