import "server-only";
import sharp from "sharp";
import { readBarcodes } from "zxing-wasm/reader";

/** Finds a QR code in an image, if any. Never throws: a missing QR code is normal. */
export async function decodeQr(image: Buffer): Promise<string | null> {
  try {
    const { data, info } = await sharp(image).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const results = await readBarcodes(
      { data: new Uint8ClampedArray(data.buffer, data.byteOffset, data.byteLength), width: info.width, height: info.height, colorSpace: "srgb" },
      { formats: ["QRCode"], tryHarder: true, maxNumberOfSymbols: 1 },
    );
    return results.find((r) => r.isValid && r.text)?.text ?? null;
  } catch (err) {
    console.warn("[qr] decode failed", err instanceof Error ? err.message : err);
    return null;
  }
}
