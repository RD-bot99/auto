import { Router } from "express";
import { db, scheduledPostsTable, videosTable, publishLogsTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { authMiddleware, AuthRequest } from "../middleware/auth";

const router = Router();
router.use(authMiddleware as any);

// Get scheduled posts
router.get("/", async (req: AuthRequest, res) => {
  try {
    const { status, platform } = req.query;

    const posts = await db.select({
      id: scheduledPostsTable.id,
      videoId: scheduledPostsTable.videoId,
      userId: scheduledPostsTable.userId,
      platform: scheduledPostsTable.platform,
      scheduledAt: scheduledPostsTable.scheduledAt,
      status: scheduledPostsTable.status,
      caption: scheduledPostsTable.caption,
      hashtags: scheduledPostsTable.hashtags,
      publishedAt: scheduledPostsTable.publishedAt,
      errorMessage: scheduledPostsTable.errorMessage,
      createdAt: scheduledPostsTable.createdAt,
      video: {
        id: videosTable.id,
        userId: videosTable.userId,
        title: videosTable.title,
        description: videosTable.description,
        fileUrl: videosTable.fileUrl,
        thumbnailUrl: videosTable.thumbnailUrl,
        duration: videosTable.duration,
        fileSize: videosTable.fileSize,
        resolution: videosTable.resolution,
        fileHash: videosTable.fileHash,
        viralityScore: videosTable.viralityScore,
        category: videosTable.category,
        tone: videosTable.tone,
        status: videosTable.status,
        aiSuggestions: videosTable.aiSuggestions,
        createdAt: videosTable.createdAt,
        updatedAt: videosTable.updatedAt,
      },
    })
    .from(scheduledPostsTable)
    .leftJoin(videosTable, eq(scheduledPostsTable.videoId, videosTable.id))
    .where(eq(scheduledPostsTable.userId, req.userId!))
    .orderBy(desc(scheduledPostsTable.scheduledAt));

    let filtered = posts;
    if (status) filtered = filtered.filter(p => p.status === status);
    if (platform) filtered = filtered.filter(p => p.platform === platform);

    res.json(filtered);
  } catch (err) {
    console.error("Get scheduled posts error:", err);
    res.status(500).json({ error: "InternalError", message: "Failed to get scheduled posts" });
  }
});

// Create scheduled post
router.post("/", async (req: AuthRequest, res) => {
  try {
    const { videoId, platform, scheduledAt, caption, hashtags } = req.body;

    if (!videoId || !platform || !scheduledAt) {
      res.status(400).json({ error: "BadRequest", message: "videoId, platform, and scheduledAt are required" });
      return;
    }

    const [video] = await db.select({ id: videosTable.id }).from(videosTable).where(
      and(eq(videosTable.id, videoId), eq(videosTable.userId, req.userId!))
    );

    if (!video) {
      res.status(404).json({ error: "NotFound", message: "Video not found" });
      return;
    }

    const [post] = await db.insert(scheduledPostsTable).values({
      videoId,
      userId: req.userId!,
      platform,
      scheduledAt: new Date(scheduledAt),
      status: "pending",
      caption,
      hashtags,
    }).returning();

    res.status(201).json(post);
  } catch (err) {
    console.error("Create scheduled post error:", err);
    res.status(500).json({ error: "InternalError", message: "Failed to schedule post" });
  }
});

// Update scheduled post
router.patch("/:id", async (req: AuthRequest, res) => {
  try {
    const id = parseInt(req.params.id);
    const { scheduledAt, caption, hashtags, status } = req.body;

    const [existing] = await db.select({ id: scheduledPostsTable.id }).from(scheduledPostsTable).where(
      and(eq(scheduledPostsTable.id, id), eq(scheduledPostsTable.userId, req.userId!))
    );

    if (!existing) {
      res.status(404).json({ error: "NotFound", message: "Scheduled post not found" });
      return;
    }

    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    if (scheduledAt) updateData.scheduledAt = new Date(scheduledAt);
    if (caption !== undefined) updateData.caption = caption;
    if (hashtags !== undefined) updateData.hashtags = hashtags;
    if (status) updateData.status = status;

    const [updated] = await db.update(scheduledPostsTable)
      .set(updateData)
      .where(eq(scheduledPostsTable.id, id))
      .returning();

    res.json(updated);
  } catch (err) {
    console.error("Update scheduled post error:", err);
    res.status(500).json({ error: "InternalError", message: "Failed to update scheduled post" });
  }
});

// Delete scheduled post
router.delete("/:id", async (req: AuthRequest, res) => {
  try {
    const id = parseInt(req.params.id);

    const [existing] = await db.select({ id: scheduledPostsTable.id }).from(scheduledPostsTable).where(
      and(eq(scheduledPostsTable.id, id), eq(scheduledPostsTable.userId, req.userId!))
    );

    if (!existing) {
      res.status(404).json({ error: "NotFound", message: "Scheduled post not found" });
      return;
    }

    await db.delete(scheduledPostsTable).where(eq(scheduledPostsTable.id, id));
    res.json({ message: "Scheduled post deleted" });
  } catch (err) {
    console.error("Delete scheduled post error:", err);
    res.status(500).json({ error: "InternalError", message: "Failed to delete scheduled post" });
  }
});

// Publish now
router.post("/:id/publish", async (req: AuthRequest, res) => {
  try {
    const id = parseInt(req.params.id);

    const [post] = await db.select().from(scheduledPostsTable).where(
      and(eq(scheduledPostsTable.id, id), eq(scheduledPostsTable.userId, req.userId!))
    );

    if (!post) {
      res.status(404).json({ error: "NotFound", message: "Scheduled post not found" });
      return;
    }

    // Simulate publishing (in production this would call platform APIs)
    const [updated] = await db.update(scheduledPostsTable).set({
      status: "published",
      publishedAt: new Date(),
      updatedAt: new Date(),
    }).where(eq(scheduledPostsTable.id, id)).returning();

    // Log the publish attempt
    await db.insert(publishLogsTable).values({
      scheduledPostId: id,
      attemptNumber: 1,
      status: "success",
      apiResponse: JSON.stringify({ status: "ok", platformPostId: `mock_${post.platform}_${Date.now()}` }),
      publishedAt: new Date(),
    });

    res.json(updated);
  } catch (err) {
    console.error("Publish now error:", err);
    res.status(500).json({ error: "InternalError", message: "Failed to publish post" });
  }
});

export default router;
