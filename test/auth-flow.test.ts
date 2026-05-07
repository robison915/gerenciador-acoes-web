import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { getPostLoginRedirect, getSafeRedirect } from "../src/lib/auth-flow.ts";

describe("auth screen flow", () => {
  it("usa redirect interno informado apos login", () => {
    assert.equal(getSafeRedirect("/carteiras?tab=ativos"), "/carteiras?tab=ativos");
  });

  it("ignora redirect externo ou ausente", () => {
    assert.equal(getSafeRedirect("https://example.com"), "/");
    assert.equal(getSafeRedirect(null), "/");
  });

  it("direciona administradores para area administrativa", () => {
    assert.equal(getPostLoginRedirect("/", "ADMIN"), "/admin");
    assert.equal(getPostLoginRedirect("/acoes", "ADMIN"), "/admin");
  });

  it("impede cliente de usar redirect para area administrativa", () => {
    assert.equal(getPostLoginRedirect("/admin", "CLIENTE"), "/");
    assert.equal(getPostLoginRedirect("/carteiras", "CLIENTE"), "/carteiras");
  });
});
