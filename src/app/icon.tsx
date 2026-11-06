// Browser-tab icon (32×32): the MyWebRank mark.
import { ImageResponse } from "next/og";
import { logoMarkShapes } from "@/components/brand/logo";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <svg width="32" height="32" viewBox="0 0 48 48">
        {logoMarkShapes()}
      </svg>
    ),
    size,
  );
}
