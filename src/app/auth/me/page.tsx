"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AuthShell } from "@/components/auth/AuthShell";
import { clearAuthToken, getAuthToken, getMe } from "@/lib/api";
import type { ApiError } from "@/lib/api";

export default function MePage() {
  const router = useRouter();
  const [response, setResponse] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function handleGetMe() {
    setIsLoading(true);
    setError(null);

    try {
      const token = getAuthToken();
      const data = await getMe(token);
      setResponse(data);
    } catch (err) {
      const apiError = err as ApiError;
      setError(apiError.message);
      setResponse(null);
    } finally {
      setIsLoading(false);
    }
  }

  function handleLogout() {
    clearAuthToken();
    setResponse(null);
    setError(null);
    router.push("/auth/login");
  }

  return (
    <AuthShell title="Meu perfil" subtitle="GET /auth/me (usa token salvo no login)">
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700 disabled:opacity-70"
          disabled={isLoading}
          onClick={handleGetMe}
        >
          {isLoading ? "Buscando..." : "Buscar /auth/me"}
        </button>
        <button
          type="button"
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700"
          onClick={handleLogout}
        >
          Limpar token
        </button>
      </div>

      {error ? <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}

      <div className="space-y-2">
        <p className="text-sm text-slate-600">
          Token salvo: <code>{getAuthToken() ? "sim" : "nao"}</code>
        </p>

        <pre className="overflow-x-auto rounded-lg bg-slate-900 p-4 text-xs text-slate-100">
          {JSON.stringify(response, null, 2) || "Sem resposta ainda"}
        </pre>
      </div>
    </AuthShell>
  );
}
