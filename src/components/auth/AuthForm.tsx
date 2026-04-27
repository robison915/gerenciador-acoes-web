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
  placeholder?: string;
  autoComplete?: string;
  helper?: string;
  onChange: (value: string) => void;
};

export function FormField({
  label,
  id,
  type = "text",
  value,
  required,
  placeholder,
  autoComplete,
  helper,
  onChange,
}: FormFieldProps) {
  return (
    <label className="flex flex-col gap-1.5" htmlFor={id}>
      <span className="text-sm font-semibold text-slate-800">{label}</span>
      <input
        id={id}
        type={type}
        value={value}
        required={required}
        placeholder={placeholder}
        autoComplete={autoComplete}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition placeholder:text-slate-400 focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
      />
      {helper ? <span className="text-xs text-slate-500">{helper}</span> : null}
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
    <p
      className={`rounded-md border px-3 py-2 text-sm ${
        error ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-800"
      }`}
    >
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
      className="inline-flex min-h-10 items-center justify-center rounded-md bg-blue-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-70"
    >
      {isLoading ? loadingLabel : label}
    </button>
  );
}
