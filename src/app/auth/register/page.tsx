"use client";

import Link from "next/link";
import { type FormEvent, useState } from "react";
import { AuthForm, Feedback, FormField, SubmitButton } from "@/components/auth/AuthForm";
import { AuthShell } from "@/components/auth/AuthShell";
import type { ApiError } from "@/lib/api";
import { register } from "@/lib/api";

export default function RegisterPage() {
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
      await register({ email, password });
      setSuccess("Conta criada. Agora voce ja pode entrar no sistema.");
    } catch (err) {
      const apiError = err as ApiError;
      setError(apiError.message);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <AuthShell title="Criar conta" subtitle="Cadastre um usuario para registrar operacoes e acompanhar seus ativos.">
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
          autoComplete="new-password"
          placeholder="Defina uma senha"
          helper="Use uma senha que voce nao utiliza em outros servicos."
          onChange={setPassword}
        />
        <SubmitButton label="Criar conta" loadingLabel="Criando..." isLoading={isLoading} />
        <Feedback error={error} success={success} />
      </AuthForm>

      <p className="text-sm text-slate-600">
        Ja possui conta?{" "}
        <Link className="font-semibold text-blue-700 hover:text-blue-900" href="/auth/login">
          Entrar
        </Link>
      </p>
    </AuthShell>
  );
}

