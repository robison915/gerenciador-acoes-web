"use client";

import { EndpointTester } from "@/components/api/EndpointTester";
import { AppShell } from "@/components/layout/AppShell";
import {
  addAcaoCarteira,
  createCarteira,
  deleteCarteira,
  getCarteiraById,
  getCarteiraResumo,
  getResumoAcoesUsuario,
  listCarteiras,
  removeAcaoCarteira,
  transferirAcao,
  updateCarteira,
  updatePosicaoCarteira,
} from "@/lib/api";

function toOptionalNumber(value: string): number | undefined {
  if (!value.trim()) {
    return undefined;
  }

  return Number(value);
}

export default function CarteirasPage() {
  return (
    <AppShell title="Carteiras" subtitle="Operacoes de carteira, posicoes, transferencia e resumos">
      <div className="grid gap-4 lg:grid-cols-2">
        <EndpointTester
          title="Criar carteira"
          endpoint="POST /carteiras"
          fields={[{ name: "nome", label: "Nome", required: true }]}
          onSubmit={(values) => createCarteira({ nome: values.nome })}
        />

        <EndpointTester
          title="Listar carteiras"
          endpoint="GET /carteiras"
          onSubmit={() => listCarteiras()}
        />

        <EndpointTester
          title="Buscar carteira por id"
          endpoint="GET /carteiras/{id}"
          fields={[{ name: "id", label: "ID da carteira", required: true }]}
          onSubmit={(values) => getCarteiraById(values.id)}
        />

        <EndpointTester
          title="Atualizar carteira"
          endpoint="PATCH /carteiras/{id}"
          fields={[
            { name: "id", label: "ID da carteira", required: true },
            { name: "nome", label: "Novo nome" },
          ]}
          onSubmit={(values) =>
            updateCarteira(values.id, {
              ...(values.nome.trim() ? { nome: values.nome } : {}),
            })
          }
        />

        <EndpointTester
          title="Remover carteira"
          endpoint="DELETE /carteiras/{id}"
          fields={[{ name: "id", label: "ID da carteira", required: true }]}
          onSubmit={(values) => deleteCarteira(values.id)}
        />

        <EndpointTester
          title="Adicionar acao na carteira"
          endpoint="POST /carteiras/{id}/acoes"
          fields={[
            { name: "id", label: "ID da carteira", required: true },
            { name: "acaoId", label: "ID da acao", required: true },
            { name: "quantidade", label: "Quantidade (opcional)", type: "number" },
            { name: "precoMedio", label: "Preco medio (opcional)", type: "number" },
          ]}
          onSubmit={(values) =>
            addAcaoCarteira(values.id, {
              acaoId: values.acaoId,
              ...(toOptionalNumber(values.quantidade) !== undefined
                ? { quantidade: toOptionalNumber(values.quantidade) }
                : {}),
              ...(toOptionalNumber(values.precoMedio) !== undefined
                ? { precoMedio: toOptionalNumber(values.precoMedio) }
                : {}),
            })
          }
        />

        <EndpointTester
          title="Atualizar posicao"
          endpoint="PATCH /carteiras/{id}/acoes/{acaoId}/posicao"
          fields={[
            { name: "id", label: "ID da carteira", required: true },
            { name: "acaoId", label: "ID da acao", required: true },
            { name: "quantidade", label: "Quantidade (opcional)", type: "number" },
            { name: "precoMedio", label: "Preco medio (opcional)", type: "number" },
          ]}
          onSubmit={(values) =>
            updatePosicaoCarteira(values.id, values.acaoId, {
              ...(toOptionalNumber(values.quantidade) !== undefined
                ? { quantidade: toOptionalNumber(values.quantidade) }
                : {}),
              ...(toOptionalNumber(values.precoMedio) !== undefined
                ? { precoMedio: toOptionalNumber(values.precoMedio) }
                : {}),
            })
          }
        />

        <EndpointTester
          title="Remover acao da carteira"
          endpoint="DELETE /carteiras/{id}/acoes/{acaoId}"
          fields={[
            { name: "id", label: "ID da carteira", required: true },
            { name: "acaoId", label: "ID da acao", required: true },
          ]}
          onSubmit={(values) => removeAcaoCarteira(values.id, values.acaoId)}
        />

        <EndpointTester
          title="Transferir acao entre carteiras"
          endpoint="POST /carteiras/transferencias"
          fields={[
            { name: "carteiraOrigemId", label: "Carteira origem", required: true },
            { name: "carteiraDestinoId", label: "Carteira destino", required: true },
            { name: "acaoId", label: "ID da acao", required: true },
            { name: "quantidade", label: "Quantidade", required: true, type: "number" },
          ]}
          onSubmit={(values) =>
            transferirAcao({
              carteiraOrigemId: values.carteiraOrigemId,
              carteiraDestinoId: values.carteiraDestinoId,
              acaoId: values.acaoId,
              quantidade: Number(values.quantidade),
            })
          }
        />

        <EndpointTester
          title="Resumo da carteira"
          endpoint="GET /carteiras/{id}/resumo"
          fields={[{ name: "id", label: "ID da carteira", required: true }]}
          onSubmit={(values) => getCarteiraResumo(values.id)}
        />

        <EndpointTester
          title="Resumo consolidado do usuario"
          endpoint="GET /carteiras/acoes/resumo"
          onSubmit={() => getResumoAcoesUsuario()}
        />
      </div>
    </AppShell>
  );
}
