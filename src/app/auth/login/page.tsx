"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { type FormEvent, useState } from "react";
import { AuthForm, Feedback, FormField, SubmitButton } from "@/components/auth/AuthForm";
import { AuthShell } from "@/components/auth/AuthShell";
import type { ApiError } from "@/lib/api";
import { login } from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      await login({ email, password });
      const redirectParam = searchParams.get("redirect");
      const redirectTo = redirectParam && redirectParam.startsWith("/") ? redirectParam : "/auth/me";
      setSuccess("Login realizado com sucesso.");
      router.push(redirectTo);
    } catch (err) {
      const apiError = err as ApiError;
      setError(apiError.message);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <AuthShell title="Entrar" subtitle="POST /auth/login">
      <AuthForm onSubmit={onSubmit}>
        <FormField id="email" label="Email" type="email" value={email} required onChange={setEmail} />
        <FormField
          id="password"
          label="Senha"
          type="password"
          value={password}
          required
          onChange={setPassword}
        />
        <SubmitButton label="Entrar" loadingLabel="Entrando..." isLoading={isLoading} />
        <Feedback error={error} success={success} />
      </AuthForm>

      <p className="text-sm text-slate-600">
        Nao tem conta? <Link className="underline" href="/auth/register">Criar conta</Link>
      </p>
    </AuthShell>
  );
}
