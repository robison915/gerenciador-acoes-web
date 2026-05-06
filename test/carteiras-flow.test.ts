import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  findQuantidadeByTicker,
  getValidTicker,
  resultTone,
  toMovementPayload,
} from "../src/lib/carteiras-flow.ts";

describe("carteiras screen flow", () => {
  it("seleciona ticker valido a partir das posicoes disponiveis", () => {
    const items = [{ ticker: "PETR4" }, { ticker: "VALE3" }];

    assert.equal(getValidTicker(items, "VALE3"), "VALE3");
    assert.equal(getValidTicker(items, "MGLU3"), "PETR4");
    assert.equal(getValidTicker([], "PETR4"), "");
  });

  it("encontra quantidade disponivel por ticker", () => {
    assert.equal(
      findQuantidadeByTicker(
        [
          { ticker: "PETR4", quantidade: 10 },
          { ticker: "VALE3", quantidade: 2 },
        ],
        "VALE3",
      ),
      2,
    );
    assert.equal(findQuantidadeByTicker(undefined, "VALE3"), 0);
  });

  it("normaliza payload de movimentacao", () => {
    assert.deepEqual(
      toMovementPayload({
        ticker: " vale3 ",
        quantidade: "3",
        dataOperacao: "2026-01-02T10:00:00.000Z",
      }),
      {
        ticker: "VALE3",
        quantidade: 3,
        dataOperacao: "2026-01-02T10:00:00.000Z",
      },
    );
  });

  it("valida payload de movimentacao", () => {
    assert.throws(
      () => toMovementPayload({ ticker: "", quantidade: "3", dataOperacao: "" }),
      /Informe o ticker/,
    );
    assert.throws(
      () => toMovementPayload({ ticker: "VALE3", quantidade: "0", dataOperacao: "" }),
      /inteiro maior que zero/,
    );
  });

  it("define tom visual de resultado da carteira", () => {
    assert.equal(resultTone(1), "text-emerald-700");
    assert.equal(resultTone(-1), "text-red-700");
    assert.equal(resultTone(undefined), "text-slate-900");
  });
});
