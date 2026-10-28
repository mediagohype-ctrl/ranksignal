// Credential encryption (brief contract): AES-256-GCM, random 12-byte IV, auth tag.
// Format: "v1:<iv b64>:<tag b64>:<ciphertext b64>". Key: CREDENTIALS_KEY (64 hex chars = 32 bytes).
// Never log plaintext or ciphertext.
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const VERSION = "v1";

function key(): Buffer {
  const hex = process.env.CREDENTIALS_KEY?.trim();
  if (!hex || !/^[0-9a-fA-F]{64}$/.test(hex)) {
    throw new Error("CREDENTIALS_KEY must be set to 64 hex characters (32 bytes)");
  }
  return Buffer.from(hex, "hex");
}

export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [VERSION, iv.toString("base64"), tag.toString("base64"), ct.toString("base64")].join(":");
}

export function decryptSecret(cipherText: string): string {
  const parts = cipherText.split(":");
  if (parts.length !== 4 || parts[0] !== VERSION) throw new Error("Unsupported credential ciphertext format");
  const [, ivB64, tagB64, ctB64] = parts;
  const iv = Buffer.from(ivB64, "base64");
  const tag = Buffer.from(tagB64, "base64");
  if (iv.length !== 12 || tag.length !== 16) throw new Error("Malformed credential ciphertext");
  const decipher = createDecipheriv("aes-256-gcm", key(), iv);
  decipher.setAuthTag(tag);
  // final() throws if the tag does not verify (tampering / wrong key).
  return Buffer.concat([decipher.update(Buffer.from(ctB64, "base64")), decipher.final()]).toString("utf8");
}
