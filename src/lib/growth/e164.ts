// WhatsApp numbers are stored in E.164 (+<country><number>, 8–15 digits). Indian owners often type "98765 43210"
// or "098765-43210", so a bare 10-digit Indian mobile number is accepted and given +91.

const E164 = /^\+[1-9]\d{7,14}$/;

export function isE164(v: string): boolean {
  return E164.test(v);
}

/** Normalised E.164 number, or null when it can't be one. */
export function normalizeE164(raw: unknown, defaultCountry: "IN" | null = "IN"): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed || trimmed.length > 32) return null;
  if (/[^\d\s()+.-]/.test(trimmed)) return null; // letters etc.
  const plus = trimmed.startsWith("+") || trimmed.startsWith("00");
  let digits = trimmed.replace(/\D/g, "");
  if (trimmed.startsWith("00")) digits = digits.slice(2);
  if (!plus) {
    if (defaultCountry !== "IN") return null;
    if (digits.length === 11 && digits.startsWith("0")) digits = digits.slice(1);
    if (digits.length === 12 && digits.startsWith("91")) digits = digits.slice(2);
    if (!/^[6-9]\d{9}$/.test(digits)) return null; // Indian mobile numbers start with 6-9
    digits = `91${digits}`;
  }
  const out = `+${digits}`;
  return isE164(out) ? out : null;
}

/** "+91 98765 43210" style for display; other countries stay as stored. */
export function formatE164(v: string): string {
  const m = /^\+91(\d{5})(\d{5})$/.exec(v);
  return m ? `+91 ${m[1]} ${m[2]}` : v;
}
