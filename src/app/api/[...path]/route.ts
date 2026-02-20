import type { NextRequest } from "next/server";

const TARGET_API_URL = (process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000").replace(
  /\/$/,
  "",
);

function buildTargetUrl(path: string[], request: NextRequest) {
  const pathname = path.join("/");
  const query = request.nextUrl.search;
  return `${TARGET_API_URL}/${pathname}${query}`;
}

async function proxy(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  const targetUrl = buildTargetUrl(path, request);

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
  const body = hasBody ? await request.text() : undefined;

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
