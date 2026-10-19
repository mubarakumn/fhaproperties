import mongoose from "mongoose";

const adminAccountSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    passwordHash: {
      type: String,
      required: true,
    },
    sessionVersion: {
      type: Number,
      default: 0,
      required: true,
    },
  },
  { timestamps: true },
);

export default mongoose.models.AdminAccount ||
  mongoose.model("AdminAccount", adminAccountSchema);
