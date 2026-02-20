"use client";

import { useState } from "react";
import type { FormEvent } from "react";

type FieldType = "text" | "email" | "password" | "number" | "datetime-local";

type FieldConfig = {
  name: string;
  label: string;
  type?: FieldType;
  required?: boolean;
  initialValue?: string;
  placeholder?: string;
};

type EndpointTesterProps = {
  title: string;
  endpoint: string;
  submitLabel?: string;
  fields?: FieldConfig[];
  onSubmit: (values: Record<string, string>) => Promise<unknown>;
};

export function EndpointTester({
  title,
  endpoint,
  submitLabel = "Executar",
  fields = [],
  onSubmit,
}: EndpointTesterProps) {
  const [values, setValues] = useState<Record<string, string>>(
    Object.fromEntries(fields.map((field) => [field.name, field.initialValue ?? ""])),
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [response, setResponse] = useState<string>("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const data = await onSubmit(values);
      setResponse(JSON.stringify(data, null, 2));
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro inesperado";
      setError(message);
      setResponse("");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="mt-1 text-sm text-slate-600">{endpoint}</p>

      <form className="mt-4 space-y-3" onSubmit={handleSubmit}>
        {fields.map((field) => (
          <label key={field.name} className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-slate-700">{field.label}</span>
            <input
              type={field.type ?? "text"}
              required={field.required}
              placeholder={field.placeholder}
              value={values[field.name] ?? ""}
              onChange={(event) =>
                setValues((current) => ({
                  ...current,
                  [field.name]: event.target.value,
                }))
              }
              className="rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-blue-500"
            />
          </label>
        ))}

        <button
          type="submit"
          disabled={isLoading}
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700 disabled:opacity-70"
        >
          {isLoading ? "Executando..." : submitLabel}
        </button>
      </form>

      {error ? <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}

      <pre className="mt-3 overflow-x-auto rounded-lg bg-slate-900 p-4 text-xs text-slate-100">
        {response || "Sem resposta ainda"}
      </pre>
    </article>
  );
}
