"use client";

import { type ChangeEvent, type FormEvent, useEffect, useMemo, useState } from "react";
import { AppShell, LoadingPanel, ProgressLog } from "@/components/layout/AppShell";
import type {
  ApiError,
  EventoCorporativo,
  ListarCarteirasResponse,
  ListarAcoesResponse,
  ListarEventosCorporativosResponse,
  ListarTickersResponse,
  OperacaoAcaoPayload,
  OperacoesAcoesResponse,
  PerformanceAcoesResponse,
  PosicaoAcao,
  ResultadoVendasResponse,
} from "@/lib/api";
import {
  getAcaoByTicker,
  getPerformanceAcoes,
  listAcoes,
  listAcoesAvulsas,
  listCarteiras,
  listEventosCorporativos,
  listOperacoesAcoes,
  listResultadoVendas,
  listTickers,
  registrarCompra,
  registrarComprasLote,
  registrarVenda,
  registrarVendasLote,
} from "@/lib/api";
import { parseB3NegociacaoFile, type B3BatchOperation, type B3BatchParseResult } from "@/lib/b3-negociacao";

type OperationForm = {
  ticker: string;
  quantidade: string;
  valorUnitario: string;
  dataOperacao: string;
  carteiraId: string;
};

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

function toPayload(form: OperationForm): OperacaoAcaoPayload {
  const ticker = form.ticker.trim().toUpperCase();
  const quantidade = Number(form.quantidade);
  const valorUnitario = Number(form.valorUnitario);

  if (!ticker) {
    throw new Error("Informe o ticker.");
  }
  if (!Number.isInteger(quantidade) || quantidade <= 0) {
    throw new Error("A quantidade deve ser um inteiro maior que zero.");
  }
  if (!Number.isFinite(valorUnitario) || valorUnitario <= 0) {
    throw new Error("O valor unitario deve ser maior que zero.");
  }

  return {
    ticker,
    quantidade,
    valorUnitario,
    ...(form.dataOperacao ? { dataOperacao: new Date(form.dataOperacao).toISOString() } : {}),
    ...(form.carteiraId ? { carteiraId: form.carteiraId } : {}),
  };
}

function parseBatchInput(value: string): OperacaoAcaoPayload[] {
  const rows = value
    .split("\n")
    .map((row) => row.trim())
    .filter(Boolean);

  if (rows.length === 0) {
    throw new Error("Informe ao menos uma linha no lote.");
  }

  return rows.map((row, index) => {
    const [tickerRaw, quantidadeRaw, valorRaw, dataRaw] = row.split(",").map((part) => part.trim());
    const payload = toPayload({
      ticker: tickerRaw ?? "",
      quantidade: quantidadeRaw ?? "",
      valorUnitario: valorRaw ?? "",
      dataOperacao: dataRaw ?? "",
      carteiraId: "",
    });

    if (!tickerRaw || !quantidadeRaw || !valorRaw) {
      throw new Error(`Linha ${index + 1}: use TICKER,QUANTIDADE,VALOR.`);
    }

    return payload;
  });
}

function chunkImportedOperations(operations: B3BatchOperation[], maxSize = 100) {
  const groups: Array<{ mode: ActionMode; payloads: OperacaoAcaoPayload[] }> = [];

  for (const operation of operations) {
    const currentGroup = groups[groups.length - 1];
    if (currentGroup && currentGroup.mode === operation.mode && currentGroup.payloads.length < maxSize) {
      currentGroup.payloads.push(operation.payload);
      continue;
    }

    groups.push({
      mode: operation.mode,
      payloads: [operation.payload],
    });
  }

  return groups;
}

function buildTickerChangeMap(corporateEvents: EventoCorporativo[]) {
  const changes = corporateEvents
    .filter((event) => event.tipo === "ALTERACAO_TICKER" && event.tickerDestino)
    .sort((left, right) => new Date(left.dataEvento).getTime() - new Date(right.dataEvento).getTime());
  const tickerChangeMap = new Map<string, string>();

  for (const event of changes) {
    tickerChangeMap.set(event.ticker, event.tickerDestino ?? event.ticker);
  }

  return tickerChangeMap;
}

