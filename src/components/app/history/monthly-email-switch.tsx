"use client";
// "Email me monthly" (brief 5.7): settings.notifications.monthlyReport, on by default.
import { useState } from "react";
import { api, errorMessage } from "@/lib/dashboard/client";
import { SwitchRow } from "@/components/app/project-settings/switch";
import { useToast } from "@/components/ui";

export function MonthlyEmailSwitch({ projectId, initial, canEdit }: { projectId: string; initial: boolean; canEdit: boolean }) {
  const toast = useToast();
  const [on, setOn] = useState(initial);
  const [busy, setBusy] = useState(false);
  async function change(next: boolean) {
    setBusy(true);
    try {
      await api(`/api/projects/${projectId}`, { method: "PATCH", body: { settings: { notifications: { monthlyReport: next } } } });
      setOn(next);
      toast(next ? "We'll email you the monthly report." : "Monthly report emails are off.", "success");
    } catch (e) {
      toast(errorMessage(e), "error");
    } finally {
      setBusy(false);
    }
  }
  return (
    <SwitchRow
      id="progress-monthly-email"
      label="Email me monthly"
      help="A short report of what changed, at the start of each month."
      checked={on}
      onChange={change}
      disabled={!canEdit}
      busy={busy}
    />
  );
}
