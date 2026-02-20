"use client";

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
      const data = await forgotPassword({ email });
      setSuccess(`Solicitacao enviada. Resposta: ${JSON.stringify(data)}`);
    } catch (err) {
      const apiError = err as ApiError;
      setError(apiError.message);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <AuthShell title="Esqueci minha senha" subtitle="POST /auth/password/forgot">
      <AuthForm onSubmit={onSubmit}>
        <FormField id="email" label="Email" type="email" value={email} required onChange={setEmail} />
        <SubmitButton label="Enviar" loadingLabel="Enviando..." isLoading={isLoading} />
        <Feedback error={error} success={success} />
      </AuthForm>
    </AuthShell>
  );
}
