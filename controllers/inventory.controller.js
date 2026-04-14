import mongoose from "mongoose";
import { validationResult } from "express-validator";
import ItemData from "../models/item.model.js";
import BoxData from "../models/box.model.js";
import Shipment from "../models/shipment.model.js";
import DailyPacked from "../models/dailypacked.model.js";

const toDateKey = (date) => date.toISOString().slice(0, 10);

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

    const { productId, packedQty, cartonsUsed } = req.body;
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

    await session.withTransaction(async () => {
      const item = await ItemData.findOne({
        _id: productId,
        createdBy: req.user._id,
        deletedAt: null,
      }).session(session);

      if (!item) {
        throw new Error("Item not found in inventory");
      }

      if (item.quantity < quantityToPack) {
        throw new Error(
          `Insufficient quantity. Available: ${item.quantity}, Requested: ${quantityToPack}`,
        );
      }

      item.quantity -= quantityToPack;
      item.lastUpdated = new Date();
      item.lastUpdatedBy = req.user._id;
      await item.save({ session });

      // Decrement box inventory counts by the number of cartons used per box type
      const cartonCountByBox = sanitizedCartons.reduce((acc, carton) => {
        const key = carton.cartonId;
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      }, {});

      const cartonBoxIds = Object.keys(cartonCountByBox).filter((id) =>
        mongoose.Types.ObjectId.isValid(id),
      );

      for (const boxId of cartonBoxIds) {
        const cartonsToDeduct = cartonCountByBox[boxId];
        const box = await BoxData.findOne({
          _id: boxId,
          createdBy: req.user._id,
        }).session(session);

        if (!box) {
          throw new Error(`Box not found for cartonId: ${boxId}`);
        }

        if (box.quantity < cartonsToDeduct) {
          throw new Error(
            `Insufficient box inventory for '${box.box_name}'. Available: ${box.quantity}, Required: ${cartonsToDeduct}`,
          );
        }

        box.quantity -= cartonsToDeduct;
        box.lastUpdated = new Date();
        box.lastUpdatedBy = req.user._id;
        await box.save({ session });
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
            productId: item._id,
            productName: item.productName,
            packedQty: quantityToPack,
            items_packed: quantityToPack,
            box_type: shipmentBoxType,
            cartonsUsed: sanitizedCartons,
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
    });

    return res.status(200).json({
      success: true,
      message: `${quantityToPack} Items packed and inventory updated.`,
    });
  } catch (error) {
    console.error("Error packing inventory:", error);

    return res.status(400).json({
      success: false,
      message: error.message || "Failed to pack inventory",
    });
  } finally {
    session.endSession();
  }
};
