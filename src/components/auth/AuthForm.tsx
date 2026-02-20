import type { FormEvent, PropsWithChildren } from "react";

type AuthFormProps = PropsWithChildren<{
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}>;

export function AuthForm({ onSubmit, children }: AuthFormProps) {
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {children}
    </form>
  );
}

type FormFieldProps = {
  label: string;
  id: string;
  type?: string;
  value: string;
  required?: boolean;
  onChange: (value: string) => void;
};

export function FormField({
  label,
  id,
  type = "text",
  value,
  required,
  onChange,
}: FormFieldProps) {
  return (
    <label className="flex flex-col gap-1" htmlFor={id}>
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <input
        id={id}
        type={type}
        value={value}
        required={required}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-blue-500"
      />
    </label>
  );
}

type FeedbackProps = {
  error?: string | null;
  success?: string | null;
};

export function Feedback({ error, success }: FeedbackProps) {
  if (!error && !success) {
    return null;
  }

  return (
    <p className={`rounded-lg px-3 py-2 text-sm ${error ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"}`}>
      {error ?? success}
    </p>
  );
}

type SubmitButtonProps = {
  label: string;
  loadingLabel: string;
  isLoading: boolean;
};

export function SubmitButton({ label, loadingLabel, isLoading }: SubmitButtonProps) {
  return (
    <button
      type="submit"
      disabled={isLoading}
      className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-70"
    >
      {isLoading ? loadingLabel : label}
    </button>
  );
}
