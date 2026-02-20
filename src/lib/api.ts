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

export function createAcao(payload: { ticker: string; nome: string }) {
  return apiRequest<unknown>("/acoes", { method: "POST", body: payload, withAuth: true });
}

export function listAcoes() {
  return apiRequest<unknown>("/acoes", { method: "GET", withAuth: true });
}

export function updateCotacoes() {
  return apiRequest<unknown>("/acoes/cotacoes/atualizar", { method: "POST", withAuth: true });
}

export function getAcaoById(id: string) {
  return apiRequest<unknown>(`/acoes/${id}`, { method: "GET", withAuth: true });
}

export function updateAcao(id: string, payload: { ticker?: string; nome?: string }) {
  return apiRequest<unknown>(`/acoes/${id}`, { method: "PATCH", body: payload, withAuth: true });
}

export function deleteAcao(id: string) {
  return apiRequest<unknown>(`/acoes/${id}`, { method: "DELETE", withAuth: true });
}

export function createEventoCorporativo(
  id: string,
  payload: {
    tipo: string;
    effectiveAt?: string;
    ratioNumerator?: number;
    ratioDenominator?: number;
    fractionTreatment?: string;
    newTicker?: string;
    observacao?: string;
  },
) {
  return apiRequest<unknown>(`/acoes/${id}/eventos-corporativos`, {
    method: "POST",
    body: payload,
    withAuth: true,
  });
}

export function createCarteira(payload: { nome: string }) {
  return apiRequest<unknown>("/carteiras", { method: "POST", body: payload, withAuth: true });
}

export function listCarteiras() {
  return apiRequest<unknown>("/carteiras", { method: "GET", withAuth: true });
}

export function getCarteiraById(id: string) {
  return apiRequest<unknown>(`/carteiras/${id}`, { method: "GET", withAuth: true });
}

export function updateCarteira(id: string, payload: { nome?: string }) {
  return apiRequest<unknown>(`/carteiras/${id}`, { method: "PATCH", body: payload, withAuth: true });
}

export function deleteCarteira(id: string) {
  return apiRequest<unknown>(`/carteiras/${id}`, { method: "DELETE", withAuth: true });
}

export function addAcaoCarteira(
  id: string,
  payload: { acaoId: string; quantidade?: number; precoMedio?: number },
) {
  return apiRequest<unknown>(`/carteiras/${id}/acoes`, { method: "POST", body: payload, withAuth: true });
}

export function updatePosicaoCarteira(
  id: string,
  acaoId: string,
  payload: { quantidade?: number; precoMedio?: number },
) {
  return apiRequest<unknown>(`/carteiras/${id}/acoes/${acaoId}/posicao`, {
    method: "PATCH",
    body: payload,
    withAuth: true,
  });
}

export function removeAcaoCarteira(id: string, acaoId: string) {
  return apiRequest<unknown>(`/carteiras/${id}/acoes/${acaoId}`, { method: "DELETE", withAuth: true });
}

export function transferirAcao(payload: {
  carteiraOrigemId: string;
  carteiraDestinoId: string;
  acaoId: string;
  quantidade: number;
}) {
  return apiRequest<unknown>("/carteiras/transferencias", { method: "POST", body: payload, withAuth: true });
}

export function getCarteiraResumo(id: string) {
  return apiRequest<unknown>(`/carteiras/${id}/resumo`, { method: "GET", withAuth: true });
}

export function getResumoAcoesUsuario() {
  return apiRequest<unknown>("/carteiras/acoes/resumo", { method: "GET", withAuth: true });
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
