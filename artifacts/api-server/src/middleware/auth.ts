import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const JWT_SECRET = process.env.JWT_SECRET || "autoflow-dev-secret-key-change-in-production";

export interface AuthRequest extends Request {
  userId?: number;
  user?: { id: number; email: string; timezone: string };
}

export function signToken(userId: number): string {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: "7d" });
}

export async function authMiddleware(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const token = req.cookies?.token || req.headers.authorization?.replace("Bearer ", "");

    if (!token) {
      res.status(401).json({ error: "Unauthorized", message: "No token provided" });
      return;
    }

    const payload = jwt.verify(token, JWT_SECRET) as { userId: number };

    const [user] = await db.select({
      id: usersTable.id,
      email: usersTable.email,
      timezone: usersTable.timezone,
    }).from(usersTable).where(eq(usersTable.id, payload.userId));

    if (!user) {
      res.status(401).json({ error: "Unauthorized", message: "User not found" });
      return;
    }

    req.userId = user.id;
    req.user = user;
    next();
  } catch {
    res.status(401).json({ error: "Unauthorized", message: "Invalid token" });
  }
}
