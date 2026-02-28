import mongoose from "mongoose";

const DailyPackedSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  date: { type: String, required: true }, // YYYY-MM-DD
  count: { type: Number, default: 0 },
});

DailyPackedSchema.index({ user: 1, date: 1 }, { unique: true });

export default mongoose.model("DailyPacked", DailyPackedSchema);
