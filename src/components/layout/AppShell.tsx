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

export function LoadingPanel({ message = "Carregando dados..." }: { message?: string }) {
  return (
    <div className="flex items-center gap-3 rounded-md border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-blue-200 border-t-blue-700" />
      <span className="font-medium">{message}</span>
    </div>
  );
}

export function ProgressLog({ items }: { items: string[] }) {
  if (items.length === 0) {
    return null;
  }

  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
      <p className="font-semibold text-slate-900">Processamento</p>
      <ul className="mt-2 space-y-1">
        {items.slice(-8).map((item, index) => (
          <li key={`${item}-${index}`} className="flex gap-2">
            <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-blue-600" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