function getCanonicalTicker(ticker: string, tickerChangeMap: Map<string, string>) {
  let current = ticker.trim().toUpperCase();
  const visited = new Set<string>();

  while (tickerChangeMap.has(current) && !visited.has(current)) {
    visited.add(current);
    current = tickerChangeMap.get(current) ?? current;
  }

  return current;
}

function normalizeImportedOperationTickers(
  operations: B3BatchOperation[],
  corporateEvents: EventoCorporativo[],
): B3BatchOperation[] {
  const tickerChangeMap = buildTickerChangeMap(corporateEvents);

  if (tickerChangeMap.size === 0) {
    return operations;
  }

  return operations.map((operation) => ({
    ...operation,
    payload: {
      ...operation.payload,
      ticker: getCanonicalTicker(operation.payload.ticker, tickerChangeMap),
    },
  }));
}

function validateImportedOperationBalances(
  operations: B3BatchOperation[],
  currentLoosePositions: PosicaoAcao[],
  corporateEvents: EventoCorporativo[],
) {
  const tickerChangeMap = buildTickerChangeMap(corporateEvents);
  const balances = new Map<string, number>();
  const eventsByTicker = new Map<string, EventoCorporativo[]>();
  const nextEventIndexByTicker = new Map<string, number>();

  for (const position of currentLoosePositions) {
    const ticker = getCanonicalTicker(position.ticker, tickerChangeMap);
    balances.set(ticker, (balances.get(ticker) ?? 0) + position.quantidade);
  }

  for (const event of corporateEvents) {
    if (event.tipo === "ALTERACAO_TICKER") {
      continue;
    }

    const eventTicker = getCanonicalTicker(event.ticker, tickerChangeMap);
    const events = eventsByTicker.get(eventTicker) ?? [];
    events.push(event);
    eventsByTicker.set(eventTicker, events);
  }

  for (const events of eventsByTicker.values()) {
    events.sort((left, right) => new Date(left.dataEvento).getTime() - new Date(right.dataEvento).getTime());
  }

  for (const operation of operations) {
    const ticker = getCanonicalTicker(operation.payload.ticker, tickerChangeMap);
    const events = eventsByTicker.get(ticker) ?? [];
    let nextEventIndex = nextEventIndexByTicker.get(ticker) ?? 0;
    const operationTime = new Date(operation.payload.dataOperacao ?? 0).getTime();

    while (nextEventIndex < events.length && new Date(events[nextEventIndex].dataEvento).getTime() <= operationTime) {
      const currentBalance = balances.get(ticker) ?? 0;
      balances.set(ticker, Number((currentBalance * events[nextEventIndex].fatorQuantidade).toFixed(8)));
      nextEventIndex += 1;
    }
    nextEventIndexByTicker.set(ticker, nextEventIndex);

    const currentBalance = balances.get(ticker) ?? 0;

    if (operation.mode === "compra") {
      balances.set(ticker, currentBalance + operation.payload.quantidade);
      continue;
    }

    if (operation.payload.quantidade > currentBalance) {
      throw new Error(
        `Linha ${operation.sourceRow}: venda de ${operation.payload.quantidade} ${ticker} excede o saldo avulso disponivel (${currentBalance}). Importe primeiro as compras anteriores desse ticker ou use um arquivo que comece antes da primeira venda. Nenhuma operacao do arquivo foi enviada.`,
      );
    }

    balances.set(ticker, currentBalance - operation.payload.quantidade);
  }
}

