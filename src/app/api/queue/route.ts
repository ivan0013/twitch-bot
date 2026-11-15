import { NextRequest, NextResponse } from 'next/server';
import { clear, next, setOpen, snapshot } from '@/lib/queue';
import { isAdmin } from '@/lib/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET() {
  if (!process.env.DATABASE_URL) return NextResponse.json({ demo: true, isOpen: true, entries: [] }, { headers: { 'Cache-Control': 'no-store' } });
  try {
    const state = await snapshot();
    return NextResponse.json({ isOpen: state.isOpen, entries: state.entries.map(({ id, username, joinedAt }) => ({ id, username, joinedAt })) }, { headers: { 'Cache-Control': 'no-store' } });
  } catch { return NextResponse.json({ error: 'Database unavailable' }, { status: 503 }); }
}
export async function POST(request: NextRequest) {
  if (!isAdmin(request.headers.get('authorization'))) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  let action: string;
  try { action = (await request.json()).action; } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  try {
    if (action === 'open') await setOpen(true);
    else if (action === 'close') await setOpen(false);
    else if (action === 'clear') await clear();
    else if (action === 'next') {
      const viewer = await next();
      return NextResponse.json({ viewer: viewer?.username ?? null });
    } else return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    return NextResponse.json({ ok: true });
  } catch { return NextResponse.json({ error: 'Database unavailable' }, { status: 503 }); }
}
