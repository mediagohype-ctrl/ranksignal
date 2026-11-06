// MyWebRank logo (mark + MYWEBRANK wordmark). Geometry lives in ./logo-geometry. The mark keeps fixed brand
// colours on purpose so it looks the same everywhere: app, browser tab, emails, social cards. No hooks.
import clsx from "clsx";
import { BRAND } from "@/lib/brand";

import { LOGO_ARROW, LOGO_BARS, LOGO_BAR_RX, LOGO_COLORS, LOGO_TILE } from "./logo-geometry";

export { LOGO_ARROW, LOGO_BARS, LOGO_COLORS, LOGO_TILE, logoMarkSvg } from "./logo-geometry";

/**
 * The mark's shapes as plain SVG elements (no wrapper), so next/og (satori) can render them too.
 * Call it as a function — `{logoMarkShapes()}` — not as a component.
 */
export function logoMarkShapes() {
  return [
    <rect key="tile" {...LOGO_TILE} fill={LOGO_COLORS.tile} />,
    ...LOGO_BARS.map((b) => <rect key={b.x} x={b.x} y={b.y} width={b.width} height={b.height} rx={LOGO_BAR_RX} fill={LOGO_COLORS.bar} />),
    <path
      key="line"
      d={LOGO_ARROW.line}
      fill="none"
      stroke={LOGO_COLORS.arrow}
      strokeWidth={LOGO_ARROW.width}
      strokeLinecap="round"
      strokeLinejoin="round"
    />,
    <path key="head" d={LOGO_ARROW.head} fill={LOGO_COLORS.arrow} stroke={LOGO_COLORS.arrow} strokeWidth={1} strokeLinejoin="round" />,
  ];
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
      {logoMarkShapes()}
    </svg>
  );
}

/** The two-tone wordmark parts, e.g. ["MYWEB", "RANK"]. */
export function wordmarkParts(): [string, string] {
  return [BRAND.wordmark[0].toUpperCase(), BRAND.wordmark[1].toUpperCase()];
}

const SIZES = {
  sm: { mark: 24, text: "text-[16px]", gap: "gap-2" },
  md: { mark: 30, text: "text-[19px]", gap: "gap-2.5" },
  lg: { mark: 40, text: "text-[26px]", gap: "gap-3" },
} as const;

/** Mark + two-tone wordmark (MYWEB in ink, RANK in brand indigo). `tone="dark"` is for ink/navy backgrounds. */
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
  const [first, second] = wordmarkParts();
  return (
    <span className={clsx("inline-flex items-center", s.gap, className)} aria-label={BRAND.name} role="img">
      <LogoMark size={s.mark} />
      <span
        aria-hidden
        className={clsx("font-[750] leading-none tracking-[0.01em]", s.text, tone === "dark" ? "text-white" : "text-fg")}
      >
        {first}
        <span className={tone === "dark" ? "text-[#5eead4]" : "text-primary"}>{second}</span>
      </span>
    </span>
  );
}
