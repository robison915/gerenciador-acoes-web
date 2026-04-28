"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, type FormEvent, useState } from "react";
import { AuthForm, Feedback, FormField, SubmitButton } from "@/components/auth/AuthForm";
import { AuthShell } from "@/components/auth/AuthShell";
import { getMe, login } from "@/lib/api";
import type { ApiError } from "@/lib/api";

function AdminLoginForm() {
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
      const user = await getMe();
      if (user.role !== "ADMIN") {
        setError("Este acesso e restrito a administradores.");
        return;
      }

      const redirectParam = searchParams.get("redirect");
      const redirectTo = redirectParam && redirectParam.startsWith("/") ? redirectParam : "/admin";
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
          id="admin-email"
          label="Email administrativo"
          type="email"
          value={email}
          required
          autoComplete="email"
          placeholder="admin@email.com"
          onChange={setEmail}
        />
        <FormField
          id="admin-password"
          label="Senha"
          type="password"
          value={password}
          required
          autoComplete="current-password"
          placeholder="Senha do administrador"
          onChange={setPassword}
        />
        <SubmitButton label="Entrar como admin" loadingLabel="Entrando..." isLoading={isLoading} />
        <Feedback error={error} />
      </AuthForm>

      <p className="text-sm text-slate-600">
        Acesso de cliente?{" "}
        <Link className="font-semibold text-blue-700 hover:text-blue-900" href="/auth/login">
          Entrar na conta
        </Link>
      </p>
    </>
  );
}

export default function AdminLoginPage() {
  return (
    <AuthShell title="Admin" subtitle="Acesse a area administrativa para gerenciar eventos corporativos e administradores.">
      <Suspense fallback={<p className="text-sm text-slate-600">Carregando acesso...</p>}>
        <AdminLoginForm />
      </Suspense>
    </AuthShell>
  );
}
