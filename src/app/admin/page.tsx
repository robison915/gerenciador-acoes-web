"use client";

import { type FormEvent, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import {
  createAdminUser,
  createEventoCorporativo,
  getMe,
  listEventosCorporativos,
} from "@/lib/api";
import type { ApiError, EventoCorporativo } from "@/lib/api";
import {
  getEventoCorporativoKey,
  parseEventosCorporativosFile,
  type EventoCorporativoImportItem,
} from "@/lib/eventos-corporativos-import";

type EventForm = {
  ticker: string;
  tipo: "DESDOBRAMENTO" | "GRUPAMENTO";
  dataEvento: string;
  fatorQuantidade: string;
  fatorPreco: string;
  observacao: string;
};

const defaultEventForm: EventForm = {
  ticker: "MGLU3",
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

function toEventPayload(form: EventForm) {
  const ticker = form.ticker.trim().toUpperCase();
  const fatorQuantidade = Number(form.fatorQuantidade);
  const fatorPreco = Number(form.fatorPreco);

  if (!ticker) {
    throw new Error("Informe o ticker.");
  }
  if (!form.dataEvento) {
    throw new Error("Informe a data do evento.");
  }
  if (!Number.isFinite(fatorQuantidade) || fatorQuantidade <= 0) {
    throw new Error("Fator de quantidade deve ser maior que zero.");
  }
  if (!Number.isFinite(fatorPreco) || fatorPreco <= 0) {
    throw new Error("Fator de preco deve ser maior que zero.");
  }

  return {
    ticker,
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
  const [importFileName, setImportFileName] = useState("");
  const [importRows, setImportRows] = useState<ImportPreviewItem[]>([]);
  const [ignoredImportRows, setIgnoredImportRows] = useState(0);
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isParsingImport, setIsParsingImport] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
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
      await createEventoCorporativo(payload);
      setNotice(`Evento de ${payload.ticker} cadastrado.`);
      setEventForm(defaultEventForm);
      await loadAdminData();
    } catch (err) {
      const message = err instanceof Error ? err.message : (err as ApiError).message;
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleImportFile(file: File | null) {
    setNotice(null);
    setError(null);
    setImportRows([]);
    setIgnoredImportRows(0);
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
    } catch (err) {
      const message = err instanceof Error ? err.message : "Nao foi possivel ler o arquivo.";
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

    let importedCount = 0;
    let errorCount = 0;
    const nextRows = [...importRows];

    for (const row of pendingRows) {
      const rowIndex = nextRows.findIndex((item) => item.sourceRow === row.sourceRow);
      try {
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
    setNotice(`${importedCount} eventos importados${errorCount ? `, ${errorCount} com erro` : ""}.`);
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

      {isLoading ? <p className="text-sm text-slate-600">Carregando administracao...</p> : null}

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
                              {row.payload.tipo === "DESDOBRAMENTO" ? "Desdobramento" : "Grupamento"}
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
              <h2 className="text-lg font-semibold text-slate-900">Evento corporativo</h2>
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
                      }))
                    }
                    className="rounded-md border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
                  >
                    <option value="DESDOBRAMENTO">Desdobramento</option>
                    <option value="GRUPAMENTO">Grupamento</option>
                  </select>
                </label>

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
                  {isSubmitting ? "Salvando..." : "Cadastrar evento"}
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
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {events.map((event) => (
                      <tr key={event.id}>
                        <td className="px-4 py-3 font-medium text-slate-900">{formatDate(event.dataEvento)}</td>
                        <td className="px-4 py-3">{event.ticker}</td>
                        <td className="px-4 py-3">{event.tipo === "DESDOBRAMENTO" ? "Desdobramento" : "Grupamento"}</td>
                        <td className="px-4 py-3">{event.fatorQuantidade}</td>
                        <td className="px-4 py-3">{event.fatorPreco}</td>
                        <td className="px-4 py-3 text-slate-600">{event.observacao ?? "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </article>
        </section>
      ) : null}
    </AppShell>
  );
}
