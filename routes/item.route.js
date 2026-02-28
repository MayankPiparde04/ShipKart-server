import express from "express";
import { body } from "express-validator";
import { authenticateToken } from "../middleware/auth.middleware.js";
import {
  sanitizeInput,
  validatePagination,
} from "../middleware/validation.middleware.js";
import * as itemController from "../controllers/item.controller.js";

const router = express.Router();

// Validation for item data
const validateItemData = [
  body("productName")
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage("Product name must be between 1-100 characters"),

  body("quantity")
    .optional()
    .isInt({ min: 0 })
    .withMessage("Quantity must be a non-negative integer"),

  body("weight")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("Weight must be a non-negative number"),

  body("price")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("Price must be a non-negative number"),

  body("dimensions.length")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("Length must be a non-negative number"),

  body("dimensions.breadth")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("Breadth must be a non-negative number"),

  body("dimensions.height")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("Height must be a non-negative number"),
];

// Add or Update Item
router.post(
  "/senditemdata",
  authenticateToken,
  sanitizeInput,
  validateItemData,
  itemController.createOrUpdateItem,
);

// Fetch All Items with pagination and filtering
router.get(
  "/getitemdata",
  authenticateToken,
  validatePagination,
  itemController.getItems,
);

// Get item by ID
router.get("/getitem/:id", authenticateToken, itemController.getItemById);

// Soft-delete item
router.delete("/deleteitem/:id", authenticateToken, itemController.deleteItem);

// Daily transaction
router.get(
  "/daily-transaction",
  authenticateToken,
  itemController.getDailyTransaction,
);

// Validation middleware for item removal
const validateRemoveItem = [
  body("productName")
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage("Product name must be between 1-100 characters"),

  body("quantity")
    .isInt({ min: 1 })
    .withMessage("Quantity must be a positive integer"),
];

// Enhanced item removal route
router.post(
  "/removeitem",
  authenticateToken,
  sanitizeInput,
  validateRemoveItem,
  itemController.removeItemQuantity,
);

// Get items with low stock
router.get("/low-stock", authenticateToken, itemController.getLowStockItems);

export default router;
