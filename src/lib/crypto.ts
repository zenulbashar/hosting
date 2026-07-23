import crypto from "node:crypto";

/**
 * Envelope encryption for secrets at rest (environment variable values).
 *
 * AES-256-GCM with a random 96-bit IV per value; the auth tag makes tampering
 * detectable. The key is derived from ZALE_ENCRYPTION_KEY; a stable dev
 * fallback keeps local development working but is NOT safe for production —
 * set ZALE_ENCRYPTION_KEY (any high-entropy string) in every real environment.
 *
 * Stored format: `v1:<iv>:<tag>:<ciphertext>` (each part base64). Values that
 * don't carry the `v1:` prefix are treated as legacy plaintext and returned
 * as-is on decrypt, so existing rows keep working and get encrypted on next
 * write — no migration, no downtime.
 */

let warned = false;

function deriveKey(): Buffer {
  const raw = process.env.ZALE_ENCRYPTION_KEY;
  if (raw && raw.length >= 16) {
    return crypto.createHash("sha256").update(raw).digest();
  }
  if (!warned && process.env.NODE_ENV === "production") {
    console.warn(
      "[crypto] ZALE_ENCRYPTION_KEY is unset or weak — using an insecure dev key. Secrets at rest are NOT protected."
    );
    warned = true;
  }
  return crypto.createHash("sha256").update("zale-dev-insecure-key").digest();
}

const KEY = deriveKey();

export function encryptSecret(plaintext: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", KEY, iv);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString("base64")}:${tag.toString("base64")}:${ct.toString("base64")}`;
}

export function decryptSecret(stored: string): string {
  if (!stored.startsWith("v1:")) return stored; // legacy plaintext — migrate on next write
  const [, ivB64, tagB64, ctB64] = stored.split(":");
  try {
    const decipher = crypto.createDecipheriv("aes-256-gcm", KEY, Buffer.from(ivB64, "base64"));
    decipher.setAuthTag(Buffer.from(tagB64, "base64"));
    return Buffer.concat([decipher.update(Buffer.from(ctB64, "base64")), decipher.final()]).toString("utf8");
  } catch {
    // Wrong key or tampered ciphertext — never leak a partial/garbage secret.
    return "";
  }
}

/** Constant-time HMAC-SHA256 verification for signed webhook payloads. */
export function verifyHmac(secret: string, body: string, signature: string): boolean {
  const expected = "sha256=" + crypto.createHmac("sha256", secret).update(body).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
