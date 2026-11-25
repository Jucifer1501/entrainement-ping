import { NextResponse } from 'next/server';
import {
  SESSION_COOKIE_NAME,
  authenticateViewerCredentials,
  createSessionToken,
  getSessionCookieOptions,
  parseConfiguredViewerAccounts,
} from '@/lib/serverAuth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as {
      email?: unknown;
      password?: unknown;
    } | null;

    const email = typeof body?.email === 'string' ? body.email.trim() : '';
    const password = typeof body?.password === 'string' ? body.password : '';

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Veuillez renseigner votre adresse e-mail et votre mot de passe.' },
        { status: 400 }
      );
    }

    const configuredAccounts = parseConfiguredViewerAccounts();
    if (configuredAccounts.length === 0) {
      return NextResponse.json(
        {
          error:
            'Aucun compte lecteur configuré sur le serveur (variable AUTH_USERS_JSON manquante).',
        },
        { status: 503 }
      );
    }

    const user = authenticateViewerCredentials(email, password);
    if (!user) {
      return NextResponse.json(
        { error: 'Adresse e-mail ou mot de passe incorrect.' },
        { status: 401 }
      );
    }

    const token = createSessionToken(user);
    const response = NextResponse.json({
      authenticated: true,
      user,
    });

    response.cookies.set(
      SESSION_COOKIE_NAME,
      token,
      getSessionCookieOptions()
    );

    return response;
  } catch (err) {
    const message =
      err instanceof Error
        ? err.message
        : 'Erreur serveur lors de la connexion.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
