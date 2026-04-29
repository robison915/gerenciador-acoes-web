"use client";

import { type FormEvent, useEffect, useMemo, useState } from "react";
import { AppShell, LoadingPanel } from "@/components/layout/AppShell";
import type { ApiError, Carteira, CarteiraDetalhe, ListarAcoesResponse, ListarCarteirasResponse } from "@/lib/api";
import {
  adicionarAcaoAvulsaEmCarteira,
  createCarteira,
  deleteCarteira,
  getCarteiraById,
  listAcoesAvulsas,
  listCarteiras,
  movimentarAcaoEntreCarteiras,
  removerAcaoDaCarteira,
} from "@/lib/api";

type MovementForm = {
  ticker: string;
  quantidade: string;
  dataOperacao: string;
  carteiraDestinoId: string;
};

const emptyMovementForm: MovementForm = {
  ticker: "",
  quantidade: "",
  dataOperacao: "",
  carteiraDestinoId: "",
};

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

function formatQuantity(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? quantityFormatter.format(value) : "-";
}

function formatCurrentValueWithQuote(total: number | null | undefined, quote: number | null | undefined) {
  if (typeof total !== "number" || !Number.isFinite(total)) {
    return {
      total: "Sem cotacao",
      quote: null,
    };
  }

  return {
    total: formatCurrency(total),
    quote: typeof quote === "number" && Number.isFinite(quote) ? `${formatCurrency(quote)} por acao` : null,
  };
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

function findQuantidadeByTicker(
  items: Array<{ ticker: string; quantidade: number }> | undefined,
  ticker: string,
) {
  return items?.find((item) => item.ticker === ticker)?.quantidade ?? 0;
}

function resultTone(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value) || value === 0) {
    return "text-slate-900";
  }

  return value < 0 ? "text-red-700" : "text-emerald-700";
}

function EmptyState({ message }: { message: string }) {
  return <div className="rounded-md border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">{message}</div>;
}

function toMovementPayload(form: Pick<MovementForm, "ticker" | "quantidade" | "dataOperacao">) {
  const ticker = form.ticker.trim().toUpperCase();
  const quantidade = Number(form.quantidade);

  if (!ticker) {
    throw new Error("Informe o ticker.");
  }
  if (!Number.isInteger(quantidade) || quantidade <= 0) {
    throw new Error("A quantidade deve ser um inteiro maior que zero.");
  }

  return {
    ticker,
    quantidade,
    ...(form.dataOperacao ? { dataOperacao: new Date(form.dataOperacao).toISOString() } : {}),
  };
}

