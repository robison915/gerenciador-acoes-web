"use client";

import { type FormEvent, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell, LoadingPanel, ProgressLog } from "@/components/layout/AppShell";
import {
  createAdminUser,
  createEventoCorporativo,
  getMe,
  listExecucoesEventoCorporativo,
  listEventosCorporativos,
  processarEventoCorporativo,
  processarEventosCorporativos,
  updateEventoCorporativo,
  updateTickerCadastro,
} from "@/lib/api";
import type { ApiError, EventoCorporativo, EventoCorporativoExecucao } from "@/lib/api";
import {
  getEventoCorporativoKey,
  parseEventosCorporativosFile,
  type EventoCorporativoImportItem,
} from "@/lib/eventos-corporativos-import";

type EventForm = {
  ticker: string;
  tickerDestino: string;
  tipo: "DESDOBRAMENTO" | "GRUPAMENTO" | "ALTERACAO_TICKER";
  dataEvento: string;
  fatorQuantidade: string;
  fatorPreco: string;
  observacao: string;
};

const defaultEventForm: EventForm = {
  ticker: "MGLU3",
  tickerDestino: "",
  tipo: "DESDOBRAMENTO",
  dataEvento: "2020-10-15",
  fatorQuantidade: "4",
  fatorPreco: "0.25",
  observacao: "Desdobro MGLU3 - entrada de 57 acoes.",
};

type ImportItemStatus = "pendente" | "duplicado" | "importado" | "erro";

type ImportPreviewItem = EventoCorporativoImportItem & {
  status: ImportItemStatus;
  message?: string;
};

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" }).format(date);
}

function toDateInputValue(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toISOString().slice(0, 10);
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(date);
}

function eventTypeLabel(tipo: EventoCorporativo["tipo"]) {
  const labels: Record<EventoCorporativo["tipo"], string> = {
    DESDOBRAMENTO: "Desdobramento",
    GRUPAMENTO: "Grupamento",
    ALTERACAO_TICKER: "Alteracao de ticker",
  };

  return labels[tipo];
}

function toEventForm(event: EventoCorporativo): EventForm {
  return {
    ticker: event.ticker,
    tickerDestino: event.tickerDestino ?? "",
    tipo: event.tipo,
    dataEvento: toDateInputValue(event.dataEvento),
    fatorQuantidade: String(event.fatorQuantidade),
    fatorPreco: String(event.fatorPreco),
    observacao: event.observacao ?? "",
  };
}

function toEventPayload(form: EventForm) {
  const ticker = form.ticker.trim().toUpperCase();
  const tickerDestino = form.tickerDestino.trim().toUpperCase();
  const fatorQuantidade = Number(form.fatorQuantidade);
  const fatorPreco = Number(form.fatorPreco);

  if (!ticker) {
    throw new Error("Informe o ticker.");
  }
  if (!form.dataEvento) {
    throw new Error("Informe a data do evento.");
  }
  if (form.tipo === "ALTERACAO_TICKER") {
    if (!tickerDestino) {
      throw new Error("Informe o ticker destino.");
    }
    if (tickerDestino === ticker) {
      throw new Error("Ticker destino deve ser diferente do ticker de origem.");
    }
  }
  if (!Number.isFinite(fatorQuantidade) || fatorQuantidade <= 0) {
    throw new Error("Fator de quantidade deve ser maior que zero.");
  }
  if (!Number.isFinite(fatorPreco) || fatorPreco <= 0) {
    throw new Error("Fator de preco deve ser maior que zero.");
  }

  return {
    ticker,
    ...(form.tipo === "ALTERACAO_TICKER" ? { tickerDestino } : {}),
    tipo: form.tipo,
    dataEvento: new Date(`${form.dataEvento}T00:00:00.000Z`).toISOString(),
    fatorQuantidade,
    fatorPreco,
    ...(form.observacao.trim() ? { observacao: form.observacao.trim() } : {}),
  };
}

