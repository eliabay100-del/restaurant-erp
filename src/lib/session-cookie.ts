import { createHmac, timingSafeEqual, randomBytes } from 'crypto';
import { readFileSync, writeFileSync } from 'fs';
import path from 'path';

/**
 * Signed session cookie: `<staffId>.<issuedAtMs>.<hmac>`.
 *
 * The cookie is the only auth token the app trusts, so it must be signed —
 * a bare staffId cookie lets anyone with devtools act as any employee.
 */
const MAX_AGE_MS = 12 * 60 * 60 * 1000;
const CLOCK_SKEW_MS = 60 * 1000;
const SECRET_FILE = path.join(process.cwd(), '.auth-secret');

let cachedSecret: string | null = null;

function getSecret(): string {
  const fromEnv = process.env.AUTH_SECRET?.trim();
  if (fromEnv) return fromEnv;
  if (cachedSecret) return cachedSecret;

  try {
    const stored = readFileSync(SECRET_FILE, 'utf8').trim();
    if (stored) {
      cachedSecret = stored;
      return stored;
    }
  } catch {
    // No secret yet — generate one below.
  }

  const generated = randomBytes(32).toString('hex');
  try {
    writeFileSync(SECRET_FILE, generated, { mode: 0o600 });
  } catch (error) {
    console.error('Could not persist auth secret; sessions will reset on restart:', error);
  }
  cachedSecret = generated;
  return generated;
}

function sign(payload: string): string {
  return createHmac('sha256', getSecret()).update(payload).digest('base64url');
}

export function createSessionValue(staffId: number): string {
  const payload = `${staffId}.${Date.now()}`;
  return `${payload}.${sign(payload)}`;
}

export function readSessionStaffId(raw: string | undefined | null): number | null {
  if (!raw) return null;

  const parts = raw.split('.');
  if (parts.length !== 3) return null;

  const [staffIdRaw, issuedRaw, signature] = parts;
  const staffId = Number.parseInt(staffIdRaw, 10);
  const issuedAt = Number.parseInt(issuedRaw, 10);
  if (!Number.isFinite(staffId) || staffId <= 0 || !Number.isFinite(issuedAt)) return null;

  const now = Date.now();
  if (issuedAt > now + CLOCK_SKEW_MS || now - issuedAt > MAX_AGE_MS) return null;

  const expected = sign(`${staffIdRaw}.${issuedRaw}`);
  const provided = Buffer.from(signature);
  const wanted = Buffer.from(expected);
  if (provided.length !== wanted.length || !timingSafeEqual(provided, wanted)) return null;

  return staffId;
}
