import fs from "fs";
import { db, clipsTable } from "@workspace/db";
import { inArray, eq } from "drizzle-orm";
import app from "./app";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

async function cleanupStaleClips() {
  try {
    const stale = await db
      .select({ id: clipsTable.id, finalFilePath: clipsTable.finalFilePath })
      .from(clipsTable)
      .where(inArray(clipsTable.status, ["processing", "ready"]));

    const staleIds: string[] = [];
    for (const clip of stale) {
      if (clip.finalFilePath && !fs.existsSync(clip.finalFilePath)) {
        staleIds.push(clip.id);
      } else if (!clip.finalFilePath && clip.finalFilePath !== null) {
        staleIds.push(clip.id);
      }
    }

    // Mark any "processing" clips that have no file as failed
    const processingStale = stale
      .filter((c) => !c.finalFilePath)
      .map((c) => c.id);
    if (processingStale.length > 0) {
      await db
        .update(clipsTable)
        .set({ status: "failed", errorMessage: "Server restarted before processing completed" })
        .where(inArray(clipsTable.id, processingStale));
    }

    // Mark "ready" clips with missing files as failed
    const readyMissingFile = stale
      .filter((c) => c.finalFilePath && !fs.existsSync(c.finalFilePath))
      .map((c) => c.id);
    if (readyMissingFile.length > 0) {
      await db
        .update(clipsTable)
        .set({ status: "failed", errorMessage: "Clip file was lost (server restarted)" })
        .where(inArray(clipsTable.id, readyMissingFile));
    }

    const total = processingStale.length + readyMissingFile.length;
    if (total > 0) {
      console.log(`[Startup] Marked ${total} stale clip(s) as failed`);
    }
  } catch (err) {
    console.warn("[Startup] Could not clean up stale clips:", err);
  }
}

cleanupStaleClips().then(() => {
  app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
  });
});
