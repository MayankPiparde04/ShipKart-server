import mongoose from "mongoose";

const ItemDataSchema = new mongoose.Schema({
  productName: { type: String, required: true, unique: true },
  category: { type: String, default: null },
  quantity: { type: Number, default: 0 },
  brand: { type: String, default: null },
  price: { type: Number, default: null },
  weight: { type: Number, default: null },
  weight_per_unit: { type: Number, default: null },
  max_vertical_stack: { type: Number, default: 1 },
  crush_resistance_kg: { type: Number, default: null },
  leakage_risk: {
    type: String,
    enum: ["High", "Medium", "Low"],
    default: "Low",
  },
  shape: { type: String, default: null },
  dimensions: {
    side: { type: Number, default: null },
    length: { type: Number, default: null },
    breadth: { type: Number, default: null },
    height: { type: Number, default: null },
    radius: { type: Number, default: null },
  },
  productDetails: { type: String, default: null },
  unitOfMeasurement: { type: String, default: null },
  unitOfWeight: { type: String, default: null },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  createdAt: { type: Date, default: Date.now },
  lastUpdated: { type: Date },
  lastUpdatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  deletedAt: { type: Date, default: null },
});

export default mongoose.model("ItemData", ItemDataSchema);
