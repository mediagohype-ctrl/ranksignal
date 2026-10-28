// Apple touch icon (180×180). iOS fills transparency with black, so the mark sits on a white tile.
import { ImageResponse } from "next/og";
import { LOGO_BARS, LOGO_BUBBLE_PATH, LOGO_COLORS, LOGO_SIGNAL } from "@/components/brand/logo";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#ffffff" }}>
        <svg width="132" height="132" viewBox="0 0 48 48">
          <path fill={LOGO_COLORS.bubble} d={LOGO_BUBBLE_PATH} />
          {LOGO_BARS.map((b) => (
            <rect key={b.x} x={b.x} y={b.y} width={b.width} height={b.height} rx={2.75} fill={LOGO_COLORS.bar} />
          ))}
          <circle cx={LOGO_SIGNAL.cx} cy={LOGO_SIGNAL.cy} r={LOGO_SIGNAL.r} fill={LOGO_COLORS.signal} />
        </svg>
      </div>
    ),
    size,
  );
}
