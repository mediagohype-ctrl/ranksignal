// Email normalisation + disposable-domain blocking for sign-up.
// Extend the list with DISPOSABLE_EMAIL_DOMAINS="foo.com,bar.io"; allow a listed domain with ALLOWED_EMAIL_DOMAINS.

export const DEFAULT_DISPOSABLE_DOMAINS: readonly string[] = [
  "mailinator.com",
  "guerrillamail.com",
  "guerrillamail.net",
  "guerrillamail.org",
  "sharklasers.com",
  "grr.la",
  "10minutemail.com",
  "10minutemail.net",
  "tempmail.com",
  "temp-mail.org",
  "temp-mail.io",
  "tempmail.net",
  "tempmailo.com",
  "throwawaymail.com",
  "yopmail.com",
  "yopmail.net",
  "trashmail.com",
  "trashmail.de",
  "getnada.com",
  "nada.email",
  "dispostable.com",
  "maildrop.cc",
  "mailnesia.com",
  "mintemail.com",
  "mohmal.com",
  "fakeinbox.com",
  "emailondeck.com",
  "spamgourmet.com",
  "mailcatch.com",
  "moakt.com",
  "tempinbox.com",
  "burnermail.io",
  "mail.tm",
  "mytemp.email",
  "tempr.email",
  "discard.email",
  "spambox.us",
  "inboxkitten.com",
  "linshiyouxiang.net",
  "emailfake.com",
  "fakemail.net",
  "33mail.com",
  "getairmail.com",
  "harakirimail.com",
  "mailpoof.com",
];

/** Trim + lowercase. Use everywhere an email is looked up or stored. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function envList(name: string): string[] {
  return (process.env[name] ?? "")
    .split(/[,\s]+/)
    .map((d) => d.trim().toLowerCase().replace(/^@/, ""))
    .filter(Boolean);
}

export function emailDomain(email: string): string {
  const at = email.lastIndexOf("@");
  return at === -1 ? "" : normalizeEmail(email.slice(at + 1)).replace(/\.$/, "");
}

/** True when the address (or a parent domain of it) is a known throwaway inbox provider. */
export function isDisposableEmail(email: string): boolean {
  const domain = emailDomain(email);
  if (!domain) return false;
  const matches = (list: readonly string[]) => list.some((d) => domain === d || domain.endsWith(`.${d}`));
  if (matches(envList("ALLOWED_EMAIL_DOMAINS"))) return false;
  return matches(DEFAULT_DISPOSABLE_DOMAINS) || matches(envList("DISPOSABLE_EMAIL_DOMAINS"));
}

/** Password rules beyond length: must not be the email address (or its local part). Returns an error message or null. */
export function passwordPolicyError(password: string, email: string): string | null {
  const pw = password.trim().toLowerCase();
  const e = normalizeEmail(email);
  const local = e.split("@")[0] ?? "";
  if (pw === e || (local.length > 0 && pw === local)) return "Your password can't be your email address.";
  return null;
}
