import { NextResponse } from 'next/server';
import {
  SESSION_COOKIE_NAME,
  getSessionCookieOptions,
} from '@/lib/serverAuth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE_NAME, '', getSessionCookieOptions(0));
  return response;
}
