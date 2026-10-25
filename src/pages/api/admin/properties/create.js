import { randomBytes } from "node:crypto";
import { connectDB } from "../../../../lib/db.js";
import {
  getAdminFromCookies,
  isSameOriginRequest,
} from "../../../../lib/adminAuth.js";
import {
  uploadPropertyImage,
  deletePropertyImage,
} from "../../../../lib/cloudinary.js";
import {
  collectPropertyImageUrls,
  MAX_PROPERTY_IMAGES,
  readPropertyImage,
  normalizePropertyVideoUrl,
} from "../../../../lib/propertyImages.js";
import Property from "../../../../models/Property.js";

export const prerender = false;

const allowedPropertyTypes = new Set([
  "House",
  "Land",
  "Commercial",
  "Apartment",
  "Other",
]);

const allowedListingTypes = new Set(["Sale", "Rent"]);

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

function makeSlug(title) {
  const base = title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 70);

  return `${base || "fha-property"}-${randomBytes(4).toString("hex")}`;
}

export async function POST({ request, cookies }) {
  const adminUsername = await getAdminFromCookies(cookies);
  if (!adminUsername) {
    return json({ message: "Admin authentication required." }, 401);
  }

  if (!isSameOriginRequest(request)) {
    return json({ message: "Invalid request origin." }, 403);
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
  const targetStatus = clean(form.get("status"), 20) || "published";

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

  const status = targetStatus === "draft" ? "draft" : "published";

  // Features parsing: comma separated or list
  const rawFeatures = clean(form.get("features"), 1000);
  const features = rawFeatures
    ? rawFeatures
        .split(",")
        .map((f) => clean(f, 80))
        .filter(Boolean)
    : [];

  // Submitter details: admin can provide specific contact or default to FHA Admin
  const contactName =
    clean(form.get("contactName"), 120) || "FHA Properties Management";
  const contactPhone =
    clean(form.get("contactPhone"), 30) || "+234 906 671 5348";
  const contactEmail =
    clean(form.get("contactEmail"), 254) || "fehintolahayodeji@gmail.com";

  // Images: uploaded files
  const rawImages = form.getAll("images");
  const imageFiles = rawImages.filter(
    (item) => item instanceof File && item.size > 0,
  );
  const rawVideoUrl = clean(form.get("videoUrl"), 2048);
  const videoUrl = rawVideoUrl ? normalizePropertyVideoUrl(rawVideoUrl) : "";

  if (rawVideoUrl && !videoUrl) {
    return json(
      { message: "Use a valid HTTPS YouTube, Vimeo, MP4, or WebM video link." },
      400,
    );
  }

  // Images: direct URLs
  let imageUrls;

  try {
    imageUrls = collectPropertyImageUrls(form.getAll("imageUrls"));
  } catch (error) {
    return json({ message: error.message }, 400);
  }

  const totalImages = imageFiles.length + imageUrls.length;
  if (totalImages > MAX_PROPERTY_IMAGES) {
    return json(
      {
        message: `You can add a maximum of ${MAX_PROPERTY_IMAGES} images in total.`,
      },
      400,
    );
  }

  const uploadedImages = [];

  try {
    const priceAmount = parseOptionalNumber(form.get("priceAmount"), "Price");
    const agentFeePercent = parseOptionalNumber(
      form.get("agentFeePercent"),
      "Agent fee",
      100,
    ) ?? 0;
    const bedrooms = parseOptionalNumber(form.get("bedrooms"), "Bedrooms", 100);
    const bathrooms = parseOptionalNumber(
      form.get("bathrooms"),
      "Bathrooms",
      100,
    );

    const priceLabel = clean(form.get("priceLabel"), 100);
    const area = clean(form.get("area"), 100);

    await connectDB();

    for (const file of imageFiles) {
      const buffer = await readPropertyImage(file);
      const uploaded = await uploadPropertyImage(buffer, file.type);
      uploadedImages.push(uploaded);
    }

    const allImages = [...uploadedImages.map((img) => img.url), ...imageUrls];

    const now = new Date();
    const property = await Property.create({
      title,
      slug: makeSlug(title),
      description,
      type,
      listingType,
      state,
      city,
      address,
      priceAmount,
      agentFeePercent,
      priceLabel,
      bedrooms,
      bathrooms,
      area,
      features,
      images: allImages,
      videoUrl,
      source: "fha",
      status,
      publishedAt: status === "published" ? now : null,
      reviewedAt: now,
      reviewNotes: `Published directly by admin (${adminUsername})`,
      submittedBy: {
        name: contactName,
        phone: contactPhone,
        email: contactEmail,
      },
    });

    return json(
      {
        success: true,
        message:
          status === "published"
            ? "Property published live on FHA Properties Management successfully!"
            : "Property saved as draft successfully.",
        property: {
          id: property._id.toString(),
          title: property.title,
          slug: property.slug,
          status: property.status,
        },
      },
      201,
    );
  } catch (error) {
    await Promise.allSettled(
      uploadedImages.map((image) => deletePropertyImage(image.publicId)),
    );

    console.error("Admin property creation failed:", error);

    const validationError =
      error instanceof Error &&
      (      error.message.startsWith("Price ") ||
      error.message.startsWith("Agent fee ") ||
        error.message.startsWith("Bedrooms ") ||
        error.message.startsWith("Bathrooms ") ||
        error.message.startsWith("Images ") ||
        error.message.startsWith("Each image ") ||
        error.message.startsWith("The uploaded file "));

    return json(
      {
        message: validationError
          ? error.message
          : "Could not create property. Please verify the input values.",
      },
      validationError ? 400 : 500,
    );
  }
}
