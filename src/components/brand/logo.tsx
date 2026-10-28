// RankSignal logo: an AI-answer bubble holding rising signal bars, with a teal "signal" dot above the
// tallest bar. The mark keeps fixed brand colours on purpose (it must look the same everywhere).
// Server- and client-safe: no hooks.
import clsx from "clsx";
import { BRAND } from "@/lib/brand";

/** Shared geometry (viewBox 0 0 48 48). Also used by next/og icons and the email header. */
export const LOGO_COLORS = { bubble: "#4338ca", bar: "#ffffff", signal: "#5eead4" } as const;
export const LOGO_BUBBLE_PATH =
  "M16 4H32C38.63 4 44 9.37 44 16V28C44 34.63 38.63 40 32 40H19.5L11.9 45.5C10.86 46.25 9.42 45.37 9.62 44.1L10.35 39.4C6.6 37.45 4 33.53 4 29V16C4 9.37 9.37 4 16 4Z";
export const LOGO_BARS = [
  { x: 13, y: 25, width: 5.5, height: 7 },
  { x: 20.75, y: 21.5, width: 5.5, height: 10.5 },
  { x: 28.5, y: 18, width: 5.5, height: 14 },
] as const;
export const LOGO_SIGNAL = { cx: 31.25, cy: 11.6, r: 3.6 } as const;

/** Standalone SVG markup (for public/logo-mark.svg style uses and tests). */
export function logoMarkSvg(size = 48): string {
  const bars = LOGO_BARS.map(
    (b) => `<rect x="${b.x}" y="${b.y}" width="${b.width}" height="${b.height}" rx="2.75" fill="${LOGO_COLORS.bar}"/>`,
  ).join("");
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 48 48">` +
    `<path fill="${LOGO_COLORS.bubble}" d="${LOGO_BUBBLE_PATH}"/>${bars}` +
    `<circle cx="${LOGO_SIGNAL.cx}" cy="${LOGO_SIGNAL.cy}" r="${LOGO_SIGNAL.r}" fill="${LOGO_COLORS.signal}"/></svg>`
  );
}

export function LogoMark({ size = 32, className, title }: { size?: number; className?: string; title?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      className={clsx("shrink-0", className)}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      <path fill={LOGO_COLORS.bubble} d={LOGO_BUBBLE_PATH} />
      {LOGO_BARS.map((b) => (
        <rect key={b.x} {...b} rx={2.75} fill={LOGO_COLORS.bar} />
      ))}
      <circle {...LOGO_SIGNAL} fill={LOGO_COLORS.signal} />
    </svg>
  );
}

/** Splits "RankSignal" into ["Rank", "Signal"] for the two-tone wordmark; single words stay whole. */
export function splitBrandName(name: string): [string, string] {
  const i = name.slice(1).search(/[A-Z]/);
  return i === -1 ? [name, ""] : [name.slice(0, i + 1), name.slice(i + 1)];
}

const SIZES = {
  sm: { mark: 24, text: "text-[17px]", gap: "gap-2" },
  md: { mark: 30, text: "text-[21px]", gap: "gap-2.5" },
  lg: { mark: 40, text: "text-[28px]", gap: "gap-3" },
} as const;

/** Mark + two-tone wordmark. `tone="dark"` is for use on ink/navy backgrounds. */
export function LogoLockup({
  size = "md",
  tone = "light",
  className,
}: {
  size?: keyof typeof SIZES;
  tone?: "light" | "dark";
  className?: string;
}) {
  const s = SIZES[size];
  const [first, second] = splitBrandName(BRAND.name);
  return (
    <span className={clsx("inline-flex items-center", s.gap, className)}>
      <LogoMark size={s.mark} />
      <span
        className={clsx(
          "font-[650] leading-none tracking-[-0.035em]",
          s.text,
          tone === "dark" ? "text-white" : "text-fg",
        )}
      >
        {first}
        {second && <span className={tone === "dark" ? "text-[#a5b4fc]" : "text-primary"}>{second}</span>}
      </span>
    </span>
  );
}
