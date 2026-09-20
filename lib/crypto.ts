import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "crypto";

const ALGO = "aes-256-gcm";

// Derives a stable 32-byte key from whichever app secret is configured,
// via the same fallback chain lib/auth.ts uses for the JWT signing key —
// so TOTP secret encryption works out of the box without requiring a
// brand-new env var, while still preferring a dedicated one if set.
function getKey(): Buffer {
  const secret =
    process.env.TOTP_ENCRYPTION_KEY ||
    process.env.JWT_SECRET ||
    process.env.AUTH_SECRET ||
    process.env.NEXTAUTH_SECRET ||
    "xwallet-asia-dev-secret-change-me";
  return scryptSync(secret, "xwallet-totp-encryption-salt", 32);
}

/** Encrypts a plaintext TOTP secret for storage in `User.totpSecretEncrypted`. */
export function encryptSecret(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv.toString("hex"), authTag.toString("hex"), encrypted.toString("hex")].join(":");
}

/** Reverses encryptSecret(). Throws if the payload was tampered with or the key changed. */
export function decryptSecret(payload: string): string {
  const [ivHex, tagHex, dataHex] = payload.split(":");
  const decipher = createDecipheriv(ALGO, getKey(), Buffer.from(ivHex, "hex"));
  decipher.setAuthTag(Buffer.from(tagHex, "hex"));
  const decrypted = Buffer.concat([decipher.update(Buffer.from(dataHex, "hex")), decipher.final()]);
  return decrypted.toString("utf8");
}
