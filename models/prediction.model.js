import mongoose from "mongoose";

const PredictionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    imageUrl: {
      type: String, // Path to stored image (if we decide to keep them)
      required: false,
    },
    productName: {
      type: String,
      required: true,
    },
    brand: {
      type: String,
      default: "Unknown",
    },
    price: {
      type: Number,
      default: 0,
    },
    category: {
      type: String,
      default: "Uncategorized",
    },
    dimensions: {
      length: Number,
      breadth: Number,
      height: Number,
      unit: {
        type: String,
        default: "cm",
      },
    },
    weight: {
      value: Number,
      unit: {
        type: String,
        default: "gram",
      },
      confidence: String,
    },
    confidenceLevel: {
      type: String,
      enum: ["low", "medium", "high"],
      default: "medium",
    },
    notes: String,
    userFeedback: {
      isAccurate: Boolean,
      correctedDimensions: {
        length: Number,
        breadth: Number,
        height: Number,
        unit: String,
      },
    },
    processingInfo: {
      processingTime: Number, // ms
      modelUsed: String,
    },
  },
  {
    timestamps: true,
  },
);

export default mongoose.model("Prediction", PredictionSchema);
