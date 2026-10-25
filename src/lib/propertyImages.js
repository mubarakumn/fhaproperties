export const MAX_PROPERTY_IMAGES = 5;
export const MAX_PROPERTY_IMAGE_SIZE = 5 * 1024 * 1024;
export const MAX_PROPERTY_VIDEO_SIZE = 4 * 1024 * 1024;

const allowedImageTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const allowedVideoTypes = new Set(["video/mp4", "video/webm"]);

const youtubeIdPattern = /^[A-Za-z0-9_-]{11}$/;
const vimeoIdPattern = /^\d{1,12}$/;

export function normalizePropertyImageUrl(value, { allowHttp = false } = {}) {
  const input = String(value ?? "").trim();
  if (!input || input.length > 2048) return null;

  try {
    const url = new URL(input);
    const allowedProtocol =
      url.protocol === "https:" || (allowHttp && url.protocol === "http:");

    if (!allowedProtocol || !url.hostname || url.username || url.password) {
      return null;
    }

    return url.href;
  } catch {
    return null;
  }
}

export function collectPropertyImageUrls(values, options = {}) {
  const entries = Array.from(values ?? [], (value) =>
    String(value ?? "").trim(),
  ).filter(Boolean);
  const urls = entries.map((value) =>
    normalizePropertyImageUrl(value, options),
  );

  if (urls.some((url) => !url)) {
    const scheme = options.allowHttp ? "HTTP or HTTPS" : "HTTPS";
    throw new Error(`Each image link must be a valid ${scheme} URL.`);
  }

  return [...new Set(urls)];
}

export function normalizePropertyVideoUrl(value) {
  const input = String(value ?? "").trim();
  if (!input || input.length > 2048) return null;

  try {
    const url = new URL(input);
    if (url.protocol !== "https:" || !url.hostname || url.username || url.password) {
      return null;
    }

    const hostname = url.hostname.toLowerCase().replace(/^www\./, "");
    let videoId;

    if (hostname === "youtu.be") {
      videoId = url.pathname.split("/").filter(Boolean)[0];
    } else if (
      hostname === "youtube.com" ||
      hostname === "m.youtube.com" ||
      hostname === "youtube-nocookie.com"
    ) {
      const segments = url.pathname.split("/").filter(Boolean);
      videoId =
        url.searchParams.get("v") ||
        (["embed", "shorts", "live"].includes(segments[0])
          ? segments[1]
          : undefined);
    } else if (hostname === "vimeo.com" || hostname === "player.vimeo.com") {
      const segments = url.pathname.split("/").filter(Boolean);
      videoId =
        hostname === "player.vimeo.com" && segments[0] === "video"
          ? segments[1]
          : segments[0];
    } else if (/\.(mp4|webm)$/i.test(url.pathname)) {
      return url.href;
    } else {
      return null;
    }

    if (hostname.includes("youtube") || hostname === "youtu.be") {
      return youtubeIdPattern.test(videoId || "")
        ? `https://www.youtube-nocookie.com/embed/${videoId}`
        : null;
    }

    return vimeoIdPattern.test(videoId || "")
      ? `https://player.vimeo.com/video/${videoId}`
      : null;
  } catch {
    return null;
  }
}

export function getPropertyVideoType(value) {
  const normalizedUrl = normalizePropertyVideoUrl(value);
  if (!normalizedUrl) return null;

  return /\.(mp4|webm)(?:$|\?)/i.test(normalizedUrl)
    ? { type: "file", url: normalizedUrl }
    : { type: "embed", url: normalizedUrl };
}

export async function readPropertyImage(file) {
  if (!allowedImageTypes.has(file.type)) {
    throw new Error("Images must be JPEG, PNG, or WebP files.");
  }

  if (file.size > MAX_PROPERTY_IMAGE_SIZE) {
    throw new Error("Each image must be 5 MB or smaller.");
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const isJpeg =
    buffer.length >= 3 &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff;
  const isPng =
    buffer.length >= 8 &&
    buffer
      .subarray(0, 8)
      .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  const isWebp =
    buffer.length >= 12 &&
    buffer.toString("ascii", 0, 4) === "RIFF" &&
    buffer.toString("ascii", 8, 12) === "WEBP";

  const signatureMatches =
    (file.type === "image/jpeg" && isJpeg) ||
    (file.type === "image/png" && isPng) ||
    (file.type === "image/webp" && isWebp);

  if (!signatureMatches) {
    throw new Error(
      "The uploaded file is not a valid JPEG, PNG, or WebP image.",
    );
  }

  return buffer;
}

export async function readPropertyVideo(file) {
  if (!allowedVideoTypes.has(file.type)) {
    throw new Error("Videos must be MP4 or WebM files.");
  }

  if (file.size === 0 || file.size > MAX_PROPERTY_VIDEO_SIZE) {
    throw new Error("The video must be 4 MB or smaller.");
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const isMp4 =
    buffer.length >= 12 &&
    buffer.toString("ascii", 4, 8) === "ftyp";
  const isWebm =
    buffer.length >= 4 &&
    buffer.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]));

  if (
    (file.type === "video/mp4" && !isMp4) ||
    (file.type === "video/webm" && !isWebm)
  ) {
    throw new Error("The uploaded video is not a valid MP4 or WebM file.");
  }

  return buffer;
}
