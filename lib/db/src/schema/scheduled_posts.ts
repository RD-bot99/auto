import { pgTable, serial, integer, text, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { videosTable } from "./videos";

export const scheduledPostsTable = pgTable("scheduled_posts", {
  id: serial("id").primaryKey(),
  videoId: integer("video_id").notNull().references(() => videosTable.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  platform: text("platform").notNull(), // tiktok, youtube, instagram
  scheduledAt: timestamp("scheduled_at").notNull(),
  status: text("status").notNull().default("pending"), // pending, publishing, published, failed, cancelled
  caption: text("caption"),
  hashtags: jsonb("hashtags").$type<string[]>(),
  publishedAt: timestamp("published_at"),
  errorMessage: text("error_message"),
  jobId: text("job_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertScheduledPostSchema = createInsertSchema(scheduledPostsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertScheduledPost = z.infer<typeof insertScheduledPostSchema>;
export type ScheduledPost = typeof scheduledPostsTable.$inferSelect;
