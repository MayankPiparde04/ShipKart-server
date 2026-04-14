import express from "express";
import morgan from "morgan";
import helmet from "helmet";
import compression from "compression";
import rateLimit from "express-rate-limit";
import connectDB, { getDBStatus } from "./config/db.js";
import cors from "cors";
import dotenv from "dotenv";
import crypto from "crypto";

dotenv.config({ path: "./config/config.env" });

const app = express();

app.set("trust proxy", 1);

connectDB();

app.use(helmet());
app.use(compression());

app.use((req, res, next) => {
  req.requestId = crypto.randomUUID();
  res.setHeader("X-Request-Id", req.requestId);
  next();
});

app.use((req, res, next) => {
  const blockedPaths = [
    "/.git",
    "/.env",
    "/config",
    "/.gitignore",
    "/package.json",
    "/node_modules",
  ];
  if (blockedPaths.some((p) => req.url.startsWith(p))) {
    return res.status(404).json({ success: false, message: "Not found" });
  }
  next();
});

const strictLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: {
    success: false,
    message: "Too many AI requests from this IP, please try again later.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: {
    success: false,
    message: "Too many requests from this IP, please try again later.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use("/api/ai", strictLimiter);
app.use(limiter);

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",")
  : [];

app.use(
  cors({
    origin: (origin, callback) => {
      // Mobile applications (React Native/Expo) typically don't send an Origin header.
      // We allow requests with no origin to permit mobile app traffic.
      if (!origin) return callback(null, true);

      // If it's a web browser (Origin exists), it must be in the whitelist or localhost.
      if (
        allowedOrigins.length === 0 ||
        allowedOrigins.includes(origin) ||
        origin.startsWith("http://localhost") ||
        origin.startsWith("http://192.168.")
      ) {
        return callback(null, true);
      }

      callback(new Error("Blocked by CORS policy"));
    },
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);

if (process.env.NODE_ENV === "development") {
  app.use(morgan("dev"));
} else {
  app.use(
    morgan(":method :url :status :response-time ms - :req[x-request-id]"),
  );
}

app.get("/health", (req, res) => {
  const dbStatus = getDBStatus();
  const memUsage = process.memoryUsage();

  const isHealthy = dbStatus.state === "connected";

  res.status(isHealthy ? 200 : 503).json({
    success: isHealthy,
    status: isHealthy ? "healthy" : "degraded",
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
    environment: process.env.NODE_ENV || "production",
    database: {
      state: dbStatus.state,
      host: dbStatus.host,
      name: dbStatus.name,
    },
    memory: {
      rss: `${Math.round(memUsage.rss / 1024 / 1024)}MB`,
      heapUsed: `${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`,
      heapTotal: `${Math.round(memUsage.heapTotal / 1024 / 1024)}MB`,
    },
    version: process.env.npm_package_version || "1.0.0",
  });
});

import authRouter from "./routes/auth.route.js";
import userRouter from "./routes/user.route.js";
import itemRouter from "./routes/item.route.js";
import boxRouter from "./routes/box.route.js";
import optimalPackingRouter from "./routes/optimalpacking.route.js";
import packingRoutes from "./routes/packing.route.js";
import shippingRoutes from "./routes/shipping.route.js";
import geminiRoutes from "./routes/gemini.route.js";
import analyticsRouter from "./routes/analytics.route.js";
import inventoryRouter from "./routes/inventory.route.js";

const routes = [
  { path: "/api", router: authRouter },
  { path: "/api", router: userRouter },
  { path: "/api", router: itemRouter },
  { path: "/api", router: boxRouter },
  { path: "/api", router: optimalPackingRouter },
  { path: "/api", router: packingRoutes },
  { path: "/api", router: shippingRoutes },
  { path: "/api/inventory", router: inventoryRouter },
  { path: "/api/ai", router: geminiRoutes },
  { path: "/api/analytics", router: analyticsRouter },
];

routes.forEach(({ path, router }) => {
  app.use(path, router);
});

app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && "body" in err) {
    return res.status(400).json({
      success: false,
      message: "Invalid JSON in request body",
    });
  }
  next(err);
});

app.use((err, req, res, next) => {
  console.error(`[${req.requestId}] Unhandled error:`, {
    message: err.message,
    stack: process.env.NODE_ENV === "development" ? err.stack : undefined,
    url: req.url,
    method: req.method,
  });

  if (err.name === "ValidationError") {
    return res.status(400).json({
      success: false,
      message: "Validation error",
      details: process.env.NODE_ENV === "development" ? err.message : undefined,
    });
  }

  if (err.name === "CastError") {
    return res.status(400).json({
      success: false,
      message: "Invalid ID format",
    });
  }

  if (err.code === 11000) {
    return res.status(409).json({
      success: false,
      message: "Duplicate entry",
    });
  }

  res.status(err.status || 500).json({
    success: false,
    message:
      process.env.NODE_ENV === "development"
        ? err.message
        : "Internal server error",
  });
});

app.use("*", (req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.originalUrl} not found`,
  });
});

process.on("unhandledRejection", (err) => {
  console.error("Unhandled Promise Rejection:", err.message || err);
});

process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception:", err.message || err);
});

process.on("SIGTERM", () => {
  console.log("SIGTERM received. Shutting down gracefully...");
  if (server) {
    server.close(() => process.exit(0));
  } else {
    process.exit(0);
  }
});

const PORT = process.env.PORT || 3001;
const server = app.listen(PORT, () => {
  console.log(
    `🚀 Server running in ${process.env.NODE_ENV || "production"} mode on port ${PORT}`,
  );
  console.log(`📊 Health Check API active on port ${PORT}`);
});

server.on("error", (error) => {
  if (error.code === "EADDRINUSE") {
    console.error(`Port ${PORT} is already in use`);
    process.exit(1);
  }
  console.error("Server error:", error.message);
});

export default app;
