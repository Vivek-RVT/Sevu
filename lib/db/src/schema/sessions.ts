import { pgTable, uuid, integer, text, timestamp, index } from "drizzle-orm/pg-core";

export const sessionsTable = pgTable("sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: integer("user_id").notNull(),
  refreshTokenHash: text("refresh_token_hash").notNull().unique(),
  deviceInfo: text("device_info"),
  ipAddress: text("ip_address"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  expiresAt: timestamp("expires_at").notNull(),
}, (t) => [
  index("sessions_user_id_idx").on(t.userId),
]);

export type Session = typeof sessionsTable.$inferSelect;
