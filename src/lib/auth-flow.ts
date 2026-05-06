export function getSafeRedirect(redirectParam: string | null | undefined) {
  return redirectParam?.startsWith("/") ? redirectParam : "/";
}
