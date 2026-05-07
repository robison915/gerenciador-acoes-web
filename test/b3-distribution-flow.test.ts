import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { Carteira, CarteiraProjecao, ImportacaoB3 } from "../src/lib/api.ts";
import {
  buildB3ProjectionDiagnostics,
  createInitialB3Distribution,
  getUnresolvedB3ProjectionConflicts,
} from "../src/lib/b3-distribution-flow.ts";

const wallets: Carteira[] = [
  {
    id: "carteira-a",
    userId: "user-id",
    nome: "Longo prazo",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "carteira-b",
    userId: "user-id",
    nome: "Dividendos",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
];

function projection(carteiraId: string, tickers: string[]): CarteiraProjecao {
  return {
    id: `projecao-${carteiraId}`,
    userId: "user-id",
    carteiraId,
    saldoInformado: 0,
    valorCarteiraAtual: 0,
    saldoTotalProjetado: 0,
    valorProjetadoAlocado: 0,
    saldoResidualEstimado: 0,
    ativos: tickers.map((ticker) => ({
      ticker,
      percentual: 50,
      cotacaoAtual: 10,
      quantidadeAtual: 0,
      quantidadeProjetada: 1,
      valorProjetado: 10,
      novo: false,
    })),
    compras: [],
    vendas: [],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

const importacao: ImportacaoB3 = {
  id: "importacao-id",
  userId: "user-id",
  status: "REVISADA",
  nomeArquivo: "b3.xlsx",
  totalLinhas: 2,
  totalCompras: 2,
  totalVendas: 0,
  totalErros: 0,
  itens: [
    {
      linha: 2,
      tipoOperacao: "COMPRA",
      ticker: "PETR4",
      quantidade: 10,
      valorUnitario: 30,
      valorTotal: 300,
      dataOperacao: "2026-01-01T12:00:00.000Z",
      carteiraId: null,
      status: "VALIDO",
      avisos: [],
      erros: [],
    },
    {
      linha: 3,
      tipoOperacao: "COMPRA",
      ticker: "VALE3",
      quantidade: 1,
      valorUnitario: 55,
      valorTotal: 55,
      dataOperacao: "2026-01-01T12:00:00.000Z",
      carteiraId: "carteira-b",
      status: "VALIDO",
      avisos: [],
      erros: [],
    },
  ],
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

describe("b3 distribution screen flow", () => {
  it("detecta ticker presente em mais de uma projecao ativa", () => {
    const diagnostics = buildB3ProjectionDiagnostics(importacao, wallets, {
      "carteira-a": projection("carteira-a", ["PETR4"]),
      "carteira-b": projection("carteira-b", ["PETR4", "VALE3"]),
    });

    assert.equal(diagnostics.conflicts.length, 1);
    assert.deepEqual(diagnostics.conflicts[0], {
      linha: 2,
      ticker: "PETR4",
      candidateWalletIds: ["carteira-a", "carteira-b"],
      candidateWalletNames: ["Longo prazo", "Dividendos"],
      isConflict: true,
    });
  });

  it("exige escolha manual para conflito de projecoes", () => {
    const diagnostics = buildB3ProjectionDiagnostics(importacao, wallets, {
      "carteira-a": projection("carteira-a", ["PETR4"]),
      "carteira-b": projection("carteira-b", ["PETR4"]),
    });

    assert.deepEqual(
      getUnresolvedB3ProjectionConflicts(diagnostics, {
        3: "carteira-b",
      }).map((item) => item.linha),
      [2],
    );
    assert.deepEqual(
      getUnresolvedB3ProjectionConflicts(diagnostics, {
        2: "carteira-a",
        3: "carteira-b",
      }),
      [],
    );
  });

  it("inicia selecao manual a partir da revisao do backend", () => {
    assert.deepEqual(createInitialB3Distribution(importacao), {
      2: "",
      3: "carteira-b",
    });
  });
});
