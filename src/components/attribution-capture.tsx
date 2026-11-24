"use client";
// Remembers the UTM tags / fbclid of the page the visitor landed on (for the lead record). Renders nothing.
import { useEffect } from "react";
import { captureAttribution } from "@/lib/attribution";

export function AttributionCapture() {
  useEffect(() => captureAttribution(), []);
  return null;
}
