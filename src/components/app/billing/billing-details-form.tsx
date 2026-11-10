"use client";
// "Billing details" form: the business name, optional GSTIN, state and address printed on GST invoices.
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, errorMessage } from "@/lib/dashboard/client";
import { Button, Field, Input, Select, useToast } from "@/components/ui";

export interface BillingDetailsValue {
  legalName: string;
  gstin: string | null;
  stateCode: string;
  addressLine: string | null;
  invoiceEmail: string | null;
}

export function BillingDetailsForm({
  initial,
  states,
  defaultName,
  canManage,
}: {
  initial: BillingDetailsValue | null;
  states: readonly { code: string; name: string }[];
  defaultName: string;
  canManage: boolean;
}) {
  const toast = useToast();
  const router = useRouter();
  const [legalName, setLegalName] = useState(initial?.legalName ?? defaultName);
  const [gstin, setGstin] = useState(initial?.gstin ?? "");
  const [stateCode, setStateCode] = useState(initial?.stateCode ?? "");
  const [addressLine, setAddressLine] = useState(initial?.addressLine ?? "");
  const [invoiceEmail, setInvoiceEmail] = useState(initial?.invoiceEmail ?? "");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErrors({});
    try {
      await api("/api/billing/details", {
        method: "PUT",
        body: { legalName, gstin: gstin.trim() || null, stateCode, addressLine: addressLine.trim() || null, invoiceEmail: invoiceEmail.trim() || null },
      });
      toast("Billing details saved. They'll appear on your next invoice.", "success");
      router.refresh();
    } catch (err) {
      const details = (err as { details?: { fieldErrors?: Record<string, string[]> } }).details;
      const fe = details?.fieldErrors ?? {};
      const next: Record<string, string> = {};
      for (const [k, v] of Object.entries(fe)) if (v?.[0]) next[k] = v[0];
      setErrors(next);
      if (!Object.keys(next).length) toast(errorMessage(err), "error");
    } finally {
      setBusy(false);
    }
  }

  const disabled = !canManage || busy;
  return (
    <form onSubmit={save} className="grid gap-4 sm:grid-cols-2" noValidate>
      <Field label="Business or legal name" htmlFor="bd-name" required error={errors.legalName} className="sm:col-span-2">
        <Input id="bd-name" value={legalName} onChange={(e) => setLegalName(e.target.value)} disabled={disabled} required maxLength={200} />
      </Field>
      <Field
        label="GSTIN"
        htmlFor="bd-gstin"
        optional
        hint="Add it if you want to claim input tax credit. 15 characters, like 27AAPFU0939F1ZV."
        error={errors.gstin}
      >
        <Input
          id="bd-gstin"
          value={gstin}
          onChange={(e) => setGstin(e.target.value.toUpperCase())}
          disabled={disabled}
          maxLength={15}
          autoComplete="off"
          className="font-mono uppercase"
        />
      </Field>
      <Field label="State" htmlFor="bd-state" required hint="Where your business is registered. Decides CGST + SGST or IGST." error={errors.stateCode}>
        <Select id="bd-state" value={stateCode} onChange={(e) => setStateCode(e.target.value)} disabled={disabled} required>
          <option value="">Choose your state</option>
          {states.map((s) => (
            <option key={s.code} value={s.code}>
              {s.name} ({s.code})
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Address" htmlFor="bd-address" optional error={errors.addressLine} className="sm:col-span-2">
        <Input id="bd-address" value={addressLine} onChange={(e) => setAddressLine(e.target.value)} disabled={disabled} maxLength={300} />
      </Field>
      <Field label="Email for invoices" htmlFor="bd-email" optional error={errors.invoiceEmail}>
        <Input id="bd-email" type="email" value={invoiceEmail} onChange={(e) => setInvoiceEmail(e.target.value)} disabled={disabled} maxLength={200} />
      </Field>
      {canManage && (
        <div className="flex items-end sm:col-span-2">
          <Button type="submit" loading={busy} loadingText="Saving…">
            Save billing details
          </Button>
        </div>
      )}
    </form>
  );
}
