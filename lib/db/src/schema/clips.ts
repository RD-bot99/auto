import { pgTable, text, real, bigint, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const clipsTable = pgTable("clips", {
  id: text("id").primaryKey(), // UUID
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  jobId: text("job_id").notNull(),
  sourceUrl: text("source_url"),
  sourceFilename: text("source_filename"),
  clipStart: real("clip_start"),
  clipEnd: real("clip_end"),
  aiReason: text("ai_reason"),
  subtitleLanguage: text("subtitle_language").default("auto"),
  finalFilePath: text("final_file_path"),
  fileSizeBytes: bigint("file_size_bytes", { mode: "number" }),
  status: text("status").notNull().default("processing"), // processing | ready | downloaded | deleted | failed
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  downloadedAt: timestamp("downloaded_at"),
});

export const insertClipSchema = createInsertSchema(clipsTable).omit({ createdAt: true });
export type InsertClip = z.infer<typeof insertClipSchema>;
export type Clip = typeof clipsTable.$inferSelect;
