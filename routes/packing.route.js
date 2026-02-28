import express from "express";
import { body, validationResult } from "express-validator";
import Packing from "../models/packing.model.js";
import { authenticateToken } from "../middleware/auth.middleware.js";
import {
  sanitizeInput,
  validatePagination,
} from "../middleware/validation.middleware.js";

const router = express.Router();

// Enhanced validation for packing data
const validatePackingData = [
  body("productName")
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage("Product name must be between 1-100 characters"),

  body("shape")
    .optional()
    .isIn(["cube", "cuboid", "cylinder", "sphere", "irregular"])
    .withMessage("Invalid shape type"),

  body("weight")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("Weight must be a non-negative number"),

  body("quantity")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Quantity must be a positive integer"),

  body("price")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("Price must be a non-negative number"),
];

// Enhanced POST API to send packing data
router.post(
  "/sendPackagingData",
  authenticateToken,
  sanitizeInput,
  validatePackingData,
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: "Validation failed",
          errors: errors.array(),
        });
      }

      // Add user information to packing data
      const packingDataWithUser = {
        ...req.body,
        createdBy: req.user._id,
        createdAt: new Date(),
        userId: req.user._id,
      };

      const packingData = new Packing(packingDataWithUser);
      const savedPacking = await packingData.save();

      // Populate user information if needed
      const populatedPacking = await Packing.findById(savedPacking._id)
        .populate("createdBy", "name email")
        .lean();

      res.status(201).json({
        success: true,
        message: "Packing data saved successfully",
        data: populatedPacking,
      });
    } catch (error) {
      console.error("Error saving packing data:", error);

      if (error.code === 11000) {
        return res.status(409).json({
          success: false,
          message: "Duplicate packing data entry",
        });
      }

      res.status(500).json({
        success: false,
        message: "Error saving packing data",
        error:
          process.env.NODE_ENV === "development" ? error.message : undefined,
      });
    }
  },
);

// Enhanced GET API to fetch packing data with filtering and pagination
router.get(
  "/getPackagingData",
  authenticateToken,
  validatePagination,
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: "Validation failed",
          errors: errors.array(),
        });
      }

      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const skip = (page - 1) * limit;

      const {
        productName,
        shape,
        sortBy = "createdAt",
        sortOrder = "desc",
        startDate,
        endDate,
      } = req.query;

      // Build filter
      const filter = { userId: req.user._id };

      if (productName) {
        filter.productName = { $regex: productName, $options: "i" };
      }

      if (shape) {
        filter.shape = shape;
      }

      if (startDate || endDate) {
        filter.createdAt = {};
        if (startDate) filter.createdAt.$gte = new Date(startDate);
        if (endDate) filter.createdAt.$lte = new Date(endDate);
      }

      // Build sort
      const sort = {};
      sort[sortBy] = sortOrder === "desc" ? -1 : 1;

      const [packingData, total] = await Promise.all([
        Packing.find(filter)
          .sort(sort)
          .skip(skip)
          .limit(limit)
          .populate("createdBy", "name email")
          .lean(),
        Packing.countDocuments(filter),
      ]);

      res.status(200).json({
        success: true,
        message: "Packing data retrieved successfully",
        data: {
          packingData,
          pagination: {
            currentPage: page,
            totalPages: Math.ceil(total / limit),
            totalItems: total,
            itemsPerPage: limit,
            hasNextPage: page < Math.ceil(total / limit),
            hasPrevPage: page > 1,
          },
          filters: {
            productName,
            shape,
            dateRange: startDate || endDate ? { startDate, endDate } : null,
          },
        },
      });
    } catch (error) {
      console.error("Error fetching packing data:", error);
      res.status(500).json({
        success: false,
        message: "Error fetching packing data",
      });
    }
  },
);

// Get packing statistics for user
router.get("/packaging-statistics", authenticateToken, async (req, res) => {
  try {
    const userId = req.user._id;

    const stats = await Packing.aggregate([
      { $match: { userId: userId } },
      {
        $group: {
          _id: null,
          totalPackings: { $sum: 1 },
          totalItems: { $sum: "$quantity" },
          averageWeight: { $avg: "$weight" },
          totalWeight: { $sum: { $multiply: ["$weight", "$quantity"] } },
          shapes: { $addToSet: "$shape" },
          averagePrice: { $avg: "$price" },
        },
      },
    ]);

    const shapeDistribution = await Packing.aggregate([
      { $match: { userId: userId } },
      { $group: { _id: "$shape", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);

    const result = stats[0] || {
      totalPackings: 0,
      totalItems: 0,
      averageWeight: 0,
      totalWeight: 0,
      shapes: [],
      averagePrice: 0,
    };

    res.status(200).json({
      success: true,
      message: "Packing statistics retrieved successfully",
      data: {
        ...result,
        averageWeight: Math.round(result.averageWeight * 100) / 100,
        totalWeight: Math.round(result.totalWeight * 100) / 100,
        averagePrice: Math.round(result.averagePrice * 100) / 100,
        shapeDistribution,
      },
    });
  } catch (error) {
    console.error("Error fetching packing statistics:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching packing statistics",
    });
  }
});

// Delete packing data
router.delete("/deletePackaging/:id", authenticateToken, async (req, res) => {
  try {
    const packingData = await Packing.findOneAndDelete({
      _id: req.params.id,
      userId: req.user._id,
    });

    if (!packingData) {
      return res.status(404).json({
        success: false,
        message: "Packing data not found or not authorized",
      });
    }

    res.status(200).json({
      success: true,
      message: "Packing data deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting packing data:", error);
    res.status(500).json({
      success: false,
      message: "Error deleting packing data",
    });
  }
});

export default router;
