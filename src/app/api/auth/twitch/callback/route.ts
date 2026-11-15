import { timingSafeEqual } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { callbackUrl, registerChatWebhook, saveAccount, tokenRequest } from '@/lib/twitch-auth';
export const runtime = 'nodejs';
export async function GET(request: NextRequest) {
  const url = new URL('/', request.url);
  const state = request.nextUrl.searchParams.get('state') ?? '';
  const stored = request.cookies.get('twitch_oauth_state')?.value ?? '';
  const valid = state.length === 64 && stored.length === 64 &&
    timingSafeEqual(Buffer.from(state), Buffer.from(stored));
  const reply = (message: string) => {
    const result = NextResponse.redirect(new URL('/?twitch=' + encodeURIComponent(message), url), { status: 303 });
    result.cookies.delete('twitch_oauth_state');
    return result;
  };
  if (!valid) return reply('invalid_state');
  if (request.nextUrl.searchParams.has('error')) return reply('denied');
  const code = request.nextUrl.searchParams.get('code');
  if (!code) return reply('missing_code');
  try {
    const tokens = await tokenRequest({ grant_type: 'authorization_code', code, redirect_uri: callbackUrl() });
    const userResponse = await fetch('https://api.twitch.tv/helix/users', {
      headers: { Authorization: 'Bearer ' + tokens.access_token, 'Client-Id': process.env.TWITCH_CLIENT_ID! }, cache: 'no-store',
    });
    if (!userResponse.ok) throw new Error('profile');
    const profile = await userResponse.json() as { data?: { id: string; login: string }[] };
    const owner = profile.data?.[0];
    if (!owner) throw new Error('profile');
    // Persist authorization before subscription; a subscription failure can then be retried by reconnecting.
    await saveAccount(owner.id, owner.login, tokens);
    try { await registerChatWebhook(owner.id); } catch { return reply('connected_webhook_pending'); }
    return reply('connected');
  } catch { return reply('failed'); }
}
