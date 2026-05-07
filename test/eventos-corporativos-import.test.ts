import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { utils, write } from "xlsx";

import {
  getEventoCorporativoKey,
  parseEventosCorporativosFile,
} from "../src/lib/eventos-corporativos-import.ts";

function createWorkbookFile(rows: Record<string, unknown>[], sheetName = "Eventos 2020+") {
  const workbook = utils.book_new();
  utils.book_append_sheet(workbook, utils.json_to_sheet(rows), sheetName);
  const buffer = write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;

  return new File([buffer], "eventos.xlsx", {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

describe("parseEventosCorporativosFile", () => {
  it("normaliza desdobramentos, grupamentos e alteracoes de ticker", async () => {
    const file = createWorkbookFile([
      {
        Ticker: "mglu3",
        Tipo: "split",
        "Data evento": "15/10/2020",
        "Fator quantidade sugerido": "4",
        "Fator preco sugerido": "0,25",
        Observacao: "Desdobro MGLU3",
      },
      {
        Ticker: "vvar3",
        "Ticker destino": "viia3",
        Tipo: "Alteracao de ticker",
        "Data evento": "2021-08-16",
        "Fator quantidade sugerido": 1,
        "Fator preco sugerido": 1,
      },
      {
        Ticker: "vivt3",
        Tipo: "Grupamento",
        "Data evento": "15/04/2025",
        "Fator quantidade sugerido": "0,025",
        "Fator preco sugerido": "40",
      },
      {
        Ticker: "ciel3",
        Tipo: "Cancelamento de ticker",
        "Data evento": "27/08/2024",
        "Fator quantidade sugerido": 1,
        "Fator preco sugerido": 1,
      },
    ]);

    const result = await parseEventosCorporativosFile(file);

    assert.equal(result.totalRows, 4);
    assert.equal(result.ignoredRows, 0);
    assert.deepEqual(
      result.items.map((item) => item.payload),
      [
        {
          ticker: "CIEL3",
          tipo: "CANCELAMENTO_TICKER",
          dataEvento: "2024-08-27T12:00:00.000Z",
          fatorQuantidade: 1,
          fatorPreco: 1,
        },
        {
          ticker: "MGLU3",
          tipo: "DESDOBRAMENTO",
          dataEvento: "2020-10-15T12:00:00.000Z",
          fatorQuantidade: 4,
          fatorPreco: 0.25,
          observacao: "Desdobro MGLU3",
        },
        {
          ticker: "VIVT3",
          tipo: "GRUPAMENTO",
          dataEvento: "2025-04-15T12:00:00.000Z",
          fatorQuantidade: 0.025,
          fatorPreco: 40,
        },
        {
          ticker: "VVAR3",
          tickerDestino: "VIIA3",
          tipo: "ALTERACAO_TICKER",
          dataEvento: "2021-08-16T12:00:00.000Z",
          fatorQuantidade: 1,
          fatorPreco: 1,
        },
      ],
    );
  });

  it("ignora tipos nao suportados e falha quando nao encontra eventos validos", async () => {
    const file = createWorkbookFile([
      {
        Ticker: "PETR4",
        Tipo: "Dividendo",
        "Data evento": "01/01/2024",
        "Fator quantidade sugerido": 1,
        "Fator preco sugerido": 1,
      },
    ]);

    await assert.rejects(
      () => parseEventosCorporativosFile(file),
      /Nenhum evento corporativo suportado/,
    );
  });
});

describe("getEventoCorporativoKey", () => {
  it("gera chave estavel para detectar duplicidade", () => {
    const key = getEventoCorporativoKey({
      ticker: " trpl4 ",
      tickerDestino: " isae4 ",
      tipo: "ALTERACAO_TICKER",
      dataEvento: "2024-11-18T12:00:00.000Z",
    });

    assert.equal(key, "TRPL4|ISAE4|ALTERACAO_TICKER|2024-11-18");
  });
});
