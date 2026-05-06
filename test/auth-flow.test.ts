import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { getSafeRedirect } from "../src/lib/auth-flow.ts";

describe("auth screen flow", () => {
  it("usa redirect interno informado apos login", () => {
    assert.equal(getSafeRedirect("/carteiras?tab=ativos"), "/carteiras?tab=ativos");
  });

  it("ignora redirect externo ou ausente", () => {
    assert.equal(getSafeRedirect("https://example.com"), "/");
    assert.equal(getSafeRedirect(null), "/");
  });
});
