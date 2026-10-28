// App icon: indigo rounded square with the brand initial. Generated at build time (no assets to maintain).
// next/og renders outside the CSS token system, so brand colours are literal here.
import { ImageResponse } from "next/og";
import { BRAND } from "@/lib/brand";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#4338ca",
          borderRadius: 7,
          color: "#ffffff",
          fontSize: 22,
          fontWeight: 700,
        }}
      >
        {BRAND.name.charAt(0).toUpperCase()}
      </div>
    ),
    size,
  );
}
