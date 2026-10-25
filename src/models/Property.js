
import mongoose from "mongoose";

const propertySchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 160,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    description: {
      type: String,
      required: true,
      maxlength: 5000,
    },
    type: {
      type: String,
      required: true,
      enum: ["House", "Land", "Commercial", "Apartment", "Other"],
    },
    listingType: {
      type: String,
      required: true,
      enum: ["Sale", "Rent"],
    },
    state: {
      type: String,
      required: true,
      trim: true,
      maxlength: 80,
    },
    city: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    address: {
      type: String,
      trim: true,
      maxlength: 250,
      default: "",
    },
    priceAmount: {
      type: Number,
      min: 0,
    },
    agentFeePercent: {
      type: Number,
      min: 0,
      max: 100,
      default: 0,
    },
    priceLabel: {
      type: String,
      trim: true,
      maxlength: 100,
      default: "",
    },
    bedrooms: {
      type: Number,
      min: 0,
      max: 100,
    },
    bathrooms: {
      type: Number,
      min: 0,
      max: 100,
    },
    area: {
      type: String,
      trim: true,
      maxlength: 100,
      default: "",
    },
    features: {
      type: [String],
      default: [],
    },
    images: {
      type: [String],
      default: [],
    },
    videoUrl: {
      type: String,
      trim: true,
      maxlength: 2048,
      default: "",
    },
    source: {
      type: String,
      enum: ["fha", "external"],
      required: true,
      default: "external",
    },
    submittedBy: {
      name: {
        type: String,
        required: true,
        trim: true,
        maxlength: 120,
      },
      phone: {
        type: String,
        required: true,
        trim: true,
        maxlength: 30,
      },
      email: {
        type: String,
        trim: true,
        lowercase: true,
        maxlength: 254,
        default: "",
      },
    },
    status: {
      type: String,
      enum: [
        "draft",
        "pending_review",
        "approved",
        "rejected",
        "published",
        "archived",
        "sold",
      ],
      default: "draft",
      required: true,
      index: true,
    },
    reviewNotes: {
      type: String,
      default: "",
      maxlength: 2000,
    },
    reviewedAt: {
      type: Date,
      default: null,
    },
    publishedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

propertySchema.index({
  status: 1,
  state: 1,
  type: 1,
  listingType: 1,
});

const cachedPropertyModel = mongoose.models.Property;
const cachedStatusValues =
  cachedPropertyModel?.schema.path("status")?.enumValues || [];

if (cachedPropertyModel && !cachedStatusValues.includes("sold")) {
  mongoose.deleteModel("Property");
}

export default mongoose.models.Property ||
  mongoose.model("Property", propertySchema);
