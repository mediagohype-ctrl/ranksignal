"use client";
// "What to change, page by page": every affected page in ONE table (page → now → suggested), with Copy on each row,
// "Copy all" (the suggestions, one per line) and "Copy as a table" (tab-separated, pastes into Excel / Google Sheets).
import { useState } from "react";
import { Check, Copy, Table2 } from "lucide-react";
import type { ChangeRow } from "@/lib/fix-guides";
import { changesAsTable } from "@/lib/fix-guides/copy";
import { Button, Table, TD, TH, THead, TR, useToast } from "@/components/ui";

export function ChangesTable({ rows, copyable }: { rows: ChangeRow[]; copyable: boolean }) {
  const toast = useToast();
  const [copied, setCopied] = useState<string | null>(null);

  async function copy(key: string, text: string, msg = "Copied. Paste it on your website.") {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      toast(msg, "success");
      setTimeout(() => setCopied((k) => (k === key ? null : k)), 2000);
    } catch {
      toast("Couldn't copy automatically — select the text and copy it instead.", "warning");
    }
  }

  return (
    <div>
      {copyable && rows.length > 1 && (
        <div className="flex flex-wrap gap-2 border-b border-border px-5 py-3 sm:px-6">
          <Button size="sm" variant="secondary" icon={copied === "all" ? <Check /> : <Copy />} onClick={() => copy("all", rows.map((r) => r.change).join("\n"), `Copied ${rows.length} suggestions.`)}>
            Copy all
          </Button>
          <Button
            size="sm"
            variant="ghost"
            icon={copied === "table" ? <Check /> : <Table2 />}
            onClick={() => copy("table", changesAsTable(rows), "Copied as a table. Paste it into Excel or Google Sheets.")}
          >
            Copy as a table
          </Button>
        </div>
      )}
      <div className="overflow-x-auto">
        <Table caption="What to change on each page">
          <THead>
            <tr>
              <TH>Page</TH>
              <TH>Now</TH>
              <TH>Change it to</TH>
              {copyable && <TH className="w-px"><span className="sr-only">Copy</span></TH>}
            </tr>
          </THead>
          <tbody>
            {rows.map((c, i) => (
              <TR key={`${c.page}-${i}`}>
                <TD className="whitespace-nowrap font-medium text-fg">{c.page}</TD>
                <TD className="min-w-48 text-muted">{c.now}</TD>
                <TD className="min-w-56 text-fg">{c.change}</TD>
                {copyable && (
                  <TD className="w-px">
                    <Button size="xs" variant="ghost" icon={copied === `r${i}` ? <Check /> : <Copy />} onClick={() => copy(`r${i}`, c.change)} aria-label={`Copy the suggestion for ${c.page}`}>
                      Copy
                    </Button>
                  </TD>
                )}
              </TR>
            ))}
          </tbody>
        </Table>
      </div>
    </div>
  );
}
