export type ApiError = {
  message: string;
  status?: number;
};

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ?? "/api";

const AUTH_TOKEN_KEY = "auth_token";
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

type RequestOptions = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  token?: string | null;
  withAuth?: boolean;
};

function toApiError(message: string, status?: number): ApiError {
  return { message, status };
}

function redirectToLogin() {
  if (typeof window === "undefined") {
    return;
  }

  const redirect = `${window.location.pathname}${window.location.search}`;
  const loginUrl = new URL("/auth/login", window.location.origin);
  loginUrl.searchParams.set("redirect", redirect);
  window.location.assign(loginUrl.toString());
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const url = `${API_BASE_URL}${path}`;
  const token = options.token ?? (options.withAuth ? getAuthToken() : null);
  let response: Response;

  try {
    response = await fetch(url, {
      method: options.method ?? "GET",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
      cache: "no-store",
    });
  } catch {
    throw toApiError(
      `Falha de conexao com ${url}. Verifique se a API esta no ar e se o CORS permite a origem do front.`,
    );
  }

  const text = await response.text();
  let data: unknown = null;

  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { message: text };
    }
  }

  if (!response.ok) {
    if (response.status === 401 && options.withAuth) {
      clearAuthToken();
      redirectToLogin();
    }

    const maybeData = data as { message?: string | string[] } | null;
    const message =
      maybeData?.message && typeof maybeData.message === "string"
        ? maybeData.message
        : Array.isArray(maybeData?.message)
          ? maybeData.message.join(" | ")
          : `Request failed with status ${response.status}`;

    throw toApiError(message, response.status);
  }

  return data as T;
}

export type RegisterPayload = {
  email: string;
  password: string;
};

export type LoginPayload = {
  email: string;
  password: string;
};

export type ForgotPasswordPayload = {
  email: string;
};

export type ResetPasswordPayload = {
  token: string;
  newPassword: string;
};

export type OperacaoAcaoPayload = {
  ticker: string;
  quantidade: number;
  valorUnitario: number;
  dataOperacao?: string;
  carteiraId?: string;
};

export type OperacaoAcaoResponse = OperacaoAcaoPayload & {
  id: string;
  userId: string;
  valorTotal: number;
  tipoOperacao: "COMPRA" | "VENDA";
  dataOperacao: string;
  createdAt: string;
  criterioApuracao?: "FIFO";
  custoTotal?: number;
  lucroRealizado?: number;
};

export type PosicaoAcao = {
  ticker: string;
  quantidade: number;
  precoMedio: number;
  valorInvestido: number;
  cotacaoAtual: number | null;
  valorAtual: number | null;
  variacaoAbsoluta: number | null;
  variacaoPercentual: number | null;
  totalOperacoesCompra: number;
  totalOperacoesVenda?: number;
};

export type ListarAcoesResponse = {
  items: PosicaoAcao[];
  totalAtivos: number;
};

export type PerformanceAcao = {
  ticker: string;
  quantidade: number;
  precoMedio: number;
  precoReferencia: number;
  valorInvestido: number;
  valorAtual: number;
  variacaoAbsoluta: number;
  variacaoPercentual: number;
};

export type PerformanceAcoesResponse = {
  items: PerformanceAcao[];
  totalAtivos: number;
  valorInvestidoTotal: number;
  valorAtualTotal: number;
  variacaoAbsolutaTotal: number;
  variacaoPercentualTotal: number;
};

export type OperacoesAcoesResponse = {
  items: OperacaoAcaoResponse[];
  totalOperacoes: number;
};

export type ResultadoVenda = OperacaoAcaoResponse & {
  criterioApuracao: "FIFO";
  custoTotal: number;
  ganhoPerda: number;
  tipoResultado: "GANHO" | "PERDA" | "EMPATE";
};

export type ResultadoVendasResponse = {
  items: ResultadoVenda[];
  totalVendas: number;
  ganhoPerdaTotal: number;
};

