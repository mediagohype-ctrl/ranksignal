// Default Open Graph / social preview image (1200×630, white background, brand + tagline).
import { ImageResponse } from "next/og";
import { BRAND } from "@/lib/brand";

export const alt = `${BRAND.name} — ${BRAND.tagline}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
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
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div
            style={{
              width: 72,
              height: 72,
              borderRadius: 18,
              background: "#4338ca",
              color: "#ffffff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 46,
              fontWeight: 700,
            }}
          >
            {BRAND.name.charAt(0).toUpperCase()}
          </div>
          <div style={{ fontSize: 44, fontWeight: 700, letterSpacing: -1 }}>{BRAND.name}</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div style={{ fontSize: 64, fontWeight: 700, lineHeight: 1.1, letterSpacing: -2, maxWidth: 1000 }}>{BRAND.tagline}</div>
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
    size,
  );
}
