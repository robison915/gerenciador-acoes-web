import type { Carteira, CarteiraProjecao, ImportacaoB3, ImportacaoB3Item } from "@/lib/api";

export type B3ProjectionDiagnostic = {
  linha: number;
  ticker: string;
  candidateWalletIds: string[];
  candidateWalletNames: string[];
  isConflict: boolean;
};

export type B3ProjectionDiagnosticsResult = {
  items: B3ProjectionDiagnostic[];
  conflicts: B3ProjectionDiagnostic[];
};

export type B3ProjectionLookup = Record<string, CarteiraProjecao | null | undefined>;
export type B3DistributionSelection = Record<number, string>;

function getProjectionList(item: ImportacaoB3Item, projection: CarteiraProjecao) {
  return item.tipoOperacao === "COMPRA" ? projection.ativos : projection.vendas;
}

export function buildB3ProjectionDiagnostics(
  importacao: ImportacaoB3 | null,
  wallets: Carteira[] | undefined,
  latestProjectionByWallet: B3ProjectionLookup,
): B3ProjectionDiagnosticsResult {
  if (!importacao || !wallets?.length || importacao.status === "DISTRIBUIDA") {
    return { items: [], conflicts: [] };
  }

  const walletNameById = new Map(wallets.map((wallet) => [wallet.id, wallet.nome]));
  const items = importacao.itens.map((item) => {
    const candidateWalletIds = wallets
      .filter((wallet) => {
        const projection = latestProjectionByWallet[wallet.id];
        if (!projection) {
          return false;
        }

        return getProjectionList(item, projection).some((asset) => asset.ticker === item.ticker);
      })
      .map((wallet) => wallet.id);

    return {
      linha: item.linha,
      ticker: item.ticker,
      candidateWalletIds,
      candidateWalletNames: candidateWalletIds.map((id) => walletNameById.get(id) ?? id),
      isConflict: candidateWalletIds.length > 1,
    };
  });

  return {
    items,
    conflicts: items.filter((item) => item.isConflict),
  };
}

export function getUnresolvedB3ProjectionConflicts(
  diagnostics: B3ProjectionDiagnosticsResult,
  distribution: B3DistributionSelection,
) {
  return diagnostics.conflicts.filter((conflict) => !distribution[conflict.linha]);
}

export function createInitialB3Distribution(importacao: ImportacaoB3) {
  return Object.fromEntries(importacao.itens.map((item) => [item.linha, item.carteiraId ?? ""]));
}
