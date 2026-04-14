import ItemData from "../models/item.model.js";
import DailyAdded from "../models/dailyadded.model.js";
import { validationResult } from "express-validator";
import Shipment from "../models/shipment.model.js";
import mongoose from "mongoose";
import { getDayName, getLastNDates, toDateKey } from "../utils/date.utils.js";

// Helper function to get daily transaction data
async function getDailyTransactionData(userId) {
  try {
    const userObjectId =
      typeof userId === "string" ? new mongoose.Types.ObjectId(userId) : userId;

    const dateWindow = getLastNDates(7);
    const daysArr = dateWindow.map((date) => toDateKey(date));

    // Fetch daily added counts for the user for the last 7 days
    const dailyAddedDocs = await DailyAdded.find({
      user: userObjectId,
      date: { $in: daysArr },
    }).lean();

    // Map date to count
    const dataMap = {};
    dailyAddedDocs.forEach((doc) => {
      dataMap[doc.date] = doc.count;
    });

    // Build result for each of the last 7 days
    const result = dateWindow.map((date) => {
      const dateStr = toDateKey(date);
      return {
        date: dateStr,
        day: getDayName(date),
        quantity: dataMap[dateStr] || 0,
      };
    });

    return {
      success: true,
      data: result,
    };
  } catch (error) {
    console.error("Error fetching daily quantity:", error);
    return {
      success: false,
      error: error.message,
    };
  }
}

export const createOrUpdateItem = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: errors.array(),
      });
    }

    const {
      productName,
      quantity,
      weight,
      weight_per_unit,
      max_vertical_stack,
      crush_resistance_kg,
      leakage_risk,
      price,
      brand,
      dimensions,
      category,
      shape,
      productDetails,
      unitOfMeasurement,
      unitOfWeight,
    } = req.body;

    // Find the item by productName
    let item = await ItemData.findOne({ productName: productName.trim() });

    if (item) {
      // Calculate difference in quantity if quantity is being updated
      const previousQuantity = Number(item.quantity);
      if (quantity !== undefined) {
        item.quantity = quantity;
      }
      // Update only provided fields
      if (weight !== undefined) item.weight = weight;
      if (weight_per_unit !== undefined) item.weight_per_unit = weight_per_unit;
      if (max_vertical_stack !== undefined) {
        item.max_vertical_stack = max_vertical_stack;
      }
      if (crush_resistance_kg !== undefined) {
        item.crush_resistance_kg = crush_resistance_kg;
      }
      if (leakage_risk !== undefined) item.leakage_risk = leakage_risk;
      if (price !== undefined) item.price = price;
      if (brand !== undefined) item.brand = brand;
      if (category !== undefined) item.category = category;
      if (shape !== undefined) item.shape = shape;
      if (productDetails !== undefined) item.productDetails = productDetails;
      if (unitOfMeasurement !== undefined)
        item.unitOfMeasurement = unitOfMeasurement;
      if (unitOfWeight !== undefined) item.unitOfWeight = unitOfWeight;
      if (dimensions && typeof dimensions === "object") {
        item.dimensions = { ...item.dimensions, ...dimensions };
      }

      item.lastUpdatedBy = req.user._id;
      item.lastUpdated = new Date();

      await item.save();

      // Increment daily added count by abs difference if quantity was updated and only if increased
      if (quantity !== undefined && Number(quantity) > previousQuantity) {
        const quantityDiff = Number(quantity) - previousQuantity;
        if (quantityDiff > 0) {
          const todayStr = toDateKey();
          const dailyDoc = await DailyAdded.findOne({
            user: req.user._id,
            date: todayStr,
          });
          if (dailyDoc) {
            await DailyAdded.updateOne(
              { user: req.user._id, date: todayStr },
              { $inc: { count: quantityDiff } },
            );
          } else {
            await DailyAdded.create({
              user: req.user._id, // Fixed: use req.user._id
              date: todayStr,
              count: quantityDiff,
            });
          }
        }
      }

      return res.status(200).json({
        success: true,
        message: "Item updated successfully!",
        data: item,
      });
    } else {
      // Create a new item
      const newItem = new ItemData({
        productName: productName.trim(),
        quantity: quantity !== undefined ? quantity : 0,
        weight,
        weight_per_unit,
        max_vertical_stack,
        crush_resistance_kg,
        leakage_risk,
        price,
        brand,
        dimensions,
        category,
        shape,
        productDetails,
        unitOfMeasurement,
        unitOfWeight,
        createdBy: req.user._id,
        lastUpdatedBy: req.user._id,
        createdAt: new Date(),
        lastUpdated: new Date(),
      });

      await newItem.save();

      // Increment daily added count
      const todayStr = toDateKey();
      const addCount = quantity !== undefined ? Math.abs(Number(quantity)) : 0;
      const dailyDoc = await DailyAdded.findOne({
        user: req.user._id,
        date: todayStr,
      });
      if (dailyDoc) {
        await DailyAdded.updateOne(
          { user: req.user._id, date: todayStr },
          { $inc: { count: addCount } },
        );
      } else {
        await DailyAdded.create({
          user: req.user._id,
          date: todayStr,
          count: addCount,
        });
      }

      return res.status(201).json({
        success: true,
        message: "Item added successfully!",
        data: newItem,
      });
    }
  } catch (error) {
    console.error("Error in createOrUpdateItem:", error);

    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "Item with this name already exists",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to save or update item",
    });
  }
};

