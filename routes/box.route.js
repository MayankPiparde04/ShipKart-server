import express from "express";
import { body } from "express-validator";
import { authenticateToken } from "../middleware/auth.middleware.js";
import {
  sanitizeInput,
  validatePagination,
} from "../middleware/validation.middleware.js";
import * as boxController from "../controllers/box.controller.js";

const router = express.Router();

// Enhanced validation for box data
const validateBoxData = [
  body("box_name")
    .isLength({ min: 1, max: 100 })
    .withMessage("Box name must be between 1-100 characters")
    .matches(/^[a-zA-Z0-9\s\-_]+$/)
    .withMessage(
      "Box name can only contain letters, numbers, spaces, hyphens, and underscores",
    ),

  body("length")
    .isFloat({ min: 0.1 })
    .withMessage("Length must be greater than 0.1"),

  body("breadth")
    .isFloat({ min: 0.1 })
    .withMessage("Breadth must be greater than 0.1"),

  body("height")
    .isFloat({ min: 0.1 })
    .withMessage("Height must be greater than 0.1"),

  body("quantity").isInt({ min: 1 }).withMessage("Quantity must be at least 1"),

  body("max_weight")
    .isFloat({ min: 0.1 })
    .withMessage("Max weight must be greater than 0.1"),
];

const validateUpdateQuantity = [
  body("box_name")
    .isLength({ min: 1, max: 100 })
    .withMessage("Box name is required"),

  body("additionalQuantity")
    .isInt({ min: 1 })
    .withMessage("Additional quantity must be a positive integer"),
];

// Enhanced add box route
router.post(
  "/addbox",
  authenticateToken,
  sanitizeInput,
  // validateBoxData,
  boxController.addBox,
);

// Enhanced update box quantity route
router.post(
  "/updateboxquantity",
  authenticateToken,
  sanitizeInput,
  validateUpdateQuantity,
  boxController.updateBoxQuantity,
);

// Enhanced get all boxes route
router.get(
  "/getboxes",
  authenticateToken,
  validatePagination,
  boxController.getBoxes,
);

// Get box by ID
router.get("/getbox/:id", authenticateToken, boxController.getBoxById);

// Delete box
router.delete("/deletebox/:id", authenticateToken, boxController.deleteBox);

// Update box details endpoint
router.put(
  "/updatebox",
  authenticateToken,
  sanitizeInput,
  boxController.updateBox,
);

// Validation middleware for box removal
const validateRemoveBox = [
  body("boxName")
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage("Box name must be between 1-100 characters"),

  body("quantity")
    .isInt({ min: 1 })
    .withMessage("Quantity must be a positive integer"),
];

// Enhanced box removal route
router.post(
  "/removebox",
  authenticateToken,
  sanitizeInput,
  validateRemoveBox,
  boxController.removeBoxQuantity,
);

/**
 * Remove boxes and items together.
 */
router.post(
  "/removeboxitem",
  authenticateToken,
  sanitizeInput,
  boxController.removeBoxItem,
);

// Get box statistics
router.get(
  "/box-statistics",
  authenticateToken,
  boxController.getBoxStatistics,
);

export default router;
