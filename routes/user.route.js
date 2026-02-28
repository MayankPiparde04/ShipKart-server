import express from "express";
// Import controllers
import {
  readController,
  updateController,
  getProfileController,
  deleteController,
} from "../controllers/user.controller.js";

// Import middleware
import {
  authenticateToken,
  Admin as requireAdmin,
  requireOwnershipOrAdmin,
} from "../middleware/auth.middleware.js";
import {
  validateProfileUpdate,
  validateObjectId,
  sanitizeInput,
} from "../middleware/validation.middleware.js";

const router = express.Router();

// User Routes
router.get("/user/profile", authenticateToken, getProfileController);
router.get(
  "/user/:id",
  authenticateToken,
  validateObjectId("id"),
  requireOwnershipOrAdmin,
  readController,
);
router.put(
  "/user/update",
  authenticateToken,
  sanitizeInput,
  validateProfileUpdate,
  updateController,
);
router.delete("/user/delete", authenticateToken, deleteController);

// Admin Routes
router.put(
  "/admin/user/:id",
  authenticateToken,
  requireAdmin,
  validateObjectId("id"),
  sanitizeInput,
  validateProfileUpdate,
  updateController,
);

export default router;
