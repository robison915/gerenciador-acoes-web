"use client";

import { type FormEvent, useState } from "react";
import { AuthForm, Feedback, FormField, SubmitButton } from "@/components/auth/AuthForm";
import { AuthShell } from "@/components/auth/AuthShell";
import type { ApiError } from "@/lib/api";
import { resetPassword } from "@/lib/api";

export default function ResetPasswordPage() {
  const [token, setToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const data = await resetPassword({ token, newPassword });
      setSuccess(`Senha alterada. Resposta: ${JSON.stringify(data)}`);
    } catch (err) {
      const apiError = err as ApiError;
      setError(apiError.message);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <AuthShell title="Resetar senha" subtitle="POST /auth/password/reset">
      <AuthForm onSubmit={onSubmit}>
        <FormField id="token" label="Token de reset" value={token} required onChange={setToken} />
        <FormField
          id="password"
          label="Nova senha"
          type="password"
          value={newPassword}
          required
          onChange={setNewPassword}
        />
        <SubmitButton label="Redefinir" loadingLabel="Redefinindo..." isLoading={isLoading} />
        <Feedback error={error} success={success} />
      </AuthForm>
    </AuthShell>
  );
}
