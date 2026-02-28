import express from "express";
import * as packingController from "../controllers/packing.controller.js";

const router = express.Router();

// Enhanced endpoint for multiple products packing
router.post("/enhanced-packing", packingController.enhancedPacking);

// Original endpoint wrapping the new logic for backward compatibility
router.post("/optimal-packing2", packingController.enhancedPacking);

export default router;
