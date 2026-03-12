import { Router, Request } from "express";
import multer from "multer";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { db, clipsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { authMiddleware, AuthRequest } from "../middleware/auth.js";
import {
  getVideoDuration,
  extractAudio,
  detectBestClip,
  cutClip,
  addSubtitles,
  downloadFromUrl,
  cleanupFiles,
  cleanupFinalFile,
  getTempPath,
} from "../services/clipper.js";
import { transcribe } from "../services/transcription.js";

const router = Router();
router.use(authMiddleware as any);

const TEMP_DIR = process.env.TEMP_FILES_DIR || path.resolve(process.cwd(), "..", "..", "data", "clips");
fs.mkdirSync(TEMP_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: TEMP_DIR,
  filename: (_req, file, cb) => {
    const jobId = crypto.randomUUID();
    const ext = path.extname(file.originalname) || ".mp4";
    cb(null, `input_${jobId}${ext}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 * 1024 }, // 2GB
  fileFilter: (_req, file, cb) => {
    const allowed = [".mp4", ".mov", ".avi", ".mkv", ".webm"];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) cb(null, true);
    else cb(new Error("Unsupported file type"));
  },
});

// In-memory job progress store (keyed by jobId)
const jobProgress: Record<string, { progress: number; status: string; error?: string }> = {};

async function runClipperPipeline(jobId: string, clipId: string, inputPath: string, sourceUrl?: string, sourceFilename?: string) {
  try {
    jobProgress[jobId] = { progress: 5, status: "Preparing video..." };

    // Verify the input file actually exists before doing anything
    if (!fs.existsSync(inputPath)) {
      // yt-dlp sometimes saves with a different extension — scan the dir for a match
      const dir = path.dirname(inputPath);
      const base = path.basename(inputPath, path.extname(inputPath));
      const found = fs.readdirSync(dir).find((f) => f.startsWith(base.replace("input_", "input_")));
      if (found) {
        inputPath = path.join(dir, found);
        console.log("[Clipper] Using actual downloaded file:", inputPath);
      } else {
        throw new Error(`Input video file not found at ${inputPath}`);
      }
    }

    const duration = await getVideoDuration(inputPath);
    jobProgress[jobId] = { progress: 10, status: "Extracting audio..." };

    const audioPath = await extractAudio(inputPath, jobId);
    jobProgress[jobId] = { progress: 30, status: audioPath ? "Transcribing audio..." : "No audio stream — skipping transcription..." };

    let transcript: { start: number; end: number; text: string }[] = [];
    if (audioPath) {
      try {
        transcript = await transcribe(audioPath);
      } catch (err: any) {
        console.warn("[Clipper] Transcription failed, using empty transcript:", err.message);
      }
    }
    jobProgress[jobId] = { progress: 50, status: "Detecting best clip..." };

    let startTime = 0;
    let endTime = Math.min(duration, 60);
    let reason = "Auto-selected first 60 seconds";

    if (transcript.length > 0) {
      try {
        const detection = await detectBestClip(transcript, duration);
        startTime = detection.startTime;
        endTime = detection.endTime;
        reason = detection.reason;
      } catch (err: any) {
        console.warn("[Clipper] AI detection failed:", err.message);
      }
    }
    jobProgress[jobId] = { progress: 65, status: "Cutting clip..." };

    const clipPath = await cutClip(inputPath, startTime, endTime, jobId, (pct) => {
      jobProgress[jobId] = { progress: 65 + Math.round(pct * 0.15), status: "Cutting clip..." };
    });
    jobProgress[jobId] = { progress: 80, status: "Burning subtitles..." };

    let finalPath: string;
    const safeFinalPath = path.join(TEMP_DIR, `final_${jobId}.mp4`);
    if (transcript.length > 0) {
      try {
        finalPath = await addSubtitles(clipPath, transcript, startTime, endTime, jobId);
      } catch (err: any) {
        console.warn("[Clipper] Subtitle burning failed, using clip without subtitles:", err.message);
        fs.renameSync(clipPath, safeFinalPath);
        finalPath = safeFinalPath;
      }
    } else {
      // No transcript — rename so cleanupFiles() doesn't delete the final output
      fs.renameSync(clipPath, safeFinalPath);
      finalPath = safeFinalPath;
    }
    jobProgress[jobId] = { progress: 95, status: "Finalizing..." };

    const stat = fs.statSync(finalPath);
    await db.update(clipsTable).set({
      clipStart: startTime,
      clipEnd: endTime,
      aiReason: reason,
      finalFilePath: finalPath,
      fileSizeBytes: stat.size,
      status: "ready",
    }).where(eq(clipsTable.id, clipId));

    // Clean up intermediate files (keep final)
    cleanupFiles(jobId);

    jobProgress[jobId] = { progress: 100, status: "Ready for download" };
  } catch (err: any) {
    console.error("[Clipper] Pipeline error:", err);
    await db.update(clipsTable).set({ status: "failed", errorMessage: err.message }).where(eq(clipsTable.id, clipId));
    jobProgress[jobId] = { progress: 0, status: "Failed", error: err.message };
  }
}

// POST /api/clipper/upload
router.post("/upload", upload.single("video"), async (req: AuthRequest, res) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: "BadRequest", message: "No video file provided" });
      return;
    }

    const clipId = crypto.randomUUID();
    const jobId = crypto.randomUUID();
    const inputPath = req.file.path;

    await db.insert(clipsTable).values({
      id: clipId,
      userId: req.userId!,
      jobId,
      sourceFilename: req.file.originalname,
      status: "processing",
    });

    jobProgress[jobId] = { progress: 0, status: "Starting..." };

    // Run pipeline async
    runClipperPipeline(jobId, clipId, inputPath, undefined, req.file.originalname);

    res.status(201).json({ clipId, jobId, status: "processing" });
  } catch (err) {
    console.error("Upload error:", err);
    res.status(500).json({ error: "InternalError", message: "Upload failed" });
  }
});

// POST /api/clipper/from-url
router.post("/from-url", async (req: AuthRequest, res) => {
  try {
    const { url } = req.body;
    if (!url) {
      res.status(400).json({ error: "BadRequest", message: "URL is required" });
      return;
    }

    const clipId = crypto.randomUUID();
    const jobId = crypto.randomUUID();

    await db.insert(clipsTable).values({
      id: clipId,
      userId: req.userId!,
      jobId,
      sourceUrl: url,
      status: "processing",
    });

    jobProgress[jobId] = { progress: 0, status: "Downloading video..." };

    // Run pipeline async
    (async () => {
      try {
        const inputPath = await downloadFromUrl(url, jobId);
        jobProgress[jobId] = { progress: 10, status: "Video downloaded" };
        await runClipperPipeline(jobId, clipId, inputPath, url);
      } catch (err: any) {
        console.error("[Clipper] Download error:", err);
        await db.update(clipsTable).set({ status: "failed", errorMessage: err.message }).where(eq(clipsTable.id, clipId));
        jobProgress[jobId] = { progress: 0, status: "Failed", error: err.message };
      }
    })();

    res.status(201).json({ clipId, jobId, status: "processing" });
  } catch (err) {
    console.error("From-URL error:", err);
    res.status(500).json({ error: "InternalError", message: "Failed to start processing" });
  }
});

// GET /api/clipper/status/:jobId
router.get("/status/:jobId", async (req: AuthRequest, res) => {
  const { jobId } = req.params;

  const [clip] = await db.select().from(clipsTable).where(eq(clipsTable.jobId, jobId));
  if (!clip || clip.userId !== req.userId!) {
    res.status(404).json({ error: "NotFound", message: "Job not found" });
    return;
  }

  const progress = jobProgress[jobId] || { progress: 0, status: "Unknown" };
  res.json({
    jobId,
    clipId: clip.id,
    progress: progress.progress,
    status: progress.status,
    error: progress.error,
    clipStatus: clip.status,
    clipStart: clip.clipStart,
    clipEnd: clip.clipEnd,
    aiReason: clip.aiReason,
    fileSizeBytes: clip.fileSizeBytes,
  });
});

// GET /api/clipper/preview/:clipId
router.get("/preview/:clipId", async (req: AuthRequest, res) => {
  const [clip] = await db.select().from(clipsTable).where(
    and(eq(clipsTable.id, req.params.clipId), eq(clipsTable.userId, req.userId!))
  );

  if (!clip || !clip.finalFilePath || clip.status !== "ready") {
    res.status(404).json({ error: "NotFound", message: "Clip not ready" });
    return;
  }

  if (!fs.existsSync(clip.finalFilePath)) {
    res.status(404).json({ error: "NotFound", message: "Clip file not found" });
    return;
  }

  const stat = fs.statSync(clip.finalFilePath);
  const range = req.headers.range;

  if (range) {
    const parts = range.replace(/bytes=/, "").split("-");
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : stat.size - 1;
    const chunkSize = end - start + 1;

    res.writeHead(206, {
      "Content-Range": `bytes ${start}-${end}/${stat.size}`,
      "Accept-Ranges": "bytes",
      "Content-Length": chunkSize,
      "Content-Type": "video/mp4",
    });

    fs.createReadStream(clip.finalFilePath, { start, end }).pipe(res);
  } else {
    res.writeHead(200, {
      "Content-Length": stat.size,
      "Content-Type": "video/mp4",
      "Accept-Ranges": "bytes",
    });
    fs.createReadStream(clip.finalFilePath).pipe(res);
  }
});

// GET /api/clipper/download/:clipId
router.get("/download/:clipId", async (req: AuthRequest, res) => {
  const [clip] = await db.select().from(clipsTable).where(
    and(eq(clipsTable.id, req.params.clipId), eq(clipsTable.userId, req.userId!))
  );

  if (!clip || !clip.finalFilePath || clip.status !== "ready") {
    res.status(404).json({ error: "NotFound", message: "Clip not ready" });
    return;
  }

  if (!fs.existsSync(clip.finalFilePath)) {
    res.status(404).json({ error: "NotFound", message: "Clip file not found" });
    return;
  }

  res.setHeader("Content-Disposition", `attachment; filename="autoflow_clip_${clip.id.slice(0, 8)}.mp4"`);
  res.setHeader("Content-Type", "video/mp4");

  fs.createReadStream(clip.finalFilePath).pipe(res);

  // Mark as downloaded
  await db.update(clipsTable).set({ status: "downloaded", downloadedAt: new Date() }).where(eq(clipsTable.id, clip.id));
});

// DELETE /api/clipper/:clipId
router.delete("/:clipId", async (req: AuthRequest, res) => {
  const [clip] = await db.select().from(clipsTable).where(
    and(eq(clipsTable.id, req.params.clipId), eq(clipsTable.userId, req.userId!))
  );

  if (!clip) {
    res.status(404).json({ error: "NotFound", message: "Clip not found" });
    return;
  }

  if (clip.finalFilePath && fs.existsSync(clip.finalFilePath)) {
    fs.unlinkSync(clip.finalFilePath);
  }
  cleanupFiles(clip.jobId);
  cleanupFinalFile(clip.jobId);

  await db.update(clipsTable).set({ status: "deleted" }).where(eq(clipsTable.id, clip.id));
  res.json({ message: "Clip deleted" });
});

// GET /api/clipper — list user's clips
router.get("/", async (req: AuthRequest, res) => {
  const clips = await db.select().from(clipsTable).where(eq(clipsTable.userId, req.userId!));
  res.json(clips);
});

export default router;
