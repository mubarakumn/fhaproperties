import { randomBytes } from "node:crypto";
import { connectDB } from "../../../lib/db.js";
import {
  uploadPropertyImage,
  deletePropertyImage,
} from "../../../lib/cloudinary.js";
import {
  collectPropertyImageUrls,
  MAX_PROPERTY_IMAGES,
  readPropertyImage,
  normalizePropertyVideoUrl,
} from "../../../lib/propertyImages.js";
import Property from "../../../models/Property.js";
import {
  sendPropertySubmissionConfirmation,
  sendPropertySubmissionOwnerNotice,
} from "../../../lib/email.js";

export const prerender = false;

const WINDOW_MS = 5 * 60 * 1000; // 5 minutes
const MAX_REQUESTS = 5;
const allowedPropertyTypes = new Set([
  "House",
  "Land",
  "Commercial",
  "Apartment",
  "Other",
]);

const allowedListingTypes = new Set(["Sale", "Rent"]);

const requestLog = new Map();

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

  return `${base || "property"}-${randomBytes(4).toString("hex")}`;
}

function checkRateLimit(request) {
  const forwarded = request.headers.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() || "unknown";
  const now = Date.now();

  const current = requestLog.get(ip);

  if (!current || now - current.start >= WINDOW_MS) {
    requestLog.set(ip, { start: now, count: 1 });
    return true;
  }

  if (current.count >= MAX_REQUESTS) return false;

  current.count += 1;
  return true;
}

export async function POST({ request }) {
  if (!checkRateLimit(request)) {
    return json(
      { message: "Too many submissions. Please try again in 15 minutes." },
      429,
    );
  }

  let form;

  try {
    form = await request.formData();
  } catch {
    return json({ message: "Invalid form submission." }, 400);
  }

  // Honeypot field: normal visitors should leave this empty.
  if (clean(form.get("website"), 200)) {
    return json({ message: "Submission could not be accepted." }, 400);
  }

  const title = clean(form.get("title"), 150);
  const description = clean(form.get("description"), 5000);
  const type = clean(form.get("type"), 40);
  const listingType = clean(form.get("listingType"), 20);
  const state = clean(form.get("state"), 100);
  const city = clean(form.get("city"), 100);
  const address = clean(form.get("address"), 300);

  const name = clean(form.get("submitterName"), 120);
  const phone = clean(form.get("submitterPhone"), 40);
  const email = clean(form.get("submitterEmail"), 254);

  if (
    !title ||
    !description ||
    !type ||
    !listingType ||
    !state ||
    !city ||
    !name ||
    !phone
  ) {
    return json(
      {
        message:
          "Please provide the title, description, property type, listing type, state, city, name, and phone number.",
      },
      400,
    );
  }

  if (!allowedPropertyTypes.has(type)) {
    return json({ message: "Invalid property type." }, 400);
  }

  if (!allowedListingTypes.has(listingType)) {
    return json({ message: "Invalid listing type." }, 400);
  }

  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return json({ message: "Please provide a valid email address." }, 400);
  }

  // Collect uploaded files — browser sends an empty string when no file chosen
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

  // Collect image URLs entered manually
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
      images: [
        ...new Set([...uploadedImages.map((image) => image.url), ...imageUrls]),
      ],
      videoUrl,
      source: "external",
      status: "pending_review",
      submittedBy: {
        name,
        phone,
        email,
      },
    });

    const [confirmationResult, ownerNoticeResult] = await Promise.allSettled([
      sendPropertySubmissionConfirmation({
        to: email,
        propertyTitle: title,
        propertyId: property._id.toString(),
      }),
      sendPropertySubmissionOwnerNotice({
        propertyTitle: title,
        submitterName: name,
        submitterEmail: email,
        submitterPhone: phone,
        propertyId: property._id.toString(),
      }),
    ]);

    if (confirmationResult.status === "rejected") {
      console.error("Property submission confirmation email failed:", confirmationResult.reason);
    }

    if (ownerNoticeResult.status === "rejected") {
      console.error("Owner submission email failed:", ownerNoticeResult.reason);
    }

    return json(
      {
        success: true,
        message:
          "Your property has been submitted successfully and is awaiting FHA review.",
        reference: property._id.toString(),
      },
      201,
    );
  } catch (error) {
    // If saving fails after an upload, remove uploaded assets where possible.
    await Promise.allSettled(
      uploadedImages.map((image) => deletePropertyImage(image.publicId)),
    );

    console.error("Property submission failed:", error);

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
          : "We could not submit your property right now. Please try again later.",
      },
      validationError ? 400 : 500,
    );
  }
}