export default function CarteirasPage() {
  const [wallets, setWallets] = useState<ListarCarteirasResponse | null>(null);
  const [selectedWallet, setSelectedWallet] = useState<CarteiraDetalhe | null>(null);
  const [loosePositions, setLoosePositions] = useState<ListarAcoesResponse | null>(null);
  const [walletName, setWalletName] = useState("");
  const [addForm, setAddForm] = useState<MovementForm>(emptyMovementForm);
  const [removeForm, setRemoveForm] = useState<MovementForm>(emptyMovementForm);
  const [transferForm, setTransferForm] = useState<MovementForm>(emptyMovementForm);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loadWallets(selectId?: string) {
    setIsLoading(true);
    setError(null);

    try {
      const [data, looseData] = await Promise.all([listCarteiras(), listAcoesAvulsas()]);
      setWallets(data);
      setLoosePositions(looseData);

      const nextSelectedId = selectId ?? selectedWallet?.id ?? data.items[0]?.id;
      if (nextSelectedId) {
        const detail = await getCarteiraById(nextSelectedId);
        setSelectedWallet(detail);
        setRemoveForm((current) => ({
          ...current,
          ticker: detail.posicoes.some((position) => position.ticker === current.ticker) ? current.ticker : detail.posicoes[0]?.ticker || "",
        }));
        setTransferForm((current) => ({
          ...current,
          ticker: detail.posicoes.some((position) => position.ticker === current.ticker) ? current.ticker : detail.posicoes[0]?.ticker || "",
        }));
      } else {
        setSelectedWallet(null);
      }
    } catch (err) {
      const apiError = err as ApiError;
      setError(apiError.message);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadWallets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const totals = useMemo(() => {
    const totalCarteiras = wallets?.totalCarteiras ?? 0;
    const totalAtivos = selectedWallet?.totalAtivos ?? 0;
    const valorInvestido = selectedWallet?.valorInvestidoTotal ?? 0;
    const valorAtual = selectedWallet?.valorAtualTotal ?? 0;

    return {
      totalCarteiras,
      totalAtivos,
      valorInvestido,
      valorAtual,
    };
  }, [wallets, selectedWallet]);

  const quantidadeAvulsaSelecionada = findQuantidadeByTicker(
    loosePositions?.items,
    addForm.ticker,
  );
  const quantidadeCarteiraSelecionada = findQuantidadeByTicker(
    selectedWallet?.posicoes,
    removeForm.ticker,
  );
  const quantidadeTransferenciaSelecionada = findQuantidadeByTicker(
    selectedWallet?.posicoes,
    transferForm.ticker,
  );

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nome = walletName.trim();

    if (!nome) {
      setError("Informe um nome para a carteira.");
      return;
    }

    setIsSubmitting(true);
    setNotice(null);
    setError(null);

    try {
      const created = await createCarteira({ nome });
      setWalletName("");
      setNotice(`Carteira "${created.nome}" criada.`);
      await loadWallets(created.id);
    } catch (err) {
      const apiError = err as ApiError;
      setError(apiError.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleSelect(wallet: Carteira) {
    setNotice(null);
    setError(null);
    setSelectedWallet(null);

    try {
      const detail = await getCarteiraById(wallet.id);
      setSelectedWallet(detail);
      setRemoveForm((current) => ({ ...current, ticker: detail.posicoes[0]?.ticker ?? "" }));
      setTransferForm((current) => ({ ...current, ticker: detail.posicoes[0]?.ticker ?? "" }));
    } catch (err) {
      const apiError = err as ApiError;
      setError(apiError.message);
    }
  }

  async function handleDelete(wallet: Carteira) {
    const confirmed = window.confirm(`Excluir a carteira "${wallet.nome}"?`);
    if (!confirmed) {
      return;
    }

    setIsSubmitting(true);
    setNotice(null);
    setError(null);

    try {
      await deleteCarteira(wallet.id);
      setNotice(`Carteira "${wallet.nome}" excluida.`);
      await loadWallets(selectedWallet?.id === wallet.id ? undefined : selectedWallet?.id);
    } catch (err) {
      const apiError = err as ApiError;
      setError(apiError.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleAddLoosePosition(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedWallet) {
      setError("Selecione uma carteira.");
      return;
    }

    setIsSubmitting(true);
    setNotice(null);
    setError(null);

    try {
      const payload = toMovementPayload(addForm);
      if (payload.quantidade > quantidadeAvulsaSelecionada) {
        setError(
          `Quantidade indisponivel. Restam ${formatQuantity(quantidadeAvulsaSelecionada)} acoes avulsas de ${payload.ticker}.`,
        );
        return;
      }
      await adicionarAcaoAvulsaEmCarteira(selectedWallet.id, payload);
      setAddForm(emptyMovementForm);
      setNotice(`${payload.ticker} vinculada a "${selectedWallet.nome}".`);
      await loadWallets(selectedWallet.id);
    } catch (err) {
      const message = err instanceof Error ? err.message : (err as ApiError).message;
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleRemoveToLoose(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedWallet) {
      setError("Selecione uma carteira.");
      return;
    }

    setIsSubmitting(true);
    setNotice(null);
    setError(null);

    try {
      const payload = toMovementPayload(removeForm);
      if (payload.quantidade > quantidadeCarteiraSelecionada) {
        setError(
          `Quantidade indisponivel. A carteira possui ${formatQuantity(quantidadeCarteiraSelecionada)} acoes de ${payload.ticker}.`,
        );
        return;
      }
      await removerAcaoDaCarteira(selectedWallet.id, payload.ticker, {
        quantidade: payload.quantidade,
        dataOperacao: payload.dataOperacao,
      });
      setRemoveForm(emptyMovementForm);
      setNotice(`${payload.ticker} removida para acoes avulsas.`);
      await loadWallets(selectedWallet.id);
    } catch (err) {
      const message = err instanceof Error ? err.message : (err as ApiError).message;
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleTransfer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedWallet) {
      setError("Selecione uma carteira de origem.");
      return;
    }
    if (!transferForm.carteiraDestinoId) {
      setError("Selecione a carteira de destino.");
      return;
    }

    setIsSubmitting(true);
    setNotice(null);
    setError(null);

    try {
      const payload = toMovementPayload(transferForm);
      if (payload.quantidade > quantidadeTransferenciaSelecionada) {
        setError(
          `Quantidade indisponivel. A carteira de origem possui ${formatQuantity(quantidadeTransferenciaSelecionada)} acoes de ${payload.ticker}.`,
        );
        return;
      }
      await movimentarAcaoEntreCarteiras({
        carteiraOrigemId: selectedWallet.id,
        carteiraDestinoId: transferForm.carteiraDestinoId,
        ...payload,
      });
      setTransferForm(emptyMovementForm);
      setNotice(`${payload.ticker} movimentada para outra carteira.`);
      await loadWallets(selectedWallet.id);
    } catch (err) {
      const message = err instanceof Error ? err.message : (err as ApiError).message;
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AppShell title="Carteiras" subtitle="Crie, consulte e organize agrupamentos de ativos conforme o backend evolui.">
      {notice ? <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{notice}</p> : null}
      {error ? <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
      {isLoading ? <LoadingPanel message="Carregando carteiras e posicoes..." /> : null}

      <section className="grid gap-4 md:grid-cols-4">
        <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Carteiras</p>
          <p className="mt-3 text-2xl font-semibold">{totals.totalCarteiras}</p>
        </article>
        <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Ativos na carteira</p>
          <p className="mt-3 text-2xl font-semibold">{totals.totalAtivos}</p>
        </article>
        <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Investido</p>
          <p className="mt-3 text-2xl font-semibold">{formatCurrency(totals.valorInvestido)}</p>
        </article>
        <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Valor atual</p>
          <p className="mt-3 text-2xl font-semibold">{formatCurrency(totals.valorAtual)}</p>
        </article>
      </section>

      <section className="grid gap-5 xl:grid-cols-[360px_1fr]">
        <aside className="space-y-5">
          <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold">Nova carteira</h2>
            <p className="mt-1 text-sm text-slate-600">Use nomes claros por estrategia, objetivo ou prazo.</p>
            <form className="mt-4 space-y-4" onSubmit={handleCreate}>
              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-semibold text-slate-800">Nome</span>
                <input
                  value={walletName}
                  onChange={(event) => setWalletName(event.target.value)}
                  placeholder="Longo prazo"
                  className="rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition placeholder:text-slate-400 focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
                />
              </label>
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full rounded-md bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-800 disabled:opacity-70"
              >
                {isSubmitting ? "Salvando..." : "Criar carteira"}
              </button>
            </form>
          </article>

          <article className="rounded-lg border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-200 p-5">
              <h2 className="text-lg font-semibold">Minhas carteiras</h2>
              <button
                type="button"
                className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                onClick={() => void loadWallets()}
              >
                Atualizar
              </button>
            </div>
            <div className="divide-y divide-slate-100">
              {wallets?.items.map((wallet) => (
                <div
                  key={wallet.id}
                  className={`flex items-start justify-between gap-3 p-4 ${
                    selectedWallet?.id === wallet.id ? "bg-blue-50" : "bg-white"
                  }`}
                >
                  <button className="min-w-0 flex-1 text-left" type="button" onClick={() => void handleSelect(wallet)}>
                    <p className="truncate font-semibold text-slate-900">{wallet.nome}</p>
                    <p className="mt-1 text-xs text-slate-500">Criada em {formatDate(wallet.createdAt)}</p>
                  </button>
                  <button
                    type="button"
                    disabled={isSubmitting}
                    className="rounded-md border border-red-200 px-2.5 py-1 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
                    onClick={() => void handleDelete(wallet)}
                  >
                    Excluir
                  </button>
                </div>
              ))}
              {!isLoading && (wallets?.items.length ?? 0) === 0 ? (
                <div className="p-4">
                  <EmptyState message="Nenhuma carteira criada ainda." />
                </div>
              ) : null}
              {isLoading ? <div className="p-4 text-sm text-slate-500">Carregando carteiras...</div> : null}
            </div>
          </article>
        </aside>

        <div className="space-y-5">
          <article className="rounded-lg border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 p-5">
              <h2 className="text-lg font-semibold">{selectedWallet?.nome ?? "Detalhe da carteira"}</h2>
              <p className="mt-1 text-sm text-slate-600">Posicoes, indicadores e movimentacoes vinculadas ao backend.</p>
            </div>

            {selectedWallet ? (
              <div className="p-5">
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="rounded-md border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Resultado</p>
                    <p className={`mt-2 text-xl font-semibold ${resultTone(selectedWallet.variacaoAbsolutaTotal)}`}>
                      {formatCurrency(selectedWallet.variacaoAbsolutaTotal)}
                    </p>
                  </div>
                  <div className="rounded-md border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Variacao</p>
                    <p className={`mt-2 text-xl font-semibold ${resultTone(selectedWallet.variacaoPercentualTotal)}`}>
                      {formatPercent(selectedWallet.variacaoPercentualTotal)}
                    </p>
                  </div>
                  <div className="rounded-md border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Atualizada em</p>
                    <p className="mt-2 text-sm font-semibold">{formatDate(selectedWallet.updatedAt)}</p>
                  </div>
                </div>

                <div className="mt-5 overflow-x-auto rounded-md border border-slate-200">
                  <table className="min-w-full text-left text-sm">
                    <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                      <tr>
                        <th className="px-4 py-3">Ticker</th>
                        <th className="px-4 py-3">Qtd.</th>
                        <th className="px-4 py-3">Preco medio</th>
                        <th className="px-4 py-3">Cotacao</th>
                        <th className="px-4 py-3">Investido</th>
                        <th className="px-4 py-3">Valor atual</th>
                        <th className="px-4 py-3">Variacao</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {selectedWallet.posicoes.map((position) => {
                        const currentValue = formatCurrentValueWithQuote(position.valorAtual, position.cotacaoAtual);

                        return (
                          <tr key={position.ticker}>
                            <td className="px-4 py-3 font-semibold">{position.ticker}</td>
                            <td className="px-4 py-3">{formatQuantity(position.quantidade)}</td>
                            <td className="px-4 py-3">{formatCurrency(position.precoMedio)}</td>
                            <td className="px-4 py-3 font-semibold">{formatCurrency(position.cotacaoAtual)}</td>
                            <td className="px-4 py-3">{formatCurrency(position.valorInvestido)}</td>
                            <td className="px-4 py-3">
                              <div className="flex flex-col">
                                <span>{currentValue.total}</span>
                                {currentValue.quote ? <span className="text-xs text-slate-500">{currentValue.quote}</span> : null}
                              </div>
                            </td>
                            <td className={`px-4 py-3 font-semibold ${resultTone(position.variacaoAbsoluta)}`}>
                              {formatPercent(position.variacaoPercentual)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  {selectedWallet.posicoes.length === 0 ? (
                    <div className="p-5">
                      <EmptyState message="Esta carteira ainda nao possui posicoes vinculadas." />
                    </div>
                  ) : null}
                </div>
              </div>
            ) : (
              <div className="p-5">
                <EmptyState message="Selecione ou crie uma carteira para ver os detalhes." />
              </div>
            )}
          </article>

          {selectedWallet ? (
            <section className="grid gap-4 lg:grid-cols-3">
              <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                <h3 className="text-base font-semibold text-slate-900">Vincular avulsa</h3>
                <form className="mt-4 space-y-4" onSubmit={handleAddLoosePosition}>
                  <label className="flex flex-col gap-1.5">
                    <span className="text-sm font-semibold text-slate-800">Ticker</span>
                    <select
                      value={addForm.ticker}
                      onChange={(event) => setAddForm((current) => ({ ...current, ticker: event.target.value }))}
                      className="rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
                    >
                      <option value="">Selecione</option>
                      {loosePositions?.items.map((position) => (
                        <option key={position.ticker} value={position.ticker}>
                          {position.ticker} - {formatQuantity(position.quantidade)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex flex-col gap-1.5">
                    <span className="text-sm font-semibold text-slate-800">Quantidade</span>
                    <input
                      value={addForm.quantidade}
                      type="number"
                      min="1"
                      max={quantidadeAvulsaSelecionada || undefined}
                      onChange={(event) => setAddForm((current) => ({ ...current, quantidade: event.target.value }))}
                      className="rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
                    />
                    <span className="text-xs text-slate-500">Disponivel: {formatQuantity(quantidadeAvulsaSelecionada)}</span>
                  </label>
                  <label className="flex flex-col gap-1.5">
                    <span className="text-sm font-semibold text-slate-800">Data</span>
                    <input
                      value={addForm.dataOperacao}
                      type="datetime-local"
                      onChange={(event) => setAddForm((current) => ({ ...current, dataOperacao: event.target.value }))}
                      className="rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
                    />
                  </label>
                  <button
                    type="submit"
                    disabled={isSubmitting || !selectedWallet}
                    className="w-full rounded-md bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-800 disabled:opacity-70"
                  >
                    Vincular
                  </button>
                </form>
              </article>

              <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                <h3 className="text-base font-semibold text-slate-900">Remover para avulsas</h3>
                <form className="mt-4 space-y-4" onSubmit={handleRemoveToLoose}>
                  <label className="flex flex-col gap-1.5">
                    <span className="text-sm font-semibold text-slate-800">Ticker</span>
                    <select
                      value={removeForm.ticker}
                      onChange={(event) => setRemoveForm((current) => ({ ...current, ticker: event.target.value }))}
                      className="rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
                    >
                      <option value="">Selecione</option>
                      {selectedWallet.posicoes.map((position) => (
                        <option key={position.ticker} value={position.ticker}>
                          {position.ticker} - {formatQuantity(position.quantidade)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex flex-col gap-1.5">
                    <span className="text-sm font-semibold text-slate-800">Quantidade</span>
                    <input
                      value={removeForm.quantidade}
                      type="number"
                      min="1"
                      max={quantidadeCarteiraSelecionada || undefined}
                      onChange={(event) => setRemoveForm((current) => ({ ...current, quantidade: event.target.value }))}
                      className="rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
                    />
                    <span className="text-xs text-slate-500">Disponivel: {formatQuantity(quantidadeCarteiraSelecionada)}</span>
                  </label>
                  <label className="flex flex-col gap-1.5">
                    <span className="text-sm font-semibold text-slate-800">Data</span>
                    <input
                      value={removeForm.dataOperacao}
                      type="datetime-local"
                      onChange={(event) => setRemoveForm((current) => ({ ...current, dataOperacao: event.target.value }))}
                      className="rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
                    />
                  </label>
                  <button
                    type="submit"
                    disabled={isSubmitting || selectedWallet.posicoes.length === 0}
                    className="w-full rounded-md border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-70"
                  >
                    Remover
                  </button>
                </form>
              </article>

              <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                <h3 className="text-base font-semibold text-slate-900">Transferir</h3>
                <form className="mt-4 space-y-4" onSubmit={handleTransfer}>
                  <label className="flex flex-col gap-1.5">
                    <span className="text-sm font-semibold text-slate-800">Ticker</span>
                    <select
                      value={transferForm.ticker}
                      onChange={(event) => setTransferForm((current) => ({ ...current, ticker: event.target.value }))}
                      className="rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
                    >
                      <option value="">Selecione</option>
                      {selectedWallet.posicoes.map((position) => (
                        <option key={position.ticker} value={position.ticker}>
                          {position.ticker} - {formatQuantity(position.quantidade)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex flex-col gap-1.5">
                    <span className="text-sm font-semibold text-slate-800">Destino</span>
                    <select
                      value={transferForm.carteiraDestinoId}
                      onChange={(event) => setTransferForm((current) => ({ ...current, carteiraDestinoId: event.target.value }))}
                      className="rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
                    >
                      <option value="">Selecione</option>
                      {wallets?.items
                        .filter((wallet) => wallet.id !== selectedWallet.id)
                        .map((wallet) => (
                          <option key={wallet.id} value={wallet.id}>
                            {wallet.nome}
                          </option>
                        ))}
                    </select>
                  </label>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
                    <label className="flex flex-col gap-1.5">
                      <span className="text-sm font-semibold text-slate-800">Quantidade</span>
                      <input
                        value={transferForm.quantidade}
                        type="number"
                        min="1"
                        max={quantidadeTransferenciaSelecionada || undefined}
                        onChange={(event) => setTransferForm((current) => ({ ...current, quantidade: event.target.value }))}
                        className="rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
                      />
                      <span className="text-xs text-slate-500">Disponivel: {formatQuantity(quantidadeTransferenciaSelecionada)}</span>
                    </label>
                    <label className="flex flex-col gap-1.5">
                      <span className="text-sm font-semibold text-slate-800">Data</span>
                      <input
                        value={transferForm.dataOperacao}
                        type="datetime-local"
                        onChange={(event) => setTransferForm((current) => ({ ...current, dataOperacao: event.target.value }))}
                        className="rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
                      />
                    </label>
                  </div>
                  <button
                    type="submit"
                    disabled={isSubmitting || selectedWallet.posicoes.length === 0 || (wallets?.items.length ?? 0) < 2}
                    className="w-full rounded-md bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-70"
                  >
                    Transferir
                  </button>
                </form>
              </article>
            </section>
          ) : null}
        </div>
      </section>
    </AppShell>
  );
}
