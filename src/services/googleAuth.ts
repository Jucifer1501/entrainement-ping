'use client';

const SHEETS_SCOPE = 'https://www.googleapis.com/auth/spreadsheets';
const TOKEN_REFRESH_BUFFER_MS = 2 * 60 * 1000; // Refresh proactively 2 min before 60-min expiry
const SILENT_REFRESH_TIMEOUT_MS = 10_000;
const SESSION_TOKEN_KEY = 'pingcoach_oauth_session_v1';

const PLACEHOLDER_CLIENT_IDS = new Set([
  'COLLE_ICI_TON_CLIENT_ID',
  'votre-client-id.apps.googleusercontent.com',
]);

interface GoogleTokenResponse {
  access_token?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
}

interface GoogleTokenClient {
  requestAccessToken: (overrideConfig?: {
    prompt?: '' | 'consent' | 'select_account';
  }) => void;
}

declare global {
  interface Window {
    google?: {
      accounts?: {
        oauth2?: {
          initTokenClient: (config: {
            client_id: string;
            scope: string;
            callback: (response: GoogleTokenResponse) => void;
            error_callback?: (err: { type?: string; message?: string }) => void;
          }) => GoogleTokenClient;
          revoke: (token: string, done?: () => void) => void;
        };
      };
    };
  }
}

export interface AuthState {
  isSignedIn: boolean;
  accessToken: string | null;
  expiresAt: number | null;
  clientId: string;
  gisLoaded: boolean;
}

const RUNTIME_CLIENT_ID_KEY = 'pingcoach_custom_client_id';
const RUNTIME_SPREADSHEET_ID_KEY = 'pingcoach_custom_spreadsheet_id';
export const DEFAULT_SPREADSHEET_ID =
  '1vCbfHGjbceR-BZUZPLoOG2mkHf4UnFYb2fd65vsYNHE';

function cleanClientId(raw: string | null | undefined): string {
  const trimmed = (raw ?? '').trim();
  if (!trimmed || PLACEHOLDER_CLIENT_IDS.has(trimmed)) return '';
  return trimmed;
}

export function getConfiguredClientId(): string {
  if (typeof window !== 'undefined') {
    const custom = cleanClientId(
      window.localStorage.getItem(RUNTIME_CLIENT_ID_KEY)
    );
    if (custom) return custom;
  }
  return cleanClientId(process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID);
}

export function setCustomClientId(clientId: string): void {
  if (typeof window === 'undefined') return;
  const trimmed = cleanClientId(clientId);
  if (trimmed) {
    window.localStorage.setItem(RUNTIME_CLIENT_ID_KEY, trimmed);
  } else {
    window.localStorage.removeItem(RUNTIME_CLIENT_ID_KEY);
  }
}

export function getConfiguredSpreadsheetId(): string {
  if (typeof window !== 'undefined') {
    const custom = window.localStorage.getItem(RUNTIME_SPREADSHEET_ID_KEY);
    if (custom && custom.trim()) return custom.trim();
  }
  return (
    process.env.NEXT_PUBLIC_SPREADSHEET_ID?.trim() || DEFAULT_SPREADSHEET_ID
  );
}

export function setCustomSpreadsheetId(spreadsheetId: string): void {
  if (typeof window === 'undefined') return;
  const trimmed = spreadsheetId.trim();
  if (trimmed) {
    window.localStorage.setItem(RUNTIME_SPREADSHEET_ID_KEY, trimmed);
  } else {
    window.localStorage.removeItem(RUNTIME_SPREADSHEET_ID_KEY);
  }
}

class GoogleAuthManager {
  private accessToken: string | null = null;
  private expiresAt: number | null = null;
  private inFlightPromise: Promise<string> | null = null;
  private listeners = new Set<() => void>();

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(): void {
    this.listeners.forEach((fn) => fn());
  }

  private persistSession(): void {
    if (typeof window === 'undefined') return;
    try {
      if (this.accessToken && this.expiresAt) {
        window.sessionStorage.setItem(
          SESSION_TOKEN_KEY,
          JSON.stringify({
            accessToken: this.accessToken,
            expiresAt: this.expiresAt,
          })
        );
      } else {
        window.sessionStorage.removeItem(SESSION_TOKEN_KEY);
      }
    } catch {
      // Ignore sessionStorage errors in restricted contexts
    }
  }

  /**
   * Restores a non-expired OAuth token from sessionStorage on page reload.
   */
  restoreSession(): boolean {
    if (typeof window === 'undefined') return false;
    if (this.accessToken && !this.isTokenExpired()) return true;
    try {
      const raw = window.sessionStorage.getItem(SESSION_TOKEN_KEY);
      if (!raw) return false;
      const parsed = JSON.parse(raw) as {
        accessToken?: string;
        expiresAt?: number;
      };
      if (
        parsed.accessToken &&
        typeof parsed.expiresAt === 'number' &&
        Date.now() < parsed.expiresAt - 15_000
      ) {
        this.accessToken = parsed.accessToken;
        this.expiresAt = parsed.expiresAt;
        this.emit();
        return true;
      }
      window.sessionStorage.removeItem(SESSION_TOKEN_KEY);
      return false;
    } catch {
      return false;
    }
  }

