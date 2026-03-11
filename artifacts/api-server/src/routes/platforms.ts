import { Router } from "express";
import { db, platformConnectionsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { authMiddleware, AuthRequest } from "../middleware/auth";

const router = Router();
router.use(authMiddleware as any);

router.get("/", async (req: AuthRequest, res) => {
  try {
    const platforms = ["tiktok", "youtube", "instagram"];
    const connections = await db
      .select()
      .from(platformConnectionsTable)
      .where(eq(platformConnectionsTable.userId, req.userId!));

    // Return one entry per platform, defaulting to disconnected if not found
    const result = platforms.map(platform => {
      const conn = connections.find(c => c.platform === platform);
      if (conn) {
        return {
          id: conn.id,
          userId: conn.userId,
          platform: conn.platform,
          status: conn.status,
          username: conn.username,
          followerCount: conn.followerCount,
          avatarUrl: conn.avatarUrl,
          expiresAt: conn.expiresAt,
          createdAt: conn.createdAt,
        };
      }
      return {
        id: -1,
        userId: req.userId!,
        platform,
        status: "disconnected",
        username: null,
        followerCount: null,
        avatarUrl: null,
        expiresAt: null,
        createdAt: new Date(),
      };
    });

    res.json(result);
  } catch (err) {
    console.error("Get platforms error:", err);
    res.status(500).json({ error: "InternalError", message: "Failed to get platforms" });
  }
});

router.post("/:platform/connect", async (req: AuthRequest, res) => {
  try {
    const { platform } = req.params;
    const validPlatforms = ["tiktok", "youtube", "instagram"];
    if (!validPlatforms.includes(platform)) {
      res.status(400).json({ error: "BadRequest", message: "Invalid platform" });
      return;
    }

    const { username, followerCount, avatarUrl } = req.body;
    if (!username) {
      res.status(400).json({ error: "BadRequest", message: "Username is required" });
      return;
    }

    // Check if already connected
    const [existing] = await db
      .select()
      .from(platformConnectionsTable)
      .where(and(
        eq(platformConnectionsTable.userId, req.userId!),
        eq(platformConnectionsTable.platform, platform)
      ));

    const expiresAt = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000); // 60 days

    let conn;
    if (existing) {
      [conn] = await db
        .update(platformConnectionsTable)
        .set({ status: "connected", username, followerCount, avatarUrl, expiresAt, updatedAt: new Date() })
        .where(eq(platformConnectionsTable.id, existing.id))
        .returning();
    } else {
      [conn] = await db
        .insert(platformConnectionsTable)
        .values({
          userId: req.userId!,
          platform,
          status: "connected",
          username,
          followerCount,
          avatarUrl,
          expiresAt,
          accessTokenEncrypted: "mock_token_" + platform,
          refreshTokenEncrypted: "mock_refresh_" + platform,
        })
        .returning();
    }

    res.json({
      id: conn.id,
      userId: conn.userId,
      platform: conn.platform,
      status: conn.status,
      username: conn.username,
      followerCount: conn.followerCount,
      avatarUrl: conn.avatarUrl,
      expiresAt: conn.expiresAt,
      createdAt: conn.createdAt,
    });
  } catch (err) {
    console.error("Connect platform error:", err);
    res.status(500).json({ error: "InternalError", message: "Failed to connect platform" });
  }
});

router.post("/:platform/disconnect", async (req: AuthRequest, res) => {
  try {
    const { platform } = req.params;

    await db
      .update(platformConnectionsTable)
      .set({ status: "disconnected", updatedAt: new Date() })
      .where(and(
        eq(platformConnectionsTable.userId, req.userId!),
        eq(platformConnectionsTable.platform, platform)
      ));

    res.json({ message: `Disconnected from ${platform}` });
  } catch (err) {
    console.error("Disconnect platform error:", err);
    res.status(500).json({ error: "InternalError", message: "Failed to disconnect platform" });
  }
});

export default router;
