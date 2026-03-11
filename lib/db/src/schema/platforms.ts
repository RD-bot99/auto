import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const platformConnectionsTable = pgTable("platform_connections", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  platform: text("platform").notNull(), // tiktok, youtube, instagram
  accessTokenEncrypted: text("access_token_encrypted"),
  refreshTokenEncrypted: text("refresh_token_encrypted"),
  status: text("status").notNull().default("disconnected"), // connected, disconnected, expired
  username: text("username"),
  followerCount: integer("follower_count"),
  avatarUrl: text("avatar_url"),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertPlatformConnectionSchema = createInsertSchema(platformConnectionsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertPlatformConnection = z.infer<typeof insertPlatformConnectionSchema>;
export type PlatformConnection = typeof platformConnectionsTable.$inferSelect;
