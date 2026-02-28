import express from "express";
import morgan from "morgan";
import helmet from "helmet";
import compression from "compression";
import rateLimit from "express-rate-limit";
import connectDB from "./config/db.js";
import bodyParser from "body-parser";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import os from "os";

// Load environment variables
dotenv.config({ path: "./config/config.env" });

const app = express();

// Set trust proxy for correct client IP detection (important for Vercel/Proxies)
app.set("trust proxy", 1);

// Connect to the database
connectDB();

// Security middleware
app.use(helmet()); // Set various HTTP headers for security
app.use(compression()); // Compress responses

// Block access to .git and other sensitive paths
app.use((req, res, next) => {
  const blockedPaths = [
    "/.git",
    "/.env",
    "/config",
    "/.gitignore",
    "/package.json",
    "/node_modules",
  ];

  if (blockedPaths.some((path) => req.url.startsWith(path))) {
    return res.status(404).json({
      success: false,
      message: "Not found",
    });
  }
  next();
});

// Rate limiting with different limits for different endpoints
const strictLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // Limit AI endpoints to 20 requests per windowMs
  message: {
    success: false,
    message: "Too many AI requests from this IP, please try again later.",
  },
});

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: {
    success: false,
    message: "Too many requests from this IP, please try again later.",
  },
});

// Apply strict rate limiting to AI endpoints
app.use("/api/ai", strictLimiter);
app.use(limiter);

// Body parsing middleware with size limits
app.use(bodyParser.json({ limit: "10mb" }));
app.use(bodyParser.urlencoded({ extended: true, limit: "10mb" }));

// CORS configuration
const corsOptions = {
  origin: "*", // Allow all origins for Expo dev environment flexibly
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true,
};
app.use(cors(corsOptions));

// Logging middleware
if (process.env.NODE_ENV === "development") {
  app.use(morgan("dev"));
} else {
  app.use(morgan("combined"));
}

// Health check endpoint
app.get("/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Server is running",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
  });
});

// Route Imports
import authRouter from "./routes/auth.route.js";
import userRouter from "./routes/user.route.js";
import itemRouter from "./routes/item.route.js";
import boxRouter from "./routes/box.route.js";
import optimalPackingRouter from "./routes/optimalpacking.route.js";
import packingRoutes from "./routes/packing.route.js";
import shippingRoutes from "./routes/shipping.route.js";
import geminiRoutes from "./routes/gemini.route.js";
import analyticsRouter from "./routes/analytics.route.js";

// Mount Routes with error handling
const routes = [
  { path: "/api", router: authRouter },
  { path: "/api", router: userRouter },
  { path: "/api", router: itemRouter },
  { path: "/api", router: boxRouter },
  { path: "/api", router: optimalPackingRouter },
  { path: "/api", router: packingRoutes },
  { path: "/api", router: shippingRoutes },
  { path: "/api/ai", router: geminiRoutes },
  { path: "/api/analytics", router: analyticsRouter },
];

routes.forEach(({ path, router }) => {
  app.use(path, router);
});

// Add error handler for invalid JSON
app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && "body" in err) {
    // Handle invalid JSON
    return res.status(400).json({
      success: false,
      message: "Invalid JSON in request body",
    });
  }
  next(err);
});

// Enhanced global error handling middleware
app.use((err, req, res, next) => {
  // Log error details for debugging
  console.error("Unhandled error:", {
    message: err.message,
    stack: process.env.NODE_ENV === "development" ? err.stack : undefined,
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.get("User-Agent"),
    timestamp: new Date().toISOString(),
  });

  // Handle specific error types
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
    ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
  });
});

// Handle 404 Errors
app.use("*", (req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.originalUrl} not found`,
    availableRoutes: [
      "GET /health",
      "POST /api/optimal-packing2",
      "POST /api/calculate-shipping",
      "POST /api/ai/predict-dimensions",
      "GET /api/carton-sizes",
    ],
  });
});

// Graceful shutdown and global error handling
process.on("unhandledRejection", (err) => {
  console.error("Unhandled Promise Rejection:", err);
  // Keep server running for unhandled rejections instead of crashing
});

process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception thrown:", err);
  // Keep server running for now, though standard practice is to restart
});

process.on("SIGTERM", () => {
  console.log("SIGTERM received. Shutting down gracefully...");
  process.exit(0);
});

process.on("SIGINT", () => {
  console.log("SIGINT received. Shutting down gracefully...");
  process.exit(0);
});

// Start the Server only if directly executed (esMain check simulation)
const __filename = fileURLToPath(import.meta.url);
const isMainModule = process.argv[1] === __filename;

if (isMainModule) {
  const PORT = process.env.PORT || 3001;
  // Get local network IPv4 addresses
  function getLocalIPs() {
    const interfaces = os.networkInterfaces();
    const ips = [];
    for (const name of Object.keys(interfaces)) {
      for (const iface of interfaces[name]) {
        if (iface.family === "IPv4" && !iface.internal) {
          ips.push(iface.address);
        }
      }
    }
    return ips;
  }

  const server = app.listen(PORT, "0.0.0.0", () => {
    const ips = getLocalIPs();
    console.log(
      `🚀 Server running in ${process.env.NODE_ENV} mode on port ${PORT}`,
    );
    if (ips.length) {
      ips.forEach((ip) =>
        console.log(
          `📊 Health check available at: http://${ip}:${PORT}/health`,
        ),
      );
    } else {
      console.log(
        `📊 Health check available at: http://localhost:${PORT}/health`,
      );
    }
  });

  // Handle server errors
  server.on("error", (error) => {
    if (error.code === "EADDRINUSE") {
      console.error(`Port ${PORT} is already in use`);
      process.exit(1);
    } else {
      console.error("Server error:", error);
    }
  });
}

// Export default app
export default app;
