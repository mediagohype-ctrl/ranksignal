"use client";
// Personal preferences (brief 5.8): Expert mode switch (off by default) and Time zone. Saved with PATCH /api/me.
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { UserRound } from "lucide-react";
import { api, errorMessage } from "@/lib/dashboard/client";
import { DEFAULT_TIME_ZONE, timeZoneOptions } from "@/lib/user-prefs";
import { Card, CardBody, CardHeader, Field, Select, useToast } from "@/components/ui";
import { SwitchRow } from "./switch";

export function browserTimeZone(): string | null {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || null;
  } catch {
    return null;
  }
}

export function PreferencesPanel({ expertMode, timeZone }: { expertMode: boolean; timeZone: string | null }) {
  const router = useRouter();
  const toast = useToast();
  const [expert, setExpert] = useState(expertMode);
  const [tz, setTz] = useState(timeZone ?? browserTimeZone() ?? DEFAULT_TIME_ZONE);
  const [busy, setBusy] = useState<"expert" | "tz" | null>(null);
  const zones = useMemo(() => {
    const list = timeZoneOptions();
    return list.includes(tz) ? list : [tz, ...list];
  }, [tz]);

  async function save(kind: "expert" | "tz", body: { expertMode?: boolean; timeZone?: string }, ok: string) {
    setBusy(kind);
    try {
      await api("/api/me", { method: "PATCH", body });
      toast(ok, "success");
      router.refresh();
      return true;
    } catch (e) {
      toast(errorMessage(e), "error");
      return false;
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card as="section" aria-labelledby="prefs-h">
      <CardHeader icon={<UserRound />} title={<span id="prefs-h">Just for you</span>} description="These only change what you see." />
      <CardBody className="space-y-2">
        <SwitchRow
          id="pref-expert"
          label="Expert mode"
          help="Show the technical names (SEO, AEO, GEO), every score part and the detailed tables."
          checked={expert}
          busy={busy === "expert"}
          onChange={async (next) => {
            if (await save("expert", { expertMode: next }, next ? "Expert mode is on." : "Expert mode is off.")) setExpert(next);
          }}
        />
        <Field label="Time zone" htmlFor="pref-tz" hint="Dates and check times are shown in this time zone.">
          <Select
            id="pref-tz"
            value={tz}
            disabled={busy === "tz"}
            onChange={async (e) => {
              const next = e.target.value;
              const prev = tz;
              setTz(next);
              if (!(await save("tz", { timeZone: next }, "Time zone saved."))) setTz(prev);
            }}
          >
            {zones.map((z) => (
              <option key={z} value={z}>
                {z.replace(/_/g, " ")}
              </option>
            ))}
          </Select>
        </Field>
      </CardBody>
    </Card>
  );
}
