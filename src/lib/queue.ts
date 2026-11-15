import { asc, eq, sql } from 'drizzle-orm';
import { getDb } from '@/db/client';
import { processedEvents, queueEntries, queueSettings } from '@/db/schema';

export async function snapshot() {
  const db = getDb();
  const [settings, entries] = await Promise.all([
    db.select().from(queueSettings).where(eq(queueSettings.key, 'main')),
    db.select().from(queueEntries).orderBy(asc(queueEntries.joinedAt), asc(queueEntries.id)),
  ]);
  return { isOpen: settings[0]?.isOpen ?? true, entries };
}

export async function setOpen(isOpen: boolean) {
  await getDb().insert(queueSettings).values({ key: 'main', isOpen })
    .onConflictDoUpdate({ target: queueSettings.key, set: { isOpen } });
}

export async function join(userId: string, username: string) {
  const db = getDb();
  // Missing settings means an open queue. An inserted row indicates a successful join.
  const result = await db.execute(sql`
    INSERT INTO queue_entries (id, user_id, username, joined_at)
    SELECT gen_random_uuid(), ${userId}, ${username}, now()
    WHERE COALESCE((SELECT is_open FROM queue_settings WHERE key = 'main'), true)
    ON CONFLICT (user_id) DO NOTHING RETURNING id
  `);
  if (result.rows.length) return 'joined' as const;
  const state = await snapshot();
  return state.entries.some(e => e.userId === userId) ? 'already' as const : 'closed' as const;
}

export async function leave(userId: string) {
  const rows = await getDb().delete(queueEntries).where(eq(queueEntries.userId, userId)).returning();
  return rows.length > 0;
}

export async function next() {
  // Single atomic statement prevents concurrent moderators selecting the same viewer.
  const result = await getDb().execute(sql`
    DELETE FROM queue_entries WHERE id = (
      SELECT id FROM queue_entries ORDER BY joined_at, id FOR UPDATE SKIP LOCKED LIMIT 1
    ) RETURNING username, user_id
  `);
  return result.rows[0] as { username: string; user_id: string } | undefined;
}

export async function clear() { await getDb().delete(queueEntries); }

export async function reserveEvent(id: string) {
  const rows = await getDb().insert(processedEvents).values({ id })
    .onConflictDoNothing().returning({ id: processedEvents.id });
  return rows.length > 0;
}
