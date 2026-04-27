"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, type FormEvent, useState } from "react";
import { AuthForm, Feedback, FormField, SubmitButton } from "@/components/auth/AuthForm";
import { AuthShell } from "@/components/auth/AuthShell";
import type { ApiError } from "@/lib/api";
import { login } from "@/lib/api";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      await login({ email, password });
      const redirectParam = searchParams.get("redirect");
      const redirectTo = redirectParam && redirectParam.startsWith("/") ? redirectParam : "/";
      router.push(redirectTo);
    } catch (err) {
      const apiError = err as ApiError;
      setError(apiError.message);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <>
      <AuthForm onSubmit={onSubmit}>
        <FormField
          id="email"
          label="Email"
          type="email"
          value={email}
          required
          autoComplete="email"
          placeholder="voce@email.com"
          onChange={setEmail}
        />
        <FormField
          id="password"
          label="Senha"
          type="password"
          value={password}
          required
          autoComplete="current-password"
          placeholder="Sua senha"
          onChange={setPassword}
        />
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <SubmitButton label="Entrar" loadingLabel="Entrando..." isLoading={isLoading} />
          <Link className="text-sm font-medium text-blue-700 hover:text-blue-900" href="/auth/password/forgot">
            Esqueci minha senha
          </Link>
        </div>
        <Feedback error={error} />
      </AuthForm>

      <p className="text-sm text-slate-600">
        Ainda nao tem conta?{" "}
        <Link className="font-semibold text-blue-700 hover:text-blue-900" href="/auth/register">
          Criar conta
        </Link>
      </p>
    </>
  );
}

export default function LoginPage() {
  return (
    <AuthShell title="Entrar na conta" subtitle="Acesse sua area para acompanhar posicoes, compras, vendas e performance.">
      <Suspense fallback={<p className="text-sm text-slate-600">Carregando acesso...</p>}>
        <LoginForm />
      </Suspense>
    </AuthShell>
  );
}

