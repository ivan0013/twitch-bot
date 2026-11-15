import { randomBytes } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { isAdmin } from '@/lib/admin';
import { authorizeUrl, configured } from '@/lib/twitch-auth';
export const runtime = 'nodejs';
export async function POST(request: NextRequest) {
  if (!isAdmin(request.headers.get('authorization'))) return NextResponse.json({ error: 'Contraseña de administrador incorrecta o no configurada.' }, { status: 401 });
  if (!configured()) return NextResponse.json({ error: 'Falta configurar Twitch, Neon o las variables de seguridad en Vercel.' }, { status: 503 });
  try {
    const state = randomBytes(32).toString('hex');
    const response = NextResponse.json({ url: authorizeUrl(state) }, { headers: { 'Cache-Control': 'no-store' } });
    response.cookies.set('twitch_oauth_state', state, { httpOnly: true, secure: true, sameSite: 'lax', path: '/api/auth/twitch/callback', maxAge: 600 });
    return response;
  } catch { return NextResponse.json({ error: 'Configuración OAuth incorrecta.' }, { status: 503 }); }
}
