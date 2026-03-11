import { Router } from "express";
import { db, publishLogsTable, scheduledPostsTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { authMiddleware, AuthRequest } from "../middleware/auth";

const router = Router();
router.use(authMiddleware as any);

router.get("/", async (req: AuthRequest, res) => {
  try {
    const { scheduledPostId } = req.query;

    // First verify ownership if filtering by scheduledPostId
    if (scheduledPostId) {
      const [post] = await db.select({ id: scheduledPostsTable.id }).from(scheduledPostsTable).where(
        and(
          eq(scheduledPostsTable.id, parseInt(scheduledPostId as string)),
          eq(scheduledPostsTable.userId, req.userId!)
        )
      );

      if (!post) {
        res.json([]);
        return;
      }

      const logs = await db.select().from(publishLogsTable)
        .where(eq(publishLogsTable.scheduledPostId, parseInt(scheduledPostId as string)))
        .orderBy(desc(publishLogsTable.createdAt));

      res.json(logs);
      return;
    }

    // Get all logs for user's posts
    const userPosts = await db.select({ id: scheduledPostsTable.id }).from(scheduledPostsTable)
      .where(eq(scheduledPostsTable.userId, req.userId!));

    if (userPosts.length === 0) {
      res.json([]);
      return;
    }

    const postIds = userPosts.map(p => p.id);
    const logs = await db.select().from(publishLogsTable)
      .orderBy(desc(publishLogsTable.createdAt))
      .limit(50);

    const filtered = logs.filter(l => postIds.includes(l.scheduledPostId));
    res.json(filtered);
  } catch (err) {
    console.error("Publish logs error:", err);
    res.status(500).json({ error: "InternalError", message: "Failed to get publish logs" });
  }
});

export default router;
