import express from "express";
import BoxData from "../models/box.model.js";
import ItemData from "../models/item.model.js";
import Prediction from "../models/prediction.model.js";
import Shipment from "../models/shipment.model.js";
import { authenticateToken } from "../middleware/auth.middleware.js";
import { getLastNDates, toDateKey } from "../utils/date.utils.js";

const router = express.Router();

/**
 * GET /analytics/overview
 * Returns high-level stats for the dashboard
 */
router.get("/overview", authenticateToken, async (req, res) => {
  try {
    const userId = req.user._id;

    // 1. Total Items Packed (Lifetime)
    const totalPackedResult = await Shipment.aggregate([
      { $match: { userId, isArchived: { $ne: true } } },
      { $group: { _id: null, total: { $sum: "$packedQty" } } },
    ]);
    const totalPacked = totalPackedResult[0]?.total || 0;

    // 2. Inventory Stats
    const totalItemsInStock = await ItemData.aggregate([
      { $group: { _id: null, total: { $sum: "$quantity" } } },
    ]);
    const totalBoxesInStock = await BoxData.aggregate([
      { $group: { _id: null, total: { $sum: "$quantity" } } },
    ]);

    // 3. AI Usage
    const totalpredictions = await Prediction.countDocuments({ userId });

    res.status(200).json({
      success: true,
      data: {
        totalPacked,
        itemsInStock: totalItemsInStock[0]?.total || 0,
        boxesInStock: totalBoxesInStock[0]?.total || 0,
        aiPredictions: totalpredictions,
      },
    });
  } catch (error) {
    console.error("Error fetching analytics overview:", error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
});

/**
 * GET /analytics/packing-history
 * Returns packing data for the last 7 days
 */
router.get("/packing-history", authenticateToken, async (req, res) => {
  try {
    const userId = req.user._id;
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const history = await Shipment.find({
      userId,
      isArchived: { $ne: true },
      packedAt: { $gte: sevenDaysAgo },
    }).lean();

    const historyMap = {};
    history.forEach((shipment) => {
      const dateKey = new Date(shipment.packedAt).toISOString().slice(0, 10);
      historyMap[dateKey] = (historyMap[dateKey] || 0) + (shipment.packedQty || 0);
    });

    // Fill in missing days with 0
    const reversedResult = getLastNDates(7).map((date) => {
      const dStr = toDateKey(date);
      return {
        date: dStr,
        count: historyMap[dStr] || 0,
        day: date.toLocaleDateString("en-US", { weekday: "short" }),
      };
    });

    res.status(200).json({
      success: true,
      data: reversedResult,
    });
  } catch (error) {
    console.error("Error fetching packing history:", error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
});

/**
 * GET /analytics/transactions
 * Returns shipment transactions sorted newest-first for Order History screen
 */
router.get("/transactions", authenticateToken, async (req, res) => {
  try {
    const userId = req.user._id;
    const limit = Number.parseInt(req.query.limit, 10) || 100;

    const shipments = await Shipment.find({
      userId,
      isArchived: { $ne: true },
    })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    return res.status(200).json({
      success: true,
      data: shipments,
    });
  } catch (error) {
    console.error("Error fetching shipment transactions:", error);
    return res.status(500).json({
      success: false,
      message: "Server Error",
    });
  }
});

/**
 * DELETE /analytics/transactions/:id
 * Deletes a shipment history log without touching inventory stock.
 */
router.delete("/transactions/:id", authenticateToken, async (req, res) => {
  try {
    const userId = req.user._id;
    const { id } = req.params;

    const archivedShipment = await Shipment.findOneAndUpdate({
      _id: id,
      userId,
      isArchived: { $ne: true },
    }, {
      $set: {
        isArchived: true,
        archivedAt: new Date(),
      },
    });

    if (!archivedShipment) {
      return res.status(404).json({
        success: false,
        message: "History record not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "History record removed from view",
    });
  } catch (error) {
    console.error("Error deleting shipment transaction:", error);
    return res.status(500).json({
      success: false,
      message: "Server Error",
    });
  }
});

export default router;
