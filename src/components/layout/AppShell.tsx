import Link from "next/link";
import { PropsWithChildren } from "react";

type AppShellProps = PropsWithChildren<{
  title: string;
  subtitle?: string;
}>;

export function AppShell({ title, subtitle, children }: AppShellProps) {
  return (
    <main className="min-h-screen bg-slate-100 text-slate-900">
      <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-8">
        <header className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-wide text-blue-700">Gerenciador de Acoes</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">{title}</h1>
          {subtitle ? <p className="mt-1 text-sm text-slate-600">{subtitle}</p> : null}

          <nav className="mt-4 flex flex-wrap gap-3 text-sm">
            <Link className="underline" href="/">
              Inicio
            </Link>
            <Link className="underline" href="/acoes">
              Acoes
            </Link>
            <Link className="underline" href="/carteiras">
              Carteiras
            </Link>
            <Link className="underline" href="/auth/me">
              Meu perfil
            </Link>
            <Link className="underline" href="/auth/login">
              Login
            </Link>
          </nav>
        </header>

        <section className="space-y-4">{children}</section>
      </div>
    </main>
  );
}
