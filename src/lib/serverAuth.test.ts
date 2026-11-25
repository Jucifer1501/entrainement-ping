import { describe, expect, it } from 'vitest';
import {
  authenticateViewerCredentials,
  createSessionToken,
  hashPassword,
  verifyPassword,
  verifySessionToken,
} from './serverAuth';

describe('serverAuth (read-only email/password viewer auth)', () => {
  const testSecret = 'super-secret-session-key-32-chars-min';

  it('hashes passwords with scrypt and verifies valid vs invalid passwords', () => {
    const hash1 = hashPassword('PingPong2026!');
    const hash2 = hashPassword('PingPong2026!');

    // Random salt ensures distinct hashes for the same password
    expect(hash1).not.toBe(hash2);
    expect(hash1.startsWith('scrypt$')).toBe(true);
    expect(verifyPassword('PingPong2026!', hash1)).toBe(true);
    expect(verifyPassword('WrongPassword', hash1)).toBe(false);
    expect(verifyPassword('PingPong2026!', 'invalid-hash')).toBe(false);
  });

  it('authenticates configured viewer accounts with case-insensitive email', () => {
    const hash = hashPassword('ClubPing#42');
    const accountsJson = JSON.stringify([
      { email: 'Invite@Club.fr', name: 'Alex Coach', passwordHash: hash },
    ]);

    const user = authenticateViewerCredentials(
      '  invite@club.fr ',
      'ClubPing#42',
      accountsJson
    );
    expect(user).toEqual({
      email: 'invite@club.fr',
      name: 'Alex Coach',
      role: 'viewer',
    });

    expect(
      authenticateViewerCredentials('invite@club.fr', 'bad-pass', accountsJson)
    ).toBeNull();
    expect(
      authenticateViewerCredentials('autre@club.fr', 'ClubPing#42', accountsJson)
    ).toBeNull();
  });

  it('signs and verifies session tokens and rejects tampered, wrong-secret, or expired tokens', () => {
    const viewer = {
      email: 'invite@club.fr',
      name: 'Alex',
      role: 'viewer' as const,
    };

    const token = createSessionToken(viewer, testSecret, 3600);
    expect(verifySessionToken(token, testSecret)).toEqual(viewer);

    // Wrong secret
    expect(verifySessionToken(token, 'another-secret-key-at-least-16')).toBeNull();

    // Tampered payload
    const [payload, sig] = token.split('.');
    const tampered = `${payload}x.${sig}`;
    expect(verifySessionToken(tampered, testSecret)).toBeNull();

    // Expired token
    const expired = createSessionToken(viewer, testSecret, -10);
    expect(verifySessionToken(expired, testSecret)).toBeNull();
  });
});
