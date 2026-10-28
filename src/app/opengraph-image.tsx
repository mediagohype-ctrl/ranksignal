// Default Open Graph / social preview image (1200×630, white background, brand + tagline).
import { ImageResponse } from "next/og";
import { BRAND } from "@/lib/brand";
import { LOGO_BARS, LOGO_BUBBLE_PATH, LOGO_COLORS, LOGO_SIGNAL, splitBrandName } from "@/components/brand/logo";

export const alt = `${BRAND.name} — ${BRAND.tagline}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const OG_TEXT = `${BRAND.name}${BRAND.tagline}SEOAEOGEO AI visibilityFree AI-readiness check · plain-English fixes · no guaranteed rankings`;

/** Static Google Sans Flex instances (TTF) for next/og, subset to the text on the card. Falls back to the default font. */
async function loadBrandFonts() {
  const weights = [400, 600] as const;
  try {
    const css = await fetch(
      `https://fonts.googleapis.com/css2?family=Google+Sans+Flex:wght@${weights.join(";")}&text=${encodeURIComponent(OG_TEXT)}`,
    ).then((r) => r.text());
    const urls = [...css.matchAll(/src: url\((.+?)\) format\('truetype'\)/g)].map((m) => m[1]);
    if (urls.length !== weights.length) return undefined;
    const data = await Promise.all(urls.map((u) => fetch(u).then((r) => r.arrayBuffer())));
    return data.map((d, i) => ({ name: "Google Sans Flex", data: d, weight: weights[i], style: "normal" as const }));
  } catch {
    return undefined;
  }
}

export default async function OpengraphImage() {
  const fonts = await loadBrandFonts();
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#ffffff",
          padding: "72px 80px",
          color: "#0f172a",
          fontFamily: fonts ? "Google Sans Flex" : undefined,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <svg width="76" height="76" viewBox="0 0 48 48">
            <path fill={LOGO_COLORS.bubble} d={LOGO_BUBBLE_PATH} />
            {LOGO_BARS.map((b) => (
              <rect key={b.x} x={b.x} y={b.y} width={b.width} height={b.height} rx={2.75} fill={LOGO_COLORS.bar} />
            ))}
            <circle cx={LOGO_SIGNAL.cx} cy={LOGO_SIGNAL.cy} r={LOGO_SIGNAL.r} fill={LOGO_COLORS.signal} />
          </svg>
          <div style={{ display: "flex", fontSize: 46, fontWeight: 600, letterSpacing: -1.5 }}>
            <span>{splitBrandName(BRAND.name)[0]}</span>
            <span style={{ color: "#4338ca" }}>{splitBrandName(BRAND.name)[1]}</span>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div style={{ fontSize: 66, fontWeight: 600, lineHeight: 1.08, letterSpacing: -2.5, maxWidth: 1000 }}>{BRAND.tagline}</div>
          <div style={{ display: "flex", gap: 14 }}>
            {["SEO", "AEO", "GEO", "AI visibility"].map((t) => (
              <div
                key={t}
                style={{ display: "flex", padding: "10px 22px", borderRadius: 999, background: "#eef2ff", color: "#3730a3", fontSize: 28, fontWeight: 600 }}
              >
                {t}
              </div>
            ))}
          </div>
        </div>
        <div style={{ display: "flex", fontSize: 26, color: "#475569" }}>Free AI-readiness check · plain-English fixes · no guaranteed rankings</div>
        <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 12, display: "flex", background: "linear-gradient(90deg, #4338ca, #0d9488)" }} />
      </div>
    ),
    { ...size, fonts },
  );
}
