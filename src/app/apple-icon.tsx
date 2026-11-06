// Apple touch icon (180×180). iOS rounds the corners itself, so the indigo fills the whole square.
import { ImageResponse } from "next/og";
import { LOGO_COLORS, logoMarkShapes } from "@/components/brand/logo";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: LOGO_COLORS.tile }}>
        <svg width="180" height="180" viewBox="2 2 44 44">
          {logoMarkShapes()}
        </svg>
      </div>
    ),
    size,
  );
}
