import { pgTable, uuid, text, timestamp, pgEnum } from 'drizzle-orm/pg-core';

// ── Enum for roles ────────────────────────────────────────────────────────────
export const roleEnum = pgEnum('role', ['host', 'moderator', 'participant']);

// ── Rooms table ───────────────────────────────────────────────────────────────
// Stores the room record. Active video state lives in memory (RoomManager).
export const rooms = pgTable('rooms', {
  id:        uuid('id').primaryKey().defaultRandom(),
  code:      text('code').notNull().unique(),          // 6-char invite code e.g. "A3F9KX"
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ── Participants table ────────────────────────────────────────────────────────
// Tracks who joined which room. Useful for history and reconnect.
export const participants = pgTable('participants', {
  id:       uuid('id').primaryKey().defaultRandom(),
  roomId:   uuid('room_id')
              .references(() => rooms.id, { onDelete: 'cascade' })
              .notNull(),
  username: text('username').notNull(),
  role:     roleEnum('role').notNull().default('participant'),
  socketId: text('socket_id'),                          // updated on connect/disconnect
  joinedAt: timestamp('joined_at').defaultNow().notNull(),
});

// ── Types inferred from schema ────────────────────────────────────────────────
export type Room        = typeof rooms.$inferSelect;
export type NewRoom     = typeof rooms.$inferInsert;
export type DBParticipant    = typeof participants.$inferSelect;
export type NewParticipant   = typeof participants.$inferInsert;
