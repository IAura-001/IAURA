import type { InputHTMLAttributes } from "react";

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  error?: string;
};

export default function Input({
  label,
  error,
  className = "",
  id,
  ...props
}: InputProps) {
  const inputId = id ?? props.name;

  return (
    <div className="w-full">
      {label ? (
        <label
          htmlFor={inputId}
          className="mb-2 block text-sm font-medium text-zinc-300"
        >
          {label}
        </label>
      ) : null}

      <input
        id={inputId}
        className={[
          "w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-4",
          "text-sm text-white outline-none",
          "placeholder:text-zinc-600",
          "transition-all duration-300",
          "focus:border-purple-400/50",
          "focus:ring-2 focus:ring-purple-500/20",
          error ? "border-red-500/60 focus:border-red-500" : "",
          className,
        ].join(" ")}
        {...props}
      />

      {error ? (
        <p className="mt-2 text-sm text-red-400">{error}</p>
      ) : null}
    </div>
  );
}