import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { getNavigationItemsForRole } from "../src/lib/navigation.ts";

describe("navigation permissions", () => {
  it("nao mostra administracao para cliente", () => {
    const labels = getNavigationItemsForRole("CLIENTE").map((item) => item.label);

    assert.deepEqual(labels, ["Visao geral", "Acoes", "Carteiras", "Ajuste", "Conta"]);
  });

  it("nao mostra acoes nem carteiras para administrador", () => {
    const labels = getNavigationItemsForRole("ADMIN").map((item) => item.label);

    assert.deepEqual(labels, ["Administracao", "Conta"]);
  });
});
