import path from "path";
import fs from "fs";
import { exec, spawn } from "child_process";
import { promisify } from "util";
import ffmpeg from "fluent-ffmpeg";
import { transcribe, TranscriptSegment } from "./transcription.js";
import { anthropic } from "@workspace/integrations-anthropic-ai";

const execAsync = promisify(exec);

const TEMP_DIR = process.env.TEMP_FILES_DIR || "/tmp/autoflow_clips";
fs.mkdirSync(TEMP_DIR, { recursive: true });

export function getTempPath(filename: string) {
  return path.join(TEMP_DIR, filename);
}

export async function getVideoDuration(videoPath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(videoPath, (err, metadata) => {
      if (err) reject(err);
      else resolve(metadata.format.duration ?? 0);
    });
  });
}

export async function extractAudio(videoPath: string, jobId: string): Promise<string> {
  const audioPath = getTempPath(`audio_${jobId}.wav`);
  return new Promise((resolve, reject) => {
    ffmpeg(videoPath)
      .noVideo()
      .audioFrequency(16000)
      .audioChannels(1)
      .audioCodec("pcm_s16le")
      .format("wav")
      .on("end", () => resolve(audioPath))
      .on("error", reject)
      .save(audioPath);
  });
}

export async function detectBestClip(
  transcript: TranscriptSegment[],
  duration: number
): Promise<{ startTime: number; endTime: number; reason: string }> {
  const transcriptText = transcript
    .map((s) => `[${s.start.toFixed(1)}s - ${s.end.toFixed(1)}s]: ${s.text}`)
    .join("\n");

  const prompt = `You are a viral video editor. Given this transcript with timestamps, identify the single most engaging, shareable, and impactful segment.

Rules:
- Clip must be between 15 and 90 seconds long
- Must start and end at natural speech boundaries (not mid-sentence)
- Must contain the "hook" or the most surprising/valuable moment
- Prefer moments with strong emotional appeal, humor, surprising facts, or clear calls-to-action
- Return ONLY valid JSON, no markdown, no explanation outside JSON

Return exactly this JSON format:
{ "start_time": <float>, "end_time": <float>, "reason": "<brief explanation>" }

Transcript:
${transcriptText}

Video duration: ${duration.toFixed(1)} seconds`;

  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 512,
    messages: [{ role: "user", content: prompt }],
  });

  const content = message.content[0];
  if (content.type !== "text") throw new Error("Unexpected Claude response type");

  const jsonMatch = content.text.match(/\{[\s\S]*?\}/);
  if (!jsonMatch) throw new Error("Claude did not return valid JSON");

  const parsed = JSON.parse(jsonMatch[0]);
  return {
    startTime: Math.max(0, parsed.start_time),
    endTime: Math.min(duration, parsed.end_time),
    reason: parsed.reason,
  };
}

export async function cutClip(
  inputPath: string,
  startTime: number,
  endTime: number,
  jobId: string,
  onProgress?: (pct: number) => void
): Promise<string> {
  const outputPath = getTempPath(`clip_${jobId}.mp4`);
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .setStartTime(startTime)
      .setDuration(endTime - startTime)
      .videoCodec("libx264")
      .audioCodec("aac")
      .outputOptions(["-avoid_negative_ts", "make_zero", "-movflags", "+faststart"])
      .on("progress", (p) => onProgress?.(p.percent ?? 0))
      .on("end", () => resolve(outputPath))
      .on("error", reject)
      .save(outputPath);
  });
}

function toSrtTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.round((seconds % 1) * 1000);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")},${String(ms).padStart(3, "0")}`;
}

function generateSrt(segments: TranscriptSegment[], startOffset: number): string {
  return segments
    .map((seg, i) => {
      const start = toSrtTime(seg.start - startOffset);
      const end = toSrtTime(seg.end - startOffset);
      return `${i + 1}\n${start} --> ${end}\n${seg.text}\n`;
    })
    .join("\n");
}

export async function addSubtitles(
  clipPath: string,
  transcript: TranscriptSegment[],
  clipStart: number,
  clipEnd: number,
  jobId: string,
  videoHeight: number = 720
): Promise<string> {
  const relevant = transcript.filter(
    (s) => s.end > clipStart && s.start < clipEnd
  );
  const srtContent = generateSrt(relevant, clipStart);
  const srtPath = getTempPath(`subs_${jobId}.srt`);
  fs.writeFileSync(srtPath, srtContent, "utf8");

  const fontSize = videoHeight >= 1080 ? 22 : 18;
  const finalPath = getTempPath(`final_${jobId}.mp4`);
  const escapedSrt = srtPath.replace(/\\/g, "/").replace(/:/g, "\\:");

  return new Promise((resolve, reject) => {
    ffmpeg(clipPath)
      .videoFilter(
        `subtitles='${escapedSrt}':force_style='FontName=Arial,FontSize=${fontSize},PrimaryColour=&Hffffff,OutlineColour=&H000000,Outline=2,Bold=1,Alignment=2'`
      )
      .audioCodec("copy")
      .on("end", () => resolve(finalPath))
      .on("error", reject)
      .save(finalPath);
  });
}

export async function downloadFromUrl(url: string, jobId: string): Promise<string> {
  const outputPath = getTempPath(`input_${jobId}.mp4`);

  // Prefer the absolute Nix store path if it exists, fall back to PATH
  const ytdlpCandidates = [
    "/nix/store/am2x1y1qyja0hbyjpffj7rcvycp9d644-yt-dlp-2025.6.30/bin/yt-dlp",
    "/usr/local/bin/yt-dlp",
    "yt-dlp",
  ];
  const ytdlpBin = ytdlpCandidates.find((b) => {
    try { return b === "yt-dlp" || fs.existsSync(b); } catch { return false; }
  }) ?? "yt-dlp";

  return new Promise((resolve, reject) => {
    let proc: ReturnType<typeof spawn>;
    try {
      proc = spawn(ytdlpBin, [
        "-f", "mp4/bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best",
        "--merge-output-format", "mp4",
        "-o", outputPath,
        "--no-playlist",
        url,
      ]);
    } catch (err) {
      reject(new Error("yt-dlp not found — URL mode requires yt-dlp to be installed"));
      return;
    }

    proc.on("error", (err) => {
      reject(new Error(`yt-dlp not available: ${err.message}. Install with: pip install yt-dlp`));
    });

    proc.stdout?.on("data", (d) => console.log("[yt-dlp]", d.toString()));
    proc.stderr?.on("data", (d) => console.log("[yt-dlp]", d.toString()));

    proc.on("close", (code) => {
      if (code === 0) resolve(outputPath);
      else reject(new Error(`yt-dlp exited with code ${code}`));
    });
  });
}

export function cleanupFiles(jobId: string) {
  const patterns = [`input_${jobId}.mp4`, `audio_${jobId}.wav`, `clip_${jobId}.mp4`, `subs_${jobId}.srt`];
  for (const name of patterns) {
    const p = getTempPath(name);
    if (fs.existsSync(p)) fs.unlinkSync(p);
  }
}

export function cleanupFinalFile(jobId: string) {
  const p = getTempPath(`final_${jobId}.mp4`);
  if (fs.existsSync(p)) fs.unlinkSync(p);
}
