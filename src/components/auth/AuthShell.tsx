import Link from "next/link";
import { PropsWithChildren } from "react";

type AuthShellProps = PropsWithChildren<{
  title: string;
  subtitle: string;
}>;

export function AuthShell({ title, subtitle, children }: AuthShellProps) {
  return (
    <main className="min-h-screen bg-slate-100 text-slate-900">
      <div className="mx-auto flex min-h-screen w-full max-w-5xl items-center px-4 py-8 sm:px-8">
        <section className="w-full rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-10">
          <header className="mb-8 flex flex-col gap-2">
            <p className="text-sm font-semibold uppercase tracking-wide text-blue-700">
              Gerenciador de Acoes
            </p>
            <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
            <p className="text-sm text-slate-600">{subtitle}</p>
          </header>

          <div className="space-y-4">{children}</div>

          <footer className="mt-8 border-t border-slate-200 pt-4 text-sm text-slate-600">
            <nav className="flex flex-wrap gap-3">
              <Link className="underline" href="/auth/login">
                Login
              </Link>
              <Link className="underline" href="/auth/register">
                Registro
              </Link>
              <Link className="underline" href="/auth/password/forgot">
                Esqueci senha
              </Link>
              <Link className="underline" href="/auth/password/reset">
                Resetar senha
              </Link>
              <Link className="underline" href="/auth/me">
                Meu perfil
              </Link>
              <Link className="underline" href="/acoes">
                Acoes
              </Link>
              <Link className="underline" href="/carteiras">
                Carteiras
              </Link>
            </nav>
          </footer>
        </section>
      </div>
    </main>
  );
}
