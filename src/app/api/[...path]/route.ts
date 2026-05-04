import type { NextRequest } from "next/server";

const DEFAULT_API_URL = "http://localhost:3000";

function getConfiguredApiUrl() {
  return (process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? DEFAULT_API_URL).replace(/\/$/, "");
}

function isSameOrigin(left: URL, right: URL) {
  return left.protocol === right.protocol && left.hostname === right.hostname && left.port === right.port;
}

function toConfigurationError(message: string) {
  return Response.json({ message }, { status: 500 });
}

function buildTargetUrl(path: string[], request: NextRequest) {
  const pathname = path.join("/");
  const query = request.nextUrl.search;
  const configuredApiUrl = getConfiguredApiUrl();
  let targetBaseUrl: URL;

  try {
    targetBaseUrl = new URL(configuredApiUrl);
  } catch {
    throw new Error(`API_URL invalida: ${configuredApiUrl}. Informe uma URL absoluta, como http://localhost:3000.`);
  }

  if (isSameOrigin(targetBaseUrl, request.nextUrl)) {
    throw new Error(
      `API_URL aponta para o proprio frontend (${configuredApiUrl}). Configure API_URL para a URL do backend NestJS.`,
    );
  }

  return new URL(`${targetBaseUrl.pathname.replace(/\/$/, "")}/${pathname}${query}`, targetBaseUrl).toString();
}

async function proxy(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  let targetUrl: string;

  try {
    targetUrl = buildTargetUrl(path, request);
  } catch (error) {
    return toConfigurationError(error instanceof Error ? error.message : "Configuracao invalida da API.");
  }

  const headers = new Headers();
  const contentType = request.headers.get("content-type");
  const authorization = request.headers.get("authorization");

  if (contentType) {
    headers.set("content-type", contentType);
  }

  if (authorization) {
    headers.set("authorization", authorization);
  }

  const method = request.method.toUpperCase();
  const hasBody = method !== "GET" && method !== "HEAD";
  const body = hasBody ? await request.arrayBuffer() : undefined;

  const upstreamResponse = await fetch(targetUrl, {
    method,
    headers,
    body,
    cache: "no-store",
  });

  const responseText = await upstreamResponse.text();
  const responseHeaders = new Headers();
  const upstreamContentType = upstreamResponse.headers.get("content-type");

  if (upstreamContentType) {
    responseHeaders.set("content-type", upstreamContentType);
  }

  return new Response(responseText, {
    status: upstreamResponse.status,
    headers: responseHeaders,
  });
}

export function GET(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  return proxy(request, context);
}

export function POST(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  return proxy(request, context);
}

export function PUT(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  return proxy(request, context);
}

export function PATCH(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  return proxy(request, context);
}

export function DELETE(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  return proxy(request, context);
}
