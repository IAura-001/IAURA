import type { ButtonHTMLAttributes, ReactNode } from "react";

type ButtonVariant = "primary" | "secondary" | "ghost";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  variant?: ButtonVariant;
  fullWidth?: boolean;
};

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    "bg-gradient-to-r from-violet-600 via-purple-600 to-blue-600 text-white hover:scale-[1.02] hover:shadow-[0_0_38px_rgba(139,92,246,0.38)]",

  secondary:
    "border border-white/10 bg-white/[0.05] text-white hover:border-purple-400/40 hover:bg-white/[0.08]",

  ghost:
    "bg-transparent text-zinc-300 hover:bg-white/[0.05] hover:text-white",
};

export default function Button({
  children,
  variant = "primary",
  fullWidth = false,
  className = "",
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={[
        "inline-flex items-center justify-center rounded-2xl px-6 py-3.5",
        "font-semibold transition-all duration-300",
        "focus:outline-none focus:ring-2 focus:ring-purple-400/60",
        "disabled:cursor-not-allowed disabled:opacity-50",
        variantStyles[variant],
        fullWidth ? "w-full" : "",
        className,
      ].join(" ")}
      {...props}
    >
      {children}
    </button>
  );
}