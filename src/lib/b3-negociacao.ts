import { read, utils } from "xlsx";
import type { OperacaoAcaoPayload } from "@/lib/api";

export type B3BatchOperation = {
  mode: "compra" | "venda";
  payload: OperacaoAcaoPayload;
  sourceRow: number;
};

export type B3BatchParseResult = {
  operations: B3BatchOperation[];
  totalRows: number;
  totalCompras: number;
  totalVendas: number;
};

type B3WorksheetRow = {
  "Data do Negócio"?: unknown;
  "Tipo de Movimentação"?: unknown;
  Mercado?: unknown;
  "Prazo/Vencimento"?: unknown;
  Instituição?: unknown;
  "Código de Negociação"?: unknown;
  Quantidade?: unknown;
  "Preço"?: unknown;
  Valor?: unknown;
};

function normalizeMode(value: unknown): "compra" | "venda" | null {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (normalized === "compra") {
    return "compra";
  }
  if (normalized === "venda") {
    return "venda";
  }

  return null;
}

function parsePositiveInteger(value: unknown, fieldName: string, rowNumber: number): number {
  const parsed = Number(String(value ?? "").replace(/\s+/g, ""));
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`Linha ${rowNumber}: ${fieldName} invalido.`);
  }

  return parsed;
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

  return Number(parsed.toFixed(2));
}

function parseB3Date(value: unknown, rowNumber: number): string {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return new Date(
      Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate(), 12, 0, 0),
    ).toISOString();
  }

  const raw = String(value ?? "").trim();
  const match = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) {
    throw new Error(`Linha ${rowNumber}: data do negocio invalida.`);
  }

  const [, dayRaw, monthRaw, yearRaw] = match;
  const day = Number(dayRaw);
  const month = Number(monthRaw);
  const year = Number(yearRaw);
  const date = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new Error(`Linha ${rowNumber}: data do negocio invalida.`);
  }

  return date.toISOString();
}

function normalizeTicker(code: unknown, market: unknown, rowNumber: number): string {
  const normalizedCode = String(code ?? "").trim().toUpperCase();
  if (!normalizedCode) {
    throw new Error(`Linha ${rowNumber}: codigo de negociacao obrigatorio.`);
  }

  const normalizedMarket = String(market ?? "").trim().toLowerCase();
  if (normalizedMarket.includes("fracion")) {
    return normalizedCode.endsWith("F") && normalizedCode.length > 1
      ? normalizedCode.slice(0, -1)
      : normalizedCode;
  }

  return normalizedCode;
}

export async function parseB3NegociacaoFile(file: File): Promise<B3BatchParseResult> {
  const buffer = await file.arrayBuffer();
  const workbook = read(buffer, {
    type: "array",
    cellDates: true,
  });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) {
    throw new Error("Arquivo XLSX sem planilha utilizavel.");
  }

  const sheet = workbook.Sheets[firstSheetName];
  const rows = utils.sheet_to_json<B3WorksheetRow>(sheet, {
    defval: "",
    raw: false,
  });

  const operations = rows.flatMap((row, index) => {
    const rowNumber = index + 2;
    const mode = normalizeMode(row["Tipo de Movimentação"]);
    if (!mode) {
      return [];
    }

    return [
      {
        mode,
        sourceRow: rowNumber,
        payload: {
          ticker: normalizeTicker(row["Código de Negociação"], row.Mercado, rowNumber),
          quantidade: parsePositiveInteger(row.Quantidade, "quantidade", rowNumber),
          valorUnitario: parsePositiveNumber(row["Preço"], "preco", rowNumber),
          dataOperacao: parseB3Date(row["Data do Negócio"], rowNumber),
        },
      } satisfies B3BatchOperation,
    ];
  });

  if (operations.length === 0) {
    throw new Error("Nenhuma compra ou venda foi encontrada no arquivo da B3.");
  }

  operations.sort((left, right) => {
    const leftTime = new Date(left.payload.dataOperacao ?? 0).getTime();
    const rightTime = new Date(right.payload.dataOperacao ?? 0).getTime();
    if (leftTime !== rightTime) {
      return leftTime - rightTime;
    }

    return left.sourceRow - right.sourceRow;
  });

  const totalCompras = operations.filter((operation) => operation.mode === "compra").length;
  const totalVendas = operations.length - totalCompras;

  return {
    operations,
    totalRows: operations.length,
    totalCompras,
    totalVendas,
  };
}
