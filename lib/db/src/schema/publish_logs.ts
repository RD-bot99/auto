import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { scheduledPostsTable } from "./scheduled_posts";

export const publishLogsTable = pgTable("publish_logs", {
  id: serial("id").primaryKey(),
  scheduledPostId: integer("scheduled_post_id").notNull().references(() => scheduledPostsTable.id, { onDelete: "cascade" }),
  attemptNumber: integer("attempt_number").notNull().default(1),
  status: text("status").notNull(), // success, failed, retrying
  apiResponse: text("api_response"),
  errorMessage: text("error_message"),
  publishedAt: timestamp("published_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertPublishLogSchema = createInsertSchema(publishLogsTable).omit({ id: true, createdAt: true });
export type InsertPublishLog = z.infer<typeof insertPublishLogSchema>;
export type PublishLog = typeof publishLogsTable.$inferSelect;
