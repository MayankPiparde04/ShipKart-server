import mongoose from "mongoose";

const BoxSchema = new mongoose.Schema({
  box_name: { type: String, required: true, unique: true }, // Box Name (Ensuring uniqueness)
  length: { type: Number, required: true }, // in inches
  breadth: { type: Number, required: true }, // in inches
  height: { type: Number, required: true }, // in inches
  max_weight: { type: Number, required: true }, // in kg
  quantity: { type: Number, required: true }, // Quantity of boxes
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  createdAt: { type: Date, default: Date.now },
  lastUpdated: { type: Date },
  lastUpdatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
});

export default mongoose.model("BoxData", BoxSchema);
