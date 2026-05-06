import type { OperacaoAcaoPayload } from "@/lib/api";

export type OperationForm = {
  ticker: string;
  quantidade: string;
  valorUnitario: string;
  dataOperacao: string;
  carteiraId: string;
};

export function toOperacaoPayload(form: OperationForm): OperacaoAcaoPayload {
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

export function parseOperacoesLote(value: string): OperacaoAcaoPayload[] {
  const rows = value
    .split("\n")
    .map((row) => row.trim())
    .filter(Boolean);

  if (rows.length === 0) {
    throw new Error("Informe ao menos uma linha no lote.");
  }

  return rows.map((row, index) => {
    const [tickerRaw, quantidadeRaw, valorRaw, dataRaw] = row.split(",").map((part) => part.trim());
    const payload = toOperacaoPayload({
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

export function metricTone(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value) || value === 0) {
    return "text-slate-900";
  }

  return value < 0 ? "text-red-700" : "text-emerald-700";
}
