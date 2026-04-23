import { pgTable, text, serial, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const businessesTable = pgTable("businesses", {
  id: serial("id").primaryKey(),
  ownerName: text("owner_name"),
  name: text("name").notNull(),
  category: text("category").notNull(),
  phone: text("phone"),
  address: text("address"),
  reviewLink: text("review_link"),
  defaultReminderMessage: text("default_reminder_message"),
  defaultReviewMessage: text("default_review_message"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertBusinessSchema = createInsertSchema(businessesTable).omit({ id: true, createdAt: true });
export type InsertBusiness = z.infer<typeof insertBusinessSchema>;
export type Business = typeof businessesTable.$inferSelect;
