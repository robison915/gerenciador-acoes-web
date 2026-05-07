import type { UserRole } from "@/lib/api";

export type NavigationItem = {
  href: string;
  label: string;
  roles?: UserRole[];
};

export const APP_NAV_ITEMS: NavigationItem[] = [
  { href: "/", label: "Visao geral", roles: ["CLIENTE"] },
  { href: "/acoes", label: "Acoes", roles: ["CLIENTE"] },
  { href: "/carteiras", label: "Carteiras", roles: ["CLIENTE"] },
  { href: "/carteiras/ajuste", label: "Ajuste", roles: ["CLIENTE"] },
  { href: "/admin", label: "Administracao", roles: ["ADMIN"] },
  { href: "/auth/me", label: "Conta" },
];

export function getNavigationItemsForRole(role: UserRole | null | undefined) {
  return APP_NAV_ITEMS.filter((item) => !item.roles || (role ? item.roles.includes(role) : false));
}
