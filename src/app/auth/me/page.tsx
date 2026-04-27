"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { clearAuthToken, getMe } from "@/lib/api";
import type { ApiError } from "@/lib/api";

export default function MePage() {
  const router = useRouter();
  const [email, setEmail] = useState<string>("");
  const [userId, setUserId] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function loadUser() {
      setIsLoading(true);
      setError(null);

      try {
        const data = await getMe();
        if (!active) {
          return;
        }
        setEmail(typeof data.email === "string" ? data.email : "");
        setUserId(typeof data.userId === "string" ? data.userId : "");
      } catch (err) {
        const apiError = err as ApiError;
        if (active) {
          setError(apiError.message);
        }
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    }

    void loadUser();

    return () => {
      active = false;
    };
  }, []);

  function handleLogout() {
    clearAuthToken();
    router.push("/auth/login");
  }

  return (
    <AppShell title="Conta" subtitle="Sessao atual e acesso ao sistema.">
      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        {isLoading ? <p className="text-sm text-slate-600">Carregando dados da conta...</p> : null}
        {error ? <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
        {!isLoading && !error ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Email</p>
              <p className="mt-1 text-lg font-semibold">{email || "Nao informado"}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Identificador</p>
              <p className="mt-1 break-all text-sm text-slate-700">{userId || "Nao informado"}</p>
            </div>
          </div>
        ) : null}
        <button
          type="button"
          className="mt-5 rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          onClick={handleLogout}
        >
          Sair da conta
        </button>
      </section>
    </AppShell>
  );
}

