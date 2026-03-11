import { Router } from "express";
import { db, scheduledPostsTable, videosTable, publishLogsTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { authMiddleware, AuthRequest } from "../middleware/auth";

const router = Router();
router.use(authMiddleware as any);

router.get("/overview", async (req: AuthRequest, res) => {
  try {
    const allPosts = await db.select().from(scheduledPostsTable).where(eq(scheduledPostsTable.userId, req.userId!));
    const allVideos = await db.select({ id: videosTable.id }).from(videosTable).where(eq(videosTable.userId, req.userId!));

    const platforms = ["tiktok", "youtube", "instagram"];
    const platformBreakdown = platforms.map(platform => {
      const platformPosts = allPosts.filter(p => p.platform === platform);
      return {
        platform,
        published: platformPosts.filter(p => p.status === "published").length,
        pending: platformPosts.filter(p => p.status === "pending").length,
        failed: platformPosts.filter(p => p.status === "failed").length,
      };
    });

    // Recent activity - last 10 posts
    const recentPosts = await db.select({
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
      }
    })
    .from(scheduledPostsTable)
    .leftJoin(videosTable, eq(scheduledPostsTable.videoId, videosTable.id))
    .where(eq(scheduledPostsTable.userId, req.userId!))
    .orderBy(desc(scheduledPostsTable.createdAt))
    .limit(10);

    res.json({
      totalVideos: allVideos.length,
      totalScheduled: allPosts.filter(p => p.status === "pending").length,
      totalPublished: allPosts.filter(p => p.status === "published").length,
      totalFailed: allPosts.filter(p => p.status === "failed").length,
      platformBreakdown,
      recentActivity: recentPosts,
    });
  } catch (err) {
    console.error("Analytics overview error:", err);
    res.status(500).json({ error: "InternalError", message: "Failed to get analytics" });
  }
});

router.get("/posts", async (req: AuthRequest, res) => {
  try {
    const posts = await db.select({
      id: scheduledPostsTable.id,
      platform: scheduledPostsTable.platform,
      publishedAt: scheduledPostsTable.publishedAt,
      status: scheduledPostsTable.status,
      videoTitle: videosTable.title,
    })
    .from(scheduledPostsTable)
    .leftJoin(videosTable, eq(scheduledPostsTable.videoId, videosTable.id))
    .where(eq(scheduledPostsTable.userId, req.userId!))
    .orderBy(desc(scheduledPostsTable.publishedAt));

    // Generate mock analytics data for published posts
    const analytics = posts.map(post => ({
      scheduledPostId: post.id,
      platform: post.platform,
      videoTitle: post.videoTitle || "Unknown",
      publishedAt: post.publishedAt,
      status: post.status,
      views: post.status === "published" ? Math.floor(Math.random() * 50000) + 1000 : 0,
      likes: post.status === "published" ? Math.floor(Math.random() * 5000) + 100 : 0,
      comments: post.status === "published" ? Math.floor(Math.random() * 500) + 10 : 0,
      engagementRate: post.status === "published" ? Math.round((Math.random() * 8 + 2) * 100) / 100 : 0,
    }));

    res.json(analytics);
  } catch (err) {
    console.error("Post analytics error:", err);
    res.status(500).json({ error: "InternalError", message: "Failed to get post analytics" });
  }
});

export default router;
