"use client";
// "Send follow-up" for a free-check lead: one plain email (score, top fix, sign-up link), then the lead is marked contacted.
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Send } from "lucide-react";
import { Button, useToast } from "@/components/ui";
import { adminSend } from "./actions";

export function SendFollowUpButton({ leadId, sent, size = "xs" }: { leadId: string; sent: boolean; size?: "xs" | "sm" }) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(sent);

  if (done) return <span className="text-xs text-muted">Follow-up sent</span>;
  return (
    <Button
      size={size}
      variant="secondary"
      icon={<Send />}
      loading={busy}
      loadingText="Sending…"
      onClick={async () => {
        setBusy(true);
        try {
          await adminSend(`/api/admin/leads/${leadId}/follow-up`, "POST", {});
          setDone(true);
          toast("Follow-up sent", "success");
          router.refresh();
        } catch (e) {
          const msg = (e as Error).message;
          if (/already sent/i.test(msg)) setDone(true);
          toast(msg, "error");
        } finally {
          setBusy(false);
        }
      }}
    >
      Send follow-up
    </Button>
  );
}
