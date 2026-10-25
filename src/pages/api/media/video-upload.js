import { uploadPropertyVideo } from "../../../lib/cloudinary.js";
import {
  MAX_PROPERTY_VIDEO_SIZE,
  readPropertyVideo,
} from "../../../lib/propertyImages.js";
import { isSameOriginRequest } from "../../../lib/adminAuth.js";

export const prerender = false;

const RATE_LIMIT_WINDOW_MS = 5 * 60 * 1000;
const MAX_UPLOADS_PER_WINDOW = 5;
const uploadLog = new Map();

function json(data, status = 200) {
  return Response.json(data, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function checkRateLimit(request) {
  const forwardedFor = request.headers.get("x-forwarded-for");
  const ip = forwardedFor?.split(",")[0]?.trim() || "unknown";
  const now = Date.now();
  const current = uploadLog.get(ip);

  if (!current || now - current.start >= RATE_LIMIT_WINDOW_MS) {
    uploadLog.set(ip, { start: now, count: 1 });
    return true;
  }

  if (current.count >= MAX_UPLOADS_PER_WINDOW) return false;

  current.count += 1;
  return true;
}

export async function POST({ request }) {
  if (!isSameOriginRequest(request)) {
    return json({ message: "Invalid request origin." }, 403);
  }

  if (!checkRateLimit(request)) {
    return json({ message: "Too many video uploads. Please try again later." }, 429);
  }

  let form;
  try {
    form = await request.formData();
  } catch {
    return json({ message: "Invalid video upload." }, 400);
  }

  const video = form.get("videoFile");
  if (!(video instanceof File) || video.size === 0) {
    return json({ message: "Choose an MP4 or WebM video to upload." }, 400);
  }

  if (video.size > MAX_PROPERTY_VIDEO_SIZE) {
    return json({ message: "The video must be 4 MB or smaller." }, 400);
  }

  try {
    const buffer = await readPropertyVideo(video);
    const uploaded = await uploadPropertyVideo(buffer);
    return json({ success: true, videoUrl: uploaded.url }, 201);
  } catch (error) {
    console.error("Property video upload failed:", error);
    const validationError =
      error instanceof Error &&
      (error.message.startsWith("The video ") ||
        error.message.startsWith("The uploaded video ") ||
        error.message.startsWith("Videos "));
    return json(
      {
        message: validationError
          ? error.message
          : "Could not upload the video. Please try again.",
      },
      validationError ? 400 : 500,
    );
  }
}
