"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, type FormEvent, useEffect, useState } from "react";
import { AuthForm, Feedback, FormField, SubmitButton } from "@/components/auth/AuthForm";
import { AuthShell } from "@/components/auth/AuthShell";
import type { ApiError } from "@/lib/api";
import { resetPassword } from "@/lib/api";

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const [token, setToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    const tokenParam = searchParams.get("token");
    if (tokenParam) {
      setToken(tokenParam);
    }
  }, [searchParams]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      await resetPassword({ token, newPassword });
      setSuccess("Senha redefinida. Voce ja pode entrar com a nova senha.");
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
          id="token"
          label="Token de recuperacao"
          value={token}
          required
          placeholder="Cole o token recebido"
          helper="Quando o link vier com token, este campo sera preenchido automaticamente."
          onChange={setToken}
        />
        <FormField
          id="password"
          label="Nova senha"
          type="password"
          value={newPassword}
          required
          autoComplete="new-password"
          placeholder="Defina a nova senha"
          onChange={setNewPassword}
        />
        <SubmitButton label="Redefinir senha" loadingLabel="Redefinindo..." isLoading={isLoading} />
        <Feedback error={error} success={success} />
      </AuthForm>

      <Link className="text-sm font-semibold text-blue-700 hover:text-blue-900" href="/auth/login">
        Voltar para login
      </Link>
    </>
  );
}

export default function ResetPasswordPage() {
  return (
    <AuthShell title="Redefinir senha" subtitle="Crie uma nova senha usando o token recebido por email.">
      <Suspense fallback={<p className="text-sm text-slate-600">Carregando token...</p>}>
        <ResetPasswordForm />
      </Suspense>
    </AuthShell>
  );
}

