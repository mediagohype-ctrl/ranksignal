// Password hashing (bcrypt, cost 12) with a constant-ish-time verify path for unknown users.
import bcrypt from "bcryptjs";

export const BCRYPT_COST = 12;
export const MIN_PASSWORD_LENGTH = 10;
/** Marker stored on placeholder (invited, never signed-up) users; never matches any password. */
export const UNUSABLE_PASSWORD = "!unusable";

// Precomputed hash of a random string, used so unknown-email logins still pay the bcrypt cost.
const DUMMY_HASH = "$2b$12$nHrYL5kLo2A0sl2JcL9z.uZVeCGCimIf9YDPVKBSyNwL7Wf.cdbfi";

export async function hashPassword(plain: string): Promise<string> {
  if (plain.length < MIN_PASSWORD_LENGTH) throw new Error("Password too short");
  return bcrypt.hash(plain, BCRYPT_COST);
}

/** Returns false (never throws) for missing/placeholder/malformed hashes, after doing equivalent work. */
export async function verifyPassword(plain: string, hash: string | null | undefined): Promise<boolean> {
  const usable = typeof hash === "string" && hash.startsWith("$2");
  try {
    const ok = await bcrypt.compare(plain, usable ? hash : DUMMY_HASH);
    return usable && ok;
  } catch {
    return false;
  }
}
