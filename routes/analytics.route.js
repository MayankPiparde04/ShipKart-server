import express from "express";
import DailyPacked from "../models/dailypacked.model.js";
import BoxData from "../models/box.model.js";
import ItemData from "../models/item.model.js";
import Prediction from "../models/prediction.model.js";
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
    const totalPackedResult = await DailyPacked.aggregate([
      { $match: { user: userId } },
      { $group: { _id: null, total: { $sum: "$count" } } },
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
    const dateStr = sevenDaysAgo.toISOString().slice(0, 10);

    const history = await DailyPacked.find({
      user: userId,
      date: { $gte: dateStr },
    }).sort({ date: 1 });

    // Fill in missing days with 0
    const result = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dStr = d.toISOString().slice(0, 10);

      const found = history.find((h) => h.date === dStr);
      result.push({
        date: dStr,
        count: found ? found.count : 0,
        day: d.toLocaleDateString("en-US", { weekday: "short" }),
      });
    }

    res.status(200).json({
      success: true,
      data: result.reverse(),
    });
  } catch (error) {
    console.error("Error fetching packing history:", error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
});

export default router;
