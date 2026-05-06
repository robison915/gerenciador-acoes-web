import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";

import {
  adicionarAcaoAvulsaEmCarteira,
  createAdminUser,
  createCarteira,
  createEventoCorporativo,
  distribuirUltimaImportacaoB3,
  getAuthToken,
  getMe,
  listExecucoesEventoCorporativo,
  login,
  movimentarAcaoEntreCarteiras,
  processarEventoCorporativo,
  projetarAjusteCarteira,
  registrarCompra,
  registrarVendasLote,
  setAuthToken,
  updateEventoCorporativo,
  updateTickerCadastro,
} from "../src/lib/api.ts";

type FetchCall = {
  url: string;
  init: RequestInit;
};

const calls: FetchCall[] = [];
let nextResponse: unknown = {};

function buildStorage() {
  const values = new Map<string, string>();

  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
    removeItem: (key: string) => {
      values.delete(key);
    },
  };
}

beforeEach(() => {
  calls.length = 0;
  nextResponse = {};
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      localStorage: buildStorage(),
      location: {
        pathname: "/",
        search: "",
        assign: () => undefined,
      },
    },
  });
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: {
      cookie: "",
    },
  });
  Object.defineProperty(globalThis, "fetch", {
    configurable: true,
    value: async (input: string | URL | Request, init?: RequestInit) => {
      calls.push({ url: String(input), init: init ?? {} });

      return new Response(JSON.stringify(nextResponse), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    },
  });
});

afterEach(() => {
  Reflect.deleteProperty(globalThis, "window");
  Reflect.deleteProperty(globalThis, "document");
  Reflect.deleteProperty(globalThis, "fetch");
});

function lastCall() {
  const call = calls.at(-1);
  assert.ok(call, "expected fetch call");
  return call;
}

function parsedBody(call: FetchCall) {
  assert.equal(typeof call.init.body, "string");
  return JSON.parse(call.init.body as string) as Record<string, unknown>;
}

describe("api client", () => {
  it("salva token recebido no login para chamadas autenticadas", async () => {
    nextResponse = { accessToken: "token-admin" };

    await login({ email: "admin@teste.com", password: "123456" });

    assert.equal(getAuthToken(), "token-admin");
    assert.equal(lastCall().url, "/api/auth/login");
    assert.equal(lastCall().init.method, "POST");
  });

  it("envia Authorization em chamadas autenticadas", async () => {
    nextResponse = { userId: "user-id", email: "admin@teste.com", role: "ADMIN" };
    setAuthToken("token-admin");

    await getMe();

    const call = lastCall();
    assert.equal(call.url, "/api/auth/me");
    assert.equal((call.init.headers as Record<string, string>).Authorization, "Bearer token-admin");
  });

  it("centraliza chamadas operacionais de acoes", async () => {
    nextResponse = { id: "compra-id" };
    setAuthToken("token-user");

    await registrarCompra({
      ticker: "PETR4",
      quantidade: 10,
      valorUnitario: 30,
      carteiraId: "carteira-id",
    });
    await registrarVendasLote([
      {
        ticker: "PETR4",
        quantidade: 2,
        valorUnitario: 32,
      },
    ]);

    assert.equal(calls[0].url, "/api/acoes/compras");
    assert.equal(calls[0].init.method, "POST");
    assert.deepEqual(parsedBody(calls[0]), {
      ticker: "PETR4",
      quantidade: 10,
      valorUnitario: 30,
      carteiraId: "carteira-id",
    });
    assert.equal(calls[1].url, "/api/acoes/vendas/lote");
    assert.deepEqual(parsedBody(calls[1]), {
      vendas: [{ ticker: "PETR4", quantidade: 2, valorUnitario: 32 }],
    });
  });

  it("centraliza chamadas de carteiras", async () => {
    nextResponse = { id: "carteira-id" };
    setAuthToken("token-user");

    await createCarteira({ nome: "Longo prazo" });
    await adicionarAcaoAvulsaEmCarteira("carteira-id", {
      ticker: "VALE3",
      quantidade: 3,
    });
    await movimentarAcaoEntreCarteiras({
      carteiraOrigemId: "origem-id",
      carteiraDestinoId: "destino-id",
      ticker: "VALE3",
      quantidade: 1,
    });
    await projetarAjusteCarteira("carteira-id", {
      saldoInformado: 1000,
      ativos: [{ ticker: "PETR4" }],
    });

    assert.equal(calls[0].url, "/api/carteiras");
    assert.equal(calls[1].url, "/api/carteiras/carteira-id/acoes");
    assert.equal(calls[2].url, "/api/carteiras/movimentacoes");
    assert.equal(calls[3].url, "/api/carteiras/carteira-id/projecoes");
  });

  it("centraliza chamadas administrativas novas", async () => {
    nextResponse = { id: "evento-id" };
    setAuthToken("token-admin");

    const payload = {
      ticker: "TRPL4",
      tickerDestino: "ISAE4",
      tipo: "ALTERACAO_TICKER" as const,
      dataEvento: "2024-11-18T00:00:00.000Z",
      fatorQuantidade: 1,
      fatorPreco: 1,
    };
    await createEventoCorporativo(payload);
    await updateEventoCorporativo("evento-id", payload);
    await processarEventoCorporativo("evento-id");
    await listExecucoesEventoCorporativo("evento-id");
    await updateTickerCadastro("ISAE4", { nomeEmpresa: "ISA Energia Brasil S.A." });
    await createAdminUser({ email: "novo-admin@teste.com", password: "123456" });

    assert.equal(calls[0].url, "/api/admin/eventos-corporativos");
    assert.equal(calls[1].url, "/api/admin/eventos-corporativos/evento-id");
    assert.equal(calls[1].init.method, "PATCH");
    assert.equal(calls[2].url, "/api/admin/eventos-corporativos/evento-id/processar");
    assert.equal(calls[3].url, "/api/admin/eventos-corporativos/evento-id/execucoes");
    assert.equal(calls[4].url, "/api/admin/acoes/tickers/ISAE4");
    assert.deepEqual(parsedBody(calls[4]), { nomeEmpresa: "ISA Energia Brasil S.A." });
    assert.equal(calls[5].url, "/api/admin/usuarios/admins");
  });

  it("centraliza distribuicao da ultima importacao B3", async () => {
    nextResponse = { id: "importacao-id" };
    setAuthToken("token-user");

    await distribuirUltimaImportacaoB3({
      aplicarProjecoes: true,
      itens: [{ linha: 2, carteiraId: "carteira-id" }],
    });

    assert.equal(lastCall().url, "/api/acoes/importacoes/b3/ultima/distribuicao");
    assert.deepEqual(parsedBody(lastCall()), {
      aplicarProjecoes: true,
      itens: [{ linha: 2, carteiraId: "carteira-id" }],
    });
  });
});
