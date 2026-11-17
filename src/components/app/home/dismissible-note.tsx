"use client";
// A one-time note on Home (e.g. "why your full score differs from the free check"). Closing it is remembered in
// this browser (localStorage) under `storageKey`; nothing is stored on the server.
import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { Notice, type NoticeTone } from "@/components/ui";

export function DismissibleNote({
  storageKey,
  title,
  tone = "info",
  children,
}: {
  storageKey: string;
  title?: string;
  tone?: NoticeTone;
  children: React.ReactNode;
}) {
  // Hidden until we know it wasn't closed before, so it never flashes for people who dismissed it.
  const [show, setShow] = useState(false);
  useEffect(() => {
    try {
      setShow(localStorage.getItem(storageKey) !== "1");
    } catch {
      setShow(true);
    }
  }, [storageKey]);
  if (!show) return null;

  function close() {
    setShow(false);
    try {
      localStorage.setItem(storageKey, "1");
    } catch {
      /* private mode: it just shows again next time */
    }
  }

  return (
    <Notice
      tone={tone}
      title={title}
      className="no-print"
      actions={
        <button type="button" onClick={close} className="focus-ring inline-flex items-center gap-1 rounded-lg px-2 py-1 text-small font-medium text-fg-soft hover:bg-surface-2">
          <X size={14} aria-hidden /> Got it
        </button>
      }
    >
      {children}
    </Notice>
  );
}
