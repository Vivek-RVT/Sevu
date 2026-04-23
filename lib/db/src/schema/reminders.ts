import { pgTable, serial, integer, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { customersTable } from "./customers";
import { businessesTable } from "./businesses";

export const reminderLogsTable = pgTable("reminder_logs", {
  id: serial("id").primaryKey(),
  customerId: integer("customer_id").references(() => customersTable.id).notNull(),
  businessId: integer("business_id").references(() => businessesTable.id).notNull(),
  sentAt: timestamp("sent_at").defaultNow().notNull(),
}, (t) => [
  index("reminder_logs_business_id_idx").on(t.businessId),
]);

export const reviewLogsTable = pgTable("review_logs", {
  id: serial("id").primaryKey(),
  customerId: integer("customer_id").references(() => customersTable.id).notNull(),
  businessId: integer("business_id").references(() => businessesTable.id).notNull(),
  sentAt: timestamp("sent_at").defaultNow().notNull(),
}, (t) => [
  index("review_logs_business_id_idx").on(t.businessId),
]);

export const insertReminderLogSchema = createInsertSchema(reminderLogsTable).omit({ id: true, sentAt: true });
export type InsertReminderLog = z.infer<typeof insertReminderLogSchema>;
export type ReminderLog = typeof reminderLogsTable.$inferSelect;

export const insertReviewLogSchema = createInsertSchema(reviewLogsTable).omit({ id: true, sentAt: true });
export type InsertReviewLog = z.infer<typeof insertReviewLogSchema>;
export type ReviewLog = typeof reviewLogsTable.$inferSelect;
