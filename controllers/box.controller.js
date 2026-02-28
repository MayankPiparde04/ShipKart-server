import BoxData from "../models/box.model.js";
import ItemData from "../models/item.model.js";
import DailyPacked from "../models/dailypacked.model.js";
import { validationResult } from "express-validator";

// Add a new box
export const addBox = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: errors.array(),
      });
    }

    const { box_name, length, breadth, height, quantity, max_weight } =
      req.body;

    // Check if box already exists
    const existingBox = await BoxData.findOne({
      box_name: box_name,
    });

    if (existingBox) {
      return res.status(409).json({
        success: false,
        message:
          "Box with this name already exists. Use update quantity instead.",
      });
    }

    // Calculate volume for reference
    const volume = length * breadth * height;

    // Create new box entry
    const newBox = new BoxData({
      box_name: box_name,
      length: parseFloat(length),
      breadth: parseFloat(breadth),
      height: parseFloat(height),
      quantity: parseInt(quantity),
      max_weight: parseFloat(max_weight),
      createdBy: req.user._id,
      createdAt: new Date(),
      lastUpdated: new Date(),
      lastUpdatedBy: req.user._id,
    });

    await newBox.save();

    res.status(201).json({
      success: true,
      message: "Box added successfully!",
      data: {
        ...newBox.toObject(),
        volume: Math.round(volume * 100) / 100,
      },
    });
  } catch (error) {
    console.error("Error adding box:", error);

    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "Box with this name already exists",
      });
    }

    res.status(500).json({
      success: false,
      message: "Failed to add box",
    });
  }
};

// Update box quantity
export const updateBoxQuantity = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: errors.array(),
      });
    }

    const { box_name, additionalQuantity } = req.body;
    const quantityToAdd = parseInt(additionalQuantity, 10);

    if (isNaN(quantityToAdd)) {
      return res.status(400).json({
        success: false,
        message: "Valid additionalQuantity is required",
      });
    }

    // Find the box by name
    const box = await BoxData.findOne({
      box_name: box_name,
    });

    if (!box) {
      return res.status(404).json({
        success: false,
        message: "Box not found",
      });
    }

    const previousQuantity = box.quantity;
    box.quantity += quantityToAdd;
    box.lastUpdated = new Date();
    box.lastUpdatedBy = req.user._id;

    await box.save();

    res.status(200).json({
      success: true,
      message: "Box quantity updated successfully!",
      data: {
        box_name: box.box_name,
        previousQuantity,
        quantityAdded: quantityToAdd,
        newQuantity: box.quantity,
      },
    });
  } catch (error) {
    console.error("Error updating box quantity:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update box quantity",
    });
  }
};

// Get all boxes with filtering and pagination
export const getBoxes = async (req, res) => {
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
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const {
      search,
      sortBy = "box_name",
      sortOrder = "asc",
      minWeight,
      maxWeight,
      minVolume,
      maxVolume,
    } = req.query;

    // Build filter
    const filter = {};
    filter.createdBy = req.user._id; // Only fetch boxes created by this user

    if (search) {
      filter.box_name = { $regex: search, $options: "i" };
    }

    if (minWeight || maxWeight) {
      filter.max_weight = {};
      if (minWeight) filter.max_weight.$gte = parseFloat(minWeight);
      if (maxWeight) filter.max_weight.$lte = parseFloat(maxWeight);
    }

    // Build sort
    const sort = {};
    sort[sortBy] = sortOrder === "desc" ? -1 : 1;

    let query = BoxData.find(filter).sort(sort).skip(skip).limit(limit);

    const [boxes, total] = await Promise.all([
      query.lean(),
      BoxData.countDocuments(filter),
    ]);

    // Calculate volume for each box and apply volume filter if needed
    let processedBoxes = boxes.map((box) => ({
      ...box,
      volume: Math.round(box.length * box.breadth * box.height * 100) / 100,
      capacity_efficiency:
        Math.round(
          (box.max_weight / (box.length * box.breadth * box.height)) * 100,
        ) / 100,
    }));

    // Apply volume filter if specified
    if (minVolume || maxVolume) {
      processedBoxes = processedBoxes.filter((box) => {
        if (minVolume && box.volume < parseFloat(minVolume)) return false;
        if (maxVolume && box.volume > parseFloat(maxVolume)) return false;
        return true;
      });
    }

    res.status(200).json({
      success: true,
      message: "Boxes retrieved successfully",
      data: {
        boxes: processedBoxes,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(total / limit),
          totalBoxes: total,
          boxesPerPage: limit,
          hasNextPage: page < Math.ceil(total / limit),
          hasPrevPage: page > 1,
        },
        filters: {
          search,
          weightRange: minWeight || maxWeight ? { minWeight, maxWeight } : null,
          volumeRange: minVolume || maxVolume ? { minVolume, maxVolume } : null,
        },
      },
    });
  } catch (error) {
    console.error("Error fetching boxes:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch boxes",
    });
  }
};

