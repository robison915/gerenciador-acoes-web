import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const AUTH_COOKIE_KEY = "auth_token";
const PROTECTED_ROUTES = ["/auth/me", "/acoes", "/carteiras"];
const GUEST_ROUTES = ["/auth/login", "/auth/register"];

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const token = request.cookies.get(AUTH_COOKIE_KEY)?.value;

  const isProtected = PROTECTED_ROUTES.some((route) => pathname.startsWith(route));

  if (isProtected && !token) {
    const loginUrl = new URL("/auth/login", request.url);
    loginUrl.searchParams.set("redirect", `${pathname}${search}`);
    return NextResponse.redirect(loginUrl);
  }

  const isGuestRoute = GUEST_ROUTES.some((route) => pathname.startsWith(route));

  if (isGuestRoute && token) {
    return NextResponse.redirect(new URL("/auth/me", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/auth/me", "/auth/login", "/auth/register", "/acoes/:path*", "/carteiras/:path*"],
};