export type TickerCadastrado = {
  id: string;
  ticker: string;
  ultimaCotacao: number | null;
  dataHoraUltimaCotacao: string | null;
  createdAt: string;
};

export type ListarTickersResponse = {
  items: TickerCadastrado[];
  totalTickers: number;
};

export type Carteira = {
  id: string;
  userId: string;
  nome: string;
  createdAt: string;
  updatedAt: string;
};

export type CarteiraPosicao = {
  ticker: string;
  quantidade: number;
  precoMedio: number;
  valorInvestido: number;
  cotacaoAtual: number | null;
  valorAtual: number | null;
  variacaoAbsoluta: number | null;
  variacaoPercentual: number | null;
};

export type CarteiraDetalhe = Carteira & {
  posicoes: CarteiraPosicao[];
  totalAtivos: number;
  valorInvestidoTotal: number;
  valorAtualTotal: number;
  variacaoAbsolutaTotal: number;
  variacaoPercentualTotal: number;
};

export type ListarCarteirasResponse = {
  items: Carteira[];
  totalCarteiras: number;
};

export type MovimentarAcaoCarteiraPayload = {
  ticker: string;
  quantidade: number;
  dataOperacao?: string;
};

export type RemoverAcaoCarteiraPayload = {
  quantidade: number;
  dataOperacao?: string;
};

export type MovimentarAcaoEntreCarteirasPayload = {
  carteiraOrigemId: string;
  carteiraDestinoId: string;
  ticker: string;
  quantidade: number;
  dataOperacao?: string;
};

export type MovimentarAcaoCarteiraResponse = {
  ticker: string;
  quantidade: number;
  valorUnitario: number;
  carteiraOrigemId: string | null;
  carteiraDestinoId: string | null;
  vendaOperacaoId: string;
  compraOperacaoId: string;
  dataOperacao: string;
};

export function healthcheck() {
  return apiRequest<Record<string, unknown>>("/", { method: "GET" });
}

export function register(payload: RegisterPayload) {
  return apiRequest<unknown>("/auth/register", {
    method: "POST",
    body: payload,
  });
}

export async function login(payload: LoginPayload) {
  const result = await apiRequest<
    { accessToken?: string; access_token?: string; token?: string } & Record<string, unknown>
  >("/auth/login", {
    method: "POST",
    body: payload,
  });

  const token =
    typeof result.accessToken === "string"
      ? result.accessToken
      : typeof result.access_token === "string"
        ? result.access_token
        : typeof result.token === "string"
          ? result.token
          : null;

  if (token) {
    setAuthToken(token);
  }

  return result;
}

export function forgotPassword(payload: ForgotPasswordPayload) {
  return apiRequest<unknown>("/auth/password/forgot", {
    method: "POST",
    body: payload,
  });
}

export function resetPassword(payload: ResetPasswordPayload) {
  return apiRequest<unknown>("/auth/password/reset", {
    method: "POST",
    body: payload,
  });
}

export function getMe(token?: string | null) {
  return apiRequest<Record<string, unknown>>("/auth/me", {
    method: "GET",
    withAuth: true,
    token,
  });
}

export function registrarCompra(payload: OperacaoAcaoPayload) {
  return apiRequest<OperacaoAcaoResponse>("/acoes/compras", {
    method: "POST",
    body: payload,
    withAuth: true,
  });
}

export function registrarComprasLote(compras: OperacaoAcaoPayload[]) {
  return apiRequest<{
    items: OperacaoAcaoResponse[];
    totalCompras: number;
    valorTotalLote: number;
  }>("/acoes/compras/lote", {
    method: "POST",
    body: { compras },
    withAuth: true,
  });
}

export function registrarVenda(payload: OperacaoAcaoPayload) {
  return apiRequest<OperacaoAcaoResponse>("/acoes/vendas", {
    method: "POST",
    body: payload,
    withAuth: true,
  });
}

