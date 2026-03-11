import { Router } from "express";
import { db, videosTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { authMiddleware, AuthRequest } from "../middleware/auth";
import { anthropic } from "@workspace/integrations-anthropic-ai";

const router = Router();
router.use(authMiddleware as any);

router.get("/", async (req: AuthRequest, res) => {
  try {
    let query = db.select().from(videosTable).where(eq(videosTable.userId, req.userId!));
    const videos = await query;
    res.json(videos);
  } catch (err) {
    console.error("Get videos error:", err);
    res.status(500).json({ error: "InternalError", message: "Failed to get videos" });
  }
});

router.post("/", async (req: AuthRequest, res) => {
  try {
    const { title, description, fileUrl, thumbnailUrl, duration, fileSize, resolution } = req.body;

    if (!title || !fileUrl) {
      res.status(400).json({ error: "BadRequest", message: "Title and fileUrl are required" });
      return;
    }

    const [video] = await db.insert(videosTable).values({
      userId: req.userId!,
      title,
      description,
      fileUrl,
      thumbnailUrl,
      duration,
      fileSize,
      resolution,
      status: "uploaded",
    }).returning();

    res.status(201).json(video);
  } catch (err) {
    console.error("Create video error:", err);
    res.status(500).json({ error: "InternalError", message: "Failed to create video" });
  }
});

router.get("/:id", async (req: AuthRequest, res) => {
  try {
    const id = parseInt(req.params.id);
    const [video] = await db.select().from(videosTable).where(
      and(eq(videosTable.id, id), eq(videosTable.userId, req.userId!))
    );

    if (!video) {
      res.status(404).json({ error: "NotFound", message: "Video not found" });
      return;
    }

    res.json(video);
  } catch (err) {
    console.error("Get video error:", err);
    res.status(500).json({ error: "InternalError", message: "Failed to get video" });
  }
});

router.delete("/:id", async (req: AuthRequest, res) => {
  try {
    const id = parseInt(req.params.id);
    const [video] = await db.select({ id: videosTable.id }).from(videosTable).where(
      and(eq(videosTable.id, id), eq(videosTable.userId, req.userId!))
    );

    if (!video) {
      res.status(404).json({ error: "NotFound", message: "Video not found" });
      return;
    }

    await db.delete(videosTable).where(eq(videosTable.id, id));
    res.json({ message: "Video deleted" });
  } catch (err) {
    console.error("Delete video error:", err);
    res.status(500).json({ error: "InternalError", message: "Failed to delete video" });
  }
});

router.post("/:id/analyze", async (req: AuthRequest, res) => {
  try {
    const id = parseInt(req.params.id);
    const [video] = await db.select().from(videosTable).where(
      and(eq(videosTable.id, id), eq(videosTable.userId, req.userId!))
    );

    if (!video) {
      res.status(404).json({ error: "NotFound", message: "Video not found" });
      return;
    }

    // Update status to analyzing
    await db.update(videosTable).set({ status: "analyzing" }).where(eq(videosTable.id, id));

    const prompt = `You are a social media content strategist. Analyze this video content and provide recommendations.

Video title: ${video.title}
${video.description ? `Description: ${video.description}` : ""}
${video.duration ? `Duration: ${video.duration} seconds` : ""}
${video.resolution ? `Resolution: ${video.resolution}` : ""}

Please analyze and return a JSON object (no markdown, just valid JSON) with these exact fields:
{
  "category": "one of: fitness, cooking, tech, entertainment, education, fashion, travel, gaming, music, business, lifestyle, comedy, news, sports, beauty",
  "tone": "one of: educational, entertaining, promotional, inspirational, informational, comedic",
  "viralityScore": <number 1-10>,
  "suggestions": {
    "title": "optimized title for maximum engagement",
    "description": "compelling description",
    "hashtags": ["tag1", "tag2", "tag3", "tag4", "tag5", "tag6", "tag7", "tag8", "tag9", "tag10"],
    "tiktokCaption": "short engaging TikTok caption with emojis and trending hashtags",
    "youtubeDescription": "full YouTube description with timestamps and calls-to-action",
    "instagramCaption": "Instagram caption with storytelling hook and hashtags"
  }
}`;

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 8192,
      messages: [{ role: "user", content: prompt }],
    });

    const content = message.content[0];
    if (content.type !== "text") {
      throw new Error("Unexpected response type");
    }

    let analysis;
    try {
      // Try to parse JSON directly or extract from any wrapper
      const text = content.text.trim();
      analysis = JSON.parse(text);
    } catch {
      // Try to extract JSON from the response
      const match = content.text.match(/\{[\s\S]*\}/);
      if (match) {
        analysis = JSON.parse(match[0]);
      } else {
        throw new Error("Failed to parse AI response");
      }
    }

    // Update video with analysis results
    await db.update(videosTable).set({
      status: "analyzed",
      category: analysis.category,
      tone: analysis.tone,
      viralityScore: analysis.viralityScore,
      aiSuggestions: analysis.suggestions,
      updatedAt: new Date(),
    }).where(eq(videosTable.id, id));

    res.json({
      videoId: id,
      category: analysis.category,
      tone: analysis.tone,
      viralityScore: analysis.viralityScore,
      suggestions: analysis.suggestions,
    });
  } catch (err) {
    console.error("Analyze video error:", err);
    // Reset status on failure
    await db.update(videosTable).set({ status: "uploaded" }).where(eq(videosTable.id, parseInt(req.params.id)));
    res.status(500).json({ error: "InternalError", message: "Failed to analyze video" });
  }
});

export default router;
