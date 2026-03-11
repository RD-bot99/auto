import { Router } from "express";
import bcrypt from "bcryptjs";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { signToken, authMiddleware, AuthRequest } from "../middleware/auth";

const router = Router();

router.post("/register", async (req, res) => {
  try {
    const { email, password, timezone = "UTC" } = req.body;

    if (!email || !password) {
      res.status(400).json({ error: "BadRequest", message: "Email and password are required" });
      return;
    }
    if (password.length < 8) {
      res.status(400).json({ error: "BadRequest", message: "Password must be at least 8 characters" });
      return;
    }

    const [existing] = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.email, email));
    if (existing) {
      res.status(400).json({ error: "BadRequest", message: "Email already registered" });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const [user] = await db.insert(usersTable).values({ email, passwordHash, timezone }).returning({
      id: usersTable.id,
      email: usersTable.email,
      timezone: usersTable.timezone,
      createdAt: usersTable.createdAt,
    });

    const token = signToken(user.id);
    res.cookie("token", token, { httpOnly: true, sameSite: "lax", maxAge: 7 * 24 * 60 * 60 * 1000 });
    res.status(201).json({ user, token });
  } catch (err) {
    console.error("Register error:", err);
    res.status(500).json({ error: "InternalError", message: "Registration failed" });
  }
});

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ error: "BadRequest", message: "Email and password are required" });
      return;
    }

    const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email));
    if (!user) {
      res.status(401).json({ error: "Unauthorized", message: "Invalid credentials" });
      return;
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      res.status(401).json({ error: "Unauthorized", message: "Invalid credentials" });
      return;
    }

    const token = signToken(user.id);
    res.cookie("token", token, { httpOnly: true, sameSite: "lax", maxAge: 7 * 24 * 60 * 60 * 1000 });
    res.json({
      user: { id: user.id, email: user.email, timezone: user.timezone, createdAt: user.createdAt },
      token,
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "InternalError", message: "Login failed" });
  }
});

router.post("/logout", (_req, res) => {
  res.clearCookie("token");
  res.json({ message: "Logged out successfully" });
});

router.get("/me", authMiddleware, async (req: AuthRequest, res) => {
  const user = await db.select({
    id: usersTable.id,
    email: usersTable.email,
    timezone: usersTable.timezone,
    createdAt: usersTable.createdAt,
  }).from(usersTable).where(eq(usersTable.id, req.userId!));

  if (!user[0]) {
    res.status(401).json({ error: "Unauthorized", message: "User not found" });
    return;
  }

  res.json(user[0]);
});

export default router;
