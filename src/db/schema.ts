import { boolean, pgTable, timestamp, varchar, uuid, uniqueIndex } from 'drizzle-orm/pg-core';

export const queueEntries = pgTable('queue_entries', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: varchar('user_id', { length: 64 }).notNull(),
  username: varchar('username', { length: 64 }).notNull(),
  joinedAt: timestamp('joined_at', { withTimezone: true }).defaultNow().notNull(),
}, table => [uniqueIndex('queue_entries_user_unique').on(table.userId)]);

export const queueSettings = pgTable('queue_settings', {
  key: varchar('key', { length: 24 }).primaryKey(),
  isOpen: boolean('is_open').notNull().default(true),
});

export const processedEvents = pgTable('processed_events', {
  id: varchar('id', { length: 128 }).primaryKey(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});
