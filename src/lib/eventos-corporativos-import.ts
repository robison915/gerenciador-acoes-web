import { read, utils } from "xlsx";
import type { EventoCorporativo } from "@/lib/api";

export type EventoCorporativoImportPayload = {
  ticker: string;
  tickerDestino?: string;
  tipo: "DESDOBRAMENTO" | "GRUPAMENTO" | "ALTERACAO_TICKER";
  dataEvento: string;
  fatorQuantidade: number;
  fatorPreco: number;
  observacao?: string;
};

export type EventoCorporativoImportItem = {
  sourceRow: number;
  payload: EventoCorporativoImportPayload;
};

export type EventoCorporativoImportResult = {
  items: EventoCorporativoImportItem[];
  totalRows: number;
  ignoredRows: number;
};

type EventoCorporativoWorksheetRow = {
  Ticker?: unknown;
  "Ticker destino"?: unknown;
  tickerDestino?: unknown;
  Tipo?: unknown;
  "Data evento"?: unknown;
  "Data evento usada"?: unknown;
  Data?: unknown;
  "Fator quantidade sugerido"?: unknown;
  "Fator preco sugerido"?: unknown;
  fatorQuantidade?: unknown;
  fatorPreco?: unknown;
  Observacao?: unknown;
  Observação?: unknown;
  Fonte?: unknown;
};

export function getEventoCorporativoKey(event: {
  ticker: string;
  tickerDestino?: string | null;
  tipo: EventoCorporativo["tipo"];
  dataEvento: string;
}) {
  return `${event.ticker.trim().toUpperCase()}|${event.tickerDestino?.trim().toUpperCase() ?? ""}|${event.tipo}|${event.dataEvento.slice(0, 10)}`;
}

function parseTipo(value: unknown, rowNumber: number): EventoCorporativoImportPayload["tipo"] | null {
  const normalized = String(value ?? "")
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  if (normalized === "DESDOBRAMENTO" || normalized === "SPLIT") {
    return "DESDOBRAMENTO";
  }

  if (normalized === "GRUPAMENTO" || normalized === "INPLIT" || normalized === "SPLIT REVERSO") {
    return "GRUPAMENTO";
  }

  if (
    normalized === "ALTERACAO_TICKER" ||
    normalized === "ALTERACAO DE TICKER" ||
    normalized === "MUDANCA_TICKER" ||
    normalized === "MUDANCA DE TICKER" ||
    normalized === "TROCA_TICKER" ||
    normalized === "TROCA DE TICKER"
  ) {
    return "ALTERACAO_TICKER";
  }

  if (!normalized) {
    throw new Error(`Linha ${rowNumber}: tipo de evento obrigatorio.`);
  }

  return null;
}

function parsePositiveNumber(value: unknown, fieldName: string, rowNumber: number): number {
  const rawValue = typeof value === "number" ? value : String(value ?? "").trim();
  const normalized =
    typeof rawValue === "number"
      ? rawValue
      : rawValue.includes(",") && rawValue.includes(".")
        ? Number(rawValue.replace(/\./g, "").replace(",", "."))
        : rawValue.includes(",")
          ? Number(rawValue.replace(",", "."))
          : Number(rawValue);
  const parsed = Number(normalized);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Linha ${rowNumber}: ${fieldName} invalido.`);
  }

  return Number(parsed.toFixed(10));
}

function parseDate(value: unknown, rowNumber: number): string {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate(), 12, 0, 0)).toISOString();
  }

  const raw = String(value ?? "").trim();
  const isoMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    const [, yearRaw, monthRaw, dayRaw] = isoMatch;
    return buildUtcDate(Number(yearRaw), Number(monthRaw), Number(dayRaw), rowNumber);
  }

  const brMatch = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (brMatch) {
    const [, dayRaw, monthRaw, yearRaw] = brMatch;
    return buildUtcDate(Number(yearRaw), Number(monthRaw), Number(dayRaw), rowNumber);
  }

  throw new Error(`Linha ${rowNumber}: data do evento invalida.`);
}

function buildUtcDate(year: number, month: number, day: number, rowNumber: number): string {
  const date = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    throw new Error(`Linha ${rowNumber}: data do evento invalida.`);
  }

  return date.toISOString();
}

function normalizeTicker(value: unknown, rowNumber: number): string {
  const ticker = String(value ?? "").trim().toUpperCase();
  if (!ticker) {
    throw new Error(`Linha ${rowNumber}: ticker obrigatorio.`);
  }

  return ticker;
}

function getSheetName(sheetNames: string[]) {
  return sheetNames.find((name) => name.trim().toLowerCase() === "eventos 2020+") ?? sheetNames[0];
}

export async function parseEventosCorporativosFile(file: File): Promise<EventoCorporativoImportResult> {
  const buffer = await file.arrayBuffer();
  const workbook = read(buffer, {
    type: "array",
    cellDates: true,
  });
  const sheetName = getSheetName(workbook.SheetNames);
  if (!sheetName) {
    throw new Error("Arquivo XLSX sem planilha utilizavel.");
  }

  const rows = utils.sheet_to_json<EventoCorporativoWorksheetRow>(workbook.Sheets[sheetName], {
    defval: "",
    raw: false,
  });

  let ignoredRows = 0;
  const items = rows.flatMap((row, index) => {
    const rowNumber = index + 2;
    const tipo = parseTipo(row.Tipo, rowNumber);
    if (!tipo) {
      ignoredRows += 1;
      return [];
    }

    const dataEvento = row["Data evento"] || row["Data evento usada"] || row.Data;
    const observacao = String(row.Observacao || row.Observação || row.Fonte || "").trim();
    const tickerDestino = String(row["Ticker destino"] || row.tickerDestino || "").trim().toUpperCase();

    return [
      {
        sourceRow: rowNumber,
        payload: {
          ticker: normalizeTicker(row.Ticker, rowNumber),
          ...(tipo === "ALTERACAO_TICKER" ? { tickerDestino: normalizeTicker(tickerDestino, rowNumber) } : {}),
          tipo,
          dataEvento: parseDate(dataEvento, rowNumber),
          fatorQuantidade: parsePositiveNumber(
            row["Fator quantidade sugerido"] || row.fatorQuantidade,
            "fator de quantidade",
            rowNumber,
          ),
          fatorPreco: parsePositiveNumber(row["Fator preco sugerido"] || row.fatorPreco, "fator de preco", rowNumber),
          ...(observacao ? { observacao } : {}),
        },
      } satisfies EventoCorporativoImportItem,
    ];
  });

  if (items.length === 0) {
    throw new Error("Nenhum evento de desdobramento ou grupamento foi encontrado no arquivo.");
  }

  items.sort((left, right) => {
    const tickerOrder = left.payload.ticker.localeCompare(right.payload.ticker);
    if (tickerOrder !== 0) {
      return tickerOrder;
    }

    return left.payload.dataEvento.localeCompare(right.payload.dataEvento);
  });

  return {
    items,
    totalRows: rows.length,
    ignoredRows,
  };
}