// Get box by ID
export const getBoxById = async (req, res) => {
  try {
    const box = await BoxData.findById(req.params.id).lean();

    if (!box) {
      return res.status(404).json({
        success: false,
        message: "Box not found",
      });
    }

    const boxWithDetails = {
      ...box,
      volume: Math.round(box.length * box.breadth * box.height * 100) / 100,
      capacity_efficiency:
        Math.round(
          (box.max_weight / (box.length * box.breadth * box.height)) * 100,
        ) / 100,
    };

    res.status(200).json({
      success: true,
      data: boxWithDetails,
    });
  } catch (error) {
    console.error("Error fetching box:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching box",
    });
  }
};

// Delete box
export const deleteBox = async (req, res) => {
  try {
    const box = await BoxData.findByIdAndDelete(req.params.id);

    if (!box) {
      return res.status(404).json({
        success: false,
        message: "Box not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Box deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting box:", error);
    res.status(500).json({
      success: false,
      message: "Error deleting box",
    });
  }
};

// Update box details
export const updateBox = async (req, res) => {
  try {
    const { id, box_name, length, breadth, height, quantity, max_weight } =
      req.body;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Box id is required",
      });
    }

    // Build update object with only provided fields
    const update = {};
    if (box_name !== undefined) update.box_name = box_name;
    if (length !== undefined) update.length = length;
    if (breadth !== undefined) update.breadth = breadth;
    if (height !== undefined) update.height = height;
    if (quantity !== undefined) update.quantity = quantity;
    if (max_weight !== undefined) update.max_weight = max_weight;
    update.lastUpdated = new Date();
    update.lastUpdatedBy = req.user._id;

    const box = await BoxData.findByIdAndUpdate(
      id,
      { $set: update },
      { new: true },
    );

    if (!box) {
      return res.status(404).json({
        success: false,
        message: "Box not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Box updated successfully",
      data: box,
    });
  } catch (error) {
    console.error("Error updating box:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update box",
    });
  }
};

export const removeBoxQuantity = async (req, res) => {
  try {
    const { boxName, quantity } = req.body;
    const quantityToRemove = parseInt(quantity, 10);

    if (isNaN(quantityToRemove) || quantityToRemove <= 0) {
      return res.status(400).json({
        success: false,
        message: "Valid positive quantity is required",
      });
    }

    // Find the box
    const box = await BoxData.findOne({ box_name: boxName });

    if (!box) {
      return res.status(404).json({
        success: false,
        message: "Box not found",
      });
    }

    // Check availability
    if (box.quantity < quantityToRemove) {
      return res.status(400).json({
        success: false,
        message: `Insufficient quantity. Available: ${box.quantity}, Requested: ${quantityToRemove}`,
      });
    }

    // Update quantity
    const previousQuantity = box.quantity;
    box.quantity -= quantityToRemove;
    box.lastUpdatedBy = req.user._id;
    box.lastUpdated = new Date();

    // If quantity becomes zero, delete the box
    if (box.quantity === 0) {
      await BoxData.findByIdAndDelete(box._id);

      return res.status(200).json({
        success: true,
        message: "Box removed completely",
        data: {
          boxName: box.box_name,
          previousQuantity,
          quantityRemoved: quantityToRemove,
          finalQuantity: 0,
          boxDeleted: true,
        },
      });
    }

    await box.save();

    // Record daily packed statistics
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    await DailyPacked.findOneAndUpdate(
      { date: today },
      { $inc: { count: quantityToRemove } },
      { upsert: true, new: true },
    );

    res.status(200).json({
      success: true,
      message: "Box quantity updated successfully",
      data: {
        boxName: box.box_name,
        previousQuantity,
        quantityRemoved: quantityToRemove,
        remainingQuantity: box.quantity,
        boxDeleted: false,
      },
    });
  } catch (error) {
    console.error("Error removing box:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error while removing box",
    });
  }
};

