import { NextResponse } from 'next/server';
import { configured, getAccount } from '@/lib/twitch-auth';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET() {
  if (!configured()) return NextResponse.json({ ready: false, connected: false }, { headers: { 'Cache-Control': 'no-store' } });
  try {
    const account = await getAccount();
    return NextResponse.json({ ready: true, connected: Boolean(account), login: account?.login ?? null }, { headers: { 'Cache-Control': 'no-store' } });
  } catch { return NextResponse.json({ ready: false, connected: false }, { headers: { 'Cache-Control': 'no-store' } }); }
}
