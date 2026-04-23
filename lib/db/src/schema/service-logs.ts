import { pgTable, text, serial, integer, real, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { customersTable } from "./customers";
import { businessesTable } from "./businesses";

export const serviceLogsTable = pgTable("service_logs", {
  id: serial("id").primaryKey(),
  businessId: integer("business_id").references(() => businessesTable.id).notNull(),
  customerId: integer("customer_id").references(() => customersTable.id),
  customerName: text("customer_name").notNull(),
  service: text("service").notNull(),
  amount: real("amount"),
  paidAmount: real("paid_amount"),
  paymentStatus: text("payment_status").notNull().default("pending"),
  serviceDate: timestamp("service_date").notNull(),
  paymentDate: timestamp("payment_date"),
  nextVisit: timestamp("next_visit"),
  note: text("note"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  index("service_logs_business_id_idx").on(t.businessId),
  index("service_logs_customer_id_idx").on(t.customerId),
  index("service_logs_service_date_idx").on(t.serviceDate),
]);

export const insertServiceLogSchema = createInsertSchema(serviceLogsTable).omit({ id: true, createdAt: true });
export type InsertServiceLog = z.infer<typeof insertServiceLogSchema>;
export type ServiceLog = typeof serviceLogsTable.$inferSelect;
