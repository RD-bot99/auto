import { spawn } from "child_process";
import fs from "fs";
import Groq from "groq-sdk";

export interface TranscriptSegment {
  start: number;
  end: number;
  text: string;
}

async function transcribeWithGroq(audioPath: string): Promise<TranscriptSegment[]> {
  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
  const file = fs.createReadStream(audioPath);

  const transcription = await groq.audio.transcriptions.create({
    file,
    model: "whisper-large-v3",
    response_format: "verbose_json",
    timestamp_granularities: ["segment"],
  });

  const segments = (transcription as any).segments ?? [];
  return segments.map((s: any) => ({ start: s.start, end: s.end, text: s.text.trim() }));
}

async function transcribeLocal(audioPath: string): Promise<TranscriptSegment[]> {
  return new Promise((resolve, reject) => {
    const jsonOut = audioPath.replace(".wav", ".json");
    const whisperModel = process.env.WHISPER_MODEL || "small";

    const py = spawn("python3", [
      "-m", "whisper", audioPath,
      "--model", whisperModel,
      "--output_format", "json",
      "--output_dir", "/tmp/",
      "--language", "auto",
    ]);

    py.stderr.on("data", (d) => console.log("[whisper]", d.toString()));

    py.on("close", (code) => {
      if (code !== 0) {
        reject(new Error("Local Whisper failed with code " + code));
        return;
      }
      try {
        const result = JSON.parse(fs.readFileSync(jsonOut, "utf8"));
        resolve((result.segments || []).map((s: any) => ({
          start: s.start,
          end: s.end,
          text: s.text.trim(),
        })));
      } catch (err) {
        reject(new Error("Failed to parse local Whisper output"));
      }
    });
  });
}

export async function transcribe(audioPath: string): Promise<TranscriptSegment[]> {
  if (process.env.GROQ_API_KEY) {
    try {
      console.log("[Transcription] Using Groq Whisper...");
      return await transcribeWithGroq(audioPath);
    } catch (err: any) {
      console.warn("[Transcription] Groq failed, falling back to local:", err.message);
    }
  }

  console.log("[Transcription] Using local Whisper model...");
  return await transcribeLocal(audioPath);
}
