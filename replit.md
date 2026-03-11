# AutoFlow — Social Media Automation Hub

## Overview

AutoFlow is a full-stack social media automation platform for managing, scheduling, and publishing videos across TikTok, YouTube, and Instagram. It features AI-powered video analysis via Claude, a smart scheduling engine with optimal posting time recommendations, and a comprehensive dashboard.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **Frontend**: React + Vite + Tailwind CSS
- **AI**: Anthropic Claude via Replit AI Integrations (claude-sonnet-4-6)
- **Auth**: JWT (stored in httpOnly cookies) + bcryptjs for password hashing

## Features

1. **Auth** — Register/login with JWT httpOnly cookie sessions
2. **Platform Connections** — Connect TikTok, YouTube, Instagram (simulated OAuth)
3. **Video Library** — Upload video metadata, drag-and-drop UI
4. **AI Analysis** — Claude analyzes videos for category, tone, virality score (1-10), and generates platform-specific captions/hashtags
5. **Smart Scheduler** — Algorithm suggests optimal posting times per platform with confidence scores
6. **Publish Pipeline** — Schedule posts, publish immediately, track status (pending/published/failed)
7. **Analytics** — Overview dashboard, per-post analytics with engagement metrics
8. **Settings** — Account management, timezone config, notification preferences

## Structure

```text
artifacts-monorepo/
├── artifacts/
│   ├── api-server/         # Express API server (backend)
│   └── autoflow/           # React + Vite frontend (AutoFlow app)
├── lib/
│   ├── api-spec/           # OpenAPI spec + Orval codegen config
│   ├── api-client-react/   # Generated React Query hooks
│   ├── api-zod/            # Generated Zod schemas from OpenAPI
│   ├── db/                 # Drizzle ORM schema + DB connection
│   └── integrations-anthropic-ai/  # Anthropic AI client
└── scripts/                # Utility scripts
```

## Database Schema

- `users` — email, password_hash, timezone
- `platform_connections` — per-platform OAuth tokens, status, follower count
- `videos` — file metadata, AI analysis results, virality score
- `scheduled_posts` — platform, schedule time, status, captions/hashtags
- `publish_logs` — per-attempt publish history with API responses

## API Routes

- `POST /api/auth/register` — Create account
- `POST /api/auth/login` — Login
- `GET /api/auth/me` — Get current user
- `GET /api/platforms` — List platform connections
- `POST /api/platforms/:platform/connect` — Connect a platform
- `POST /api/platforms/:platform/disconnect` — Disconnect a platform
- `GET /api/videos` — List videos
- `POST /api/videos` — Create video
- `POST /api/videos/:id/analyze` — AI analyze video
- `GET /api/scheduled-posts` — List scheduled posts
- `POST /api/scheduled-posts` — Schedule a post
- `PATCH /api/scheduled-posts/:id` — Update scheduled post
- `POST /api/scheduled-posts/:id/publish` — Publish immediately
- `POST /api/scheduler/optimal-times` — Get optimal posting times
- `GET /api/analytics/overview` — Overview stats
- `GET /api/analytics/posts` — Per-post analytics
- `GET /api/publish-logs` — Publish history

## Demo Account

- Email: `demo@autoflow.com`
- Password: `demo1234`

## TypeScript & Composite Projects

Every package extends `tsconfig.base.json` which sets `composite: true`. The root `tsconfig.json` lists all packages as project references.

## Root Scripts

- `pnpm run build` — runs `typecheck` first, then recursively runs `build` in all packages that define it
- `pnpm run typecheck` — runs `tsc --build --emitDeclarationOnly` using project references

## Packages

### `artifacts/api-server` (`@workspace/api-server`)

Express 5 API server. Routes live in `src/routes/`, middleware in `src/middleware/`.

- Depends on: `@workspace/db`, `@workspace/api-zod`, `@workspace/integrations-anthropic-ai`

### `artifacts/autoflow` (`@workspace/autoflow`)

React + Vite frontend. Pages in `src/pages/`, components in `src/components/`.

- Auth context in `src/lib/auth.tsx`
- API hooks from `@workspace/api-client-react`
