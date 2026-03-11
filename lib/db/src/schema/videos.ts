import { pgTable, serial, integer, text, timestamp, real, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const videosTable = pgTable("videos", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  fileUrl: text("file_url").notNull(),
  thumbnailUrl: text("thumbnail_url"),
  duration: real("duration"),
  fileSize: integer("file_size"),
  resolution: text("resolution"),
  fileHash: text("file_hash"),
  viralityScore: real("virality_score"),
  category: text("category"),
  tone: text("tone"),
  status: text("status").notNull().default("uploaded"), // uploaded, analyzing, analyzed, scheduled, published
  aiSuggestions: jsonb("ai_suggestions"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertVideoSchema = createInsertSchema(videosTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertVideo = z.infer<typeof insertVideoSchema>;
export type Video = typeof videosTable.$inferSelect;
