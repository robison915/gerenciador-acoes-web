import Link from "next/link";
import { PropsWithChildren } from "react";

type AuthShellProps = PropsWithChildren<{
  title: string;
  subtitle: string;
}>;

export function AuthShell({ title, subtitle, children }: AuthShellProps) {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-950">
      <div className="mx-auto grid min-h-screen w-full max-w-6xl items-center gap-8 px-4 py-8 sm:px-8 lg:grid-cols-[1fr_440px]">
        <section className="hidden text-white lg:block">
          <Link href="/" className="text-sm font-semibold uppercase tracking-wide text-cyan-200">
            Gerenciador de Acoes
          </Link>
          <h1 className="mt-8 max-w-xl text-5xl font-semibold leading-tight tracking-tight">
            Controle compras, vendas e performance com clareza.
          </h1>
          <p className="mt-5 max-w-lg text-base leading-7 text-slate-300">
            Uma area de trabalho para acompanhar posicoes, operacoes e resultados da sua carteira conforme os dados do backend evoluem.
          </p>
          <div className="mt-8 grid max-w-xl grid-cols-3 gap-3 text-sm">
            <div className="rounded-md border border-white/10 bg-white/10 p-4">
              <p className="font-semibold text-white">Acoes</p>
              <p className="mt-1 text-slate-300">Compras e vendas</p>
            </div>
            <div className="rounded-md border border-white/10 bg-white/10 p-4">
              <p className="font-semibold text-white">Carteiras</p>
              <p className="mt-1 text-slate-300">Organizacao</p>
            </div>
            <div className="rounded-md border border-white/10 bg-white/10 p-4">
              <p className="font-semibold text-white">Performance</p>
              <p className="mt-1 text-slate-300">Resultado</p>
            </div>
          </div>
        </section>

        <section className="w-full rounded-lg border border-slate-200 bg-white p-6 shadow-2xl shadow-slate-950/30 sm:p-8">
          <header className="mb-7 flex flex-col gap-2">
            <Link href="/" className="text-sm font-semibold uppercase tracking-wide text-blue-700 lg:hidden">
              Gerenciador de Acoes
            </Link>
            <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
            <p className="text-sm leading-6 text-slate-600">{subtitle}</p>
          </header>

          <div className="space-y-5">{children}</div>

          <footer className="mt-8 border-t border-slate-200 pt-4 text-sm text-slate-600">
            <nav className="flex flex-wrap gap-x-4 gap-y-2">
              <Link className="font-medium text-slate-700 hover:text-blue-700" href="/auth/login">
                Entrar
              </Link>
              <Link className="font-medium text-slate-700 hover:text-blue-700" href="/auth/register">
                Criar conta
              </Link>
              <Link className="font-medium text-slate-700 hover:text-blue-700" href="/auth/password/forgot">
                Recuperar senha
              </Link>
            </nav>
          </footer>
        </section>
      </div>
    </main>
  );
}
