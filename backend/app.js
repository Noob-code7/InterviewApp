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

// Global rate limiter — tighter limits on auth routes added in Phase 2
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 200,
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
const uploadsDir = process.env.UPLOADS_DIR || path.join(__dirname, 'uploads')
app.use('/uploads', express.static(uploadsDir))

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
// Admin routes (faculty can manage question banks)
app.use("/api/admin", adminRoutes);

// ── Route stubs — filled in per phase ─────────────────────────────────────────
// Phase 6:  app.use('/api/writing', writingRoutes)
// Phase 7:  app.use('/api/reports', reportRoutes)
// Phase 8:  app.use('/api/progress', progressRoutes)

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
