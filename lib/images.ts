import "server-only";
import sharp from "sharp";

const ACCEPTED = new Set(["jpeg", "png", "webp", "heif", "avif", "gif", "tiff"]);
export const MAX_UPLOAD_BYTES = 6 * 1024 * 1024;

export class UnsupportedImageError extends Error {}

/**
 * Decodes an upload by its actual bytes (not its name or declared type),
 * applies camera orientation, and drops all metadata (EXIF, GPS).
 */
async function decode(input: Buffer) {
  const image = sharp(input, { failOn: "error", limitInputPixels: 50_000_000 });
  const meta = await image.metadata().catch(() => null);
  if (!meta?.format || !ACCEPTED.has(meta.format)) throw new UnsupportedImageError("Unsupported image format");
  return image.rotate();
}

export type StoredImages = { full: Buffer; thumb: Buffer };

/** WebP for storage (~1600px) plus a small thumbnail for lists. */
export async function prepareForStorage(input: Buffer): Promise<StoredImages> {
  const base = await decode(input);
  const [full, thumb] = await Promise.all([
    base.clone().resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true }).webp({ quality: 82 }).toBuffer(),
    base.clone().resize({ width: 360, height: 360, fit: "inside", withoutEnlargement: true }).webp({ quality: 70 }).toBuffer(),
  ]);
  return { full, thumb };
}

/** JPEG ~1024px for the vision model: small enough to keep token costs low, sharp enough to read. */
export async function prepareForModel(input: Buffer): Promise<Buffer> {
  return (await decode(input))
    .resize({ width: 1024, height: 1024, fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 82, mozjpeg: true })
    .toBuffer();
}
