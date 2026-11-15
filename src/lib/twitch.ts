import { createHmac, timingSafeEqual } from 'node:crypto';
import { join, leave, next, setOpen, snapshot } from './queue';
import { getAccount, getAccessToken, refreshAccountToken } from './twitch-auth';

export function verifySignature(id: string, timestamp: string, body: string, signature: string) {
  const secret = process.env.TWITCH_EVENTSUB_SECRET;
  if (!secret || !signature.startsWith('sha256=')) return false;
  const expected = 'sha256=' + createHmac('sha256', secret).update(id + timestamp + body).digest('hex');
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function sendChat(message: string, replyId?: string) {
  const account = process.env.DATABASE_URL ? await getAccount() : null;
  let token = account ? await getAccessToken() : process.env.TWITCH_BOT_ACCESS_TOKEN;
  const clientId = process.env.TWITCH_CLIENT_ID;
  const broadcaster = account?.twitchId ?? process.env.TWITCH_BROADCASTER_ID;
  const sender = account?.twitchId ?? process.env.TWITCH_BOT_USER_ID;
  if (!token || !clientId || !broadcaster || !sender) throw new Error('Twitch chat credentials missing');
  const post = () => fetch('https://api.twitch.tv/helix/chat/messages', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + token, 'Client-Id': clientId, 'Content-Type': 'application/json' },
    body: JSON.stringify({ broadcaster_id: broadcaster, sender_id: sender, message, ...(replyId ? { reply_parent_message_id: replyId } : {}) }),
  });
  let response = await post();
  if (response.status === 401 && account) {
    token = await refreshAccountToken();
    response = await post();
  }
  if (!response.ok) throw new Error('Twitch chat send failed: HTTP ' + response.status);
}

type ChatEvent = { broadcaster_user_id: string; chatter_user_id: string; chatter_user_login: string; message_id: string; message?: { text?: string } };

export async function handleMessage(event: ChatEvent) {
  const account = process.env.DATABASE_URL ? await getAccount() : null;
  const broadcaster = account?.twitchId ?? process.env.TWITCH_BROADCASTER_ID;
  if (!broadcaster || event.broadcaster_user_id !== broadcaster) return;
  if (event.chatter_user_id === (account?.twitchId ?? process.env.TWITCH_BOT_USER_ID)) return;
  const command = event.message?.text?.trim().split(/\s+/)[0]?.toLowerCase();
  const admin = event.chatter_user_id === broadcaster;
  let response: string | undefined;
  switch (command) {
    case '!join': case '!apuntarme': {
      const status = await join(event.chatter_user_id, event.chatter_user_login);
      response = status === 'joined' ? '@' + event.chatter_user_login + ' te has unido a la cola.' :
        status === 'already' ? '@' + event.chatter_user_login + ' ya estás en la cola.' : 'La cola está cerrada.';
      break;
    }
    case '!salir': case '!leave':
      response = await leave(event.chatter_user_id) ? 'Has salido de la cola, @' + event.chatter_user_login + '.' : 'No estabas en la cola.';
      break;
    case '!cola': {
      const state = await snapshot();
      response = (state.isOpen ? 'Cola abierta' : 'Cola cerrada') + ' · ' + state.entries.length + ' esperando' +
        (state.entries.length ? ' · Siguiente: @' + state.entries[0].username : '') + '. Usa !join / !salir.';
      break;
    }
    case '!abrircola': if (admin) { await setOpen(true); response = 'La cola está abierta. Usa !join para apuntarte.'; } break;
    case '!cerrarcola': if (admin) { await setOpen(false); response = 'La cola está cerrada.'; } break;
    case '!siguiente': if (admin) { const viewer = await next(); response = viewer ? '¡Turno de @' + viewer.username + '! 🎮' : 'No queda nadie en la cola.'; } break;
  }
  if (response) await sendChat(response.slice(0, 450), event.message_id);
}
