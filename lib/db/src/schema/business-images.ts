import { pgTable, text, serial, integer, boolean, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { businessesTable } from "./businesses";

export const businessImagesTable = pgTable("business_images", {
  id: serial("id").primaryKey(),
  businessId: integer("business_id").references(() => businessesTable.id).notNull(),
  objectPath: text("object_path").notNull(),
  type: text("type").notNull().default("general"),
  isPublic: boolean("is_public").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  index("business_images_business_id_idx").on(t.businessId),
  index("business_images_object_path_idx").on(t.objectPath),
]);

export const insertBusinessImageSchema = createInsertSchema(businessImagesTable).omit({ id: true, createdAt: true });
export type InsertBusinessImage = z.infer<typeof insertBusinessImageSchema>;
export type BusinessImage = typeof businessImagesTable.$inferSelect;
