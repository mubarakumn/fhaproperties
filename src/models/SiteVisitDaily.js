import mongoose from "mongoose";

const siteVisitDailySchema = new mongoose.Schema(
  {
    date: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    pageViews: {
      type: Number,
      default: 0,
      min: 0,
    },
    pages: {
      type: mongoose.Schema.Types.Mixed,
      default: () => ({}),
    },
    pagePaths: {
      type: mongoose.Schema.Types.Mixed,
      default: () => ({}),
    },
    emailClaimedAt: {
      type: Date,
      default: null,
    },
    emailSentAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true },
);

export default mongoose.models.SiteVisitDaily ||
  mongoose.model("SiteVisitDaily", siteVisitDailySchema);
