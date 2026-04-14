import mongoose from "mongoose";

const ShipmentSchema = new mongoose.Schema(
  {
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
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    packed_details: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    packedAt: { type: Date, default: Date.now, index: true },
    timestamp: { type: Date, default: Date.now, index: true },
    isArchived: { type: Boolean, default: false, index: true },
    archivedAt: { type: Date, default: null },
  },
  {
    timestamps: true,
  },
);

ShipmentSchema.index({ userId: 1, packedAt: 1 });

export default mongoose.model("Shipment", ShipmentSchema);
