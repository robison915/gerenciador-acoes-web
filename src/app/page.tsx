import Link from "next/link";

const routes = [
  {
    title: "Login",
    description: "Autenticar e salvar token localmente",
    href: "/auth/login",
  },
  {
    title: "Registro",
    description: "Criar usuario no backend",
    href: "/auth/register",
  },
  {
    title: "Esqueci senha",
    description: "Solicitar reset de senha",
    href: "/auth/password/forgot",
  },
  {
    title: "Resetar senha",
    description: "Enviar token + nova senha",
    href: "/auth/password/reset",
  },
  {
    title: "Meu perfil",
    description: "Consultar endpoint protegido /auth/me",
    href: "/auth/me",
  },
  {
    title: "Acoes",
    description: "CRUD de acoes, cotacoes e eventos corporativos",
    href: "/acoes",
  },
  {
    title: "Carteiras",
    description: "CRUD de carteiras, posicoes, transferencias e resumos",
    href: "/carteiras",
  },
];

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-100 px-4 py-8 text-slate-900 sm:px-8">
      <div className="mx-auto w-full max-w-5xl space-y-6">
        <header className="space-y-2">
          <p className="text-sm font-semibold uppercase tracking-wide text-blue-700">Gerenciador de Acoes</p>
          <h1 className="text-3xl font-semibold tracking-tight">Telas do Swagger</h1>
          <p className="text-sm text-slate-600">
            Front criado para testar endpoints do NestJS. O padrao usa proxy interno com <code>API_URL</code>.
          </p>
        </header>

        <section className="grid gap-4 sm:grid-cols-2">
          {routes.map((route) => (
            <Link
              key={route.href}
              href={route.href}
              className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-blue-300 hover:shadow"
            >
              <h2 className="text-lg font-semibold">{route.title}</h2>
              <p className="mt-1 text-sm text-slate-600">{route.description}</p>
              <p className="mt-3 text-sm font-medium text-blue-700">Abrir tela</p>
            </Link>
          ))}
        </section>
      </div>
    </main>
  );
}
