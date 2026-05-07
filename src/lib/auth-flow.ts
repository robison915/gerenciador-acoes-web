import type { UserRole } from "@/lib/api";

export function getSafeRedirect(redirectParam: string | null | undefined) {
  return redirectParam?.startsWith("/") ? redirectParam : "/";
}

export function getPostLoginRedirect(
  redirectParam: string | null | undefined,
  role: UserRole | null | undefined,
) {
  if (role === "ADMIN") {
    return "/admin";
  }

  const redirect = getSafeRedirect(redirectParam);
  return redirect.startsWith("/admin") ? "/" : redirect;
}
