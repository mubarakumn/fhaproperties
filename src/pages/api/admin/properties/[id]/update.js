import mongoose from "mongoose";
import { connectDB } from "../../../../../lib/db.js";
import {
  getAdminFromCookies,
  isSameOriginRequest,
} from "../../../../../lib/adminAuth.js";
import {
  uploadPropertyImage,
  deletePropertyImage,
} from "../../../../../lib/cloudinary.js";
import {
  collectPropertyImageUrls,
  MAX_PROPERTY_IMAGES,
  readPropertyImage,
} from "../../../../../lib/propertyImages.js";
import Property from "../../../../../models/Property.js";

export const prerender = false;

const allowedPropertyTypes = new Set([
  "House",
  "Land",
  "Commercial",
  "Apartment",
  "Other",
]);

const allowedListingTypes = new Set(["Sale", "Rent"]);

const allowedStatuses = new Set([
  "draft",
  "pending_review",
  "approved",
  "rejected",
  "published",
  "archived",
  "sold",
]);

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

function clean(value, maxLength = 500) {
  return String(value ?? "")
    .trim()
    .slice(0, maxLength);
}

function parseOptionalNumber(value, label, max = 1_000_000_000) {
  const raw = clean(value, 30);
  if (!raw) return undefined;
  const number = Number(raw);
  if (!Number.isFinite(number) || number < 0 || number > max) {
    throw new Error(`${label} must be a valid non-negative number.`);
  }
  return number;
}

export async function POST({ request, cookies, params }) {
  const adminUsername = await getAdminFromCookies(cookies);
  if (!adminUsername) {
    return json({ message: "Admin authentication required." }, 401);
  }

  if (!isSameOriginRequest(request)) {
    return json({ message: "Invalid request origin." }, 403);
  }

  const id = params.id;
  if (!mongoose.isValidObjectId(id)) {
    return json({ message: "Invalid property reference." }, 400);
  }

  let form;
  try {
    form = await request.formData();
  } catch {
    return json({ message: "Invalid form submission." }, 400);
  }

  const title = clean(form.get("title"), 160);
  const description = clean(form.get("description"), 5000);
  const type = clean(form.get("type"), 40);
  const listingType = clean(form.get("listingType"), 20);
  const state = clean(form.get("state"), 80);
  const city = clean(form.get("city"), 100);
  const address = clean(form.get("address"), 250);
  const status = clean(form.get("status"), 30);

  if (!title || !description || !type || !listingType || !state || !city) {
    return json(
      {
        message:
          "Please fill in the title, description, property type, listing purpose, state, and city.",
      },
      400,
    );
  }

  if (!allowedPropertyTypes.has(type)) {
    return json({ message: "Invalid property type." }, 400);
  }

  if (!allowedListingTypes.has(listingType)) {
    return json({ message: "Invalid listing purpose." }, 400);
  }

  if (status && !allowedStatuses.has(status)) {
    return json({ message: "Invalid property status." }, 400);
  }

  // Parse retained existing images
  let existingImages;
  let imageUrls;

  try {
    existingImages = collectPropertyImageUrls(form.getAll("existingImages"), {
      allowHttp: true,
    });
    imageUrls = collectPropertyImageUrls(form.getAll("imageUrls"));
  } catch (error) {
    return json({ message: error.message }, 400);
  }

  // Parse new file uploads
  const rawImages = form.getAll("images");
  const imageFiles = rawImages.filter(
    (item) => item instanceof File && item.size > 0,
  );

  // Parse new URLs
  const totalImages =
    existingImages.length + imageFiles.length + imageUrls.length;
  if (totalImages > MAX_PROPERTY_IMAGES) {
    return json(
      {
        message: `You can have a maximum of ${MAX_PROPERTY_IMAGES} images in total.`,
      },
      400,
    );
  }

  // Features parsing
  const rawFeatures = clean(form.get("features"), 1000);
  const features = rawFeatures
    ? rawFeatures
        .split(",")
        .map((f) => clean(f, 80))
        .filter(Boolean)
    : [];

  const uploadedImages = [];

  try {
    const priceAmount = parseOptionalNumber(form.get("priceAmount"), "Price");
    const bedrooms = parseOptionalNumber(form.get("bedrooms"), "Bedrooms", 100);
    const bathrooms = parseOptionalNumber(
      form.get("bathrooms"),
      "Bathrooms",
      100,
    );

    const priceLabel = clean(form.get("priceLabel"), 100);
    const area = clean(form.get("area"), 100);

    await connectDB();

    const existingProperty = await Property.findById(id);
    if (!existingProperty) {
      return json({ message: "Property not found." }, 404);
    }

    // Upload any new files to Cloudinary
    for (const file of imageFiles) {
      const buffer = await readPropertyImage(file);
      const uploaded = await uploadPropertyImage(buffer, file.type);
      uploadedImages.push(uploaded);
    }

    const finalImages = [
      ...new Set([
        ...existingImages,
        ...uploadedImages.map((img) => img.url),
        ...imageUrls,
      ]),
    ];

    existingProperty.title = title;
    existingProperty.description = description;
    existingProperty.type = type;
    existingProperty.listingType = listingType;
    existingProperty.state = state;
    existingProperty.city = city;
    existingProperty.address = address;
    existingProperty.priceAmount = priceAmount;
    existingProperty.priceLabel = priceLabel;
    existingProperty.bedrooms = bedrooms;
    existingProperty.bathrooms = bathrooms;
    existingProperty.area = area;
    existingProperty.features = features;
    existingProperty.images = finalImages;

    if (status) {
      const previousStatus = existingProperty.status;
      existingProperty.status = status;
      if (status === "published" && previousStatus !== "published") {
        existingProperty.publishedAt = new Date();
      }
    }

    await existingProperty.save();

    return json({
      success: true,
      message: "Property updated successfully!",
      property: {
        id: existingProperty._id.toString(),
        title: existingProperty.title,
        slug: existingProperty.slug,
        status: existingProperty.status,
      },
    });
  } catch (error) {
    await Promise.allSettled(
      uploadedImages.map((image) => deletePropertyImage(image.publicId)),
    );

    console.error("Property update failed:", error);

    const validationError =
      error instanceof Error &&
      (error.message.startsWith("Price ") ||
        error.message.startsWith("Bedrooms ") ||
        error.message.startsWith("Bathrooms ") ||
        error.message.startsWith("Images ") ||
        error.message.startsWith("Each image ") ||
        error.message.startsWith("The uploaded file "));

    return json(
      {
        message: validationError
          ? error.message
          : "Could not update property. Please check the values provided.",
      },
      validationError ? 400 : 500,
    );
  }
}
