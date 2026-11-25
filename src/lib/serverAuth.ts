import crypto from 'node:crypto';
import type { ViewerUser } from '@/types';

export const SESSION_COOKIE_NAME = 'pingcoach_viewer_session';
const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days

export interface StoredViewerAccount {
  email: string;
  name?: string;
  /** Format: "scrypt$<saltHex>$<derivedKeyHex>" */
  passwordHash: string;
}

interface SessionPayload {
  email: string;
  name: string;
  role: 'viewer';
  exp: number;
}

function getSessionSecret(): string {
  const secret = process.env.AUTH_SESSION_SECRET?.trim();
  if (!secret || secret.length < 16) {
    throw new Error(
      'AUTH_SESSION_SECRET non configuré (minimum 16 caractères requis côté serveur).'
    );
  }
  return secret;
}

export function hashPassword(plainPassword: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(plainPassword, salt, 64).toString('hex');
  return `scrypt$${salt}$${derived}`;
}

export function verifyPassword(
  plainPassword: string,
  storedHash: string
): boolean {
  const parts = storedHash.trim().split('$');
  if (parts.length !== 3 || parts[0] !== 'scrypt') {
    return false;
  }
  const [, salt, expectedHex] = parts;
  if (!salt || !expectedHex) return false;

  try {
    const derived = crypto.scryptSync(plainPassword, salt, 64);
    const expected = Buffer.from(expectedHex, 'hex');
    if (derived.length !== expected.length) return false;
    return crypto.timingSafeEqual(derived, expected);
  } catch {
    return false;
  }
}

export function parseConfiguredViewerAccounts(
  rawJson: string | undefined = process.env.AUTH_USERS_JSON
): StoredViewerAccount[] {
  const trimmed = (rawJson ?? '').trim();
  if (!trimmed) return [];

  try {
    const parsed: unknown = JSON.parse(trimmed);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((entry): entry is StoredViewerAccount => {
      if (!entry || typeof entry !== 'object') return false;
      const obj = entry as Record<string, unknown>;
      return (
        typeof obj.email === 'string' &&
        obj.email.trim().length > 0 &&
        typeof obj.passwordHash === 'string' &&
        obj.passwordHash.trim().length > 0
      );
    });
  } catch {
    throw new Error(
      'AUTH_USERS_JSON invalide : vérifiez le format JSON dans vos variables d’environnement.'
    );
  }
}

export function authenticateViewerCredentials(
  email: string,
  password: string,
  rawAccountsJson?: string
): ViewerUser | null {
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail || !password) return null;

  const accounts = parseConfiguredViewerAccounts(rawAccountsJson);
  const account = accounts.find(
    (u) => u.email.trim().toLowerCase() === normalizedEmail
  );
  if (!account) return null;

  if (!verifyPassword(password, account.passwordHash)) {
    return null;
  }

  return {
    email: account.email.trim().toLowerCase(),
    name: account.name?.trim() || account.email.split('@')[0] || 'Lecteur',
    role: 'viewer',
  };
}

function base64UrlEncode(input: Buffer | string): string {
  return Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function base64UrlDecode(input: string): string {
  const padded = input.replace(/-/g, '+').replace(/_/g, '/');
  const padLen = (4 - (padded.length % 4)) % 4;
  return Buffer.from(padded + '='.repeat(padLen), 'base64').toString('utf8');
}

export function createSessionToken(
  user: ViewerUser,
  secretOverride?: string,
  ttlSeconds = SESSION_TTL_SECONDS
): string {
  const secret = secretOverride ?? getSessionSecret();
  const payload: SessionPayload = {
    email: user.email,
    name: user.name,
    role: 'viewer',
    exp: Math.floor(Date.now() / 1000) + ttlSeconds,
  };
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signature = base64UrlEncode(
    crypto.createHmac('sha256', secret).update(encodedPayload).digest()
  );
  return `${encodedPayload}.${signature}`;
}

export function verifySessionToken(
  token: string | undefined | null,
  secretOverride?: string
): ViewerUser | null {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;

  const [encodedPayload, providedSig] = parts;
  if (!encodedPayload || !providedSig) return null;

  let secret: string;
  try {
    secret = secretOverride ?? getSessionSecret();
  } catch {
    return null;
  }

  const expectedSig = base64UrlEncode(
    crypto.createHmac('sha256', secret).update(encodedPayload).digest()
  );

  const a = Buffer.from(providedSig);
  const b = Buffer.from(expectedSig);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return null;
  }

  try {
    const parsed = JSON.parse(base64UrlDecode(encodedPayload)) as Partial<SessionPayload>;
    if (
      parsed.role !== 'viewer' ||
      typeof parsed.email !== 'string' ||
      typeof parsed.name !== 'string' ||
      typeof parsed.exp !== 'number'
    ) {
      return null;
    }
    if (parsed.exp <= Math.floor(Date.now() / 1000)) {
      return null;
    }
    return {
      email: parsed.email,
      name: parsed.name,
      role: 'viewer',
    };
  } catch {
    return null;
  }
}

export function getSessionCookieOptions(maxAgeSeconds = SESSION_TTL_SECONDS) {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: maxAgeSeconds,
  };
}
