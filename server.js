import express from "express";
import morgan from "morgan";
import helmet from "helmet";
import compression from "compression";
import rateLimit from "express-rate-limit";
import connectDB from "./config/db.js";
import cors from "cors";
import dotenv from "dotenv";
import crypto from "node:crypto";
import { initializeDailyStockReportCron } from "./services/dailyStockReport.service.js";

dotenv.config({ path: "./config/config.env" });

const app = express();
const PORT = process.env.PORT || 8080;
let server;

app.set("trust proxy", 1);

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
  max: 1000,
  message: {
    success: false,
    message: "Too many AI requests from this IP, please try again later.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
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

const envOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",").map((origin) => origin.trim()).filter(Boolean)
  : [];

const defaultAllowedOrigins = [
  "https://shipwise-client.onrender.com",
  "http://localhost:3000",
  "http://localhost:19006",
  "http://localhost:8081",
];

const allowedOrigins = new Set([...defaultAllowedOrigins, ...envOrigins]);

initializeDailyStockReportCron();
app.use(
  cors({
    origin: (origin, callback) => {
      // Mobile applications (React Native/Expo) typically don't send an Origin header.
      // We allow requests with no origin to permit mobile app traffic.
      if (!origin) return callback(null, true);

      // If it's a web browser (Origin exists), it must be in the whitelist or localhost.
      if (
        allowedOrigins.has(origin) ||
        origin.startsWith("http://localhost") ||
        origin.startsWith("http://192.168.")
      ) {
        return callback(null, true);
      }

      callback(new Error("Blocked by CORS policy"));
    },
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
    allowedHeaders: ["Content-Type", "Authorization", "Cookie"],
    credentials: true,
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
  res.status(200).json({
    status: "ok",
    uptime: process.uptime(),
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
  { path: "/api/auth", router: authRouter },
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

app.use("/{*path}", (req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.originalUrl} not found`,
  });
});

process.on("unhandledRejection", (err) => {
  console.error("Unhandled Promise Rejection:", err?.message || err);
  // Keep process alive; route/global middleware handles expected runtime errors.
});

process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception:", err?.message || err);
  if (server) {
    server.close(() => process.exit(1));
  } else {
    process.exit(1);
  }
});

process.on("SIGTERM", () => {
  if (server) {
    server.close(() => process.exit(0));
  } else {
    process.exit(0);
  }
});

const startServer = async () => {
  const connection = await connectDB();
  if (!connection) {
    console.error("Startup aborted: invalid or missing MongoDB URI.");
    process.exit(1);
    return;
  }

  server = app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
  });

  server.on("error", (error) => {
    if (error.code === "EADDRINUSE") {
      console.error(`Port ${PORT} is already in use`);
      process.exit(1);
    }
    console.error("Server error:", error.message);
    process.exit(1);
  });
};

try {
  await startServer();
} catch (error) {
  console.error("Startup failed:", error?.message || error);
  process.exit(1);
}

export default app;