export const getItems = async (req, res) => {
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
      category,
      search,
      sortBy = "productName",
      sortOrder = "asc",
      includeDeleted,
    } = req.query;

    // Build filter
    const filter = { createdBy: req.user._id };
    if (category) filter.category = category;
    if (search) {
      filter.$or = [
        { productName: { $regex: search, $options: "i" } },
        { brand: { $regex: search, $options: "i" } },
        { productDetails: { $regex: search, $options: "i" } },
      ];
    }
    // Only exclude deleted items if not explicitly requested
    if (!includeDeleted || includeDeleted === "false") {
      filter.deletedAt = null;
    }

    // Build sort
    const sort = {};
    sort[sortBy] = sortOrder === "desc" ? -1 : 1;

    const [items, total] = await Promise.all([
      ItemData.find(filter).sort(sort).skip(skip).limit(limit).lean(),
      ItemData.countDocuments(filter),
    ]);

    const dailyData = await getDailyTransactionData(req.user._id);

    // Fetch daily sold (packed) data for last 7 days from shipment logs
    const dateWindow = getLastNDates(7);
    const startDate = dateWindow[0];
    const shipments = await Shipment.find({
      userId: req.user._id,
      isArchived: { $ne: true },
      packedAt: { $gte: startDate },
    }).lean();
    const soldMap = {};
    shipments.forEach((doc) => {
      const dateKey = toDateKey(doc.packedAt);
      soldMap[dateKey] = (soldMap[dateKey] || 0) + (doc.packedQty || 0);
    });
    const dailySold = dateWindow.map((date) => {
      const dateStr = toDateKey(date);
      return {
        date: dateStr,
        day: getDayName(date),
        quantity: soldMap[dateStr] || 0,
      };
    });

    return res.status(200).json({
      success: true,
      message: "Items retrieved successfully",
      data: {
        items,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(total / limit),
          totalItems: total,
          itemsPerPage: limit,
          hasNextPage: page < Math.ceil(total / limit),
          hasPrevPage: page > 1,
        },
        dailyData: dailyData.data,
        dailySold,
      },
    });
  } catch (error) {
    console.error("Error fetching items:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch items",
    });
  }
};

export const getItemById = async (req, res) => {
  try {
    const item = await ItemData.findById(req.params.id);

    if (!item) {
      return res.status(404).json({
        success: false,
        message: "Item not found",
      });
    }

    res.status(200).json({
      success: true,
      data: item,
    });
  } catch (error) {
    console.error("Error fetching item:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch item",
    });
  }
};

export const deleteItem = async (req, res) => {
  try {
    const item = await ItemData.findByIdAndUpdate(
      req.params.id,
      {
        deletedAt: new Date(),
        lastUpdated: new Date(),
        lastUpdatedBy: req.user._id,
      },
      { new: true },
    );
    if (!item) {
      return res.status(404).json({
        success: false,
        message: "Item not found",
      });
    }
    res.status(200).json({
      success: true,
      message: "Item deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting item:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete item",
    });
  }
};

export const getDailyTransaction = async (req, res) => {
  const userId = req.query.userId || req.user._id;
  const result = await getDailyTransactionData(userId);

  if (result.success) {
    res.status(200).json({
      success: true,
      message: "Daily quantity created for last 7 days retrieved successfully",
      data: result.data,
    });
  } else {
    res.status(500).json({
      success: false,
      message: "Failed to fetch last 7 days daily quantity",
      error: result.error,
    });
  }
};

export const removeItemQuantity = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: errors.array(),
      });
    }

    const { productName, quantity } = req.body;
    const quantityToRemove = parseInt(quantity, 10);

    if (isNaN(quantityToRemove) || quantityToRemove <= 0) {
      return res.status(400).json({
        success: false,
        message: "Valid positive quantity is required",
      });
    }

    // Find the item
    const item = await ItemData.findOne({
      productName: productName.trim(),
    });

    if (!item) {
      return res.status(404).json({
        success: false,
        message: "Item not found in inventory",
      });
    }

    // Check if sufficient quantity is available
    if (item.quantity < quantityToRemove) {
      return res.status(400).json({
        success: false,
        message: `Insufficient quantity. Available: ${item.quantity}, Requested: ${quantityToRemove}`,
      });
    }

    // Update item quantity
    const previousQuantity = item.quantity;
    item.quantity -= quantityToRemove;
    item.lastUpdatedBy = req.user._id;
    item.lastUpdated = new Date();

    // If quantity becomes zero, optionally delete the item
    if (item.quantity === 0) {
      await ItemData.findByIdAndDelete(item._id);

      return res.status(200).json({
        success: true,
        message: "Item removed completely from inventory",
        data: {
          productName: item.productName,
          previousQuantity,
          quantityRemoved: quantityToRemove,
          finalQuantity: 0,
          itemDeleted: true,
        },
      });
    }

    // Save updated item
    await item.save();

    res.status(200).json({
      success: true,
      message: "Item quantity updated successfully",
      data: {
        productName: item.productName,
        previousQuantity,
        quantityRemoved: quantityToRemove,
        remainingQuantity: item.quantity,
        itemDeleted: false,
      },
    });
  } catch (error) {
    console.error("Error removing item:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error while removing item",
    });
  }
};

export const getLowStockItems = async (req, res) => {
  try {
    const { threshold = 10 } = req.query;
    const stockThreshold = parseInt(threshold, 10);

    const lowStockItems = await ItemData.find({
      quantity: { $lte: stockThreshold, $gt: 0 },
    })
      .select("productName quantity")
      .sort({ quantity: 1 });

    res.status(200).json({
      success: true,
      message: "Low stock items retrieved successfully",
      data: {
        items: lowStockItems,
        threshold: stockThreshold,
        count: lowStockItems.length,
      },
    });
  } catch (error) {
    console.error("Error fetching low stock items:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching low stock items",
    });
  }
};
