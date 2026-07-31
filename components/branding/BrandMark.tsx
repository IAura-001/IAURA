import type {
  BrandLogoSystem,
  BrandPalette,
} from "@/types/project";

interface BrandMarkProps {
  brandName: string;
  logo: BrandLogoSystem;
  palette: BrandPalette;
  size?: number;
  className?: string;
  label?: string;
}

const STROKE_WIDTH: Record<BrandLogoSystem["weight"], number> = {
  light: 2.25,
  regular: 3.5,
  bold: 5,
};

export function BrandSymbolGraphic({
  brandName,
  logo,
}: Pick<BrandMarkProps, "brandName" | "logo">) {
  const strokeWidth = STROKE_WIDTH[logo.weight];
  const initial = brandName.trim().charAt(0).toUpperCase() || "A";

  if (logo.symbol === "orbit") {
    return (
      <>
        <ellipse
          cx="32"
          cy="32"
          rx="22"
          ry="10"
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          transform="rotate(-28 32 32)"
        />
        <circle cx="32" cy="32" r="5.5" fill="currentColor" />
        <circle cx="51" cy="21" r="3" fill="currentColor" />
      </>
    );
  }

  if (logo.symbol === "monogram") {
    return (
      <text
        x="32"
        y="42"
        fill="currentColor"
        fontFamily="ui-sans-serif, system-ui, sans-serif"
        fontSize="30"
        fontWeight={logo.weight === "bold" ? 800 : logo.weight === "light" ? 400 : 650}
        textAnchor="middle"
      >
        {initial}
      </text>
    );
  }

  if (logo.symbol === "portal") {
    return (
      <>
        <path
          d="M15 48V31C15 20 22.6 12 32 12s17 8 17 19v17"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeWidth={strokeWidth}
        />
        <path
          d="M24 48V32c0-5.8 3.3-10 8-10s8 4.2 8 10v16"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeWidth={strokeWidth}
        />
        <circle cx="32" cy="39" r="3.5" fill="currentColor" />
      </>
    );
  }

  return (
    <path
      d="M32 8c1.8 13.6 8.4 20.2 22 22-13.6 1.8-20.2 8.4-22 22-1.8-13.6-8.4-20.2-22-22 13.6-1.8 20.2-8.4 22-22Z"
      fill="currentColor"
      stroke="currentColor"
      strokeLinejoin="round"
      strokeWidth={Math.max(0, strokeWidth - 2)}
    />
  );
}

export function BrandMark({
  brandName,
  logo,
  palette,
  size = 64,
  className = "",
  label,
}: BrandMarkProps) {
  const isBare = logo.container === "none";
  const borderRadius =
    logo.container === "circle" ? "9999px" : "28%";

  return (
    <span
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={`relative inline-grid shrink-0 place-items-center overflow-hidden ${className}`}
      style={{
        width: size,
        height: size,
        borderRadius: isBare ? 0 : borderRadius,
        color: isBare ? palette.primary : palette.text,
        background: isBare
          ? "transparent"
          : `linear-gradient(145deg, ${palette.primary}, ${palette.secondary})`,
        boxShadow: isBare
          ? "none"
          : `0 16px 40px ${palette.primary}35, inset 0 1px 0 ${palette.text}30`,
      }}
    >
      {!isBare && (
        <span
          className="absolute inset-0 opacity-50"
          style={{
            background: `radial-gradient(circle at 75% 18%, ${palette.accent}, transparent 38%)`,
          }}
        />
      )}
      <svg
        className="relative h-[62%] w-[62%]"
        viewBox="0 0 64 64"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <BrandSymbolGraphic brandName={brandName} logo={logo} />
      </svg>
    </span>
  );
}
