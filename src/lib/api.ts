export type ApiError = {
  message: string;
  status?: number;
};

export type UserRole = "CLIENTE" | "ADMIN";

export type CurrentUser = {
  userId: string;
  email: string;
  role: UserRole;
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
  const isFormData = typeof FormData !== "undefined" && options.body instanceof FormData;
  let response: Response;

  try {
    response = await fetch(url, {
      method: options.method ?? "GET",
      headers: {
        ...(isFormData ? {} : { "Content-Type": "application/json" }),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: options.body ? (isFormData ? (options.body as FormData) : JSON.stringify(options.body)) : undefined,
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
  limit: number;
  offset: number;
  hasNextPage: boolean;
  nextOffset: number | null;
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

export type ImportacaoB3Item = {
  linha: number;
  tipoOperacao: "COMPRA" | "VENDA";
  ticker: string;
  quantidade: number;
  valorUnitario: number;
  valorTotal: number;
  dataOperacao: string;
  carteiraId: string | null;
  status: "VALIDO" | "ERRO";
  avisos: string[];
  erros: string[];
};

export type ImportacaoB3 = {
  id: string;
  userId: string;
  status: "REVISADA" | "DISTRIBUIDA";
  nomeArquivo: string | null;
  totalLinhas: number;
  totalCompras: number;
  totalVendas: number;
  totalErros: number;
  itens: ImportacaoB3Item[];
  createdAt: string;
  updatedAt: string;
};

export type DistribuirImportacaoB3Payload = {
  aplicarProjecoes?: boolean;
  itens?: Array<{
    linha: number;
    carteiraId?: string | null;
  }>;
};

export type EventoCorporativo = {
  id: string;
  ticker: string;
  tickerDestino: string | null;
  tipo: "DESDOBRAMENTO" | "GRUPAMENTO" | "ALTERACAO_TICKER";
  dataEvento: string;
  fatorQuantidade: number;
  fatorPreco: number;
  observacao: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ListarEventosCorporativosResponse = {
  items: EventoCorporativo[];
  totalEventos: number;
};

export type ProcessarEventosCorporativosResponse = {
  totalEventos: number;
  eventosProcessados: number;
  operacoesAtualizadas: number;
  tickersAtualizados: number;
  tickersRemovidos: number;
  tickersCriados: number;
  items: {
    eventoId: string;
    ticker: string;
    tickerDestino: string;
    operacoesAtualizadas: number;
    tickerOrigemAtualizado: boolean;
    tickerOrigemRemovido: boolean;
    tickerDestinoCriado: boolean;
  }[];
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

export type CarteiraPerformance = PerformanceAcoesResponse & {
  carteiraId: string;
  nome: string;
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

export type ProjetarAjusteCarteiraAtivoPayload = {
  ticker: string;
  percentual?: number;
};

export type ProjetarAjusteCarteiraPayload = {
  saldoInformado: number;
  ativos: ProjetarAjusteCarteiraAtivoPayload[];
};

export type CarteiraProjecaoAtivo = {
  ticker: string;
  percentual: number;
  cotacaoAtual: number;
  quantidadeAtual: number;
  quantidadeProjetada: number;
  valorProjetado: number;
  novo: boolean;
};

export type CarteiraProjecaoOperacao = {
  ticker: string;
  quantidade: number;
  valorUnitario: number;
  valorTotal: number;
};

export type CarteiraProjecao = {
  id: string;
  userId: string;
  carteiraId: string;
  saldoInformado: number;
  valorCarteiraAtual: number;
  saldoTotalProjetado: number;
  valorProjetadoAlocado: number;
  saldoResidualEstimado: number;
  ativos: CarteiraProjecaoAtivo[];
  compras: CarteiraProjecaoOperacao[];
  vendas: CarteiraProjecaoOperacao[];
  createdAt: string;
  updatedAt: string;
};

export type ListarCarteiraProjecoesResponse = {
  items: CarteiraProjecao[];
  totalProjecoes: number;
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
    { accessToken?: string; access_token?: string; token?: string; user?: { role?: UserRole } } & Record<string, unknown>
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
  return apiRequest<CurrentUser>("/auth/me", {
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

export function listOperacoesAcoes(options: { limit?: number; offset?: number } = {}) {
  const params = new URLSearchParams();

  if (typeof options.limit === "number") {
    params.set("limit", String(options.limit));
  }
  if (typeof options.offset === "number") {
    params.set("offset", String(options.offset));
  }

  const query = params.toString();
  return apiRequest<OperacoesAcoesResponse>(`/acoes/operacoes${query ? `?${query}` : ""}`, {
    method: "GET",
    withAuth: true,
  });
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

export function importarB3Arquivo(file: File) {
  const formData = new FormData();
  formData.append("arquivo", file);

  return apiRequest<ImportacaoB3>("/acoes/importacoes/b3", {
    method: "POST",
    body: formData,
    withAuth: true,
  });
}

export function consultarUltimaImportacaoB3() {
  return apiRequest<ImportacaoB3>("/acoes/importacoes/b3/ultima", {
    method: "GET",
    withAuth: true,
  });
}

export function distribuirUltimaImportacaoB3(payload: DistribuirImportacaoB3Payload) {
  return apiRequest<ImportacaoB3>("/acoes/importacoes/b3/ultima/distribuicao", {
    method: "POST",
    body: payload,
    withAuth: true,
  });
}

export function listEventosCorporativos() {
  return apiRequest<ListarEventosCorporativosResponse>("/admin/eventos-corporativos", {
    method: "GET",
    withAuth: true,
  });
}

export function createEventoCorporativo(payload: {
  ticker: string;
  tickerDestino?: string;
  tipo: "DESDOBRAMENTO" | "GRUPAMENTO" | "ALTERACAO_TICKER";
  dataEvento: string;
  fatorQuantidade: number;
  fatorPreco: number;
  observacao?: string;
}) {
  return apiRequest<EventoCorporativo>("/admin/eventos-corporativos", {
    method: "POST",
    body: payload,
    withAuth: true,
  });
}

export function processarEventosCorporativos() {
  return apiRequest<ProcessarEventosCorporativosResponse>("/admin/eventos-corporativos/processar", {
    method: "POST",
    withAuth: true,
  });
}

export function createAdminUser(payload: { email: string; password: string }) {
  return apiRequest<{ id: string; email: string; role: "ADMIN" }>("/admin/usuarios/admins", {
    method: "POST",
    body: payload,
    withAuth: true,
  });
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

export function getCarteiraPerformance(id: string) {
  return apiRequest<CarteiraPerformance>(`/carteiras/${encodeURIComponent(id)}/performance`, {
    method: "GET",
    withAuth: true,
  });
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

export function projetarAjusteCarteira(carteiraId: string, payload: ProjetarAjusteCarteiraPayload) {
  return apiRequest<CarteiraProjecao>(`/carteiras/${encodeURIComponent(carteiraId)}/projecoes`, {
    method: "POST",
    body: payload,
    withAuth: true,
  });
}

export function listarProjecoesCarteira(carteiraId: string) {
  return apiRequest<ListarCarteiraProjecoesResponse>(`/carteiras/${encodeURIComponent(carteiraId)}/projecoes`, {
    method: "GET",
    withAuth: true,
  });
}

export function excluirProjecaoCarteira(carteiraId: string, projecaoId: string) {
  return apiRequest<{ ok: true }>(
    `/carteiras/${encodeURIComponent(carteiraId)}/projecoes/${encodeURIComponent(projecaoId)}`,
    {
      method: "DELETE",
      withAuth: true,
    },
  );
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