  getToken(): string | null {
    return this.accessToken;
  }

  getExpiresAt(): number | null {
    return this.expiresAt;
  }

  isSignedIn(): boolean {
    return Boolean(this.accessToken);
  }

  isTokenExpired(): boolean {
    if (!this.accessToken || !this.expiresAt) return true;
    return Date.now() >= this.expiresAt;
  }

  isTokenNearExpiry(): boolean {
    if (!this.accessToken || !this.expiresAt) return true;
    return Date.now() >= this.expiresAt - TOKEN_REFRESH_BUFFER_MS;
  }

  isGisReady(): boolean {
    return Boolean(
      typeof window !== 'undefined' && window.google?.accounts?.oauth2
    );
  }

  /**
   * Interactive Google Sign-In (OAuth 2.0 Token Model).
   */
  async signIn(
    prompt: '' | 'consent' | 'select_account' = 'select_account'
  ): Promise<string> {
    return this.requestToken(prompt);
  }

  /**
   * Forces a fresh token (used if Sheets API returns 401 Unauthorized).
   */
  async forceRefreshToken(): Promise<string> {
    this.accessToken = null;
    this.expiresAt = null;
    this.persistSession();
    try {
      return await this.requestToken('');
    } catch {
      return await this.requestToken('consent');
    }
  }

  /**
   * Ensures a valid non-expired token before every Sheets read/write.
   * Silently refreshes if the training session has exceeded ~58 minutes.
   */
  async ensureValidToken(): Promise<string> {
    if (this.accessToken && !this.isTokenNearExpiry()) {
      return this.accessToken;
    }
    try {
      return await this.requestToken('');
    } catch {
      return await this.requestToken('consent');
    }
  }

  /**
   * Silently refreshes without triggering an interactive popup if possible.
   */
  async refreshSilentlyIfNeeded(): Promise<string | null> {
    if (!this.accessToken) return null;
    if (!this.isTokenNearExpiry()) return this.accessToken;
    try {
      return await this.requestToken('');
    } catch {
      return null;
    }
  }

  signOut(): void {
    const current = this.accessToken;
    this.accessToken = null;
    this.expiresAt = null;
    this.persistSession();
    if (
      current &&
      typeof window !== 'undefined' &&
      window.google?.accounts?.oauth2
    ) {
      try {
        window.google.accounts.oauth2.revoke(current);
      } catch {
        // Ignore revoke errors offline
      }
    }
    this.emit();
  }

  private requestToken(
    prompt: '' | 'consent' | 'select_account'
  ): Promise<string> {
    if (this.inFlightPromise) {
      return this.inFlightPromise;
    }

    const clientId = getConfiguredClientId();
    if (!clientId) {
      return Promise.reject(
        new Error(
          'NEXT_PUBLIC_GOOGLE_CLIENT_ID non configuré (ou valeur factice). Renseignez votre vrai Client ID OAuth dans .env.local ou via l’icône Paramètres.'
        )
      );
    }

    if (!this.isGisReady()) {
      return Promise.reject(
        new Error(
          'Google Identity Services non chargé (vérifiez la connexion réseau ou rechargez la page).'
        )
      );
    }

    this.inFlightPromise = new Promise<string>((resolve, reject) => {
      let settled = false;
      const timer =
        prompt === ''
          ? window.setTimeout(() => {
              if (!settled) {
                settled = true;
                this.inFlightPromise = null;
                reject(
                  new Error('Délai de rafraîchissement silencieux dépassé.')
                );
              }
            }, SILENT_REFRESH_TIMEOUT_MS)
          : null;

      const finish = (fn: () => void) => {
        if (settled) return;
        settled = true;
        if (timer !== null) window.clearTimeout(timer);
        this.inFlightPromise = null;
        fn();
      };

      try {
        const client = window.google!.accounts!.oauth2!.initTokenClient({
          client_id: clientId,
          scope: SHEETS_SCOPE,
          callback: (response) => {
            if (response.error || !response.access_token) {
              finish(() =>
                reject(
                  new Error(
                    response.error_description ||
                      response.error ||
                      'Authentification Google refusée.'
                  )
                )
              );
              return;
            }
            const expiresInSec = Number(response.expires_in ?? 3600);
            this.accessToken = response.access_token;
            this.expiresAt = Date.now() + expiresInSec * 1000;
            this.persistSession();
            this.emit();
            finish(() => resolve(response.access_token!));
          },
          error_callback: (err) => {
            finish(() =>
              reject(
                new Error(
                  err.message || err.type || 'Popup OAuth fermée ou bloquée.'
                )
              )
            );
          },
        });

        client.requestAccessToken({ prompt });
      } catch (err) {
        finish(() =>
          reject(
            err instanceof Error
              ? err
              : new Error('Erreur initialisation Google Identity Services.')
          )
        );
      }
    });

    return this.inFlightPromise;
  }
}

export const googleAuth = new GoogleAuthManager();
