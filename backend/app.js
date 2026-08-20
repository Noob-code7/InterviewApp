import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import path from "path";
import { fileURLToPath } from "url";
import authRoutes from "./routes/auth.js";
import sessionRoutes from "./routes/sessions.js";
import questionRoutes from "./routes/questions.js";
import answerRoutes from "./routes/answers.js";
import analysisRoutes from "./routes/analysis.js";
import adminRoutes from "./routes/admin.js";
import writingRoutes from "./routes/writing.js";
import reportRoutes from "./routes/reports.js";
import storageRoutes from "./routes/storage.js";
import ttsRoutes from "./routes/tts.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// ── Security middleware ──────────────────────────────────────────────────────
app.use(helmet());

const isDev = process.env.NODE_ENV !== "production";
app.use(
  cors({
    origin: isDev
      ? // In development, echo the request origin to support different localhost ports (5173,5174, etc.)
        (origin, callback) => callback(null, true)
      : process.env.FRONTEND_URL || "https://your-production-frontend.com",
    credentials: true,
  }),
);

// Global rate limiter — generous limits in development mode.
// Deployment-specific budgets are configurable via RATE_LIMIT_MAX /
// RATE_LIMIT_WINDOW_MS; when unset the defaults match the original behavior
// (development 2000 / production 300 per 15 minutes).
const globalLimiter = rateLimit({
  windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max: (() => {
    const configured = Number(process.env.RATE_LIMIT_MAX);
    return configured > 0 ? configured : isDev ? 2000 : 300;
  })(),
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: "Too many requests, please try again later.",
  },
});
app.use(globalLimiter);

// ── Body / cookie parsing ────────────────────────────────────────────────────
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// ── HTTP logging ─────────────────────────────────────────────────────────────
if (process.env.NODE_ENV !== "test") {
  app.use(morgan("dev"));
}

// ── Health check ─────────────────────────────────────────────────────────────
app.get("/health", (_req, res) => {
  res.json({
    success: true,
    data: { status: "OK", timestamp: new Date().toISOString() },
  });
});

// ── Static Files ─────────────────────────────────────────────────────────────
const uploadsDir = process.env.UPLOADS_DIR || path.join(__dirname, "uploads");
app.use("/uploads", express.static(uploadsDir));

// ── API root ──────────────────────────────────────────────────────────────────
app.get("/api", (_req, res) => {
  res.json({
    success: true,
    data: { message: "AI Interview Platform API v1" },
  });
});

// ── Routes ───────────────────────────────────────────────────────────────────
app.use("/api/auth", authRoutes);
app.use("/api/sessions", sessionRoutes);
app.use("/api/sessions", questionRoutes);
app.use("/api/sessions", answerRoutes);
app.use("/api/analysis", analysisRoutes);
app.use("/api/sessions", writingRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/storage", storageRoutes);
app.use("/api/tts", ttsRoutes);
// Admin routes (faculty can manage question banks)
app.use("/api/admin", adminRoutes);

// ── Route stubs — filled in per phase ─────────────────────────────────────────
// Phase 6:  app.use('/api/writing', writingRoutes)
// Phase 7:  app.use('/api/reports', reportRoutes)
// Phase 8:  app.use('/api/progress', progressRoutes)

// ── Optional frontend hosting (college LAN self-hosting) ──────────────────────
// When SERVE_FRONTEND=true the backend serves the built React app from
// frontend/dist with an SPA fallback. API (/api) and upload (/uploads) routes
// take precedence, so unknown API paths still return JSON 404s. Cloud
// deployments keep this off and host the frontend separately (nginx/Docker).
if (process.env.SERVE_FRONTEND === "true") {
  const frontendDist = path.resolve(
    process.env.FRONTEND_DIST_DIR || path.join(__dirname, "../frontend/dist"),
  );
  const indexHtml = path.join(frontendDist, "index.html");
  const fs = (await import("fs")).default;

  if (fs.existsSync(indexHtml)) {
    app.use(express.static(frontendDist));
    app.use((req, res, next) => {
      if (req.method !== "GET") return next();
      if (req.path.startsWith("/api") || req.path.startsWith("/uploads")) return next();
      res.sendFile(indexHtml, (err) => {
        if (err) next(err);
      });
    });
    console.log(`[Frontend] Serving SPA from ${frontendDist}`);
  } else {
    console.warn(`[Frontend] SERVE_FRONTEND=true but no build found at ${frontendDist}. Run 'npm run build' in frontend/ first.`);
  }
}

// ── 404 handler ───────────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ success: false, error: "Route not found" });
});

// ── Global error handler ──────────────────────────────────────────────────────
app.use((err, _req, res, _next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    success: false,
    error: err.message || "Internal Server Error",
    stack: err.stack,
  });
});

export default app;
