export const ACCEPTED_TYPES = ["image/png", "image/jpeg", "image/webp"];
export const MAX_RAW_BYTES = 10 * 1024 * 1024;

const MAX_WIDTH = 1400;
const MAX_HEIGHT = 2400;
const TARGET_BYTES = 150 * 1024;

export interface CompressedImage {
  blob: Blob;
  type: string;
  ext: "webp" | "jpg";
  width: number;
  height: number;
  originalBytes: number;
}

export class ImageRejectedError extends Error {}

export function checkImageFile(file: File | Blob) {
  if (!ACCEPTED_TYPES.includes(file.type)) {
    throw new ImageRejectedError("Use a PNG, JPG or WebP screenshot.");
  }
  if (file.size > MAX_RAW_BYTES) {
    throw new ImageRejectedError("That file is over 10 MB. Try a cropped screenshot.");
  }
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Could not encode image"))), type, quality);
  });
}

/**
 * Downscales and re-encodes a screenshot in the browser so uploads stay small
 * (~50–150 KB). Prefers WebP; browsers that can't encode WebP (Safari) get JPEG.
 */
export async function compressScreenshot(file: File | Blob): Promise<CompressedImage> {
  checkImageFile(file);
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_WIDTH / bitmap.width, MAX_HEIGHT / bitmap.height);
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Your browser couldn't process this image.");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close?.();

  let quality = 0.82;
  let blob = await canvasToBlob(canvas, "image/webp", quality);
  let type = "image/webp";
  let ext: CompressedImage["ext"] = "webp";
  if (blob.type !== "image/webp") {
    type = "image/jpeg";
    ext = "jpg";
    blob = await canvasToBlob(canvas, type, quality);
  }
  while (blob.size > TARGET_BYTES && quality > 0.5) {
    quality -= 0.1;
    blob = await canvasToBlob(canvas, type, quality);
  }
  return { blob, type, ext, width, height, originalBytes: file.size };
}

/** First image found in a paste or drop event, if any. */
export function imageFromDataTransfer(data: DataTransfer | null): File | null {
  if (!data) return null;
  for (const item of Array.from(data.items ?? [])) {
    if (item.kind === "file" && item.type.startsWith("image/")) {
      const file = item.getAsFile();
      if (file) return file;
    }
  }
  for (const file of Array.from(data.files ?? [])) {
    if (file.type.startsWith("image/")) return file;
  }
  return null;
}
