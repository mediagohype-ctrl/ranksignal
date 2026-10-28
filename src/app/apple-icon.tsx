// Apple touch icon (180×180): indigo rounded square with the brand initial.
import { ImageResponse } from "next/og";
import { BRAND } from "@/lib/brand";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
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
          borderRadius: 40,
          color: "#ffffff",
          fontSize: 120,
          fontWeight: 700,
        }}
      >
        {BRAND.name.charAt(0).toUpperCase()}
      </div>
    ),
    size,
  );
}
