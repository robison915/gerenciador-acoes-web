"use client";

import { type FormEvent, useEffect, useMemo, useState } from "react";
import { AppShell, LoadingPanel } from "@/components/layout/AppShell";
import type {
  ApiError,
  Carteira,
  CarteiraProjecao,
  ListarCarteiraProjecoesResponse,
  ListarCarteirasResponse,
  ProjetarAjusteCarteiraAtivoPayload,
} from "@/lib/api";
import {
  excluirProjecaoCarteira,
  listCarteiras,
  listarProjecoesCarteira,
  projetarAjusteCarteira,
} from "@/lib/api";
import {
  buildAjusteCarteirasPlano,
  toProjetarAjusteCarteiraPayload,
  type AjusteCarteiraMovimentacao,
  type AjusteCarteiraOperacaoReal,
} from "@/lib/carteira-ajuste-flow";

const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const quantityFormatter = new Intl.NumberFormat("pt-BR", {
  maximumFractionDigits: 8,
});

function formatCurrency(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? currencyFormatter.format(value) : "-";
}

function formatQuantity(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? quantityFormatter.format(value) : "-";
}

function formatPercent(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? `${value.toFixed(2)}%` : "-";
}

function formatDate(value: string | null | undefined) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

function formatCountLabel(count: number, singular: string, plural: string) {
  return `${count} ${count === 1 ? singular : plural}`;
}

function parseTargetAssets(input: string): ProjetarAjusteCarteiraAtivoPayload[] {
  const lines = input
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    throw new Error("Informe ao menos um ticker.");
  }

  return lines.map((line, index) => {
    const parsed = line.match(/^([A-Za-z0-9]+)(?:[\s;,]+(.+))?$/);
    const ticker = parsed?.[1]?.trim().toUpperCase();
    const percentRaw = parsed?.[2]?.trim();

    if (!ticker) {
      throw new Error(`Linha ${index + 1}: informe o ticker.`);
    }

    if (!percentRaw) {
      return { ticker };
    }

    const percentual = Number(percentRaw.replace("%", "").replace(",", "."));
    if (!Number.isFinite(percentual) || percentual <= 0 || percentual > 100) {
      throw new Error(`Linha ${index + 1}: percentual invalido para ${ticker}.`);
    }

    return { ticker, percentual };
  });
}

