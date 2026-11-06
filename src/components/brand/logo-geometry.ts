// MyWebRank logo geometry (viewBox 0 0 48 48), shared by the React logo, next/og icons, the email header
// PNG and scripts/brand-assets.ts. Plain data — no React — so scripts can import it.
//
// The mark: an indigo tile with three rising white bars and a teal trend arrow climbing over them —
// your website moving up.
export const LOGO_COLORS = { tile: "#4338ca", bar: "#ffffff", arrow: "#2dd4bf" } as const;
export const LOGO_TILE = { x: 2, y: 2, width: 44, height: 44, rx: 12 } as const;
export const LOGO_BARS = [
  { x: 11, y: 30, width: 6.5, height: 8 },
  { x: 20.75, y: 25, width: 6.5, height: 13 },
  { x: 30.5, y: 20, width: 6.5, height: 18 },
] as const;
export const LOGO_BAR_RX = 1.75;
/** Trend line (stroke) and its arrow head (filled). */
export const LOGO_ARROW = {
  line: "M11 22.5L20 15.5L25.5 19L34.5 11",
  head: "M37.5 8.5L36.4 15.2L30.8 9.6Z",
  width: 3.2,
} as const;

/** Standalone SVG markup of the mark. `full` drops the tile's rounded corners (for squares the OS rounds). */
export function logoMarkSvg(size = 48, opts: { full?: boolean } = {}): string {
  const t = LOGO_TILE;
  const tile = opts.full
    ? `<rect x="0" y="0" width="48" height="48" fill="${LOGO_COLORS.tile}"/>`
    : `<rect x="${t.x}" y="${t.y}" width="${t.width}" height="${t.height}" rx="${t.rx}" fill="${LOGO_COLORS.tile}"/>`;
  const bars = LOGO_BARS.map(
    (b) => `<rect x="${b.x}" y="${b.y}" width="${b.width}" height="${b.height}" rx="${LOGO_BAR_RX}" fill="${LOGO_COLORS.bar}"/>`,
  ).join("");
  const a = LOGO_ARROW;
  const arrow =
    `<path d="${a.line}" fill="none" stroke="${LOGO_COLORS.arrow}" stroke-width="${a.width}" stroke-linecap="round" stroke-linejoin="round"/>` +
    `<path d="${a.head}" fill="${LOGO_COLORS.arrow}" stroke="${LOGO_COLORS.arrow}" stroke-width="1" stroke-linejoin="round"/>`;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 48 48">` +
    `${tile}${bars}${arrow}</svg>`
  );
}
