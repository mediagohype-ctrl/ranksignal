"use client";
// The user's time zone for client components (mounted once in src/app/app/layout.tsx).
// Use: const tz = useTimeZone(); fmtDate(d, false, tz).
import { createContext, useContext } from "react";
import { DEFAULT_TIME_ZONE } from "@/lib/dashboard/format";

const TimeZoneCtx = createContext<string>(DEFAULT_TIME_ZONE);

export function TimeZoneProvider({ timeZone, children }: { timeZone?: string | null; children: React.ReactNode }) {
  return <TimeZoneCtx.Provider value={timeZone || DEFAULT_TIME_ZONE}>{children}</TimeZoneCtx.Provider>;
}

export function useTimeZone(): string {
  return useContext(TimeZoneCtx);
}