function ProjectionTable({
  title,
  items,
}: {
  title: string;
  items: CarteiraProjecao["compras"];
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
      <div className="border-b border-slate-200 px-4 py-3">
        <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      </div>
      {items.length ? (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Ticker</th>
                <th className="px-4 py-3">Quantidade</th>
                <th className="px-4 py-3">Valor unitario</th>
                <th className="px-4 py-3">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((item) => (
                <tr key={`${title}-${item.ticker}`}>
                  <td className="px-4 py-3 font-semibold text-slate-900">{item.ticker}</td>
                  <td className="px-4 py-3 text-slate-700">{formatQuantity(item.quantidade)}</td>
                  <td className="px-4 py-3 text-slate-700">{formatCurrency(item.valorUnitario)}</td>
                  <td className="px-4 py-3 text-slate-700">{formatCurrency(item.valorTotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="px-4 py-6 text-sm text-slate-500">Nenhuma operacao projetada.</p>
      )}
    </div>
  );
}

function WalletAllocationList({ operation }: { operation: AjusteCarteiraOperacaoReal }) {
  return (
    <div className="space-y-1">
      {operation.alocacoes.map((allocation) => (
        <div key={`${operation.ticker}-${allocation.carteiraId}`} className="text-xs text-slate-600">
          <span className="font-semibold text-slate-700">{allocation.carteiraNome}</span>:{" "}
          {formatQuantity(allocation.quantidade)}
        </div>
      ))}
    </div>
  );
}

function RealOperationsTable({
  title,
  emptyText,
  operations,
  allocationTitle,
}: {
  title: string;
  emptyText: string;
  operations: AjusteCarteiraOperacaoReal[];
  allocationTitle: string;
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
      <div className="border-b border-slate-200 px-4 py-3">
        <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      </div>
      {operations.length ? (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Ticker</th>
                <th className="px-4 py-3">Quantidade</th>
                <th className="px-4 py-3">Preco medio</th>
                <th className="px-4 py-3">Total</th>
                <th className="px-4 py-3">{allocationTitle}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {operations.map((operation) => (
                <tr key={`${title}-${operation.ticker}`}>
                  <td className="px-4 py-3 font-semibold text-slate-900">{operation.ticker}</td>
                  <td className="px-4 py-3 text-slate-700">{formatQuantity(operation.quantidade)}</td>
                  <td className="px-4 py-3 text-slate-700">{formatCurrency(operation.valorUnitarioMedio)}</td>
                  <td className="px-4 py-3 text-slate-700">{formatCurrency(operation.valorTotal)}</td>
                  <td className="px-4 py-3">
                    <WalletAllocationList operation={operation} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="px-4 py-6 text-sm text-slate-500">{emptyText}</p>
      )}
    </div>
  );
}

function InternalMovementsTable({ movements }: { movements: AjusteCarteiraMovimentacao[] }) {
  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
      <div className="border-b border-slate-200 px-4 py-3">
        <h3 className="text-sm font-semibold text-slate-900">Movimentacoes entre carteiras</h3>
      </div>
      {movements.length ? (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Ticker</th>
                <th className="px-4 py-3">Quantidade</th>
                <th className="px-4 py-3">Origem</th>
                <th className="px-4 py-3">Destino</th>
                <th className="px-4 py-3">Referencia</th>
                <th className="px-4 py-3">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {movements.map((movement) => (
                <tr key={`${movement.ticker}-${movement.carteiraOrigemId}-${movement.carteiraDestinoId}`}>
                  <td className="px-4 py-3 font-semibold text-slate-900">{movement.ticker}</td>
                  <td className="px-4 py-3 text-slate-700">{formatQuantity(movement.quantidade)}</td>
                  <td className="px-4 py-3 text-slate-700">{movement.carteiraOrigemNome}</td>
                  <td className="px-4 py-3 text-slate-700">{movement.carteiraDestinoNome}</td>
                  <td className="px-4 py-3 text-slate-700">{formatCurrency(movement.valorUnitario)}</td>
                  <td className="px-4 py-3 text-slate-700">{formatCurrency(movement.valorTotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="px-4 py-6 text-sm text-slate-500">Nenhuma movimentacao entre carteiras identificada.</p>
      )}
    </div>
  );
}

export default function AjusteCarteiraPage() {
  const [wallets, setWallets] = useState<ListarCarteirasResponse | null>(null);
  const [selectedWalletId, setSelectedWalletId] = useState("");
  const [projections, setProjections] = useState<ListarCarteiraProjecoesResponse | null>(null);
  const [currentProjection, setCurrentProjection] = useState<CarteiraProjecao | null>(null);
  const [latestProjectionsByWallet, setLatestProjectionsByWallet] = useState<Record<string, CarteiraProjecao | null>>({});
  const [saldoInformado, setSaldoInformado] = useState("0");
  const [targetAssetsText, setTargetAssetsText] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRefreshingProjections, setIsRefreshingProjections] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selectedWallet = useMemo(
    () => wallets?.items.find((wallet) => wallet.id === selectedWalletId) ?? null,
    [selectedWalletId, wallets],
  );

  const latestProjections = useMemo(
    () =>
      wallets?.items
        .map((wallet) => latestProjectionsByWallet[wallet.id])
        .filter((projection): projection is CarteiraProjecao => Boolean(projection)) ?? [],
    [latestProjectionsByWallet, wallets],
  );

  const optimizedPlan = useMemo(
    () => buildAjusteCarteirasPlano(latestProjections, wallets?.items ?? []),
    [latestProjections, wallets],
  );
  const isMutating = isSubmitting || isRefreshingProjections;

  async function loadLatestProjectionsByWallet(walletItems: Carteira[]) {
    if (walletItems.length === 0) {
      setLatestProjectionsByWallet({});
      return;
    }

    const results = await Promise.allSettled(
      walletItems.map(async (wallet) => {
        const walletProjections = await listarProjecoesCarteira(wallet.id);
        return [wallet.id, walletProjections.items[0] ?? null] as const;
      }),
    );
    const nextProjections: Record<string, CarteiraProjecao | null> = {};

    for (const result of results) {
      if (result.status === "fulfilled") {
        const [walletId, projection] = result.value;
        nextProjections[walletId] = projection;
      }
    }

    setLatestProjectionsByWallet(nextProjections);
  }

  async function loadWallets() {
    setIsLoading(true);
    setError(null);

    try {
      const data = await listCarteiras();
      setWallets(data);
      const nextId = selectedWalletId || data.items[0]?.id || "";
      setSelectedWalletId(nextId);
      if (nextId) {
        const walletProjections = await listarProjecoesCarteira(nextId);
        setProjections(walletProjections);
        setCurrentProjection(walletProjections.items[0] ?? null);
      } else {
        setProjections(null);
        setCurrentProjection(null);
      }
      await loadLatestProjectionsByWallet(data.items);
    } catch (err) {
      const apiError = err as ApiError;
      setError(apiError.message);
    } finally {
      setIsLoading(false);
    }
  }

  async function loadProjections(carteiraId: string) {
    if (!carteiraId) {
      setProjections(null);
      setCurrentProjection(null);
      return;
    }

    const walletProjections = await listarProjecoesCarteira(carteiraId);
    setProjections(walletProjections);
    setCurrentProjection(walletProjections.items[0] ?? null);
  }

  useEffect(() => {
    void loadWallets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleWalletChange(carteiraId: string) {
    setSelectedWalletId(carteiraId);
    setNotice(null);
    setError(null);

    try {
      await loadProjections(carteiraId);
    } catch (err) {
      const apiError = err as ApiError;
      setError(apiError.message);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedWalletId) {
      setError("Selecione uma carteira.");
      return;
    }

    const saldo = Number(saldoInformado.replace(",", "."));
    if (!Number.isFinite(saldo) || saldo < 0) {
      setError("Informe um saldo valido maior ou igual a zero.");
      return;
    }

    setIsSubmitting(true);
    setNotice(null);
    setError(null);

    try {
      const ativos = parseTargetAssets(targetAssetsText);
      const projection = await projetarAjusteCarteira(selectedWalletId, {
        saldoInformado: saldo,
        ativos,
      });
      setCurrentProjection(projection);
      await loadProjections(selectedWalletId);
      await loadLatestProjectionsByWallet(wallets?.items ?? []);
      setNotice("Projecao de ajuste criada.");
    } catch (err) {
      const message = err instanceof Error ? err.message : (err as ApiError).message;
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleRefreshLatestProjections() {
    if (latestProjections.length === 0) {
      setError("Nenhuma projecao salva para atualizar.");
      return;
    }

    setIsRefreshingProjections(true);
    setNotice(null);
    setError(null);

    try {
      const results = await Promise.allSettled(
        latestProjections.map((projection) =>
          projetarAjusteCarteira(projection.carteiraId, toProjetarAjusteCarteiraPayload(projection)),
        ),
      );
      const updatedCount = results.filter((result) => result.status === "fulfilled").length;
      const failedCount = results.length - updatedCount;

      if (updatedCount === 0) {
        const firstFailure = results.find((result) => result.status === "rejected");
        const reason = firstFailure?.status === "rejected" ? firstFailure.reason : null;
        throw new Error(reason instanceof Error ? reason.message : "Nao foi possivel atualizar as projecoes.");
      }

      if (selectedWalletId) {
        await loadProjections(selectedWalletId);
      }
      await loadLatestProjectionsByWallet(wallets?.items ?? []);

      setNotice(
        failedCount > 0
          ? `${updatedCount} projecao(oes) atualizada(s); ${failedCount} falhou(ram).`
          : `${updatedCount} projecao(oes) atualizada(s) com as cotacoes atuais da base.`,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : (err as ApiError).message;
      setError(message);
    } finally {
      setIsRefreshingProjections(false);
    }
  }

  async function handleDeleteProjection(projection: CarteiraProjecao) {
    const confirmed = window.confirm("Excluir esta projecao de ajuste?");
    if (!confirmed) {
      return;
    }

    setIsSubmitting(true);
    setNotice(null);
    setError(null);

    try {
      await excluirProjecaoCarteira(projection.carteiraId, projection.id);
      setNotice("Projecao excluida.");
      await loadProjections(projection.carteiraId);
      await loadLatestProjectionsByWallet(wallets?.items ?? []);
    } catch (err) {
      const apiError = err as ApiError;
      setError(apiError.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AppShell title="Ajuste de carteira" subtitle="Projete compras e vendas a partir de uma nova composicao alvo.">
      {notice ? <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{notice}</p> : null}
      {error ? <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
      {isLoading ? <LoadingPanel message="Carregando carteiras e projecoes..." /> : null}

      <section className="grid gap-4 lg:grid-cols-[minmax(320px,420px)_1fr]">
        <form onSubmit={handleSubmit} className="space-y-4 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Nova projecao</h2>
            <p className="mt-1 text-sm text-slate-600">Informe os tickers desejados e o saldo livre disponivel.</p>
          </div>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-semibold text-slate-800">Carteira</span>
            <select
              value={selectedWalletId}
              onChange={(event) => void handleWalletChange(event.target.value)}
              className="rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
            >
              <option value="">Selecione</option>
              {wallets?.items.map((wallet: Carteira) => (
                <option key={wallet.id} value={wallet.id}>
                  {wallet.nome}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-semibold text-slate-800">Saldo livre</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={saldoInformado}
              onChange={(event) => setSaldoInformado(event.target.value)}
              className="rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-semibold text-slate-800">Nova lista de acoes</span>
            <textarea
              value={targetAssetsText}
              onChange={(event) => setTargetAssetsText(event.target.value)}
              rows={12}
              placeholder={"PETR4\nITUB4 20\nVALE3;15\nBBDC4,10"}
              className="min-h-72 rounded-md border border-slate-300 bg-white px-3 py-2.5 font-mono text-sm outline-none placeholder:text-slate-400 focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
            />
            <span className="text-xs text-slate-500">
              Uma acao por linha. Percentual opcional apos o ticker, separado por espaco, virgula ou ponto e virgula.
            </span>
          </label>

          <button
            type="submit"
            disabled={isMutating || !selectedWalletId}
            className="w-full rounded-md bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {isSubmitting ? "Calculando..." : "Gerar projecao"}
          </button>
        </form>

        <div className="space-y-4">
          <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  {selectedWallet ? selectedWallet.nome : "Projecao"}
                </h2>
                <p className="mt-1 text-sm text-slate-600">Resultado salvo para orientar a proxima importacao.</p>
              </div>
              {currentProjection ? (
                <button
                  type="button"
                  onClick={() => void handleDeleteProjection(currentProjection)}
                  disabled={isMutating}
                  className="rounded-md border border-red-200 px-3 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Excluir projecao
                </button>
              ) : null}
            </div>

            {currentProjection ? (
              <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Saldo informado</p>
                  <p className="mt-2 text-lg font-semibold">{formatCurrency(currentProjection.saldoInformado)}</p>
                </div>
                <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Carteira atual</p>
                  <p className="mt-2 text-lg font-semibold">{formatCurrency(currentProjection.valorCarteiraAtual)}</p>
                </div>
                <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Total projetado</p>
                  <p className="mt-2 text-lg font-semibold">{formatCurrency(currentProjection.saldoTotalProjetado)}</p>
                </div>
                <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Alocado</p>
                  <p className="mt-2 text-lg font-semibold">{formatCurrency(currentProjection.valorProjetadoAlocado)}</p>
                </div>
                <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Saldo residual</p>
                  <p className="mt-2 text-lg font-semibold">{formatCurrency(currentProjection.saldoResidualEstimado)}</p>
                </div>
              </div>
            ) : (
              <p className="mt-5 rounded-md border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                Nenhuma projecao criada para a carteira selecionada.
              </p>
            )}
          </section>

          {latestProjections.length ? (
            <section className="space-y-4 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">Plano otimizado entre carteiras</h2>
                  <p className="mt-1 text-sm text-slate-600">
                    Ultimas projecoes consolidadas para separar movimentacoes internas das ordens na corretora.
                  </p>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <span className="w-fit rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                    {formatCountLabel(latestProjections.length, "carteira com projecao", "carteiras com projecao")}
                  </span>
                  <button
                    type="button"
                    onClick={() => void handleRefreshLatestProjections()}
                    disabled={isMutating || latestProjections.length === 0}
                    className="rounded-md border border-blue-200 px-3 py-2 text-sm font-semibold text-blue-700 transition hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isRefreshingProjections ? "Atualizando..." : "Atualizar cotacoes"}
                  </button>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Movimentar</p>
                  <p className="mt-2 text-lg font-semibold text-slate-900">
                    {formatQuantity(optimizedPlan.quantidadeMovimentada)}
                  </p>
                  <p className="text-xs text-slate-500">{formatCurrency(optimizedPlan.valorMovimentado)}</p>
                </div>
                <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Comprar</p>
                  <p className="mt-2 text-lg font-semibold text-emerald-700">
                    {formatQuantity(optimizedPlan.quantidadeCompras)}
                  </p>
                  <p className="text-xs text-slate-500">{formatCurrency(optimizedPlan.valorCompras)}</p>
                </div>
                <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Vender</p>
                  <p className="mt-2 text-lg font-semibold text-red-700">{formatQuantity(optimizedPlan.quantidadeVendas)}</p>
                  <p className="text-xs text-slate-500">{formatCurrency(optimizedPlan.valorVendas)}</p>
                </div>
                <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Ordens reais</p>
                  <p className="mt-2 text-lg font-semibold text-slate-900">
                    {optimizedPlan.compras.length + optimizedPlan.vendas.length}
                  </p>
                  <p className="text-xs text-slate-500">
                    {formatCountLabel(optimizedPlan.movimentacoes.length, "movimentacao", "movimentacoes")}
                  </p>
                </div>
              </div>

              <InternalMovementsTable movements={optimizedPlan.movimentacoes} />

              <section className="grid gap-4 lg:grid-cols-2">
                <RealOperationsTable
                  title="Compras reais"
                  emptyText="Nenhuma compra real apos compensar movimentacoes."
                  operations={optimizedPlan.compras}
                  allocationTitle="Destino"
                />
                <RealOperationsTable
                  title="Vendas reais"
                  emptyText="Nenhuma venda real apos compensar movimentacoes."
                  operations={optimizedPlan.vendas}
                  allocationTitle="Origem"
                />
              </section>
            </section>
          ) : null}

          {currentProjection ? (
            <>
              <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
                <div className="border-b border-slate-200 px-4 py-3">
                  <h3 className="text-sm font-semibold text-slate-900">Composicao projetada</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-200 text-sm">
                    <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      <tr>
                        <th className="px-4 py-3">Ticker</th>
                        <th className="px-4 py-3">Peso</th>
                        <th className="px-4 py-3">Atual</th>
                        <th className="px-4 py-3">Projetada</th>
                        <th className="px-4 py-3">Valor</th>
                        <th className="px-4 py-3">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {currentProjection.ativos.map((ativo) => (
                        <tr key={ativo.ticker}>
                          <td className="px-4 py-3 font-semibold text-slate-900">{ativo.ticker}</td>
                          <td className="px-4 py-3 text-slate-700">{formatPercent(ativo.percentual)}</td>
                          <td className="px-4 py-3 text-slate-700">{formatQuantity(ativo.quantidadeAtual)}</td>
                          <td className="px-4 py-3 text-slate-700">{formatQuantity(ativo.quantidadeProjetada)}</td>
                          <td className="px-4 py-3 text-slate-700">{formatCurrency(ativo.valorProjetado)}</td>
                          <td className="px-4 py-3">
                            <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">
                              {ativo.novo ? "Novo" : "Mantido"}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

              <section className="grid gap-4 lg:grid-cols-2">
                <ProjectionTable title="Compras projetadas" items={currentProjection.compras} />
                <ProjectionTable title="Vendas projetadas" items={currentProjection.vendas} />
              </section>
            </>
          ) : null}

          {projections?.items.length ? (
            <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="text-base font-semibold text-slate-900">Historico de projecoes</h3>
              <div className="mt-3 divide-y divide-slate-100">
                {projections.items.map((projection) => (
                  <button
                    key={projection.id}
                    type="button"
                    onClick={() => setCurrentProjection(projection)}
                    className="flex w-full items-center justify-between gap-4 py-3 text-left text-sm transition hover:text-blue-700"
                  >
                    <span>
                      <span className="font-semibold text-slate-900">{formatDate(projection.createdAt)}</span>
                      <span className="ml-2 text-slate-500">
                        {projection.ativos.length} ativos, {projection.compras.length} compras, {projection.vendas.length} vendas
                      </span>
                    </span>
                    <span className="font-semibold text-slate-700">{formatCurrency(projection.saldoTotalProjetado)}</span>
                  </button>
                ))}
              </div>
            </section>
          ) : null}
        </div>
      </section>
    </AppShell>
  );
}
