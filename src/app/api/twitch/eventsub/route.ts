import { NextRequest, NextResponse } from 'next/server';
import { handleMessage, verifySignature } from '@/lib/twitch';
import { reserveEvent } from '@/lib/queue';

export const runtime = 'nodejs';
export async function POST(request: NextRequest) {
  const id = request.headers.get('twitch-eventsub-message-id') ?? '';
  const timestamp = request.headers.get('twitch-eventsub-message-timestamp') ?? '';
  const signature = request.headers.get('twitch-eventsub-message-signature') ?? '';
  const type = request.headers.get('twitch-eventsub-message-type');
  const raw = await request.text();
  const age = Date.now() - Date.parse(timestamp);
  if (!id || !Number.isFinite(age) || Math.abs(age) > 10 * 60_000 || !verifySignature(id, timestamp, raw, signature)) {
    return NextResponse.json({ error: 'invalid signature or timestamp' }, { status: 403 });
  }
  let data: { challenge?: string; subscription?: { type?: string }; event?: Parameters<typeof handleMessage>[0] };
  try { data = JSON.parse(raw); } catch { return NextResponse.json({ error: 'invalid JSON' }, { status: 400 }); }
  if (type === 'webhook_callback_verification') {
    return new Response(data.challenge ?? '', { headers: { 'Content-Type': 'text/plain' } });
  }
  if (type === 'revocation') return NextResponse.json({ ok: true });
  if (type !== 'notification' || data.subscription?.type !== 'channel.chat.message' || !data.event) {
    return NextResponse.json({ ok: true });
  }
  try {
    if (await reserveEvent(id)) await handleMessage(data.event);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('EventSub handler failure', error instanceof Error ? error.message : 'unknown error');
    return NextResponse.json({ error: 'processing failed' }, { status: 500 });
  }
}
