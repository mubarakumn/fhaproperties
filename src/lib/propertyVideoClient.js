export async function uploadPropertyVideoFile(file) {
  const form = new FormData();
  form.append("videoFile", file);

  const response = await fetch("/api/media/video-upload", {
    method: "POST",
    body: form,
  });

  let result;
  try {
    result = await response.json();
  } catch {
    throw new Error("The video upload returned an invalid response.");
  }

  if (
    !response.ok ||
    !result ||
    typeof result !== "object" ||
    !result.success ||
    typeof result.videoUrl !== "string"
  ) {
    throw new Error(result?.message || "Could not upload the video.");
  }

  return result.videoUrl;
}
