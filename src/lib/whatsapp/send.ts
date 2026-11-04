// WhatsApp messages via the Meta WhatsApp Cloud API. Needs WHATSAPP_TOKEN + WHATSAPP_PHONE_NUMBER_ID; without them
// every send is a logged no-op. Never logs tokens, numbers or message bodies — only a one-line status.
//
// Meta only delivers free-form text inside the 24-hour window after the person last messaged us; outside it, an
// approved template (sendWhatsAppTemplate) is required. Callers that message customers should use templates.
export const WHATSAPP_API_VERSION = "v21.0";
const TIMEOUT_MS = 10_000;

export interface WhatsAppResult {
  ok: boolean;
  id?: string;
  skipped?: boolean;
}

export function isWhatsAppConfigured(): boolean {
  return Boolean(process.env.WHATSAPP_TOKEN?.trim() && process.env.WHATSAPP_PHONE_NUMBER_ID?.trim());
}

/** "+91 98765-43210" → "919876543210" (digits only, as the Cloud API expects). Null when it can't be a number. */
export function normalizeWhatsAppNumber(raw: string | null | undefined): string | null {
  const digits = (raw ?? "").replace(/[^\d]/g, "");
  return digits.length >= 8 && digits.length <= 15 ? digits : null;
}

async function post(body: Record<string, unknown>): Promise<WhatsAppResult> {
  const token = process.env.WHATSAPP_TOKEN?.trim();
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID?.trim();
  if (!token || !phoneId) {
    console.info("[whatsapp] not configured (WHATSAPP_TOKEN / WHATSAPP_PHONE_NUMBER_ID missing); skipped sending");
    return { ok: false, skipped: true };
  }
  try {
    const res = await fetch(`https://graph.facebook.com/${WHATSAPP_API_VERSION}/${encodeURIComponent(phoneId)}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ messaging_product: "whatsapp", recipient_type: "individual", ...body }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) {
      console.warn(`[whatsapp] send failed: HTTP ${res.status}`);
      return { ok: false };
    }
    const data = (await res.json().catch(() => null)) as { messages?: { id?: string }[] } | null;
    return { ok: true, id: data?.messages?.[0]?.id };
  } catch (err) {
    console.warn(`[whatsapp] send failed: ${err instanceof Error ? err.name : "error"}`);
    return { ok: false };
  }
}

/** Free-form text message (max 4,096 characters; longer text is cut). */
export async function sendWhatsApp(to: string, text: string): Promise<WhatsAppResult> {
  const num = normalizeWhatsAppNumber(to);
  if (!num) return { ok: false };
  return post({ to: num, type: "text", text: { preview_url: false, body: text.slice(0, 4096) } });
}

/** Approved template message. `params` fill the template body's {{1}}, {{2}}, … in order. */
export async function sendWhatsAppTemplate(
  to: string,
  template: { name: string; language?: string; params?: string[] },
): Promise<WhatsAppResult> {
  const num = normalizeWhatsAppNumber(to);
  if (!num) return { ok: false };
  const params = template.params ?? [];
  return post({
    to: num,
    type: "template",
    template: {
      name: template.name,
      language: { code: template.language ?? "en" },
      ...(params.length ? { components: [{ type: "body", parameters: params.map((p) => ({ type: "text", text: p.slice(0, 1024) })) }] } : {}),
    },
  });
}
