import type { EventoCorporativo } from "@/lib/api";

export type EventForm = {
  ticker: string;
  tickerDestino: string;
  tipo: "DESDOBRAMENTO" | "GRUPAMENTO" | "ALTERACAO_TICKER" | "CANCELAMENTO_TICKER";
  dataEvento: string;
  fatorQuantidade: string;
  fatorPreco: string;
  observacao: string;
};

export type ImportItemStatus = "pendente" | "duplicado" | "importado" | "erro";

export function toDateInputValue(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toISOString().slice(0, 10);
}

export function eventTypeLabel(tipo: EventoCorporativo["tipo"]) {
  const labels: Record<EventoCorporativo["tipo"], string> = {
    DESDOBRAMENTO: "Desdobramento",
    GRUPAMENTO: "Grupamento",
    ALTERACAO_TICKER: "Alteracao de ticker",
    CANCELAMENTO_TICKER: "Cancelamento de ticker",
  };

  return labels[tipo];
}

export function toEventForm(event: EventoCorporativo): EventForm {
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

export function toEventPayload(form: EventForm) {
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

export function importStatusLabel(status: ImportItemStatus) {
  const labels: Record<ImportItemStatus, string> = {
    pendente: "Novo",
    duplicado: "Duplicado",
    importado: "Importado",
    erro: "Erro",
  };

  return labels[status];
}

export function importStatusClass(status: ImportItemStatus) {
  const classes: Record<ImportItemStatus, string> = {
    pendente: "bg-blue-50 text-blue-700",
    duplicado: "bg-slate-100 text-slate-600",
    importado: "bg-emerald-50 text-emerald-700",
    erro: "bg-red-50 text-red-700",
  };

  return classes[status];
}
