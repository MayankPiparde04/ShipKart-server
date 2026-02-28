import mongoose from "mongoose";

const DailyAddedSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  date: { type: String, required: true }, // YYYY-MM-DD
  count: { type: Number, default: 0 },
});

DailyAddedSchema.index({ user: 1, date: 1 }, { unique: true });

export default mongoose.model("DailyAdded", DailyAddedSchema);
