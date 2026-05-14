import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  candidatoToEventForm,
  eventTypeLabel,
  importStatusClass,
  importStatusLabel,
  toDateInputValue,
  toEventForm,
  toEventPayload,
} from "../src/lib/admin-flow.ts";

describe("admin screen flow", () => {
  it("normaliza formulario de evento para payload de criacao/edicao", () => {
    assert.deepEqual(
      toEventPayload({
        ticker: " trpl4 ",
        tickerDestino: " isae4 ",
        tipo: "ALTERACAO_TICKER",
        dataEvento: "2024-11-18",
        fatorQuantidade: "1",
        fatorPreco: "1",
        observacao: " Alteracao de ticker ",
      }),
      {
        ticker: "TRPL4",
        tickerDestino: "ISAE4",
        tipo: "ALTERACAO_TICKER",
        dataEvento: "2024-11-18T00:00:00.000Z",
        fatorQuantidade: 1,
        fatorPreco: 1,
        observacao: "Alteracao de ticker",
      },
    );
  });

  it("valida regras de formulario de evento", () => {
    const base = {
      ticker: "TRPL4",
      tickerDestino: "",
      tipo: "ALTERACAO_TICKER" as const,
      dataEvento: "2024-11-18",
      fatorQuantidade: "1",
      fatorPreco: "1",
      observacao: "",
    };

    assert.throws(() => toEventPayload({ ...base, ticker: "" }), /Informe o ticker/);
    assert.throws(() => toEventPayload(base), /ticker destino/);
    assert.throws(() => toEventPayload({ ...base, tickerDestino: "TRPL4" }), /diferente/);
    assert.throws(() => toEventPayload({ ...base, tickerDestino: "ISAE4", fatorPreco: "0" }), /Fator de preco/);
  });

  it("monta formulario a partir de evento existente", () => {
    assert.deepEqual(
      toEventForm({
        id: "evento-id",
        ticker: "MGLU3",
        tickerDestino: null,
        tipo: "DESDOBRAMENTO",
        dataEvento: "2020-10-15T00:00:00.000Z",
        fatorQuantidade: 4,
        fatorPreco: 0.25,
        observacao: null,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      }),
      {
        ticker: "MGLU3",
        tickerDestino: "",
        tipo: "DESDOBRAMENTO",
        dataEvento: "2020-10-15",
        fatorQuantidade: "4",
        fatorPreco: "0.25",
        observacao: "",
      },
    );
  });

  it("monta formulario para revisao de candidato coletado", () => {
    assert.deepEqual(
      candidatoToEventForm({
        id: "candidato-id",
        ticker: "MGLU3",
        tickerDestino: null,
        tipo: "DESDOBRAMENTO",
        dataEvento: "2020-10-15T00:00:00.000Z",
        fatorQuantidade: 4,
        fatorPreco: 0.25,
        fonte: "CVM_FATOS_RELEVANTES",
        urlFonte: "https://cvm.example/fato-relevante",
        titulo: "MGLU3 aprova desdobramento de acoes",
        trecho: "Companhia comunica desdobramento de MGLU3.",
        confianca: "MEDIA",
        status: "PENDENTE",
        createdAt: "2026-05-11T12:00:00.000Z",
        updatedAt: "2026-05-11T12:00:00.000Z",
      }),
      {
        ticker: "MGLU3",
        tickerDestino: "",
        tipo: "DESDOBRAMENTO",
        dataEvento: "2020-10-15",
        fatorQuantidade: "4",
        fatorPreco: "0.25",
        observacao: "MGLU3 aprova desdobramento de acoes",
      },
    );
  });

  it("formata labels e classes usadas na tela", () => {
    assert.equal(toDateInputValue("invalid"), "");
    assert.equal(eventTypeLabel("GRUPAMENTO"), "Grupamento");
    assert.equal(importStatusLabel("duplicado"), "Duplicado");
    assert.equal(importStatusClass("erro"), "bg-red-50 text-red-700");
  });
});
