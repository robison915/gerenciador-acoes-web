import Link from "next/link";
import { PropsWithChildren } from "react";

type AppShellProps = PropsWithChildren<{
  title: string;
  subtitle?: string;
}>;

export function AppShell({ title, subtitle, children }: AppShellProps) {
  const navItems = [
    { href: "/", label: "Visao geral" },
    { href: "/acoes", label: "Acoes" },
    { href: "/carteiras", label: "Carteiras" },
    { href: "/admin", label: "Administracao" },
    { href: "/auth/me", label: "Conta" },
  ];

  return (
    <main className="min-h-screen bg-slate-100 text-slate-950">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <Link href="/" className="text-sm font-semibold uppercase tracking-wide text-blue-700">
              Gerenciador de Acoes
            </Link>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight">{title}</h1>
            {subtitle ? <p className="mt-1 text-sm text-slate-600">{subtitle}</p> : null}
          </div>

          <nav className="flex flex-wrap gap-2 text-sm">
            {navItems.map((item) => (
              <Link
                key={item.href}
                className="rounded-md border border-slate-200 px-3 py-2 font-medium text-slate-700 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-800"
                href={item.href}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>

      <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6">
        <section className="space-y-5">{children}</section>
      </div>
    </main>
  );
}
