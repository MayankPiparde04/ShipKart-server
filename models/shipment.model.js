import mongoose from "mongoose";

const ShipmentSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    index: true,
  },
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "ItemData",
    required: true,
    index: true,
  },
  productName: { type: String, required: true },
  packedQty: { type: Number, required: true, min: 1 },
  items_packed: { type: Number, required: true, min: 1 },
  box_type: { type: String, required: true },
  cartonsUsed: {
    type: [
      {
        cartonId: { type: String, required: true },
        cartonName: { type: String, required: true },
        itemsPacked: { type: Number, required: true, min: 1 },
        orientation: { type: String, default: null },
        dimensionsUsed: {
          length: { type: Number, default: null },
          breadth: { type: Number, default: null },
          height: { type: Number, default: null },
        },
      },
    ],
    default: [],
  },
  packedAt: { type: Date, default: Date.now, index: true },
  timestamp: { type: Date, default: Date.now, index: true },
});

ShipmentSchema.index({ userId: 1, packedAt: 1 });

export default mongoose.model("Shipment", ShipmentSchema);