function importStatusLabel(status: ImportItemStatus) {
  const labels: Record<ImportItemStatus, string> = {
    pendente: "Novo",
    duplicado: "Duplicado",
    importado: "Importado",
    erro: "Erro",
  };

  return labels[status];
}

function importStatusClass(status: ImportItemStatus) {
  const classes: Record<ImportItemStatus, string> = {
    pendente: "bg-blue-50 text-blue-700",
    duplicado: "bg-slate-100 text-slate-600",
    importado: "bg-emerald-50 text-emerald-700",
    erro: "bg-red-50 text-red-700",
  };

  return classes[status];
}

export default function AdminPage() {
  const router = useRouter();
  const [events, setEvents] = useState<EventoCorporativo[]>([]);
  const [eventForm, setEventForm] = useState<EventForm>(defaultEventForm);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [selectedExecutionsEventId, setSelectedExecutionsEventId] = useState<string | null>(null);
  const [eventExecutions, setEventExecutions] = useState<EventoCorporativoExecucao[]>([]);
  const [tickerForm, setTickerForm] = useState({ ticker: "", nomeEmpresa: "" });
  const [importFileName, setImportFileName] = useState("");
  const [importRows, setImportRows] = useState<ImportPreviewItem[]>([]);
  const [ignoredImportRows, setIgnoredImportRows] = useState(0);
  const [importLog, setImportLog] = useState<string[]>([]);
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isParsingImport, setIsParsingImport] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isProcessingEvents, setIsProcessingEvents] = useState(false);
  const [processingEventId, setProcessingEventId] = useState<string | null>(null);
  const [isLoadingExecutions, setIsLoadingExecutions] = useState(false);
  const [isUpdatingTicker, setIsUpdatingTicker] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const existingEventKeys = new Set(events.map((event) => getEventoCorporativoKey(event)));

  const loadAdminData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const user = await getMe();
      if (user.role !== "ADMIN") {
        router.replace("/admin/login");
        return;
      }

      const result = await listEventosCorporativos();
      setEvents(result.items);
    } catch (err) {
      const apiError = err as ApiError;
      if (apiError.status === 401 || apiError.status === 403) {
        router.replace("/admin/login");
        return;
      }
      setError(apiError.message);
    } finally {
      setIsLoading(false);
    }
  }, [router]);

  useEffect(() => {
    void loadAdminData();
  }, [loadAdminData]);

  async function handleCreateEvent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setNotice(null);
    setError(null);

    try {
      const payload = toEventPayload(eventForm);
      if (editingEventId) {
        await updateEventoCorporativo(editingEventId, payload);
        setNotice(`Evento de ${payload.ticker} atualizado.`);
      } else {
        await createEventoCorporativo(payload);
        setNotice(`Evento de ${payload.ticker} cadastrado.`);
      }
      setEditingEventId(null);
      setEventForm(defaultEventForm);
      await loadAdminData();
    } catch (err) {
      const message = err instanceof Error ? err.message : (err as ApiError).message;
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleEditEvent(event: EventoCorporativo) {
    setEditingEventId(event.id);
    setEventForm(toEventForm(event));
    setNotice(null);
    setError(null);
  }

  function handleCancelEditEvent() {
    setEditingEventId(null);
    setEventForm(defaultEventForm);
    setNotice(null);
    setError(null);
  }

  async function handleImportFile(file: File | null) {
    setNotice(null);
    setError(null);
    setImportRows([]);
    setIgnoredImportRows(0);
    setImportLog(file ? [`Lendo ${file.name}...`] : []);
    setImportFileName(file?.name ?? "");

    if (!file) {
      return;
    }

    setIsParsingImport(true);
    try {
      const result = await parseEventosCorporativosFile(file);
      const seenKeys = new Set(existingEventKeys);
      setIgnoredImportRows(result.ignoredRows);
      setImportRows(
        result.items.map((item) => {
          const itemKey = getEventoCorporativoKey(item.payload);
          const isDuplicated = seenKeys.has(itemKey);
          seenKeys.add(itemKey);

          return {
            ...item,
            status: isDuplicated ? "duplicado" : "pendente",
            message: isDuplicated ? "Ja cadastrado" : undefined,
          };
        }),
      );
      setNotice(`${result.items.length} eventos lidos de ${file.name}.`);
      setImportLog([
        `Arquivo ${file.name} lido.`,
        `${result.items.length} eventos encontrados; ${result.ignoredRows} linhas ignoradas.`,
      ]);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Nao foi possivel ler o arquivo.";
      setImportLog([`Falha ao ler ${file.name}.`]);
      setError(message);
    } finally {
      setIsParsingImport(false);
    }
  }

  async function handleImportEvents() {
    const pendingRows = importRows.filter((row) => row.status === "pendente");
    if (pendingRows.length === 0) {
      setError("Nao ha eventos novos para importar.");
      return;
    }

    setIsImporting(true);
    setNotice(null);
    setError(null);
    setImportLog((current) => [...current, `Iniciando importacao de ${pendingRows.length} eventos novos...`]);

    let importedCount = 0;
    let errorCount = 0;
    const nextRows = [...importRows];

    for (const [index, row] of pendingRows.entries()) {
      const rowIndex = nextRows.findIndex((item) => item.sourceRow === row.sourceRow);
      try {
        setImportLog((current) => [
          ...current,
          `Enviando evento ${index + 1}/${pendingRows.length}: ${row.payload.ticker}${row.payload.tickerDestino ? ` -> ${row.payload.tickerDestino}` : ""}.`,
        ]);
        await createEventoCorporativo(row.payload);
        importedCount += 1;
        nextRows[rowIndex] = {
          ...nextRows[rowIndex],
          status: "importado",
          message: "Importado",
        };
        setImportRows([...nextRows]);
      } catch (err) {
        const apiError = err as ApiError;
        const isDuplicate = apiError.status === 400 && apiError.message.toLowerCase().includes("ja cadastrado");
        if (isDuplicate) {
          nextRows[rowIndex] = {
            ...nextRows[rowIndex],
            status: "duplicado",
            message: "Ja cadastrado",
          };
        } else {
          errorCount += 1;
          nextRows[rowIndex] = {
            ...nextRows[rowIndex],
            status: "erro",
            message: apiError.message || "Falha ao importar",
          };
        }
        setImportRows([...nextRows]);
      }
    }

    await loadAdminData();
    setIsImporting(false);
    setImportLog((current) => [
      ...current,
      `Concluido: ${importedCount} eventos importados${errorCount ? `, ${errorCount} com erro` : ""}.`,
    ]);
    setNotice(`${importedCount} eventos importados${errorCount ? `, ${errorCount} com erro` : ""}.`);
  }

  async function handleProcessEvents() {
    setIsProcessingEvents(true);
    setNotice(null);
    setError(null);

    try {
      const result = await processarEventosCorporativos();
      setNotice(
        `Processamento concluido: ${result.operacoesAtualizadas} operacoes atualizadas, ${result.tickersAtualizados} tickers atualizados, ${result.tickersRemovidos} tickers removidos e ${result.tickersCriados} tickers criados.`,
      );
      await loadAdminData();
    } catch (err) {
      const message = err instanceof Error ? err.message : (err as ApiError).message;
      setError(message);
    } finally {
      setIsProcessingEvents(false);
    }
  }

  async function handleProcessSingleEvent(event: EventoCorporativo) {
    setProcessingEventId(event.id);
    setNotice(null);
    setError(null);

    try {
      const result = await processarEventoCorporativo(event.id);
      setNotice(
        `Evento ${event.ticker}${event.tickerDestino ? ` -> ${event.tickerDestino}` : ""} processado: ${result.operacoesAtualizadas} operacoes atualizadas.`,
      );
      if (selectedExecutionsEventId === event.id) {
        const execucoes = await listExecucoesEventoCorporativo(event.id);
        setEventExecutions(execucoes.items);
      }
      await loadAdminData();
    } catch (err) {
      const message = err instanceof Error ? err.message : (err as ApiError).message;
      setError(message);
    } finally {
      setProcessingEventId(null);
    }
  }

  async function handleLoadExecutions(event: EventoCorporativo) {
    setSelectedExecutionsEventId(event.id);
    setIsLoadingExecutions(true);
    setNotice(null);
    setError(null);

    try {
      const result = await listExecucoesEventoCorporativo(event.id);
      setEventExecutions(result.items);
    } catch (err) {
      const message = err instanceof Error ? err.message : (err as ApiError).message;
      setError(message);
      setEventExecutions([]);
    } finally {
      setIsLoadingExecutions(false);
    }
  }

  async function handleUpdateTicker(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const ticker = tickerForm.ticker.trim().toUpperCase();
    const nomeEmpresa = tickerForm.nomeEmpresa.trim();

    if (!ticker) {
      setError("Informe o ticker.");
      return;
    }
    if (!nomeEmpresa) {
      setError("Informe o nome da empresa.");
      return;
    }

    setIsUpdatingTicker(true);
    setNotice(null);
    setError(null);

    try {
      const result = await updateTickerCadastro(ticker, { nomeEmpresa });
      setTickerForm({ ticker: "", nomeEmpresa: "" });
      setNotice(`Cadastro de ${result.ticker} atualizado.`);
    } catch (err) {
      const message = err instanceof Error ? err.message : (err as ApiError).message;
      setError(message);
    } finally {
      setIsUpdatingTicker(false);
    }
  }

  async function handleCreateAdmin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setNotice(null);
    setError(null);

    try {
      const result = await createAdminUser({ email: adminEmail, password: adminPassword });
      setNotice(`Administrador ${result.email} criado.`);
      setAdminEmail("");
      setAdminPassword("");
    } catch (err) {
      const message = err instanceof Error ? err.message : (err as ApiError).message;
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AppShell title="Administracao" subtitle="Gerencie eventos corporativos e acessos administrativos.">
      {notice ? <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{notice}</p> : null}
      {error ? <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}

      {isLoading ? <LoadingPanel message="Carregando eventos corporativos e permissoes..." /> : null}

      {!isLoading ? (
        <section className="grid gap-5 xl:grid-cols-[420px_1fr]">
          <div className="space-y-5">
            <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-col gap-1">
                <h2 className="text-lg font-semibold text-slate-900">Importar eventos</h2>
                <p className="text-sm text-slate-600">
                  Use a planilha com a aba Eventos 2020+ para cadastrar desdobramentos e grupamentos em lote.
                </p>
              </div>

              <div className="mt-5 space-y-4">
                <label className="flex flex-col gap-1.5">
                  <span className="text-sm font-semibold text-slate-800">Arquivo XLSX</span>
                  <input
                    type="file"
                    accept=".xlsx,.xls"
                    disabled={isParsingImport || isImporting}
                    onChange={(event) => void handleImportFile(event.target.files?.[0] ?? null)}
                    className="rounded-md border border-slate-300 px-3 py-2.5 text-sm outline-none file:mr-3 file:rounded-md file:border-0 file:bg-slate-900 file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-white focus:border-blue-600 focus:ring-4 focus:ring-blue-100 disabled:opacity-70"
                  />
                </label>

                {importRows.length ? (
                  <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                    <div className="grid gap-2 sm:grid-cols-2">
                      <span>Arquivo: {importFileName}</span>
                      <span>Eventos lidos: {importRows.length}</span>
                      <span>Novos: {importRows.filter((row) => row.status === "pendente").length}</span>
                      <span>Duplicados: {importRows.filter((row) => row.status === "duplicado").length}</span>
                      <span>Ignorados: {ignoredImportRows}</span>
                      <span>Importados: {importRows.filter((row) => row.status === "importado").length}</span>
                    </div>
                  </div>
                ) : null}

                <ProgressLog items={importLog} />

                <button
                  type="button"
                  disabled={
                    isParsingImport || isImporting || !importRows.some((row) => row.status === "pendente")
                  }
                  onClick={() => void handleImportEvents()}
                  className="w-full rounded-md bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-600 disabled:opacity-70"
                >
                  {isImporting ? "Importando..." : isParsingImport ? "Lendo arquivo..." : "Importar eventos novos"}
                </button>

                {importRows.length ? (
                  <div className="max-h-72 overflow-auto rounded-md border border-slate-200">
                    <table className="min-w-full divide-y divide-slate-200 text-sm">
                      <thead className="sticky top-0 bg-slate-50 text-left text-xs font-semibold uppercase text-slate-500">
                        <tr>
                          <th className="px-3 py-2">Data</th>
                          <th className="px-3 py-2">Ticker</th>
                          <th className="px-3 py-2">Tipo</th>
                          <th className="px-3 py-2">Qtd.</th>
                          <th className="px-3 py-2">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                        {importRows.map((row) => (
                          <tr key={`${row.sourceRow}-${row.payload.ticker}`}>
                            <td className="px-3 py-2 font-medium text-slate-900">
                              {formatDate(row.payload.dataEvento)}
                            </td>
                            <td className="px-3 py-2">{row.payload.ticker}</td>
                            <td className="px-3 py-2">
                              {eventTypeLabel(row.payload.tipo)}
                            </td>
                            <td className="px-3 py-2">{row.payload.fatorQuantidade}</td>
                            <td className="px-3 py-2">
                              <span
                                className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${importStatusClass(
                                  row.status,
                                )}`}
                                title={row.message}
                              >
                                {importStatusLabel(row.status)}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : null}
              </div>
            </article>

            <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-900">Processamento</h2>
              <div className="mt-4 space-y-3">
                <button
                  type="button"
                  disabled={isProcessingEvents || isImporting || isParsingImport}
                  onClick={() => void handleProcessEvents()}
                  className="w-full rounded-md bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-600 disabled:opacity-70"
                >
                  {isProcessingEvents ? "Aplicando..." : "Aplicar eventos na base"}
                </button>
              </div>
            </article>

            <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">
                    {editingEventId ? "Editar evento corporativo" : "Evento corporativo"}
                  </h2>
                  {editingEventId ? (
                    <p className="mt-1 text-sm text-slate-600">Atualize os dados do evento selecionado.</p>
                  ) : null}
                </div>
                {editingEventId ? (
                  <button
                    type="button"
                    onClick={handleCancelEditEvent}
                    className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                  >
                    Cancelar
                  </button>
                ) : null}
              </div>
              <form className="mt-5 space-y-4" onSubmit={handleCreateEvent}>
                <label className="flex flex-col gap-1.5">
                  <span className="text-sm font-semibold text-slate-800">Ticker</span>
                  <input
                    value={eventForm.ticker}
                    onChange={(event) => setEventForm((current) => ({ ...current, ticker: event.target.value }))}
                    className="rounded-md border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
                  />
                </label>

                <label className="flex flex-col gap-1.5">
                  <span className="text-sm font-semibold text-slate-800">Tipo</span>
                  <select
                    value={eventForm.tipo}
                    onChange={(event) =>
                      setEventForm((current) => ({
                        ...current,
                        tipo: event.target.value as EventForm["tipo"],
                        ...(event.target.value === "ALTERACAO_TICKER"
                          ? { fatorQuantidade: "1", fatorPreco: "1" }
                          : {}),
                      }))
                    }
                    className="rounded-md border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
                  >
                    <option value="DESDOBRAMENTO">Desdobramento</option>
                    <option value="GRUPAMENTO">Grupamento</option>
                    <option value="ALTERACAO_TICKER">Alteracao de ticker</option>
                  </select>
                </label>

                {eventForm.tipo === "ALTERACAO_TICKER" ? (
                  <label className="flex flex-col gap-1.5">
                    <span className="text-sm font-semibold text-slate-800">Ticker destino</span>
                    <input
                      value={eventForm.tickerDestino}
                      onChange={(event) =>
                        setEventForm((current) => ({ ...current, tickerDestino: event.target.value }))
                      }
                      placeholder="VIIA3"
                      className="rounded-md border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
                    />
                  </label>
                ) : null}

                <label className="flex flex-col gap-1.5">
                  <span className="text-sm font-semibold text-slate-800">Data</span>
                  <input
                    type="date"
                    value={eventForm.dataEvento}
                    onChange={(event) => setEventForm((current) => ({ ...current, dataEvento: event.target.value }))}
                    className="rounded-md border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
                  />
                </label>

                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="flex flex-col gap-1.5">
                    <span className="text-sm font-semibold text-slate-800">Fator quantidade</span>
                    <input
                      value={eventForm.fatorQuantidade}
                      onChange={(event) =>
                        setEventForm((current) => ({ ...current, fatorQuantidade: event.target.value }))
                      }
                      className="rounded-md border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
                    />
                  </label>
                  <label className="flex flex-col gap-1.5">
                    <span className="text-sm font-semibold text-slate-800">Fator preco</span>
                    <input
                      value={eventForm.fatorPreco}
                      onChange={(event) => setEventForm((current) => ({ ...current, fatorPreco: event.target.value }))}
                      className="rounded-md border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
                    />
                  </label>
                </div>

                <label className="flex flex-col gap-1.5">
                  <span className="text-sm font-semibold text-slate-800">Observacao</span>
                  <textarea
                    value={eventForm.observacao}
                    onChange={(event) => setEventForm((current) => ({ ...current, observacao: event.target.value }))}
                    className="min-h-24 rounded-md border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
                  />
                </label>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full rounded-md bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-70"
                >
                  {isSubmitting ? "Salvando..." : editingEventId ? "Atualizar evento" : "Cadastrar evento"}
                </button>
              </form>
            </article>

            <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-900">Cadastro de ticker</h2>
              <form className="mt-5 space-y-4" onSubmit={handleUpdateTicker}>
                <label className="flex flex-col gap-1.5">
                  <span className="text-sm font-semibold text-slate-800">Ticker</span>
                  <input
                    value={tickerForm.ticker}
                    onChange={(event) => setTickerForm((current) => ({ ...current, ticker: event.target.value }))}
                    placeholder="PETR4"
                    className="rounded-md border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
                  />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-sm font-semibold text-slate-800">Nome da empresa</span>
                  <input
                    value={tickerForm.nomeEmpresa}
                    onChange={(event) =>
                      setTickerForm((current) => ({ ...current, nomeEmpresa: event.target.value }))
                    }
                    placeholder="Petroleo Brasileiro S.A."
                    className="rounded-md border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
                  />
                </label>
                <button
                  type="submit"
                  disabled={isUpdatingTicker}
                  className="w-full rounded-md border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-800 transition hover:bg-slate-50 disabled:opacity-70"
                >
                  {isUpdatingTicker ? "Atualizando..." : "Atualizar ticker"}
                </button>
              </form>
            </article>

            <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-900">Novo administrador</h2>
              <form className="mt-5 space-y-4" onSubmit={handleCreateAdmin}>
                <label className="flex flex-col gap-1.5">
                  <span className="text-sm font-semibold text-slate-800">Email</span>
                  <input
                    type="email"
                    value={adminEmail}
                    onChange={(event) => setAdminEmail(event.target.value)}
                    className="rounded-md border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
                  />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-sm font-semibold text-slate-800">Senha inicial</span>
                  <input
                    type="password"
                    value={adminPassword}
                    onChange={(event) => setAdminPassword(event.target.value)}
                    className="rounded-md border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
                  />
                </label>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full rounded-md border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-800 transition hover:bg-slate-50 disabled:opacity-70"
                >
                  {isSubmitting ? "Criando..." : "Criar administrador"}
                </button>
              </form>
            </article>
          </div>

          <article className="rounded-lg border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 p-5">
              <h2 className="text-lg font-semibold text-slate-900">Eventos cadastrados</h2>
            </div>
            {events.length === 0 ? (
              <div className="p-8 text-center text-sm text-slate-500">Nenhum evento corporativo cadastrado.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200 text-sm">
                  <thead className="bg-slate-50 text-left text-xs font-semibold uppercase text-slate-500">
                    <tr>
                      <th className="px-4 py-3">Data</th>
                      <th className="px-4 py-3">Ticker</th>
                      <th className="px-4 py-3">Tipo</th>
                      <th className="px-4 py-3">Quantidade</th>
                      <th className="px-4 py-3">Preco</th>
                      <th className="px-4 py-3">Observacao</th>
                      <th className="px-4 py-3">Acoes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {events.map((event) => (
                      <tr key={event.id}>
                        <td className="px-4 py-3 font-medium text-slate-900">{formatDate(event.dataEvento)}</td>
                        <td className="px-4 py-3">
                          {event.tickerDestino ? `${event.ticker} -> ${event.tickerDestino}` : event.ticker}
                        </td>
                        <td className="px-4 py-3">{eventTypeLabel(event.tipo)}</td>
                        <td className="px-4 py-3">{event.fatorQuantidade}</td>
                        <td className="px-4 py-3">{event.fatorPreco}</td>
                        <td className="px-4 py-3 text-slate-600">{event.observacao ?? "-"}</td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => handleEditEvent(event)}
                              className="rounded-md border border-slate-300 px-2.5 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                            >
                              Editar
                            </button>
                            <button
                              type="button"
                              disabled={processingEventId === event.id || isProcessingEvents}
                              onClick={() => void handleProcessSingleEvent(event)}
                              className="rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-70"
                            >
                              {processingEventId === event.id ? "Aplicando..." : "Processar"}
                            </button>
                            <button
                              type="button"
                              disabled={isLoadingExecutions && selectedExecutionsEventId === event.id}
                              onClick={() => void handleLoadExecutions(event)}
                              className="rounded-md border border-blue-200 bg-blue-50 px-2.5 py-1.5 text-xs font-semibold text-blue-700 transition hover:bg-blue-100 disabled:opacity-70"
                            >
                              {isLoadingExecutions && selectedExecutionsEventId === event.id
                                ? "Carregando..."
                                : "Auditoria"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {selectedExecutionsEventId ? (
              <div className="border-t border-slate-200 p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-base font-semibold text-slate-900">Auditoria de execucoes</h3>
                    <p className="mt-1 text-sm text-slate-600">
                      {events.find((event) => event.id === selectedExecutionsEventId)?.ticker ?? "Evento selecionado"}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedExecutionsEventId(null);
                      setEventExecutions([]);
                    }}
                    className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                  >
                    Fechar
                  </button>
                </div>

                {isLoadingExecutions ? (
                  <div className="mt-4 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
                    Carregando auditoria...
                  </div>
                ) : eventExecutions.length === 0 ? (
                  <div className="mt-4 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
                    Nenhuma execucao registrada para este evento.
                  </div>
                ) : (
                  <div className="mt-4 overflow-x-auto rounded-md border border-slate-200">
                    <table className="min-w-full divide-y divide-slate-200 text-sm">
                      <thead className="bg-slate-50 text-left text-xs font-semibold uppercase text-slate-500">
                        <tr>
                          <th className="px-3 py-2">Data</th>
                          <th className="px-3 py-2">Ticker</th>
                          <th className="px-3 py-2">Operacoes</th>
                          <th className="px-3 py-2">Ticker</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {eventExecutions.map((execucao) => (
                          <tr key={execucao.id}>
                            <td className="px-3 py-2 font-medium text-slate-900">
                              {formatDateTime(execucao.createdAt)}
                            </td>
                            <td className="px-3 py-2">
                              {execucao.tickerDestino
                                ? `${execucao.ticker} -> ${execucao.tickerDestino}`
                                : execucao.ticker}
                            </td>
                            <td className="px-3 py-2">{execucao.operacoesAtualizadas}</td>
                            <td className="px-3 py-2 text-slate-600">
                              {execucao.tickerOrigemAtualizado
                                ? "Origem atualizada"
                                : execucao.tickerOrigemRemovido
                                  ? "Origem removida"
                                  : execucao.tickerDestinoCriado
                                    ? "Destino criado"
                                    : "Sem alteracao cadastral"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ) : null}
          </article>
        </section>
      ) : null}
    </AppShell>
  );
}
