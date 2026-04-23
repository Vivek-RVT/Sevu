import { pgTable, text, serial, integer, real, timestamp, boolean, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const profilesTable = pgTable("profiles", {
  id: serial("id").primaryKey(),
  businessId: integer("business_id"),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  phone: text("phone").notNull(),
  service: text("service").notNull(),
  city: text("city").notNull(),
  address: text("address"),
  lat: real("lat"),
  lng: real("lng"),
  profileImage: text("profile_image"),
  shopImage: text("shop_image"),
  description: text("description"),
  workImages: text("work_images").array(),
  priceRange: text("price_range"),
  isAvailable24x7: boolean("is_available_24x7").default(false),
  yearsExperience: integer("years_experience"),
  servicesOffered: text("services_offered"),
  certifications: text("certifications"),
  openingHours: text("opening_hours"),
  website: text("website"),
  instagram: text("instagram"),
  whatsapp: text("whatsapp"),
  rating: real("rating").default(0).notNull(),
  totalReviews: integer("total_reviews").default(0).notNull(),
  totalJobs: integer("total_jobs").default(0).notNull(),
  viewCount: integer("view_count").default(0).notNull(),
  callClicks: integer("call_clicks").default(0).notNull(),
  whatsappClicks: integer("whatsapp_clicks").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  index("profiles_business_id_idx").on(t.businessId),
  index("profiles_city_idx").on(t.city),
  index("profiles_service_idx").on(t.service),
  index("profiles_rating_idx").on(t.rating),
]);

export const profileReviewsTable = pgTable("profile_reviews", {
  id: serial("id").primaryKey(),
  profileId: integer("profile_id").references(() => profilesTable.id).notNull(),
  reviewerName: text("reviewer_name").notNull(),
  reviewerPhone: text("reviewer_phone"),
  reviewerAge: integer("reviewer_age"),
  rating: integer("rating").notNull(),
  comment: text("comment"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  index("profile_reviews_profile_id_idx").on(t.profileId),
]);

export const insertProfileSchema = createInsertSchema(profilesTable).omit({
  id: true,
  createdAt: true,
  rating: true,
  totalReviews: true,
  totalJobs: true,
});
export type InsertProfile = z.infer<typeof insertProfileSchema>;
export type Profile = typeof profilesTable.$inferSelect;

export const insertProfileReviewSchema = createInsertSchema(profileReviewsTable).omit({ id: true, createdAt: true });
export type InsertProfileReview = z.infer<typeof insertProfileReviewSchema>;
export type ProfileReview = typeof profileReviewsTable.$inferSelect;
