// Thin delegate to the EXISTING /api/v1/admin/auth/me route.
// It contains no JWT or admins-table logic of its own: whatever auth/me decides
// (JWT signature + current row in `admins`) is the single source of truth.
import { NextResponse } from 'next/server';

export async function requireAdmin(request) {
  const headers = new Headers();
  const cookie = request.headers.get('cookie');
  const auth = request.headers.get('authorization');
  if (cookie) headers.set('cookie', cookie);
  if (auth) headers.set('authorization', auth);

  let res;
  try {
    res = await fetch(new URL('/api/v1/admin/auth/me', request.url), {
      headers,
      cache: 'no-store',
    });
  } catch {
    return { error: NextResponse.json({ error: 'Auth check unavailable' }, { status: 503 }) };
  }
  if (!res.ok) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }
  const body = await res.json().catch(() => ({}));
  return { admin: body.admin ?? body };
}
