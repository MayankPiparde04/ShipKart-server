import express from "express";
import { validationResult, body } from "express-validator";

// Import helpers and constants
import {
  calculateDimensions,
  convertToKg,
  calculateOptimalPacking,
  validateCartons,
  INVENTORY,
} from "../utils/shippingUtils.js";

import {
  optionalAuth,
} from "../middleware/auth.middleware.js";
import { sanitizeInput } from "../middleware/validation.middleware.js";

const router = express.Router();

// Validation middleware for shipping calculation
const validateShippingInput = [
  body("shape")
    .notEmpty()
    .withMessage("Shape is required")
    .isIn(["cube", "cuboid", "rectangular", "box", "cylinder", "sphere"])
    .withMessage("Invalid shape type"),

  body("dimensions")
    .custom(
      (val) => typeof val === "object" && val !== null && !Array.isArray(val),
    )
    .withMessage("Dimensions must be an object"),

  body("unit")
    .notEmpty()
    .withMessage("Unit is required")
    .isIn([
      "cm",
      "in",
      "ft",
      "m",
      "inch",
      "inches",
      "centimeter",
      "centimeters",
    ])
    .withMessage("Invalid dimension unit"),

  body("weight")
    .isFloat({ min: 0.01 })
    .withMessage("Weight must be a positive number"),

  body("weightUnit")
    .notEmpty()
    .withMessage("Weight unit is required")
    .isIn([
      "g",
      "kg",
      "lb",
      "lbs",
      "oz",
      "gram",
      "grams",
      "kilogram",
      "kilograms",
    ])
    .withMessage("Invalid weight unit"),

  body("quantity")
    .isInt({ min: 1 })
    .withMessage("Quantity must be a positive integer"),
];

// Enhanced shipping calculation endpoint
router.post(
  "/calculate-shipping",
  optionalAuth,
  sanitizeInput,
  validateShippingInput,
  async (req, res) => {
    try {
      // Check validation results
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: "Validation failed",
          errors: errors.array(),
        });
      }

      const {
        shape,
        dimensions,
        unit,
        weight,
        weightUnit,
        quantity,
        customCartons,
      } = req.body;

      // Calculate product dimensions based on shape
      const productDims = calculateDimensions(shape, dimensions, unit);

      // Convert weight to kilograms
      const weightInKg = convertToKg(weight, weightUnit);

      // Validate weight constraints
      if (weightInKg > 1000) {
        return res.status(400).json({
          success: false,
          message: "Product weight exceeds maximum limit of 1000 kg",
        });
      }

      // Validate custom cartons if provided
      if (customCartons) {
        validateCartons(customCartons);
      }

      // Perform optimal packing calculation
      const packingResult = calculateOptimalPacking(
        productDims,
        weightInKg,
        quantity,
        customCartons,
      );

      // Enhanced response with additional metadata
      const response = {
        success: packingResult.success,
        message: packingResult.success
          ? "Packing calculation completed successfully"
          : "Partial packing completed - some items couldn't be packed",
        data: {
          input: {
            product: {
              shape,
              originalDimensions: dimensions,
              unit,
              calculatedDimensions: {
                length: Math.round(productDims.length * 100) / 100,
                breadth: Math.round(productDims.breadth * 100) / 100,
                height: Math.round(productDims.height * 100) / 100,
                volume: Math.round(productDims.volume * 100) / 100,
              },
              weight: {
                original: weight,
                unit: weightUnit,
                converted: Math.round(weightInKg * 100) / 100,
                convertedUnit: "kg",
              },
              quantity,
            },
          },
          results: packingResult,
        },
        timestamp: new Date().toISOString(),
      };

      return res.status(packingResult.success ? 200 : 206).json(response);
    } catch (error) {
      console.error("Error calculating shipping:", error);

      // Return appropriate error based on error type
      if (
        error.message.includes("Unsupported") ||
        error.message.includes("requires")
      ) {
        return res.status(400).json({
          success: false,
          message: error.message,
        });
      }

      return res.status(500).json({
        success: false,
        message: "Internal server error during shipping calculation",
        error:
          process.env.NODE_ENV === "development" ? error.message : undefined,
      });
    }
  },
);

// Get available carton sizes endpoint
router.get("/carton-sizes", (req, res) => {
  try {
    res.status(200).json({
      success: true,
      message: "Available carton sizes retrieved successfully",
      data: {
        cartons: INVENTORY.cartons.map((carton) => ({
          id: carton.id,
          dimensions: {
            length: carton.length,
            breadth: carton.breadth,
            height: carton.height,
            volume: carton.length * carton.breadth * carton.height,
          },
          weightLimit: carton.weightLimit,
          availableQuantity: carton.availableQuantity,
          cost: carton.cost,
        })),
        units: {
          dimension: "inches",
          weight: "kg",
          cost: "USD",
        },
      },
    });
  } catch (error) {
    console.error("Error fetching carton sizes:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching carton sizes",
    });
  }
});

export default router;
