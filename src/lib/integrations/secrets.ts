import crypto from 'crypto';

function masterKey(): Buffer | null {
  const raw = process.env.INTEGRATION_MASTER_KEY;
  if (!raw || raw.length !== 64) return null;
  try {
    return Buffer.from(raw, 'hex');
  } catch {
    return null;
  }
}

export function encryptSecret(plain: string): { value: string; encrypted: boolean } {
  const k = masterKey();
  if (!k) return { value: plain, encrypted: false };
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', k, iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return { value: Buffer.concat([iv, tag, enc]).toString('base64'), encrypted: true };
}

export function decryptSecret(stored: string, encrypted: boolean): string {
  if (!encrypted) return stored;
  const k = masterKey();
  if (!k) return stored;
  try {
    const buf = Buffer.from(stored, 'base64');
    const iv = buf.subarray(0, 12);
    const tag = buf.subarray(12, 28);
    const data = buf.subarray(28);
    const decipher = crypto.createDecipheriv('aes-256-gcm', k, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
  } catch {
    return stored;
  }
}

export function hashApiKey(raw: string): string {
  return crypto.createHash('sha256').update(raw).digest('hex');
}

export function generateApiKey(): { raw: string; prefix: string; keyHash: string } {
  const raw = `wdk_live_${crypto.randomBytes(24).toString('hex')}`;
  return { raw, prefix: raw.slice(0, 12), keyHash: hashApiKey(raw) };
}
