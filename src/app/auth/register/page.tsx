"use client";

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
      const data = await register({ email, password });
      setSuccess(`Usuario criado. Resposta: ${JSON.stringify(data)}`);
    } catch (err) {
      const apiError = err as ApiError;
      setError(apiError.message);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <AuthShell title="Criar conta" subtitle="POST /auth/register">
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
        <SubmitButton label="Criar conta" loadingLabel="Criando..." isLoading={isLoading} />
        <Feedback error={error} success={success} />
      </AuthForm>
    </AuthShell>
  );
}
