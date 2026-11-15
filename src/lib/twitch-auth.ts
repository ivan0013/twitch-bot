import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { getDb } from '@/db/client';
import { twitchAccounts } from '@/db/schema';

const accountKey = 'owner';
const scopes = ['user:read:chat', 'user:write:chat', 'user:bot', 'channel:bot'];
export function callbackUrl() {
  const base = process.env.PUBLIC_BASE_URL;
  if (!base || !base.startsWith('https://')) throw new Error('PUBLIC_BASE_URL must be HTTPS');
  return new URL('/api/auth/twitch/callback', base).toString();
}
export function configured() {
  return Boolean(process.env.DATABASE_URL && process.env.ADMIN_PASSWORD && process.env.TWITCH_CLIENT_ID &&
    process.env.TWITCH_CLIENT_SECRET && process.env.TWITCH_TOKEN_ENCRYPTION_KEY && process.env.TWITCH_EVENTSUB_SECRET && process.env.PUBLIC_BASE_URL);
}
export function authorizeUrl(state: string) {
  const url = new URL('https://id.twitch.tv/oauth2/authorize');
  url.searchParams.set('client_id', process.env.TWITCH_CLIENT_ID!);
  url.searchParams.set('redirect_uri', callbackUrl());
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', scopes.join(' '));
  url.searchParams.set('state', state);
  url.searchParams.set('force_verify', 'true');
  return url.toString();
}
function encryptionKey() {
  const hex = process.env.TWITCH_TOKEN_ENCRYPTION_KEY;
  if (!hex || !/^[a-f0-9]{64}$/i.test(hex)) throw new Error('TWITCH_TOKEN_ENCRYPTION_KEY must be 32 bytes of hex');
  return Buffer.from(hex, 'hex');
}
function seal(token: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const data = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), data]).toString('base64');
}
function unseal(token: string) {
  const buffer = Buffer.from(token, 'base64');
  const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), buffer.subarray(0, 12));
  decipher.setAuthTag(buffer.subarray(12, 28));
  return Buffer.concat([decipher.update(buffer.subarray(28)), decipher.final()]).toString('utf8');
}
type TwitchTokens = { access_token: string; refresh_token: string; expires_in: number };
export async function tokenRequest(params: Record<string, string>) {
  const result = await fetch('https://id.twitch.tv/oauth2/token', { method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: process.env.TWITCH_CLIENT_ID!, client_secret: process.env.TWITCH_CLIENT_SECRET!, ...params }),
    cache: 'no-store' });
  if (!result.ok) throw new Error('Twitch token request failed: ' + result.status);
  return await result.json() as TwitchTokens;
}
export async function saveAccount(twitchId: string, login: string, tokens: TwitchTokens) {
  await getDb().insert(twitchAccounts).values({
    key: accountKey, twitchId, login, accessToken: seal(tokens.access_token), refreshToken: seal(tokens.refresh_token),
  }).onConflictDoUpdate({ target: twitchAccounts.key, set: {
    twitchId, login, accessToken: seal(tokens.access_token), refreshToken: seal(tokens.refresh_token), updatedAt: new Date(),
  } });
}
export async function getAccount() {
  const [account] = await getDb().select().from(twitchAccounts).where(eq(twitchAccounts.key, accountKey));
  return account ?? null;
}
export async function getAccessToken() {
  const account = await getAccount();
  if (!account) throw new Error('Twitch account not connected');
  return unseal(account.accessToken);
}
export async function refreshAccountToken() {
  const account = await getAccount();
  if (!account) throw new Error('Twitch account not connected');
  const tokens = await tokenRequest({ grant_type: 'refresh_token', refresh_token: unseal(account.refreshToken) });
  // A refreshed token may rotate. Keep the latest encrypted pair on the server.
  await saveAccount(account.twitchId, account.login, tokens);
  return tokens.access_token;
}
export async function registerChatWebhook(twitchId: string) {
  const app = await tokenRequest({ grant_type: 'client_credentials' });
  const response = await fetch('https://api.twitch.tv/helix/eventsub/subscriptions', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + app.access_token, 'Client-Id': process.env.TWITCH_CLIENT_ID!, 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'channel.chat.message', version: '1',
      condition: { broadcaster_user_id: twitchId, user_id: twitchId },
      transport: { method: 'webhook', callback: new URL('/api/twitch/eventsub', process.env.PUBLIC_BASE_URL!).toString(), secret: process.env.TWITCH_EVENTSUB_SECRET } }),
  });
  // Twitch returns 409 when the subscription already exists.
  if (!response.ok && response.status !== 409) throw new Error('Twitch EventSub registration failed: ' + response.status);
}
