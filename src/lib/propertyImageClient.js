const MAX_UPLOAD_IMAGE_SIZE = 700 * 1024;
const MAX_IMAGE_DIMENSIONS = [1600, 1280, 1024, 800];
const JPEG_QUALITIES = [0.84, 0.72, 0.62, 0.52];

export class PropertyImagePreparationError extends Error {
  constructor(message) {
    super(message);
    this.name = "PropertyImagePreparationError";
  }
}

export async function preparePropertyImages(files) {
  const prepared = [];

  for (const file of files) {
    prepared.push(await preparePropertyImage(file));
  }

  return prepared;
}

async function preparePropertyImage(file) {
  if (file.size <= MAX_UPLOAD_IMAGE_SIZE) return file;

  let bitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new PropertyImagePreparationError(
      `Could not read "${file.name}". Please choose another photo.`,
    );
  }

  try {
    for (const maxDimension of MAX_IMAGE_DIMENSIONS) {
      const scale = Math.min(
        1,
        maxDimension / Math.max(bitmap.width, bitmap.height),
      );
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));

      const context = canvas.getContext("2d");
      if (!context) {
        throw new PropertyImagePreparationError(
          `Could not optimize "${file.name}". Please choose another photo.`,
        );
      }

      context.fillStyle = "#fff";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

      for (const quality of JPEG_QUALITIES) {
        const blob = await new Promise((resolve) => {
          canvas.toBlob(resolve, "image/jpeg", quality);
        });

        if (blob && blob.size <= MAX_UPLOAD_IMAGE_SIZE) {
          const baseName = file.name.replace(/\.[^.]+$/, "") || "property-image";
          return new File([blob], `${baseName}.jpg`, {
            type: "image/jpeg",
            lastModified: file.lastModified,
          });
        }
      }
    }
  } finally {
    bitmap.close();
  }

  throw new PropertyImagePreparationError(
    `"${file.name}" could not be reduced enough to upload. Please choose a smaller photo.`,
  );
}
