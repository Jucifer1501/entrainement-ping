import crypto from 'node:crypto';
import {
  SHEET_RANGES,
  parseExerciseBankRows,
  parsePlayersRows,
  parsePreparationRows,
  parseSessionRows,
  type FullSheetSnapshot,
} from '@/services/sheetsConnector';
import { DEFAULT_SPREADSHEET_ID } from '@/services/googleAuth';

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const SHEETS_API_BASE = 'https://sheets.googleapis.com/v4/spreadsheets';
// STRICT READ-ONLY SCOPE: cannot modify, append, or delete anything in Google Sheets
const SHEETS_READONLY_SCOPE =
  'https://www.googleapis.com/auth/spreadsheets.readonly';

let cachedToken: { accessToken: string; expiresAtMs: number } | null = null;

function base64Url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function getServiceAccountConfig(): {
  clientEmail: string;
  privateKey: string;
  spreadsheetId: string;
} {
  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim() ?? '';
  const rawPrivateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY ?? '';
  // Support both literal newlines and escaped "\n" in Vercel / .env.local
  const privateKey = rawPrivateKey.replace(/\\n/g, '\n').trim();
  const spreadsheetId =
    process.env.GOOGLE_SPREADSHEET_ID?.trim() ||
    process.env.NEXT_PUBLIC_SPREADSHEET_ID?.trim() ||
    DEFAULT_SPREADSHEET_ID;

  if (!clientEmail || !privateKey) {
    throw new Error(
      'Compte de service Google non configuré côté serveur (GOOGLE_SERVICE_ACCOUNT_EMAIL et GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY requis).'
    );
  }

  return { clientEmail, privateKey, spreadsheetId };
}

async function getServiceAccountAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAtMs - 60_000) {
    return cachedToken.accessToken;
  }

  const { clientEmail, privateKey } = getServiceAccountConfig();
  const nowSec = Math.floor(Date.now() / 1000);

  const header = base64Url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claimSet = base64Url(
    JSON.stringify({
      iss: clientEmail,
      scope: SHEETS_READONLY_SCOPE,
      aud: GOOGLE_TOKEN_URL,
      iat: nowSec,
      exp: nowSec + 3600,
    })
  );

  const unsignedJwt = `${header}.${claimSet}`;
  const signer = crypto.createSign('RSA-SHA256');
  signer.update(unsignedJwt);
  signer.end();
  const signature = base64Url(signer.sign(privateKey));
  const assertion = `${unsignedJwt}.${signature}`;

  const tokenResp = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }).toString(),
    cache: 'no-store',
  });

  if (!tokenResp.ok) {
    const text = await tokenResp.text().catch(() => '');
    throw new Error(
      `Échec authentification Service Account Google (${tokenResp.status}) : ${text || tokenResp.statusText}`
    );
  }

  const tokenJson = (await tokenResp.json()) as {
    access_token?: string;
    expires_in?: number;
  };
  if (!tokenJson.access_token) {
    throw new Error('Jeton Service Account Google manquant dans la réponse.');
  }

  cachedToken = {
    accessToken: tokenJson.access_token,
    expiresAtMs: Date.now() + Number(tokenJson.expires_in ?? 3600) * 1000,
  };

  return cachedToken.accessToken;
}

/**
 * Fetches all 4 tabs from Google Sheets in STRICT READ-ONLY mode using the server Service Account.
 */
export async function fetchReadOnlySheetSnapshot(): Promise<{
  spreadsheetId: string;
  snapshot: FullSheetSnapshot;
}> {
  const { spreadsheetId } = getServiceAccountConfig();
  const accessToken = await getServiceAccountAccessToken();

  const ranges = [
    SHEET_RANGES.PLAYERS,
    SHEET_RANGES.EXERCISES,
    SHEET_RANGES.PREPARATION,
    SHEET_RANGES.SESSIONS,
  ]
    .map((r) => `ranges=${encodeURIComponent(r)}`)
    .join('&');

  const url = `${SHEETS_API_BASE}/${encodeURIComponent(spreadsheetId)}/values:batchGet?${ranges}&valueRenderOption=UNFORMATTED_VALUE&dateTimeRenderOption=FORMATTED_STRING`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    cache: 'no-store',
  });

  if (!response.ok) {
    const raw = await response.text().catch(() => '');
    let detail = raw || response.statusText;
    try {
      const parsed = JSON.parse(raw) as { error?: { message?: string } };
      if (parsed.error?.message) detail = parsed.error.message;
    } catch {
      // keep raw
    }
    if (response.status === 403) {
      throw new Error(
        `Le compte de service n'a pas accès au Google Sheets (403). Partagez le classeur en mode "Lecteur" avec GOOGLE_SERVICE_ACCOUNT_EMAIL. Détail : ${detail}`
      );
    }
    throw new Error(`Google Sheets API (${response.status}) : ${detail}`);
  }

  const data = (await response.json()) as {
    valueRanges?: Array<{ values?: unknown[][] }>;
  };

  const vr = data.valueRanges ?? [];
  return {
    spreadsheetId,
    snapshot: {
      players: parsePlayersRows(vr[0]?.values ?? []),
      exerciseBank: parseExerciseBankRows(vr[1]?.values ?? []),
      preparation: parsePreparationRows(vr[2]?.values ?? []),
      sessions: parseSessionRows(vr[3]?.values ?? []),
    },
  };
}
