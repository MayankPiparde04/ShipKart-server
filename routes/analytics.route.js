import express from "express";
import BoxData from "../models/box.model.js";
import ItemData from "../models/item.model.js";
import Prediction from "../models/prediction.model.js";
import Shipment from "../models/shipment.model.js";
import { authenticateToken } from "../middleware/auth.middleware.js";

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
      { $match: { userId } },
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
      packedAt: { $gte: sevenDaysAgo },
    }).lean();

    const historyMap = {};
    history.forEach((shipment) => {
      const dateKey = new Date(shipment.packedAt).toISOString().slice(0, 10);
      historyMap[dateKey] = (historyMap[dateKey] || 0) + (shipment.packedQty || 0);
    });

    // Fill in missing days with 0
    const result = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dStr = d.toISOString().slice(0, 10);

      result.push({
        date: dStr,
        count: historyMap[dStr] || 0,
        day: d.toLocaleDateString("en-US", { weekday: "short" }),
      });
    }

    const reversedResult = result.toReversed();

    res.status(200).json({
      success: true,
      data: reversedResult,
    });
  } catch (error) {
    console.error("Error fetching packing history:", error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
});

export default router;