export const removeBoxItem = async (req, res) => {
  try {
    const { boxName, productName, boxQuantity, itemQuantity } = req.body;
    const boxesToRemove = parseInt(boxQuantity, 10);
    const itemsToRemove = parseInt(itemQuantity, 10);

    if (
      isNaN(boxesToRemove) ||
      isNaN(itemsToRemove) ||
      boxesToRemove < 0 ||
      itemsToRemove < 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Valid positive boxQuantity and itemQuantity are required",
      });
    }

    // 1. Box Operation
    const box = await BoxData.findOne({ box_name: boxName });
    if (!box) {
      return res.status(404).json({
        success: false,
        message: `Box '${boxName}' not found`,
      });
    }

    if (box.quantity < boxesToRemove) {
      return res.status(400).json({
        success: false,
        message: `Insufficient box quantity. Available: ${box.quantity}`,
      });
    }

    // 2. Item Operation
    const item = await ItemData.findOne({ productName: productName });
    if (!item) {
      return res.status(404).json({
        success: false,
        message: `Item '${productName}' not found`,
      });
    }

    if (item.quantity < itemsToRemove) {
      return res.status(400).json({
        success: false,
        message: `Insufficient item quantity. Available: ${item.quantity}`,
      });
    }

    // Perform updates
    box.quantity -= boxesToRemove;
    item.quantity -= itemsToRemove;

    // Handle zero quantities
    let boxDeleted = false;
    let itemDeleted = false;

    if (box.quantity === 0) {
      await BoxData.findByIdAndDelete(box._id);
      boxDeleted = true;
    } else {
      await box.save();
    }

    if (item.quantity === 0) {
      await ItemData.findByIdAndDelete(item._id);
      itemDeleted = true;
    } else {
      await item.save();
    }

    // Record statistics
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    await DailyPacked.findOneAndUpdate(
      { date: today },
      { $inc: { count: boxesToRemove } },
      { upsert: true, new: true },
    );

    res.status(200).json({
      success: true,
      message: "Box and Item quantities updated successfully",
      data: {
        box: {
          name: boxName,
          removed: boxesToRemove,
          remaining: boxDeleted ? 0 : box.quantity,
          deleted: boxDeleted,
        },
        item: {
          name: productName,
          removed: itemsToRemove,
          remaining: itemDeleted ? 0 : item.quantity,
          deleted: itemDeleted,
        },
      },
    });
  } catch (error) {
    console.error("Error in combined removal:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error during combined removal",
    });
  }
};

export const getBoxStatistics = async (req, res) => {
  try {
    const totalBoxes = await BoxData.countDocuments();
    const totalItems = await ItemData.countDocuments();

    // Calculate total volume capacity of all boxes
    const boxes = await BoxData.find();
    let totalVolumeCapacity = 0;
    boxes.forEach((box) => {
      totalVolumeCapacity +=
        box.length * box.breadth * box.height * box.quantity;
    });

    // Get daily packed stats for the last 7 days
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const dailyStats = await DailyPacked.find({
      date: { $gte: sevenDaysAgo },
    }).sort({ date: 1 });

    res.status(200).json({
      success: true,
      data: {
        totalBoxes,
        totalItems,
        totalVolumeCapacity,
        dailyStats,
      },
    });
  } catch (error) {
    console.error("Error fetching statistics:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching statistics",
    });
  }
};
