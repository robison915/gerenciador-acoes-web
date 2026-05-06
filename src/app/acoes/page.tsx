"use client";

import { type ChangeEvent, type FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { AppShell, LoadingPanel, ProgressLog } from "@/components/layout/AppShell";
import type {
  ApiError,
  ImportacaoB3,
  ListarCarteirasResponse,
  ListarAcoesResponse,
  ListarTickersResponse,
  OperacoesAcoesResponse,
  PerformanceAcoesResponse,
  PosicaoAcao,
  ResultadoVendasResponse,
} from "@/lib/api";
import {
  consultarUltimaImportacaoB3,
  distribuirUltimaImportacaoB3,
  getAcaoByTicker,
  getPerformanceAcoes,
  importarB3Arquivo,
  listAcoes,
  listAcoesAvulsas,
  listCarteiras,
  listOperacoesAcoes,
  listResultadoVendas,
  listTickers,
  registrarCompra,
  registrarComprasLote,
  registrarVenda,
  registrarVendasLote,
} from "@/lib/api";
import {
  metricTone,
  parseOperacoesLote,
  toOperacaoPayload,
  type OperationForm,
} from "@/lib/acoes-flow";

type ActionMode = "compra" | "venda";

const emptyForm: OperationForm = {
  ticker: "",
  quantidade: "",
  valorUnitario: "",
  dataOperacao: "",
  carteiraId: "",
};

const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const numberFormatter = new Intl.NumberFormat("pt-BR", {
  maximumFractionDigits: 2,
});

const quantityFormatter = new Intl.NumberFormat("pt-BR", {
  maximumFractionDigits: 8,
});

const OPERATIONS_PAGE_SIZE = 12;

function formatCurrency(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? currencyFormatter.format(value) : "Sem cotacao";
}

function formatNumber(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? numberFormatter.format(value) : "-";
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

function Field({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-semibold text-slate-800">{label}</span>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition placeholder:text-slate-400 focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
      />
    </label>
  );
}

function EmptyState({ message }: { message: string }) {
  return <div className="px-5 py-8 text-center text-sm text-slate-500">{message}</div>;
}

export default function AcoesPage() {
  const [positions, setPositions] = useState<ListarAcoesResponse | null>(null);
  const [loosePositions, setLoosePositions] = useState<ListarAcoesResponse | null>(null);
  const [performance, setPerformance] = useState<PerformanceAcoesResponse | null>(null);
  const [operations, setOperations] = useState<OperacoesAcoesResponse | null>(null);
  const [salesResult, setSalesResult] = useState<ResultadoVendasResponse | null>(null);
  const [tickers, setTickers] = useState<ListarTickersResponse | null>(null);
  const [wallets, setWallets] = useState<ListarCarteirasResponse | null>(null);
  const [b3Import, setB3Import] = useState<ImportacaoB3 | null>(null);
  const [b3Distribution, setB3Distribution] = useState<Record<number, string>>({});
  const [selectedPosition, setSelectedPosition] = useState<PosicaoAcao | null>(null);
  const [lookupTicker, setLookupTicker] = useState("");
  const [operationMode, setOperationMode] = useState<ActionMode>("compra");
  const [operationForm, setOperationForm] = useState<OperationForm>(emptyForm);
  const [batchMode, setBatchMode] = useState<ActionMode>("compra");
  const [batchText, setBatchText] = useState("");
  const [batchFileName, setBatchFileName] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isOperationsLoading, setIsOperationsLoading] = useState(false);
  const [isSecondaryLoading, setIsSecondaryLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isImportingB3File, setIsImportingB3File] = useState(false);
  const [operationsOffset, setOperationsOffset] = useState(0);
  const [batchImportLog, setBatchImportLog] = useState<string[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadPrimaryData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    const results = await Promise.allSettled([
        listAcoes(),
        listAcoesAvulsas(),
        getPerformanceAcoes(),
        listCarteiras(),
      ]);

    const [
      positionsResult,
      looseResult,
      performanceResult,
      walletsResult,
    ] = results;

    if (positionsResult.status === "fulfilled") {
      setPositions(positionsResult.value);
    }
    if (looseResult.status === "fulfilled") {
      setLoosePositions(looseResult.value);
    }
    if (performanceResult.status === "fulfilled") {
      setPerformance(performanceResult.value);
    }
    if (walletsResult.status === "fulfilled") {
      setWallets(walletsResult.value);
    }

    const firstRejected = results.find((result) => result.status === "rejected");
    if (firstRejected?.status === "rejected") {
      const apiError = firstRejected.reason as ApiError;
      setError(apiError.message);
    }

    setIsLoading(false);
  }, []);

  const loadOperationsPage = useCallback(async (offset: number) => {
    setIsOperationsLoading(true);

    try {
      const result = await listOperacoesAcoes({ limit: OPERATIONS_PAGE_SIZE, offset });
      setOperations(result);
      setOperationsOffset(result.offset);
    } catch (err) {
      const apiError = err as ApiError;
      setError(apiError.message);
    } finally {
      setIsOperationsLoading(false);
    }
  }, []);

  const loadSecondaryData = useCallback(async () => {
    setIsSecondaryLoading(true);

    const results = await Promise.allSettled([listResultadoVendas(), listTickers(), consultarUltimaImportacaoB3()]);
    const [salesResultData, tickersResult, b3ImportResult] = results;

    if (salesResultData.status === "fulfilled") {
      setSalesResult(salesResultData.value);
    }
    if (tickersResult.status === "fulfilled") {
      setTickers(tickersResult.value);
    }
    if (b3ImportResult.status === "fulfilled") {
      setB3Import(b3ImportResult.value);
      setB3Distribution(
        Object.fromEntries(b3ImportResult.value.itens.map((item) => [item.linha, item.carteiraId ?? ""])),
      );
    }

    const firstRejected = results.slice(0, 2).find((result) => result.status === "rejected");
    if (firstRejected?.status === "rejected") {
      const apiError = firstRejected.reason as ApiError;
      setError(apiError.message);
    }

    setIsSecondaryLoading(false);
  }, []);

  const loadData = useCallback(async () => {
    setOperationsOffset(0);
    await loadPrimaryData();
    await Promise.all([loadOperationsPage(0), loadSecondaryData()]);
  }, [loadOperationsPage, loadPrimaryData, loadSecondaryData]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const topPerformance = useMemo(() => {
    return [...(performance?.items ?? [])].sort((a, b) => b.valorInvestido - a.valorInvestido).slice(0, 8);
  }, [performance]);

  const operationsStart = operations && operations.totalOperacoes > 0 ? operations.offset + 1 : 0;
  const operationsEnd = operations ? operations.offset + operations.items.length : 0;
  const previousOperationsOffset = Math.max((operations?.offset ?? 0) - OPERATIONS_PAGE_SIZE, 0);
  const canGoToPreviousOperations = Boolean(operations && operations.offset > 0 && !isOperationsLoading);
  const canGoToNextOperations = Boolean(operations?.hasNextPage && !isOperationsLoading);

  function handleOperationsPageChange(offset: number) {
    setError(null);
    void loadOperationsPage(offset);
  }

  async function handleOperationSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setNotice(null);
    setError(null);

    try {
      const payload = toOperacaoPayload(operationForm);
      if (operationMode === "compra") {
        await registrarCompra(payload);
        setNotice(`Compra de ${payload.ticker} registrada.`);
      } else {
        await registrarVenda(payload);
        setNotice(`Venda de ${payload.ticker} registrada.`);
      }
      setOperationForm(emptyForm);
      await loadData();
    } catch (err) {
      const message = err instanceof Error ? err.message : (err as ApiError).message;
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleBatchSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setNotice(null);
    setError(null);

    try {
      const payload = parseOperacoesLote(batchText);
      if (batchMode === "compra") {
        const result = await registrarComprasLote(payload);
        setNotice(`${result.totalCompras} compras registradas no lote.`);
      } else {
        const result = await registrarVendasLote(payload);
        setNotice(`${result.totalVendas} vendas registradas no lote.`);
      }
      setBatchText("");
      await loadData();
    } catch (err) {
      const message = err instanceof Error ? err.message : (err as ApiError).message;
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleLookup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice(null);
    setError(null);

    try {
      const result = await getAcaoByTicker(lookupTicker.trim().toUpperCase());
      setSelectedPosition(result);
    } catch (err) {
      const apiError = err as ApiError;
      setSelectedPosition(null);
      setError(apiError.message);
    }
  }

  async function handleBatchFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      setBatchFileName("");
      return;
    }

    setError(null);
    setNotice(null);
    setBatchImportLog([`Enviando ${file.name} para revisao no backend...`]);
    setIsImportingB3File(true);

    try {
      const imported = await importarB3Arquivo(file);
      setBatchFileName(file.name);
      setB3Import(imported);
      setB3Distribution(Object.fromEntries(imported.itens.map((item) => [item.linha, item.carteiraId ?? ""])));
      setBatchImportLog([
        `Arquivo ${file.name} revisado pelo backend.`,
        `${imported.totalLinhas} operacoes encontradas: ${imported.totalCompras} compras e ${imported.totalVendas} vendas.`,
        imported.totalErros > 0
          ? `${imported.totalErros} itens precisam de correcao antes da distribuicao.`
          : "Revisao pronta para distribuicao.",
      ]);
    } catch (err) {
      const message = err instanceof Error ? err.message : (err as ApiError).message;
      setBatchFileName("");
      setB3Import(null);
      setB3Distribution({});
      setBatchImportLog([`Falha ao importar ${file.name}.`]);
      setError(message);
    } finally {
      setIsImportingB3File(false);
      event.target.value = "";
    }
  }

  async function handleBatchFileImport() {
    if (!b3Import) {
      setError("Importe um arquivo da B3 antes de distribuir.");
      return;
    }
    if (b3Import.totalErros > 0) {
      setError("Corrija os itens invalidos antes de distribuir a importacao.");
      return;
    }
    if (b3Import.status === "DISTRIBUIDA") {
      setError("Esta importacao ja foi distribuida.");
      return;
    }

    setIsSubmitting(true);
    setNotice(null);
    setError(null);
    setBatchImportLog([`Distribuindo ${(b3Import.nomeArquivo ?? batchFileName) || "arquivo da B3"}...`]);

    try {
      const distributed = await distribuirUltimaImportacaoB3({
        aplicarProjecoes: true,
        itens: b3Import.itens.map((item) => ({
          linha: item.linha,
          carteiraId: b3Distribution[item.linha] || null,
        })),
      });
      setB3Import(distributed);
      setB3Distribution(Object.fromEntries(distributed.itens.map((item) => [item.linha, item.carteiraId ?? ""])));
      setBatchImportLog((current) => [
        ...current,
        `Concluido: ${distributed.totalCompras} compras e ${distributed.totalVendas} vendas distribuidas.`,
        "Atualizando dados da tela...",
      ]);
      setNotice(`${distributed.totalCompras} compras e ${distributed.totalVendas} vendas importadas do arquivo da B3.`);
      await loadData();
    } catch (err) {
      const message = err instanceof Error ? err.message : (err as ApiError).message;
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AppShell title="Acoes" subtitle="Registre operacoes, acompanhe posicoes e veja o resultado dos ativos.">
      {notice ? <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{notice}</p> : null}
      {error ? <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
      {isLoading ? <LoadingPanel message="Carregando resumo e posicoes..." /> : null}

      <section className="grid gap-4 md:grid-cols-4">
        <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Investido</p>
          <p className="mt-3 text-2xl font-semibold">{formatCurrency(performance?.valorInvestidoTotal)}</p>
        </article>
        <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Valor atual</p>
          <p className="mt-3 text-2xl font-semibold">{formatCurrency(performance?.valorAtualTotal)}</p>
        </article>
        <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Resultado</p>
          <p className={`mt-3 text-2xl font-semibold ${metricTone(performance?.variacaoAbsolutaTotal)}`}>
            {formatCurrency(performance?.variacaoAbsolutaTotal)}
          </p>
        </article>
        <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Ativos</p>
          <p className="mt-3 text-2xl font-semibold">{positions?.totalAtivos ?? 0}</p>
        </article>
      </section>

      <section className="grid gap-5 xl:grid-cols-[390px_1fr]">
        <div className="space-y-5">
          <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex rounded-md border border-slate-200 bg-slate-50 p-1 text-sm">
              {(["compra", "venda"] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  className={`flex-1 rounded px-3 py-2 font-semibold ${
                    operationMode === mode ? "bg-white text-blue-700 shadow-sm" : "text-slate-600"
                  }`}
                  onClick={() => setOperationMode(mode)}
                >
                  {mode === "compra" ? "Compra" : "Venda"}
                </button>
              ))}
            </div>

            <form className="mt-5 space-y-4" onSubmit={handleOperationSubmit}>
              <Field
                label="Ticker"
                value={operationForm.ticker}
                placeholder="PETR4"
                onChange={(value) => setOperationForm((current) => ({ ...current, ticker: value }))}
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  label="Quantidade"
                  value={operationForm.quantidade}
                  type="number"
                  placeholder="100"
                  onChange={(value) => setOperationForm((current) => ({ ...current, quantidade: value }))}
                />
                <Field
                  label="Valor unitario"
                  value={operationForm.valorUnitario}
                  type="number"
                  placeholder="29.50"
                  onChange={(value) => setOperationForm((current) => ({ ...current, valorUnitario: value }))}
                />
              </div>
              <Field
                label="Data da operacao"
                value={operationForm.dataOperacao}
                type="datetime-local"
                onChange={(value) => setOperationForm((current) => ({ ...current, dataOperacao: value }))}
              />
              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-semibold text-slate-800">Carteira</span>
                <select
                  value={operationForm.carteiraId}
                  onChange={(event) => setOperationForm((current) => ({ ...current, carteiraId: event.target.value }))}
                  className="rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
                >
                  <option value="">Avulsa</option>
                  {wallets?.items.map((wallet) => (
                    <option key={wallet.id} value={wallet.id}>
                      {wallet.nome}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full rounded-md bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-800 disabled:opacity-70"
              >
                {isSubmitting ? "Registrando..." : operationMode === "compra" ? "Registrar compra" : "Registrar venda"}
              </button>
            </form>
          </article>

          <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold">Lote manual</h2>
            <p className="mt-1 text-sm text-slate-600">Uma operacao por linha: TICKER,QUANTIDADE,VALOR,DATA opcional.</p>
            <form className="mt-4 space-y-4" onSubmit={handleBatchSubmit}>
              <div className="flex rounded-md border border-slate-200 bg-slate-50 p-1 text-sm">
                {(["compra", "venda"] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    className={`flex-1 rounded px-3 py-2 font-semibold ${
                      batchMode === mode ? "bg-white text-blue-700 shadow-sm" : "text-slate-600"
                    }`}
                    onClick={() => setBatchMode(mode)}
                  >
                    {mode === "compra" ? "Compras" : "Vendas"}
                  </button>
                ))}
              </div>
              <textarea
                value={batchText}
                onChange={(event) => setBatchText(event.target.value)}
                rows={5}
                placeholder={"PETR4,10,29.50\nVALE3,5,58.10"}
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition placeholder:text-slate-400 focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
              />
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full rounded-md border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-70"
              >
                {isSubmitting ? "Registrando lote..." : "Registrar lote"}
              </button>
            </form>

            <div className="mt-6 border-t border-slate-200 pt-5">
              <h3 className="text-base font-semibold text-slate-900">Arquivo da B3</h3>
              <p className="mt-1 text-sm text-slate-600">
                Envie o XLSX para revisao no backend, confira as linhas e distribua entre carteiras antes de persistir.
              </p>
              <div className="mt-4 space-y-4">
                <label className="flex flex-col gap-1.5">
                  <span className="text-sm font-semibold text-slate-800">Arquivo XLSX</span>
                  <input
                    type="file"
                    accept=".xlsx"
                    disabled={isSubmitting || isImportingB3File}
                    onChange={(event) => void handleBatchFileChange(event)}
                    className="rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-slate-700 hover:file:bg-slate-200 disabled:opacity-70"
                  />
                </label>

                {b3Import ? (
                  <div className="rounded-md border border-slate-200 bg-slate-50 p-4 text-sm">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <p className="font-semibold text-slate-900">
                        {(b3Import.nomeArquivo ?? batchFileName) || "Ultima importacao B3"}
                      </p>
                      <span className="w-fit rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-slate-700">
                        {b3Import.status === "DISTRIBUIDA" ? "Distribuida" : "Em revisao"}
                      </span>
                    </div>
                    <p className="mt-1 text-slate-600">
                      {b3Import.totalLinhas} operacoes encontradas: {b3Import.totalCompras} compras e{" "}
                      {b3Import.totalVendas} vendas.
                    </p>
                    {b3Import.totalErros > 0 ? (
                      <p className="mt-2 text-red-700">{b3Import.totalErros} itens contem erro e impedem a distribuicao.</p>
                    ) : null}
                  </div>
                ) : (
                  <p className="text-sm text-slate-500">Selecione um arquivo como `negociacao-2026-04-27-18-00-18.xlsx`.</p>
                )}

                {b3Import ? (
                  <div className="max-h-[360px] overflow-auto rounded-md border border-slate-200">
                    <table className="min-w-full text-left text-xs">
                      <thead className="sticky top-0 bg-slate-50 uppercase tracking-wide text-slate-500">
                        <tr>
                          <th className="px-3 py-2">Linha</th>
                          <th className="px-3 py-2">Tipo</th>
                          <th className="px-3 py-2">Ticker</th>
                          <th className="px-3 py-2">Qtd.</th>
                          <th className="px-3 py-2">Valor</th>
                          <th className="px-3 py-2">Carteira</th>
                          <th className="px-3 py-2">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                        {b3Import.itens.map((item) => (
                          <tr key={item.linha}>
                            <td className="px-3 py-2">{item.linha}</td>
                            <td className="px-3 py-2 font-semibold">{item.tipoOperacao === "COMPRA" ? "Compra" : "Venda"}</td>
                            <td className="px-3 py-2 font-semibold">{item.ticker}</td>
                            <td className="px-3 py-2">{formatQuantity(item.quantidade)}</td>
                            <td className="px-3 py-2">{formatCurrency(item.valorTotal)}</td>
                            <td className="px-3 py-2">
                              <select
                                value={b3Distribution[item.linha] ?? item.carteiraId ?? ""}
                                disabled={b3Import.status === "DISTRIBUIDA"}
                                onChange={(event) =>
                                  setB3Distribution((current) => ({ ...current, [item.linha]: event.target.value }))
                                }
                                className="min-w-36 rounded border border-slate-300 bg-white px-2 py-1.5 text-xs outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 disabled:opacity-70"
                              >
                                <option value="">Avulsa/automatica</option>
                                {wallets?.items.map((wallet) => (
                                  <option key={wallet.id} value={wallet.id}>
                                    {wallet.nome}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td className="px-3 py-2">
                              <span
                                className={`rounded-full px-2 py-1 text-xs font-semibold ${
                                  item.status === "VALIDO"
                                    ? "bg-emerald-50 text-emerald-700"
                                    : "bg-red-50 text-red-700"
                                }`}
                              >
                                {item.status === "VALIDO" ? "Valido" : "Erro"}
                              </span>
                              {[...item.avisos, ...item.erros].length > 0 ? (
                                <p className="mt-1 max-w-56 text-[11px] leading-4 text-slate-500">
                                  {[...item.avisos, ...item.erros].join(" ")}
                                </p>
                              ) : null}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : null}

                <ProgressLog items={batchImportLog} />

                <button
                  type="button"
                  disabled={isSubmitting || isImportingB3File || !b3Import || b3Import.status === "DISTRIBUIDA"}
                  onClick={() => void handleBatchFileImport()}
                  className="w-full rounded-md bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-70"
                >
                  {isSubmitting
                    ? "Distribuindo importacao..."
                    : isImportingB3File
                      ? "Enviando arquivo..."
                      : "Distribuir e registrar importacao"}
                </button>
              </div>
            </div>
          </article>
        </div>

        <div className="space-y-5">
          <article className="rounded-lg border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-col gap-3 border-b border-slate-200 p-5 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-lg font-semibold">Posicoes</h2>
                <p className="mt-1 text-sm text-slate-600">Quantidade, preco medio, cotacao e variacao por ativo.</p>
              </div>
              <button
                type="button"
                className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                onClick={() => void loadData()}
              >
                {isLoading || isOperationsLoading || isSecondaryLoading ? "Atualizando..." : "Atualizar"}
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-5 py-3">Ticker</th>
                    <th className="px-5 py-3">Qtd.</th>
                    <th className="px-5 py-3">Preco medio</th>
                    <th className="px-5 py-3">Cotacao</th>
                    <th className="px-5 py-3">Investido</th>
                    <th className="px-5 py-3">Valor atual</th>
                    <th className="px-5 py-3">Variacao</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {positions?.items.map((item) => (
                    <tr key={item.ticker}>
                      <td className="px-5 py-3 font-semibold">{item.ticker}</td>
                      <td className="px-5 py-3">{formatQuantity(item.quantidade)}</td>
                      <td className="px-5 py-3">{formatCurrency(item.precoMedio)}</td>
                      <td className="px-5 py-3 font-semibold">{formatCurrency(item.cotacaoAtual)}</td>
                      <td className="px-5 py-3">{formatCurrency(item.valorInvestido)}</td>
                      <td className="px-5 py-3">{formatCurrency(item.valorAtual)}</td>
                      <td className={`px-5 py-3 font-semibold ${metricTone(item.variacaoAbsoluta)}`}>
                        {formatPercent(item.variacaoPercentual)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!isLoading && (positions?.items.length ?? 0) === 0 ? (
                <EmptyState message="Nenhuma posicao ativa. Registre uma compra para iniciar o acompanhamento." />
              ) : null}
            </div>
          </article>

          <section className="grid gap-5 lg:grid-cols-2">
            <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-semibold">Consultar ticker</h2>
              <form className="mt-4 flex gap-2" onSubmit={handleLookup}>
                <input
                  value={lookupTicker}
                  onChange={(event) => setLookupTicker(event.target.value)}
                  placeholder="PETR4"
                  className="min-w-0 flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
                />
                <button className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white" type="submit">
                  Buscar
                </button>
              </form>
              {selectedPosition ? (
                <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-slate-500">Quantidade</p>
                    <p className="font-semibold">{formatQuantity(selectedPosition.quantidade)}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">Preco medio</p>
                    <p className="font-semibold">{formatCurrency(selectedPosition.precoMedio)}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">Investido</p>
                    <p className="font-semibold">{formatCurrency(selectedPosition.valorInvestido)}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">Variacao</p>
                    <p className={`font-semibold ${metricTone(selectedPosition.variacaoAbsoluta)}`}>
                      {formatPercent(selectedPosition.variacaoPercentual)}
                    </p>
                  </div>
                </div>
              ) : null}
            </article>

            <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-semibold">Acoes avulsas</h2>
              <p className="mt-1 text-sm text-slate-600">Posicoes ainda sem carteira vinculada.</p>
              <p className="mt-5 text-3xl font-semibold">{loosePositions?.totalAtivos ?? 0}</p>
              <p className="mt-1 text-sm text-slate-500">ativos avulsos</p>
            </article>
          </section>

          <article className="rounded-lg border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 p-5">
              <h2 className="text-lg font-semibold">Performance por ativo</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-5 py-3">Ticker</th>
                    <th className="px-5 py-3">Cotacao ref.</th>
                    <th className="px-5 py-3">Valor atual</th>
                    <th className="px-5 py-3">Resultado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {topPerformance.map((item) => (
                    <tr key={item.ticker}>
                      <td className="px-5 py-3 font-semibold">{item.ticker}</td>
                      <td className="px-5 py-3">{formatCurrency(item.precoReferencia)}</td>
                      <td className="px-5 py-3">{formatCurrency(item.valorAtual)}</td>
                      <td className={`px-5 py-3 font-semibold ${metricTone(item.variacaoAbsoluta)}`}>
                        {formatCurrency(item.variacaoAbsoluta)} ({formatPercent(item.variacaoPercentual)})
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!isLoading && topPerformance.length === 0 ? <EmptyState message="Sem dados de performance." /> : null}
            </div>
          </article>
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[1fr_360px]">
        <article className="rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-slate-200 p-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-lg font-semibold">Historico de operacoes</h2>
              <p className="mt-1 text-sm text-slate-600">
                {operations
                  ? `${operationsStart}-${operationsEnd} de ${operations.totalOperacoes} operacoes`
                  : "Historico carregado em paginas."}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={!canGoToPreviousOperations}
                onClick={() => handleOperationsPageChange(previousOperationsOffset)}
                className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Anterior
              </button>
              <button
                type="button"
                disabled={!canGoToNextOperations}
                onClick={() => handleOperationsPageChange(operations?.nextOffset ?? operationsOffset + OPERATIONS_PAGE_SIZE)}
                className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Proxima
              </button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-3">Data</th>
                  <th className="px-5 py-3">Tipo</th>
                  <th className="px-5 py-3">Ticker</th>
                  <th className="px-5 py-3">Qtd.</th>
                  <th className="px-5 py-3">Valor</th>
                  <th className="px-5 py-3">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {operations?.items.map((item) => (
                  <tr key={item.id}>
                    <td className="px-5 py-3">{formatDate(item.dataOperacao)}</td>
                    <td className="px-5 py-3">
                      <span
                        className={`rounded px-2 py-1 text-xs font-semibold ${
                          item.tipoOperacao === "COMPRA" ? "bg-blue-50 text-blue-700" : "bg-amber-50 text-amber-700"
                        }`}
                      >
                        {item.tipoOperacao}
                      </span>
                    </td>
                    <td className="px-5 py-3 font-semibold">{item.ticker}</td>
                    <td className="px-5 py-3">{formatQuantity(item.quantidade)}</td>
                    <td className="px-5 py-3">{formatCurrency(item.valorUnitario)}</td>
                    <td className="px-5 py-3">{formatCurrency(item.valorTotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {isOperationsLoading ? <EmptyState message="Carregando pagina do historico..." /> : null}
            {!isOperationsLoading && (operations?.items.length ?? 0) === 0 ? (
              <EmptyState message="Nenhuma operacao registrada." />
            ) : null}
          </div>
        </article>

        <aside className="space-y-5">
          <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold">Resultado das vendas</h2>
            <p className={`mt-4 text-3xl font-semibold ${metricTone(salesResult?.ganhoPerdaTotal)}`}>
              {formatCurrency(salesResult?.ganhoPerdaTotal)}
            </p>
            <p className="mt-1 text-sm text-slate-500">{salesResult?.totalVendas ?? 0} vendas registradas</p>
            {isSecondaryLoading && !salesResult ? (
              <p className="mt-3 text-sm text-slate-500">Carregando resultados...</p>
            ) : null}
          </article>

          <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold">Tickers cadastrados</h2>
            <div className="mt-4 flex flex-wrap gap-2">
              {tickers?.items.slice(0, 18).map((item) => (
                <span key={item.id} className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-700">
                  {item.ticker}
                  {typeof item.ultimaCotacao === "number" ? ` ${formatNumber(item.ultimaCotacao)}` : ""}
                </span>
              ))}
              {isSecondaryLoading && !tickers ? <p className="text-sm text-slate-500">Carregando tickers...</p> : null}
              {!isSecondaryLoading && (tickers?.items.length ?? 0) === 0 ? (
                <p className="text-sm text-slate-500">Nenhum ticker cadastrado.</p>
              ) : null}
            </div>
          </article>
        </aside>
      </section>
    </AppShell>
  );
}
