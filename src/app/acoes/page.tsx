"use client";

import { EndpointTester } from "@/components/api/EndpointTester";
import { AppShell } from "@/components/layout/AppShell";
import {
  createAcao,
  createEventoCorporativo,
  deleteAcao,
  getAcaoById,
  healthcheck,
  listAcoes,
  updateAcao,
  updateCotacoes,
} from "@/lib/api";

function toOptionalNumber(value: string): number | undefined {
  if (!value.trim()) {
    return undefined;
  }

  return Number(value);
}

export default function AcoesPage() {
  return (
    <AppShell title="Acoes" subtitle="Telas geradas a partir do Swagger do backend">
      <div className="grid gap-4 lg:grid-cols-2">
        <EndpointTester title="Healthcheck" endpoint="GET /" onSubmit={() => healthcheck()} />

        <EndpointTester
          title="Cadastrar acao"
          endpoint="POST /acoes"
          fields={[
            { name: "ticker", label: "Ticker", required: true, placeholder: "PETR4" },
            { name: "nome", label: "Nome", required: true, placeholder: "Petrobras PN" },
          ]}
          onSubmit={(values) => createAcao({ ticker: values.ticker, nome: values.nome })}
        />

        <EndpointTester title="Listar acoes" endpoint="GET /acoes" onSubmit={() => listAcoes()} />

        <EndpointTester
          title="Atualizar cotacoes"
          endpoint="POST /acoes/cotacoes/atualizar"
          onSubmit={() => updateCotacoes()}
        />

        <EndpointTester
          title="Buscar acao por id"
          endpoint="GET /acoes/{id}"
          fields={[{ name: "id", label: "ID da acao", required: true }]}
          onSubmit={(values) => getAcaoById(values.id)}
        />

        <EndpointTester
          title="Atualizar acao"
          endpoint="PATCH /acoes/{id}"
          fields={[
            { name: "id", label: "ID da acao", required: true },
            { name: "ticker", label: "Ticker (opcional)" },
            { name: "nome", label: "Nome (opcional)" },
          ]}
          onSubmit={(values) =>
            updateAcao(values.id, {
              ...(values.ticker.trim() ? { ticker: values.ticker } : {}),
              ...(values.nome.trim() ? { nome: values.nome } : {}),
            })
          }
        />

        <EndpointTester
          title="Remover acao"
          endpoint="DELETE /acoes/{id}"
          fields={[{ name: "id", label: "ID da acao", required: true }]}
          onSubmit={(values) => deleteAcao(values.id)}
        />

        <EndpointTester
          title="Criar evento corporativo"
          endpoint="POST /acoes/{id}/eventos-corporativos"
          fields={[
            { name: "id", label: "ID da acao", required: true },
            { name: "tipo", label: "Tipo", required: true, placeholder: "SPLIT | INCORPORACAO | TROCA_TICKER" },
            {
              name: "effectiveAt",
              label: "Data efetiva (ISO, opcional)",
              placeholder: "2026-02-20T10:00:00.000Z",
            },
            { name: "ratioNumerator", label: "Numerador razao (opcional)", type: "number" },
            { name: "ratioDenominator", label: "Denominador razao (opcional)", type: "number" },
            { name: "fractionTreatment", label: "Tratamento de fracao (opcional)" },
            { name: "newTicker", label: "Novo ticker (opcional)" },
            { name: "observacao", label: "Observacao (opcional)" },
          ]}
          onSubmit={(values) =>
            createEventoCorporativo(values.id, {
              tipo: values.tipo,
              ...(values.effectiveAt.trim() ? { effectiveAt: values.effectiveAt } : {}),
              ...(values.fractionTreatment.trim() ? { fractionTreatment: values.fractionTreatment } : {}),
              ...(values.newTicker.trim() ? { newTicker: values.newTicker } : {}),
              ...(values.observacao.trim() ? { observacao: values.observacao } : {}),
              ...(toOptionalNumber(values.ratioNumerator) !== undefined
                ? { ratioNumerator: toOptionalNumber(values.ratioNumerator) }
                : {}),
              ...(toOptionalNumber(values.ratioDenominator) !== undefined
                ? { ratioDenominator: toOptionalNumber(values.ratioDenominator) }
                : {}),
            })
          }
        />
      </div>
    </AppShell>
  );
}
