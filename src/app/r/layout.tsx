// Root layout for shared report links (/r/…): <html lang="en">. See src/components/shell/root-shell.tsx.
import type { ReactNode } from "react";
import { RootShell, rootMetadata, rootViewport } from "@/components/shell/root-shell";

export const metadata = rootMetadata;
export const viewport = rootViewport;

export default function SharedReportRootLayout({ children }: { children: ReactNode }) {
  return <RootShell lang="en">{children}</RootShell>;
}