function metricTone(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value) || value === 0) {
    return "text-slate-900";
  }

  return value < 0 ? "text-red-700" : "text-emerald-700";
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
  const [corporateEvents, setCorporateEvents] = useState<ListarEventosCorporativosResponse | null>(null);
  const [wallets, setWallets] = useState<ListarCarteirasResponse | null>(null);
  const [selectedPosition, setSelectedPosition] = useState<PosicaoAcao | null>(null);
  const [lookupTicker, setLookupTicker] = useState("");
  const [operationMode, setOperationMode] = useState<ActionMode>("compra");
  const [operationForm, setOperationForm] = useState<OperationForm>(emptyForm);
  const [batchMode, setBatchMode] = useState<ActionMode>("compra");
  const [batchText, setBatchText] = useState("");
  const [batchFileSummary, setBatchFileSummary] = useState<B3BatchParseResult | null>(null);
  const [batchFileName, setBatchFileName] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isParsingBatchFile, setIsParsingBatchFile] = useState(false);
  const [batchImportLog, setBatchImportLog] = useState<string[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loadData() {
    setIsLoading(true);
    setError(null);

    const results = await Promise.allSettled([
        listAcoes(),
        listAcoesAvulsas(),
        getPerformanceAcoes(),
        listOperacoesAcoes(),
        listResultadoVendas(),
        listTickers(),
        listEventosCorporativos(),
        listCarteiras(),
      ]);

    const [
      positionsResult,
      looseResult,
      performanceResult,
      operationsResult,
      salesResultData,
      tickersResult,
      corporateEventsResult,
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
    if (operationsResult.status === "fulfilled") {
      setOperations(operationsResult.value);
    }
    if (salesResultData.status === "fulfilled") {
      setSalesResult(salesResultData.value);
    }
    if (tickersResult.status === "fulfilled") {
      setTickers(tickersResult.value);
    }
    if (corporateEventsResult.status === "fulfilled") {
      setCorporateEvents(corporateEventsResult.value);
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
  }

  useEffect(() => {
    void loadData();
  }, []);

  const topPerformance = useMemo(() => {
    return [...(performance?.items ?? [])].sort((a, b) => b.valorInvestido - a.valorInvestido).slice(0, 8);
  }, [performance]);

  async function handleOperationSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setNotice(null);
    setError(null);

    try {
      const payload = toPayload(operationForm);
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
      const payload = parseBatchInput(batchText);
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
      setBatchFileSummary(null);
      return;
    }

    setError(null);
    setNotice(null);
    setBatchImportLog([`Lendo ${file.name}...`]);
    setIsParsingBatchFile(true);

    try {
      const parsed = await parseB3NegociacaoFile(file);
      setBatchFileName(file.name);
      setBatchFileSummary(parsed);
      setBatchMode(parsed.totalCompras >= parsed.totalVendas ? "compra" : "venda");
      setBatchImportLog([
        `Arquivo ${file.name} lido.`,
        `${parsed.totalRows} operacoes encontradas: ${parsed.totalCompras} compras e ${parsed.totalVendas} vendas.`,
      ]);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Falha ao ler o arquivo da B3.";
      setBatchFileName("");
      setBatchFileSummary(null);
      setBatchImportLog([`Falha ao ler ${file.name}.`]);
      setError(message);
    } finally {
      setIsParsingBatchFile(false);
      event.target.value = "";
    }
  }

  async function handleBatchFileImport() {
    if (!batchFileSummary) {
      setError("Selecione um arquivo da B3 antes de importar.");
      return;
    }

    setIsSubmitting(true);
    setNotice(null);
    setError(null);
    setBatchImportLog([`Iniciando importacao de ${batchFileName || "arquivo da B3"}...`]);

    try {
      setBatchImportLog((current) => [...current, "Normalizando tickers por eventos corporativos cadastrados..."]);
      const normalizedOperations = normalizeImportedOperationTickers(
        batchFileSummary.operations,
        corporateEvents?.items ?? [],
      );
      setBatchImportLog((current) => [...current, "Validando saldo cronologico das operacoes..."]);
      validateImportedOperationBalances(
        normalizedOperations,
        loosePositions?.items ?? [],
        corporateEvents?.items ?? [],
      );
      const groups = chunkImportedOperations(normalizedOperations);
      let totalCompras = 0;
      let totalVendas = 0;

      for (const [index, group] of groups.entries()) {
        setBatchImportLog((current) => [
          ...current,
          `Enviando lote ${index + 1}/${groups.length}: ${group.payloads.length} ${group.mode === "compra" ? "compras" : "vendas"}...`,
        ]);
        if (group.mode === "compra") {
          const result = await registrarComprasLote(group.payloads);
          totalCompras += result.totalCompras;
          continue;
        }

        const result = await registrarVendasLote(group.payloads);
        totalVendas += result.totalVendas;
      }

      setBatchFileName("");
      setBatchFileSummary(null);
      setBatchImportLog((current) => [
        ...current,
        `Concluido: ${totalCompras} compras e ${totalVendas} vendas importadas.`,
        "Atualizando dados da tela...",
      ]);
      setNotice(`${totalCompras} compras e ${totalVendas} vendas importadas do arquivo da B3.`);
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
      {isLoading ? <LoadingPanel message="Carregando posicoes, operacoes e cotacoes..." /> : null}

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
                Leia o XLSX de negociacao da B3 e registre compras e vendas na ordem cronologica.
              </p>
              <div className="mt-4 space-y-4">
                <label className="flex flex-col gap-1.5">
                  <span className="text-sm font-semibold text-slate-800">Arquivo XLSX</span>
                  <input
                    type="file"
                    accept=".xlsx"
                    disabled={isSubmitting || isParsingBatchFile}
                    onChange={(event) => void handleBatchFileChange(event)}
                    className="rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-slate-700 hover:file:bg-slate-200 disabled:opacity-70"
                  />
                </label>

                {batchFileSummary ? (
                  <div className="rounded-md border border-slate-200 bg-slate-50 p-4 text-sm">
                    <p className="font-semibold text-slate-900">{batchFileName}</p>
                    <p className="mt-1 text-slate-600">
                      {batchFileSummary.totalRows} operacoes encontradas: {batchFileSummary.totalCompras} compras e{" "}
                      {batchFileSummary.totalVendas} vendas.
                    </p>
                  </div>
                ) : (
                  <p className="text-sm text-slate-500">Selecione um arquivo como `negociacao-2026-04-27-18-00-18.xlsx`.</p>
                )}

                <ProgressLog items={batchImportLog} />

                <button
                  type="button"
                  disabled={isSubmitting || isParsingBatchFile || !batchFileSummary}
                  onClick={() => void handleBatchFileImport()}
                  className="w-full rounded-md bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-70"
                >
                  {isSubmitting ? "Importando arquivo..." : isParsingBatchFile ? "Lendo arquivo..." : "Importar arquivo da B3"}
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
                Atualizar
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
          <div className="border-b border-slate-200 p-5">
            <h2 className="text-lg font-semibold">Historico de operacoes</h2>
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
                {operations?.items.slice(0, 12).map((item) => (
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
            {!isLoading && (operations?.items.length ?? 0) === 0 ? <EmptyState message="Nenhuma operacao registrada." /> : null}
          </div>
        </article>

        <aside className="space-y-5">
          <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold">Resultado das vendas</h2>
            <p className={`mt-4 text-3xl font-semibold ${metricTone(salesResult?.ganhoPerdaTotal)}`}>
              {formatCurrency(salesResult?.ganhoPerdaTotal)}
            </p>
            <p className="mt-1 text-sm text-slate-500">{salesResult?.totalVendas ?? 0} vendas registradas</p>
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
              {!isLoading && (tickers?.items.length ?? 0) === 0 ? <p className="text-sm text-slate-500">Nenhum ticker cadastrado.</p> : null}
            </div>
          </article>
        </aside>
      </section>
    </AppShell>
  );
}
