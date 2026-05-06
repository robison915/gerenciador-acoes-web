export type MovementForm = {
  ticker: string;
  quantidade: string;
  dataOperacao: string;
  carteiraDestinoId: string;
};

export function findQuantidadeByTicker(
  items: Array<{ ticker: string; quantidade: number }> | undefined,
  ticker: string,
) {
  return items?.find((item) => item.ticker === ticker)?.quantidade ?? 0;
}

export function getValidTicker(items: Array<{ ticker: string }> | undefined, currentTicker: string) {
  if (!items?.length) {
    return "";
  }

  return items.some((item) => item.ticker === currentTicker) ? currentTicker : items[0].ticker;
}

export function resultTone(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value) || value === 0) {
    return "text-slate-900";
  }

  return value < 0 ? "text-red-700" : "text-emerald-700";
}

export function toMovementPayload(form: Pick<MovementForm, "ticker" | "quantidade" | "dataOperacao">) {
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
