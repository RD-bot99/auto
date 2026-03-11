import { Router } from "express";
import { authMiddleware, AuthRequest } from "../middleware/auth";

const router = Router();
router.use(authMiddleware as any);

// Platform-specific best posting windows (hour ranges in local time)
const PLATFORM_WINDOWS: Record<string, Array<{ hour: number; score: number; reason: string }>> = {
  tiktok: [
    { hour: 7, score: 0.88, reason: "Morning rush hour - high engagement" },
    { hour: 8, score: 0.85, reason: "Morning commute engagement peak" },
    { hour: 19, score: 0.92, reason: "Evening prime time - highest views" },
    { hour: 20, score: 0.90, reason: "Post-dinner browsing peak" },
    { hour: 21, score: 0.82, reason: "Late evening leisure time" },
  ],
  youtube: [
    { hour: 14, score: 0.85, reason: "Afternoon viewing window" },
    { hour: 15, score: 0.88, reason: "Peak afternoon discovery" },
    { hour: 16, score: 0.82, reason: "After-school/work browsing" },
    { hour: 20, score: 0.78, reason: "Evening watchtime session" },
  ],
  instagram: [
    { hour: 7, score: 0.83, reason: "Morning scroll before work" },
    { hour: 8, score: 0.85, reason: "Breakfast browsing peak" },
    { hour: 12, score: 0.88, reason: "Lunchtime engagement peak" },
    { hour: 13, score: 0.82, reason: "Post-lunch scrolling" },
    { hour: 17, score: 0.86, reason: "After-work wind-down" },
    { hour: 18, score: 0.90, reason: "Commute home peak engagement" },
  ],
};

const PREFERRED_DAYS: Record<string, number[]> = {
  tiktok: [1, 2, 3, 4, 5, 6, 0], // All days, weekdays slightly better
  youtube: [4, 5, 6, 0, 1, 2, 3], // Thu-Fri preferred, then weekend
  instagram: [1, 2, 3, 4, 5, 6, 0], // Tue-Fri best
};

router.post("/optimal-times", async (req: AuthRequest, res) => {
  try {
    const { platform, timezone = "UTC" } = req.body;

    if (!platform || !["tiktok", "youtube", "instagram"].includes(platform)) {
      res.status(400).json({ error: "BadRequest", message: "Valid platform required" });
      return;
    }

    const windows = PLATFORM_WINDOWS[platform];
    const preferredDays = PREFERRED_DAYS[platform];

    const now = new Date();
    const slots: Array<{
      datetime: string;
      confidence: number;
      reason: string;
      dayOfWeek: string;
    }> = [];

    const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

    // Generate next 7 days of slots and pick top 3
    const candidates: Array<{
      datetime: Date;
      confidence: number;
      reason: string;
      dayOfWeek: string;
    }> = [];

    for (let day = 0; day <= 7; day++) {
      const date = new Date(now);
      date.setDate(date.getDate() + day);

      const dayOfWeek = date.getDay();
      const dayRank = preferredDays.indexOf(dayOfWeek);
      const dayScore = 1 - (dayRank / preferredDays.length) * 0.2; // 0.8-1.0 range

      for (const window of windows) {
        const slotDate = new Date(date);
        slotDate.setHours(window.hour, Math.floor(Math.random() * 15), 0, 0);

        // Only future slots
        if (slotDate <= now) continue;

        // Add ±15 min randomization
        const jitter = Math.floor(Math.random() * 30) - 15;
        slotDate.setMinutes(slotDate.getMinutes() + jitter);

        const confidence = Math.round(window.score * dayScore * 100) / 100;

        candidates.push({
          datetime: slotDate,
          confidence,
          reason: window.reason,
          dayOfWeek: dayNames[dayOfWeek],
        });
      }
    }

    // Sort by confidence and take top 3
    candidates.sort((a, b) => b.confidence - a.confidence);

    // Take top 3 ensuring they're at least 4 hours apart
    const selected: typeof candidates = [];
    for (const candidate of candidates) {
      const tooClose = selected.some(s => {
        const diff = Math.abs(candidate.datetime.getTime() - s.datetime.getTime());
        return diff < 4 * 60 * 60 * 1000;
      });

      if (!tooClose) {
        selected.push(candidate);
        if (selected.length === 3) break;
      }
    }

    for (const slot of selected) {
      slots.push({
        datetime: slot.datetime.toISOString(),
        confidence: slot.confidence,
        reason: slot.reason,
        dayOfWeek: slot.dayOfWeek,
      });
    }

    res.json(slots);
  } catch (err) {
    console.error("Optimal times error:", err);
    res.status(500).json({ error: "InternalError", message: "Failed to get optimal times" });
  }
});

export default router;
