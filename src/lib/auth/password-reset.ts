// Stateless, single-use password-reset links (60 min). The token carries `pwf`, a fingerprint of the
// password hash at issue time; once the password changes, every outstanding link stops working.
import { readToken, safeEqual, sha256Hex, signToken } from "./tokens";
import { appLink, passwordResetTemplate } from "@/lib/email/templates";
import { sendEmail } from "@/lib/email/send";

export const RESET_TTL = "60m";

export function passwordFingerprint(passwordHash: string): string {
  return sha256Hex(passwordHash).slice(0, 16);
}

export async function createPasswordResetToken(userId: string, passwordHash: string): Promise<string> {
  return signToken("password-reset", userId, { pwf: passwordFingerprint(passwordHash) }, RESET_TTL);
}

/**
 * Verifies signature/expiry/audience, then checks `pwf` against the user's CURRENT hash.
 * Returns the userId and the hash it was checked against (use it as a compare-and-swap guard).
 */
export async function verifyPasswordResetToken(
  token: string,
  loadPasswordHash: (userId: string) => Promise<string | null>,
): Promise<{ userId: string; passwordHash: string } | null> {
  const payload = await readToken("password-reset", token);
  if (!payload || typeof payload.pwf !== "string") return null;
  const hash = await loadPasswordHash(payload.sub);
  if (!hash) return null;
  if (!safeEqual(payload.pwf, passwordFingerprint(hash))) return null;
  return { userId: payload.sub, passwordHash: hash };
}

export async function sendPasswordResetEmail(user: { id: string; email: string; name: string | null; passwordHash: string }) {
  const token = await createPasswordResetToken(user.id, user.passwordHash);
  const link = appLink(`/reset-password?token=${encodeURIComponent(token)}`);
  const mail = passwordResetTemplate({ name: user.name, link });
  return sendEmail({ to: user.email, ...mail });
}
