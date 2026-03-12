import { useState, useRef, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Scissors,
  Upload,
  Link2,
  CheckCircle2,
  Download,
  Trash2,
  Play,
  Clock,
  Sparkles,
  AlertCircle,
  Loader2,
  FileVideo,
  X,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

interface ClipJob {
  clipId: string;
  jobId: string;
  progress: number;
  status: string;
  clipStatus: string;
  clipStart?: number;
  clipEnd?: number;
  aiReason?: string;
  fileSizeBytes?: number;
  sourceFilename?: string;
  sourceUrl?: string;
  error?: string;
  createdAt?: string;
}

function formatDuration(s?: number | null): string {
  if (s == null) return "--";
  const m = Math.floor(s / 60);
  const sec = Math.round(s % 60);
  return `${m}:${String(sec).padStart(2, "0")}`;
}

function formatSize(bytes?: number | null): string {
  if (bytes == null) return "--";
  const mb = bytes / 1024 / 1024;
  return mb >= 1000 ? `${(mb / 1024).toFixed(1)} GB` : `${mb.toFixed(1)} MB`;
}

function formatDate(s?: string): string {
  if (!s) return "";
  return new Date(s).toLocaleString();
}

const STEP_LABELS = [
  "Preparing video",
  "Extracting audio",
  "Transcribing audio",
  "Detecting best clip",
  "Cutting clip",
  "Burning subtitles",
  "Finalizing",
];

function stepFromProgress(p: number): number {
  if (p < 10) return 0;
  if (p < 30) return 1;
  if (p < 50) return 2;
  if (p < 65) return 3;
  if (p < 80) return 4;
  if (p < 95) return 5;
  return 6;
}

export default function Clipper() {
  const { toast } = useToast();
  const [mode, setMode] = useState<"upload" | "url">("upload");
  const [urlInput, setUrlInput] = useState("");
  const [dragging, setDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [jobs, setJobs] = useState<ClipJob[]>([]);
  const [polling, setPolling] = useState<Record<string, ReturnType<typeof setInterval>>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollingRef = useRef<Record<string, ReturnType<typeof setInterval>>>({});

  useEffect(() => {
    fetchExistingClips();
  }, []);

  async function fetchExistingClips() {
    try {
      const res = await fetch(`${BASE}/api/clipper`, { credentials: "include" });
      if (!res.ok) return;
      const clips: any[] = await res.json();
      const mapped = clips
        .filter((c) => c.status !== "deleted")
        .map((c) => ({
          clipId: c.id,
          jobId: c.jobId,
          progress: c.status === "ready" || c.status === "downloaded" ? 100 : 0,
          status: c.status === "ready" || c.status === "downloaded" ? "Ready for download" : c.status,
          clipStatus: c.status,
          clipStart: c.clipStart,
          clipEnd: c.clipEnd,
          aiReason: c.aiReason,
          fileSizeBytes: c.fileSizeBytes,
          sourceFilename: c.sourceFilename,
          sourceUrl: c.sourceUrl,
          error: c.errorMessage,
          createdAt: c.createdAt,
        }));
      setJobs(mapped);
    } catch (_e) {}
  }

  function startPolling(jobId: string, clipId: string) {
    const id = setInterval(async () => {
      try {
        const res = await fetch(`${BASE}/api/clipper/status/${jobId}`, { credentials: "include" });
        if (!res.ok) return;
        const data = await res.json();

        setJobs((prev) =>
          prev.map((j) =>
            j.jobId === jobId
              ? {
                  ...j,
                  progress: data.progress,
                  status: data.status,
                  clipStatus: data.clipStatus,
                  clipStart: data.clipStart ?? j.clipStart,
                  clipEnd: data.clipEnd ?? j.clipEnd,
                  aiReason: data.aiReason ?? j.aiReason,
                  fileSizeBytes: data.fileSizeBytes ?? j.fileSizeBytes,
                  error: data.error,
                }
              : j
          )
        );

        if (data.clipStatus === "ready" || data.clipStatus === "failed" || data.clipStatus === "downloaded") {
          clearInterval(pollingRef.current[jobId]);
          delete pollingRef.current[jobId];
        }
      } catch (_e) {}
    }, 2000);

    pollingRef.current[jobId] = id;
  }

  async function handleUpload() {
    if (!file) return;
    const formData = new FormData();
    formData.append("video", file);

    try {
      const res = await fetch(`${BASE}/api/clipper/upload`, {
        method: "POST",
        credentials: "include",
        body: formData,
      });
      if (!res.ok) throw new Error("Upload failed");
      const data = await res.json();

      const newJob: ClipJob = {
        clipId: data.clipId,
        jobId: data.jobId,
        progress: 0,
        status: "Starting...",
        clipStatus: "processing",
        sourceFilename: file.name,
        createdAt: new Date().toISOString(),
      };
      setJobs((prev) => [newJob, ...prev]);
      setFile(null);
      startPolling(data.jobId, data.clipId);

      toast({ title: "Processing started", description: `${file.name} is being analyzed.` });
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    }
  }

  async function handleFromUrl() {
    if (!urlInput.trim()) return;
    try {
      const res = await fetch(`${BASE}/api/clipper/from-url`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: urlInput.trim() }),
      });
      if (!res.ok) throw new Error("Failed to start download");
      const data = await res.json();

      const newJob: ClipJob = {
        clipId: data.clipId,
        jobId: data.jobId,
        progress: 0,
        status: "Downloading video...",
        clipStatus: "processing",
        sourceUrl: urlInput.trim(),
        createdAt: new Date().toISOString(),
      };
      setJobs((prev) => [newJob, ...prev]);
      setUrlInput("");
      startPolling(data.jobId, data.clipId);

      toast({ title: "Download started", description: "Video is being downloaded and analyzed." });
    } catch (err: any) {
      toast({ title: "Failed", description: err.message, variant: "destructive" });
    }
  }

  async function handleDownload(job: ClipJob) {
    const link = document.createElement("a");
    link.href = `${BASE}/api/clipper/download/${job.clipId}`;
    link.download = `autoflow_clip_${job.clipId.slice(0, 8)}.mp4`;
    link.click();

    setJobs((prev) =>
      prev.map((j) => (j.jobId === job.jobId ? { ...j, clipStatus: "downloaded" } : j))
    );
    toast({ title: "Download started", description: "Your clip is downloading." });
  }

  async function handleDelete(job: ClipJob) {
    try {
      await fetch(`${BASE}/api/clipper/${job.clipId}`, {
        method: "DELETE",
        credentials: "include",
      });
      setJobs((prev) => prev.filter((j) => j.jobId !== job.jobId));
      toast({ title: "Clip deleted" });
    } catch {
      toast({ title: "Delete failed", variant: "destructive" });
    }
  }

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped && dropped.type.startsWith("video/")) {
      setFile(dropped);
    } else {
      toast({ title: "Invalid file", description: "Please drop a video file.", variant: "destructive" });
    }
  }, []);

  const activeJobs = jobs.filter((j) => j.clipStatus === "processing");
  const readyJobs = jobs.filter((j) => j.clipStatus === "ready" || j.clipStatus === "downloaded");
  const failedJobs = jobs.filter((j) => j.clipStatus === "failed");

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-600 flex items-center justify-center shadow-lg shadow-violet-500/30">
            <Scissors className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-display font-bold text-white">Smart Clipper</h1>
            <p className="text-sm text-muted-foreground">AI-powered viral clip extraction with auto-subtitles</p>
          </div>
        </div>
      </div>

      {/* How it works */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { icon: Upload, label: "Upload video", color: "text-blue-400" },
          { icon: Sparkles, label: "Groq Whisper transcribes", color: "text-violet-400" },
          { icon: Scissors, label: "Claude finds best clip", color: "text-fuchsia-400" },
          { icon: Download, label: "Download with subtitles", color: "text-emerald-400" },
        ].map((step, i) => (
          <div key={i} className="flex items-center gap-2 bg-white/3 border border-white/8 rounded-xl px-3 py-2">
            <step.icon className={cn("w-4 h-4 shrink-0", step.color)} />
            <span className="text-xs text-muted-foreground">{step.label}</span>
            {i < 3 && <ChevronRight className="w-3 h-3 text-white/20 hidden sm:block ml-auto" />}
          </div>
        ))}
      </div>

      {/* Input Panel */}
      <div className="bg-card border border-white/8 rounded-2xl p-6 space-y-4">
        {/* Mode tabs */}
        <div className="flex gap-2">
          <button
            onClick={() => setMode("upload")}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all",
              mode === "upload"
                ? "bg-primary text-white shadow-lg shadow-primary/25"
                : "text-muted-foreground hover:text-white hover:bg-white/5"
            )}
          >
            <Upload className="w-4 h-4" />
            Upload File
          </button>
          <button
            onClick={() => setMode("url")}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all",
              mode === "url"
                ? "bg-primary text-white shadow-lg shadow-primary/25"
                : "text-muted-foreground hover:text-white hover:bg-white/5"
            )}
          >
            <Link2 className="w-4 h-4" />
            From URL
          </button>
        </div>

        <AnimatePresence mode="wait">
          {mode === "upload" ? (
            <motion.div
              key="upload"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              className="space-y-3"
            >
              <div
                onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={cn(
                  "border-2 border-dashed rounded-xl p-10 flex flex-col items-center justify-center gap-3 cursor-pointer transition-all",
                  dragging
                    ? "border-primary bg-primary/10"
                    : "border-white/10 hover:border-primary/50 hover:bg-white/3"
                )}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="video/*"
                  className="hidden"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                />
                {file ? (
                  <>
                    <FileVideo className="w-10 h-10 text-primary" />
                    <div className="text-center">
                      <p className="text-white font-medium">{file.name}</p>
                      <p className="text-sm text-muted-foreground">{formatSize(file.size)}</p>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); setFile(null); }}
                      className="text-xs text-muted-foreground hover:text-red-400 flex items-center gap-1"
                    >
                      <X className="w-3 h-3" /> Remove
                    </button>
                  </>
                ) : (
                  <>
                    <Upload className="w-10 h-10 text-muted-foreground" />
                    <div className="text-center">
                      <p className="text-white">Drop a video file here</p>
                      <p className="text-sm text-muted-foreground">or click to browse — MP4, MOV, AVI, MKV, WebM</p>
                    </div>
                  </>
                )}
              </div>

              <Button
                onClick={handleUpload}
                disabled={!file}
                className="w-full bg-primary hover:bg-primary/90 shadow-lg shadow-primary/25"
              >
                <Scissors className="w-4 h-4 mr-2" />
                Extract Best Clip
              </Button>
            </motion.div>
          ) : (
            <motion.div
              key="url"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              className="space-y-3"
            >
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2 text-xs text-amber-400 flex items-start gap-2">
                <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                <span>URL mode requires yt-dlp installed in the server environment. Supports YouTube, TikTok, Instagram, and 1000+ sites.</span>
              </div>
              <div className="flex gap-2">
                <Input
                  placeholder="https://youtube.com/watch?v=..."
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleFromUrl()}
                  className="bg-background/50 border-white/10 flex-1"
                />
                <Button
                  onClick={handleFromUrl}
                  disabled={!urlInput.trim()}
                  className="bg-primary hover:bg-primary/90"
                >
                  <Scissors className="w-4 h-4 mr-2" />
                  Clip
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Active Jobs */}
      {activeJobs.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Processing</h2>
          {activeJobs.map((job) => {
            const step = stepFromProgress(job.progress);
            return (
              <div key={job.jobId} className="bg-card border border-white/8 rounded-2xl p-5 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Loader2 className="w-4 h-4 text-primary animate-spin" />
                    </div>
                    <div>
                      <p className="text-white font-medium text-sm truncate max-w-xs">
                        {job.sourceFilename || job.sourceUrl || "Video"}
                      </p>
                      <p className="text-xs text-muted-foreground">{job.status}</p>
                    </div>
                  </div>
                  <Badge variant="outline" className="text-primary border-primary/30 bg-primary/5 shrink-0">
                    {job.progress}%
                  </Badge>
                </div>

                <Progress value={job.progress} className="h-1.5 bg-white/5" />

                {/* Pipeline steps */}
                <div className="grid grid-cols-7 gap-1">
                  {STEP_LABELS.map((label, i) => (
                    <div key={i} className="flex flex-col items-center gap-1">
                      <div
                        className={cn(
                          "w-2 h-2 rounded-full transition-all",
                          i < step ? "bg-primary" : i === step ? "bg-primary animate-pulse" : "bg-white/10"
                        )}
                      />
                      <span className="text-[9px] text-muted-foreground text-center leading-tight hidden sm:block">
                        {label}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Ready Clips */}
      {readyJobs.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Ready to Download</h2>
          {readyJobs.map((job) => (
            <motion.div
              key={job.jobId}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-card border border-white/8 rounded-2xl p-5"
            >
              <div className="flex items-start justify-between gap-3 mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-white font-medium text-sm truncate max-w-xs">
                      {job.sourceFilename || job.sourceUrl || "Video clip"}
                    </p>
                    <p className="text-xs text-muted-foreground">{formatDate(job.createdAt)}</p>
                  </div>
                </div>
                {job.clipStatus === "downloaded" ? (
                  <Badge variant="outline" className="text-emerald-400 border-emerald-500/30 bg-emerald-500/5">
                    Downloaded
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-primary border-primary/30 bg-primary/5">
                    Ready
                  </Badge>
                )}
              </div>

              {/* Clip info */}
              <div className="grid grid-cols-3 gap-3 mb-4">
                <div className="bg-white/3 rounded-lg p-3 text-center">
                  <Clock className="w-4 h-4 text-muted-foreground mx-auto mb-1" />
                  <p className="text-xs text-muted-foreground">Duration</p>
                  <p className="text-sm font-semibold text-white">
                    {job.clipStart != null && job.clipEnd != null
                      ? formatDuration(job.clipEnd - job.clipStart)
                      : "--"}
                  </p>
                </div>
                <div className="bg-white/3 rounded-lg p-3 text-center">
                  <Play className="w-4 h-4 text-muted-foreground mx-auto mb-1" />
                  <p className="text-xs text-muted-foreground">Start</p>
                  <p className="text-sm font-semibold text-white">
                    {job.clipStart != null ? formatDuration(job.clipStart) : "--"}
                  </p>
                </div>
                <div className="bg-white/3 rounded-lg p-3 text-center">
                  <FileVideo className="w-4 h-4 text-muted-foreground mx-auto mb-1" />
                  <p className="text-xs text-muted-foreground">Size</p>
                  <p className="text-sm font-semibold text-white">{formatSize(job.fileSizeBytes)}</p>
                </div>
              </div>

              {job.aiReason && (
                <div className="bg-violet-500/10 border border-violet-500/20 rounded-lg px-3 py-2 mb-4 flex items-start gap-2">
                  <Sparkles className="w-3.5 h-3.5 text-violet-400 mt-0.5 shrink-0" />
                  <p className="text-xs text-violet-300">{job.aiReason}</p>
                </div>
              )}

              {/* Preview */}
              <div className="mb-4 rounded-xl overflow-hidden bg-black aspect-video">
                <video
                  controls
                  className="w-full h-full object-contain"
                  src={`${BASE}/api/clipper/preview/${job.clipId}`}
                />
              </div>

              <div className="flex gap-2">
                <Button
                  onClick={() => handleDownload(job)}
                  className="flex-1 bg-primary hover:bg-primary/90 shadow-lg shadow-primary/25"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Download MP4
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleDelete(job)}
                  className="text-muted-foreground hover:text-red-400 hover:bg-red-500/10"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Failed Jobs */}
      {failedJobs.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Failed</h2>
          {failedJobs.map((job) => (
            <div key={job.jobId} className="bg-card border border-red-500/20 rounded-2xl p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-red-500/10 flex items-center justify-center">
                    <AlertCircle className="w-4 h-4 text-red-400" />
                  </div>
                  <div>
                    <p className="text-white font-medium text-sm">{job.sourceFilename || job.sourceUrl || "Video"}</p>
                    <p className="text-xs text-red-400">{job.error || "Processing failed"}</p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleDelete(job)}
                  className="text-muted-foreground hover:text-red-400"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {jobs.length === 0 && (
        <div className="text-center py-16">
          <Scissors className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-muted-foreground">No clips yet — upload a video to get started</p>
        </div>
      )}
    </div>
  );
}
