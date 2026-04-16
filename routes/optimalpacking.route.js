import express from "express";
import * as packingController from "../controllers/packing.controller.js";

const router = express.Router();

// Enhanced endpoint for multiple products packing
router.post("/enhanced-packing", packingController.enhancedPacking);

// Primary analysis endpoint
router.post("/optimal-analysis", packingController.enhancedPacking);

export default router;
