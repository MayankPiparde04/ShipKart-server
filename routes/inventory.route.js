import express from "express";
import { body } from "express-validator";
import { authenticateToken } from "../middleware/auth.middleware.js";
import { sanitizeInput } from "../middleware/validation.middleware.js";
import { packInventory } from "../controllers/inventory.controller.js";

const router = express.Router();

router.post(
  "/pack",
  authenticateToken,
  sanitizeInput,
  [
    body("productId")
      .isMongoId()
      .withMessage("productId is required"),
    body("packedQty")
      .isInt({ min: 1 })
      .withMessage("packedQty must be a positive integer"),
    body("cartonsUsed").optional().isArray(),
  ],
  packInventory,
);

export default router;
