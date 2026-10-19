export const MAX_PROPERTY_IMAGES = 5;
export const MAX_PROPERTY_IMAGE_SIZE = 5 * 1024 * 1024;

const allowedImageTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

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
