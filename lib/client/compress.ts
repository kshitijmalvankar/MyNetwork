/**
 * Shrinks a photo in the browser before upload: applies camera orientation,
 * caps the long edge, and re-encodes as JPEG, which also drops EXIF/GPS data.
 * Falls back to the original file if the browser can't decode it (e.g. HEIC
 * on desktop Chrome); the server validates and rejects unsupported formats.
 */
export async function compressImage(file: File, maxEdge = 1600, quality = 0.85): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("no canvas");
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
    if (!blob) throw new Error("encode failed");
    return blob;
  } catch {
    return file;
  }
}