export function registrarVendasLote(vendas: OperacaoAcaoPayload[]) {
  return apiRequest<{
    items: OperacaoAcaoResponse[];
    totalVendas: number;
    valorTotalLote: number;
  }>("/acoes/vendas/lote", {
    method: "POST",
    body: { vendas },
    withAuth: true,
  });
}

export function listAcoes() {
  return apiRequest<ListarAcoesResponse>("/acoes", { method: "GET", withAuth: true });
}

export function listAcoesAvulsas() {
  return apiRequest<ListarAcoesResponse>("/acoes/avulsas", { method: "GET", withAuth: true });
}

export function getAcaoByTicker(ticker: string) {
  return apiRequest<PosicaoAcao>(`/acoes/${encodeURIComponent(ticker)}`, { method: "GET", withAuth: true });
}

export function listOperacoesAcoes() {
  return apiRequest<OperacoesAcoesResponse>("/acoes/operacoes", { method: "GET", withAuth: true });
}

export function listResultadoVendas() {
  return apiRequest<ResultadoVendasResponse>("/acoes/vendas/resultado", { method: "GET", withAuth: true });
}

export function getPerformanceAcoes() {
  return apiRequest<PerformanceAcoesResponse>("/acoes/performance", { method: "GET", withAuth: true });
}

export function listTickers() {
  return apiRequest<ListarTickersResponse>("/acoes/tickers", { method: "GET", withAuth: true });
}

export function createCarteira(payload: { nome: string }) {
  return apiRequest<Carteira>("/carteiras", { method: "POST", body: payload, withAuth: true });
}

export function listCarteiras() {
  return apiRequest<ListarCarteirasResponse>("/carteiras", { method: "GET", withAuth: true });
}

export function getCarteiraById(id: string) {
  return apiRequest<CarteiraDetalhe>(`/carteiras/${id}`, { method: "GET", withAuth: true });
}

export function deleteCarteira(id: string) {
  return apiRequest<{ ok: true }>(`/carteiras/${id}`, { method: "DELETE", withAuth: true });
}

export function adicionarAcaoAvulsaEmCarteira(carteiraId: string, payload: MovimentarAcaoCarteiraPayload) {
  return apiRequest<MovimentarAcaoCarteiraResponse>(`/carteiras/${encodeURIComponent(carteiraId)}/acoes`, {
    method: "POST",
    body: payload,
    withAuth: true,
  });
}

export function removerAcaoDaCarteira(carteiraId: string, ticker: string, payload: RemoverAcaoCarteiraPayload) {
  return apiRequest<MovimentarAcaoCarteiraResponse>(
    `/carteiras/${encodeURIComponent(carteiraId)}/acoes/${encodeURIComponent(ticker)}`,
    {
      method: "DELETE",
      body: payload,
      withAuth: true,
    },
  );
}

export function movimentarAcaoEntreCarteiras(payload: MovimentarAcaoEntreCarteirasPayload) {
  return apiRequest<MovimentarAcaoCarteiraResponse>("/carteiras/movimentacoes", {
    method: "POST",
    body: payload,
    withAuth: true,
  });
}

export function getAuthToken(): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  const fromStorage = window.localStorage.getItem(AUTH_TOKEN_KEY);

  if (fromStorage) {
    return fromStorage;
  }

  const cookies = document.cookie.split(";").map((cookie) => cookie.trim());
  const tokenCookie = cookies.find((cookie) => cookie.startsWith(`${AUTH_TOKEN_KEY}=`));

  if (!tokenCookie) {
    return null;
  }

  const [, value] = tokenCookie.split("=");
  return value ? decodeURIComponent(value) : null;
}

export function setAuthToken(token: string) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(AUTH_TOKEN_KEY, token);
  document.cookie = `${AUTH_TOKEN_KEY}=${encodeURIComponent(token)}; Path=/; Max-Age=${COOKIE_MAX_AGE_SECONDS}; SameSite=Lax`;
}

export function clearAuthToken() {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(AUTH_TOKEN_KEY);
  document.cookie = `${AUTH_TOKEN_KEY}=; Path=/; Max-Age=0; SameSite=Lax`;
}
