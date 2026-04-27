"use client";

import Link from "next/link";
import { type FormEvent, useState } from "react";
import { AuthForm, Feedback, FormField, SubmitButton } from "@/components/auth/AuthForm";
import { AuthShell } from "@/components/auth/AuthShell";
import type { ApiError } from "@/lib/api";
import { forgotPassword } from "@/lib/api";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      await forgotPassword({ email });
      setSuccess("Se o email estiver cadastrado, enviaremos as instrucoes de redefinicao.");
    } catch (err) {
      const apiError = err as ApiError;
      setError(apiError.message);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <AuthShell title="Recuperar senha" subtitle="Informe o email da conta para receber um link de redefinicao.">
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
        <SubmitButton label="Enviar instrucoes" loadingLabel="Enviando..." isLoading={isLoading} />
        <Feedback error={error} success={success} />
      </AuthForm>

      <Link className="text-sm font-semibold text-blue-700 hover:text-blue-900" href="/auth/login">
        Voltar para login
      </Link>
    </AuthShell>
  );
}

