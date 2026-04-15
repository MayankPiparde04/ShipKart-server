import mongoose from "mongoose";
import { validationResult } from "express-validator";
import ItemData from "../models/item.model.js";
import BoxData from "../models/box.model.js";
import Shipment from "../models/shipment.model.js";
import DailyPacked from "../models/dailypacked.model.js";
import { toDateKey } from "../utils/date.utils.js";

export const packInventory = async (req, res) => {
  const session = await mongoose.startSession();

  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: errors.array(),
      });
    }

    const { productId, packedQty, cartonsUsed, packingMetadata } = req.body;
    const quantityToPack = Number.parseInt(packedQty, 10);

    if (!productId || !mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({
        success: false,
        message: "Valid productId is required",
      });
    }

    if (!Number.isInteger(quantityToPack) || quantityToPack <= 0) {
      return res.status(400).json({
        success: false,
        message: "packedQty must be a positive integer",
      });
    }

    const sanitizedCartons = Array.isArray(cartonsUsed)
      ? cartonsUsed
          .map((carton) => ({
            cartonId: String(carton?.cartonId || carton?.id || ""),
            cartonName: String(carton?.cartonName || carton?.name || "Carton"),
            itemsPacked: Math.max(
              1,
              Number.parseInt(carton?.itemsPacked || carton?.quantity || 1, 10),
            ),
            orientation: carton?.orientation || null,
            dimensionsUsed: carton?.dimensionsUsed
              ? {
                  length: Number(carton.dimensionsUsed.length) || null,
                  breadth: Number(carton.dimensionsUsed.breadth) || null,
                  height: Number(carton.dimensionsUsed.height) || null,
                }
              : null,
          }))
          .filter((carton) => carton.cartonId)
      : [];

    const sanitizedPackingMetadata =
      packingMetadata && typeof packingMetadata === "object" && !Array.isArray(packingMetadata)
        ? packingMetadata
        : null;

    const cartonCountByBox = Array.isArray(sanitizedCartons)
      ? sanitizedCartons.reduce((acc, carton) => {
          const key = carton.cartonId;
          acc[key] = (acc[key] || 0) + 1;
          return acc;
        }, {})
      : {};

    await session.withTransaction(async () => {
      const updatedItem = await ItemData.findOneAndUpdate(
        {
          _id: productId,
          createdBy: req.user._id,
          deletedAt: null,
          quantity: { $gte: quantityToPack },
        },
        {
          $inc: { quantity: -quantityToPack },
          $set: {
            lastUpdated: new Date(),
            lastUpdatedBy: req.user._id,
          },
        },
        { new: true, session },
      );

      if (!updatedItem) {
        throw new Error("Item not found in inventory");
      }

      // Decrement box inventory counts by the number of cartons used per box type
      const cartonBoxIds = Object.keys(cartonCountByBox).filter((id) =>
        mongoose.Types.ObjectId.isValid(id),
      );

      for (const boxId of cartonBoxIds) {
        const cartonsToDeduct = cartonCountByBox[boxId];
        const updatedBox = await BoxData.findOneAndUpdate(
          {
            _id: boxId,
            createdBy: req.user._id,
            quantity: { $gte: cartonsToDeduct },
          },
          {
            $inc: { quantity: -cartonsToDeduct },
            $set: {
              lastUpdated: new Date(),
              lastUpdatedBy: req.user._id,
            },
          },
          { new: true, session },
        );

        if (!updatedBox) {
          throw new Error(`Box not found for cartonId: ${boxId}`);
        }
      }

      const uniqueBoxTypes = [
        ...new Set(sanitizedCartons.map((carton) => carton.cartonName).filter(Boolean)),
      ];
      let shipmentBoxType = "Unknown";
      if (uniqueBoxTypes.length === 1) {
        shipmentBoxType = uniqueBoxTypes[0];
      } else if (uniqueBoxTypes.length > 1) {
        shipmentBoxType = "Mixed";
      }

      await Shipment.create(
        [
          {
            userId: req.user._id,
            productId: updatedItem._id,
            productName: updatedItem.productName,
            packedQty: quantityToPack,
            items_packed: quantityToPack,
            box_type: shipmentBoxType,
            cartonsUsed: sanitizedCartons,
            metadata: sanitizedPackingMetadata,
            packed_details: {
              packingResults: sanitizedPackingMetadata?.packingResults || sanitizedCartons,
            },
            packedAt: new Date(),
            timestamp: new Date(),
          },
        ],
        { session },
      );

      const todayStr = toDateKey(new Date());
      await DailyPacked.findOneAndUpdate(
        { user: req.user._id, date: todayStr },
        { $inc: { count: quantityToPack } },
        { upsert: true, new: true, session },
      );
    }, {
      readConcern: { level: "snapshot" },
      writeConcern: { w: "majority" },
      readPreference: "primary",
    });

    return res.status(200).json({
      success: true,
      message: `${quantityToPack} Items packed and inventory updated.`,
    });
  } catch (error) {
    console.error("Error packing inventory:", error);

    const statusCode = /not found|insufficient|invalid|required|failed/i.test(error.message)
      ? 400
      : 500;

    return res.status(statusCode).json({
      success: false,
      message: error.message || "Failed to pack inventory",
    });
  } finally {
    session.endSession();
  }
};
