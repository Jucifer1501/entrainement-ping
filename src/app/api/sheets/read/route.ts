import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import {
  SESSION_COOKIE_NAME,
  verifySessionToken,
} from '@/lib/serverAuth';
import { fetchReadOnlySheetSnapshot } from '@/lib/googleServiceAccount';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * STRICT READ-ONLY endpoint for Email/Password viewers.
 * No write, update, append, or delete operation is exposed here.
 */
export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const user = verifySessionToken(token);

  if (!user) {
    return NextResponse.json(
      { error: 'Session lecteur expirée ou invalide. Veuillez vous reconnecter.' },
      { status: 401 }
    );
  }

  try {
    const data = await fetchReadOnlySheetSnapshot();
    return NextResponse.json(
      {
        readOnly: true,
        spreadsheetId: data.spreadsheetId,
        snapshot: data.snapshot,
      },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (err) {
    const message =
      err instanceof Error
        ? err.message
        : 'Impossible de lire le Google Sheets en mode lecture seule.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
