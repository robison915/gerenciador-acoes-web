# AGENTS.md

## Objetivo
Padronizar como agentes devem implementar e revisar o frontend do Gerenciador de Acoes.

## Fonte de verdade
- Ler este arquivo e `README.md` antes de alterar telas, rotas, cliente de API ou componentes compartilhados.
- Para qualquer integracao, ler tambem `../gerenciador-acoes/README.md`.
- O backend e o contrato principal. O frontend deve refletir endpoints implementados ou explicitamente previstos no README do backend.

## Regras tecnicas
- Manter o frontend em Next.js App Router.
- Centralizar chamadas HTTP em `src/lib/api.ts`.
- Usar o proxy interno em `src/app/api/[...path]/route.ts` por padrao.
- Evitar chamada direta do navegador para o backend, exceto quando `NEXT_PUBLIC_API_URL` for uma decisao explicita.
- Nao duplicar contratos manualmente em telas quando um helper em `src/lib/api.ts` for suficiente.
- Validar `npm run lint` e `npm run build` antes de concluir mudancas no frontend.

## Regras de produto
- A primeira tela deve ser uma experiencia util do sistema, nao uma landing page.
- O frontend deve ser uma aplicacao utilizavel organizada por dominios, nao uma interface para testar endpoints.
- Telas de teste de endpoint so podem existir como apoio transitorio e nao devem ser a experiencia final.
- Usar a nomenclatura de dominio do backend: carteiras, operacoes, compras, vendas, acoes avulsas, performance, eventos corporativos.
- Nao exibir controles para endpoint inexistente no backend sem marcar claramente a pendencia no README.
- Manter layout profissional de aplicacao financeira, com navegacao por dominios, formularios claros, tabelas legiveis, estados vazios e feedbacks de erro/sucesso.

## Prioridade atual
1. Manter autenticacao e gerenciamento de acoes como fluxos de produto.
2. Evoluir o dominio de carteiras para UI operacional conforme o backend liberar os fluxos pendentes.
3. Remover chamadas antigas/inexistentes de dominios ainda em transicao.
4. Adicionar testes automatizados para autenticacao, acoes e carteiras.
5. Refinar layout e acessibilidade sem voltar a uma aparencia de playground tecnico.
