import mongoose from "mongoose";

const adminSessionSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      index: true,
    },
    sessionVersion: {
      type: Number,
      required: true,
    },
    tokenHash: {
      type: String,
      required: true,
      unique: true,
    },
    expiresAt: {
      type: Date,
      required: true,
      expires: 0,
    },
  },
  { timestamps: true },
);

export default mongoose.models.AdminSession ||
  mongoose.model("AdminSession", adminSessionSchema);
