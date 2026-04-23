import { pgTable, text, serial, integer, timestamp, date, real, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { businessesTable } from "./businesses";

export const customersTable = pgTable("customers", {
  id: serial("id").primaryKey(),
  businessId: integer("business_id").references(() => businessesTable.id).notNull(),
  name: text("name").notNull(),
  phone: text("phone").notNull(),
  email: text("email"),
  address: text("address"),
  birthday: date("birthday"),
  gender: text("gender"),
  serviceType: text("service_type").default("").notNull(),
  lastServiceDate: date("last_service_date"),
  nextServiceDate: date("next_service_date"),
  outstandingBalance: real("outstanding_balance").default(0),
  totalSpent: real("total_spent").default(0),
  notes: text("notes"),
  tags: text("tags"),
  remindersSent: integer("reminders_sent").default(0).notNull(),
  reviewsSent: integer("reviews_sent").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  index("customers_business_id_idx").on(t.businessId),
  index("customers_next_service_date_idx").on(t.nextServiceDate),
]);

export const insertCustomerSchema = createInsertSchema(customersTable).omit({ id: true, createdAt: true, remindersSent: true, reviewsSent: true });
export type InsertCustomer = z.infer<typeof insertCustomerSchema>;
export type Customer = typeof customersTable.$inferSelect;
