import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { Carteira, CarteiraProjecao } from "../src/lib/api.ts";
import { buildAjusteCarteirasPlano } from "../src/lib/carteira-ajuste-flow.ts";

const wallets: Carteira[] = [
  {
    id: "acoes",
    userId: "user-1",
    nome: "NF Ações",
    createdAt: "2026-05-07T00:00:00.000Z",
    updatedAt: "2026-05-07T00:00:00.000Z",
  },
  {
    id: "dividendos",
    userId: "user-1",
    nome: "NF Dividendos",
    createdAt: "2026-05-07T00:00:00.000Z",
    updatedAt: "2026-05-07T00:00:00.000Z",
  },
];

function projection(
  carteiraId: string,
  compras: CarteiraProjecao["compras"],
  vendas: CarteiraProjecao["vendas"],
): CarteiraProjecao {
  return {
    id: `projecao-${carteiraId}`,
    userId: "user-1",
    carteiraId,
    saldoInformado: 0,
    valorCarteiraAtual: 0,
    saldoTotalProjetado: 0,
    valorProjetadoAlocado: 0,
    saldoResidualEstimado: 0,
    ativos: [],
    compras,
    vendas,
    createdAt: "2026-05-07T00:00:00.000Z",
    updatedAt: "2026-05-07T00:00:00.000Z",
  };
}

describe("buildAjusteCarteirasPlano", () => {
  it("converte compra e venda do mesmo ticker em movimentacao entre carteiras", () => {
    const plan = buildAjusteCarteirasPlano(
      [
        projection("acoes", [], [{ ticker: "VULC3", quantidade: 75, valorUnitario: 16, valorTotal: 1200 }]),
        projection("dividendos", [{ ticker: "VULC3", quantidade: 85, valorUnitario: 16, valorTotal: 1360 }], []),
      ],
      wallets,
    );

    assert.equal(plan.movimentacoes.length, 1);
    assert.deepEqual(plan.movimentacoes[0], {
      ticker: "VULC3",
      quantidade: 75,
      valorUnitario: 16,
      valorTotal: 1200,
      carteiraOrigemId: "acoes",
      carteiraOrigemNome: "NF Ações",
      carteiraDestinoId: "dividendos",
      carteiraDestinoNome: "NF Dividendos",
    });
    assert.equal(plan.compras.length, 1);
    assert.equal(plan.compras[0].ticker, "VULC3");
    assert.equal(plan.compras[0].quantidade, 10);
    assert.equal(plan.vendas.length, 0);
  });

  it("mantem somente a diferenca como venda quando a venda excede a compra", () => {
    const plan = buildAjusteCarteirasPlano(
      [
        projection("acoes", [], [{ ticker: "ITUB4", quantidade: 45, valorUnitario: 40, valorTotal: 1800 }]),
        projection("dividendos", [{ ticker: "ITUB4", quantidade: 34, valorUnitario: 40, valorTotal: 1360 }], []),
      ],
      wallets,
    );

    assert.equal(plan.movimentacoes.length, 1);
    assert.equal(plan.movimentacoes[0].quantidade, 34);
    assert.equal(plan.compras.length, 0);
    assert.equal(plan.vendas.length, 1);
    assert.equal(plan.vendas[0].ticker, "ITUB4");
    assert.equal(plan.vendas[0].quantidade, 11);
  });
});
