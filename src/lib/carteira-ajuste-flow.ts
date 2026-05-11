import type { Carteira, CarteiraProjecao, CarteiraProjecaoOperacao } from "@/lib/api";

export type AjusteCarteiraAlocacao = {
  carteiraId: string;
  carteiraNome: string;
  quantidade: number;
  valorUnitario: number;
  valorTotal: number;
};

export type AjusteCarteiraOperacaoReal = {
  ticker: string;
  quantidade: number;
  valorUnitarioMedio: number;
  valorTotal: number;
  alocacoes: AjusteCarteiraAlocacao[];
};

export type AjusteCarteiraMovimentacao = {
  ticker: string;
  quantidade: number;
  valorUnitario: number;
  valorTotal: number;
  carteiraOrigemId: string;
  carteiraOrigemNome: string;
  carteiraDestinoId: string;
  carteiraDestinoNome: string;
};

export type AjusteCarteirasPlano = {
  movimentacoes: AjusteCarteiraMovimentacao[];
  compras: AjusteCarteiraOperacaoReal[];
  vendas: AjusteCarteiraOperacaoReal[];
  quantidadeMovimentada: number;
  valorMovimentado: number;
  quantidadeCompras: number;
  valorCompras: number;
  quantidadeVendas: number;
  valorVendas: number;
};

type OperacaoPendente = CarteiraProjecaoOperacao & {
  carteiraId: string;
  carteiraNome: string;
};

const MONEY_PRECISION = 2;
const QUANTITY_PRECISION = 8;

function roundMoney(value: number) {
  return Number(value.toFixed(MONEY_PRECISION));
}

function roundQuantity(value: number) {
  return Number(value.toFixed(QUANTITY_PRECISION));
}

function getWalletNameById(wallets: Carteira[]) {
  return new Map(wallets.map((wallet) => [wallet.id, wallet.nome]));
}

function toPendingOperations(
  projections: CarteiraProjecao[],
  wallets: Carteira[],
  operationKey: "compras" | "vendas",
) {
  const walletNameById = getWalletNameById(wallets);

  return projections.flatMap((projection) =>
    projection[operationKey].map((operation) => ({
      ...operation,
      carteiraId: projection.carteiraId,
      carteiraNome: walletNameById.get(projection.carteiraId) ?? "Carteira",
    })),
  );
}

function groupByTicker(operations: OperacaoPendente[]) {
  return operations.reduce<Record<string, OperacaoPendente[]>>((acc, operation) => {
    const ticker = operation.ticker.trim().toUpperCase();
    acc[ticker] = [...(acc[ticker] ?? []), { ...operation, ticker }];
    return acc;
  }, {});
}

function toRealOperations(operations: OperacaoPendente[]): AjusteCarteiraOperacaoReal[] {
  return Object.entries(groupByTicker(operations))
    .map(([ticker, tickerOperations]) => {
      const quantidade = roundQuantity(tickerOperations.reduce((total, operation) => total + operation.quantidade, 0));
      const valorTotal = roundMoney(tickerOperations.reduce((total, operation) => total + operation.valorTotal, 0));

      return {
        ticker,
        quantidade,
        valorUnitarioMedio: quantidade > 0 ? roundMoney(valorTotal / quantidade) : 0,
        valorTotal,
        alocacoes: tickerOperations.map((operation) => ({
          carteiraId: operation.carteiraId,
          carteiraNome: operation.carteiraNome,
          quantidade: operation.quantidade,
          valorUnitario: operation.valorUnitario,
          valorTotal: operation.valorTotal,
        })),
      };
    })
    .filter((operation) => operation.quantidade > 0)
    .sort((left, right) => left.ticker.localeCompare(right.ticker));
}

export function buildAjusteCarteirasPlano(
  projections: CarteiraProjecao[],
  wallets: Carteira[],
): AjusteCarteirasPlano {
  const comprasPorTicker = groupByTicker(toPendingOperations(projections, wallets, "compras"));
  const vendasPorTicker = groupByTicker(toPendingOperations(projections, wallets, "vendas"));
  const tickers = Array.from(new Set([...Object.keys(comprasPorTicker), ...Object.keys(vendasPorTicker)])).sort();
  const movimentacoes: AjusteCarteiraMovimentacao[] = [];
  const comprasPendentes: OperacaoPendente[] = [];
  const vendasPendentes: OperacaoPendente[] = [];

  for (const ticker of tickers) {
    const compras = (comprasPorTicker[ticker] ?? []).map((operation) => ({ ...operation }));
    const vendas = (vendasPorTicker[ticker] ?? []).map((operation) => ({ ...operation }));

    while (compras.length > 0 && vendas.length > 0) {
      const compra = compras[0];
      const venda = vendas[0];
      const quantidade = roundQuantity(Math.min(compra.quantidade, venda.quantidade));

      if (quantidade <= 0) {
        break;
      }

      const valorUnitario = venda.valorUnitario;
      movimentacoes.push({
        ticker,
        quantidade,
        valorUnitario,
        valorTotal: roundMoney(quantidade * valorUnitario),
        carteiraOrigemId: venda.carteiraId,
        carteiraOrigemNome: venda.carteiraNome,
        carteiraDestinoId: compra.carteiraId,
        carteiraDestinoNome: compra.carteiraNome,
      });

      compra.quantidade = roundQuantity(compra.quantidade - quantidade);
      compra.valorTotal = roundMoney(compra.quantidade * compra.valorUnitario);
      venda.quantidade = roundQuantity(venda.quantidade - quantidade);
      venda.valorTotal = roundMoney(venda.quantidade * venda.valorUnitario);

      if (compra.quantidade <= 0) {
        compras.shift();
      }
      if (venda.quantidade <= 0) {
        vendas.shift();
      }
    }

    comprasPendentes.push(...compras.filter((operation) => operation.quantidade > 0));
    vendasPendentes.push(...vendas.filter((operation) => operation.quantidade > 0));
  }

  const compras = toRealOperations(comprasPendentes);
  const vendas = toRealOperations(vendasPendentes);

  return {
    movimentacoes: movimentacoes.sort((left, right) => left.ticker.localeCompare(right.ticker)),
    compras,
    vendas,
    quantidadeMovimentada: roundQuantity(movimentacoes.reduce((total, operation) => total + operation.quantidade, 0)),
    valorMovimentado: roundMoney(movimentacoes.reduce((total, operation) => total + operation.valorTotal, 0)),
    quantidadeCompras: roundQuantity(compras.reduce((total, operation) => total + operation.quantidade, 0)),
    valorCompras: roundMoney(compras.reduce((total, operation) => total + operation.valorTotal, 0)),
    quantidadeVendas: roundQuantity(vendas.reduce((total, operation) => total + operation.quantidade, 0)),
    valorVendas: roundMoney(vendas.reduce((total, operation) => total + operation.valorTotal, 0)),
  };
}
