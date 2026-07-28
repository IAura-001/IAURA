import type { HTMLAttributes, ReactNode } from "react";

type CardProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
  glow?: boolean;
};

export default function Card({
  children,
  glow = false,
  className = "",
  ...props
}: CardProps) {
  return (
    <div
      className={[
        "rounded-[28px]",
        "border border-white/10",
        "bg-white/[0.04]",
        "backdrop-blur-xl",
        glow
          ? "shadow-[0_0_45px_rgba(139,92,246,0.15)]"
          : "",
        className,
      ].join(" ")}
      {...props}
    >
      {children}
    </div>
  );
}