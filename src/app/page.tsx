"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AppShell, LoadingPanel } from "@/components/layout/AppShell";
import type { ApiError, ListarAcoesResponse, PerformanceAcoesResponse } from "@/lib/api";
import { getPerformanceAcoes, listAcoes } from "@/lib/api";

const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const quantityFormatter = new Intl.NumberFormat("pt-BR", {
  maximumFractionDigits: 8,
});

function formatCurrency(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? currencyFormatter.format(value) : "Sem cotacao";
}

function formatPercent(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? `${value.toFixed(2)}%` : "-";
}

function formatQuantity(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? quantityFormatter.format(value) : "-";
}

export default function Home() {
  const [positions, setPositions] = useState<ListarAcoesResponse | null>(null);
  const [performance, setPerformance] = useState<PerformanceAcoesResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadDashboard() {
      setIsLoading(true);
      setError(null);

      try {
        const [positionsData, performanceData] = await Promise.all([listAcoes(), getPerformanceAcoes()]);
        if (!active) {
          return;
        }
        setPositions(positionsData);
        setPerformance(performanceData);
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

    void loadDashboard();

    return () => {
      active = false;
    };
  }, []);

  const topPositions = useMemo(() => {
    return [...(positions?.items ?? [])].sort((a, b) => b.valorInvestido - a.valorInvestido).slice(0, 5);
  }, [positions]);

  return (
    <AppShell title="Visao geral" subtitle="Resumo das suas posicoes e dos principais movimentos da carteira.">
      {error ? <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
      {isLoading ? <LoadingPanel message="Carregando resumo da carteira..." /> : null}

      <section className="grid gap-4 md:grid-cols-4">
        <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Valor investido</p>
          <p className="mt-3 text-2xl font-semibold">{formatCurrency(performance?.valorInvestidoTotal)}</p>
        </article>
        <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Valor atual</p>
          <p className="mt-3 text-2xl font-semibold">{formatCurrency(performance?.valorAtualTotal)}</p>
        </article>
        <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Resultado</p>
          <p
            className={`mt-3 text-2xl font-semibold ${
              (performance?.variacaoAbsolutaTotal ?? 0) < 0 ? "text-red-700" : "text-emerald-700"
            }`}
          >
            {formatCurrency(performance?.variacaoAbsolutaTotal)}
          </p>
        </article>
        <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Ativos</p>
          <p className="mt-3 text-2xl font-semibold">{positions?.totalAtivos ?? 0}</p>
        </article>
      </section>

      <section className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <article className="rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 p-5">
            <h2 className="text-lg font-semibold">Principais posicoes</h2>
            <p className="mt-1 text-sm text-slate-600">Ativos com maior valor investido.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-3">Ticker</th>
                  <th className="px-5 py-3">Quantidade</th>
                  <th className="px-5 py-3">Cotacao</th>
                  <th className="px-5 py-3">Investido</th>
                  <th className="px-5 py-3">Valor atual</th>
                  <th className="px-5 py-3">Variacao</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {topPositions.map((item) => (
                  <tr key={item.ticker}>
                    <td className="px-5 py-3 font-semibold">{item.ticker}</td>
                    <td className="px-5 py-3">{formatQuantity(item.quantidade)}</td>
                    <td className="px-5 py-3 font-semibold">{formatCurrency(item.cotacaoAtual)}</td>
                    <td className="px-5 py-3">{formatCurrency(item.valorInvestido)}</td>
                    <td className="px-5 py-3">{formatCurrency(item.valorAtual)}</td>
                    <td className="px-5 py-3">{formatPercent(item.variacaoPercentual)}</td>
                  </tr>
                ))}
                {!isLoading && topPositions.length === 0 ? (
                  <tr>
                    <td className="px-5 py-8 text-center text-slate-500" colSpan={6}>
                      Nenhuma posicao registrada ainda.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </article>

        <aside className="space-y-4">
          <Link
            href="/acoes"
            className="block rounded-lg border border-blue-200 bg-blue-700 p-5 text-white shadow-sm transition hover:bg-blue-800"
          >
            <p className="text-sm font-semibold uppercase tracking-wide text-blue-100">Acoes</p>
            <p className="mt-2 text-xl font-semibold">Registrar compra ou venda</p>
          </Link>
          <Link
            href="/carteiras"
            className="block rounded-lg border border-slate-200 bg-white p-5 shadow-sm transition hover:border-blue-200 hover:bg-blue-50"
          >
            <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">Carteiras</p>
            <p className="mt-2 text-xl font-semibold text-slate-900">Organizar posicoes</p>
          </Link>
        </aside>
      </section>
    </AppShell>
  );
}
