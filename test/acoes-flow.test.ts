import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { metricTone, parseOperacoesLote, toOperacaoPayload } from "../src/lib/acoes-flow.ts";

describe("acoes screen flow", () => {
  it("normaliza formulario unitario para payload de operacao", () => {
    assert.deepEqual(
      toOperacaoPayload({
        ticker: " petr4 ",
        quantidade: "10",
        valorUnitario: "30.5",
        dataOperacao: "2026-01-02T10:00:00.000Z",
        carteiraId: "carteira-id",
      }),
      {
        ticker: "PETR4",
        quantidade: 10,
        valorUnitario: 30.5,
        dataOperacao: "2026-01-02T10:00:00.000Z",
        carteiraId: "carteira-id",
      },
    );
  });

  it("valida campos obrigatorios da operacao", () => {
    assert.throws(
      () =>
        toOperacaoPayload({
          ticker: "",
          quantidade: "10",
          valorUnitario: "30",
          dataOperacao: "",
          carteiraId: "",
        }),
      /Informe o ticker/,
    );
    assert.throws(
      () =>
        toOperacaoPayload({
          ticker: "PETR4",
          quantidade: "1.5",
          valorUnitario: "30",
          dataOperacao: "",
          carteiraId: "",
        }),
      /inteiro maior que zero/,
    );
    assert.throws(
      () =>
        toOperacaoPayload({
          ticker: "PETR4",
          quantidade: "1",
          valorUnitario: "0",
          dataOperacao: "",
          carteiraId: "",
        }),
      /valor unitario/,
    );
  });

  it("converte lote de texto para payloads ordenados por linha", () => {
    assert.deepEqual(parseOperacoesLote("petr4,10,30\nvale3,2,55.5"), [
      { ticker: "PETR4", quantidade: 10, valorUnitario: 30 },
      { ticker: "VALE3", quantidade: 2, valorUnitario: 55.5 },
    ]);
  });

  it("define tom visual de metricas", () => {
    assert.equal(metricTone(10), "text-emerald-700");
    assert.equal(metricTone(-1), "text-red-700");
    assert.equal(metricTone(0), "text-slate-900");
    assert.equal(metricTone(null), "text-slate-900");
  });
});
