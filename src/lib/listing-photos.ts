export const MAX_LISTING_PHOTOS = 8;
export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
export type PhotoFields = { imageUrl?: unknown; photoURL?: unknown; photos?: unknown; photoAssets?: unknown; photoPaths?: unknown };
export type PhotoAsset = { url: string; path: string };

export function safePhotoUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const text = value.trim();
  if (!text || /[\u0000-\u0020\\]/.test(text)) return null;
  if (text.startsWith("/") && !text.startsWith("//")) return text;
  try {
    const url = new URL(text);
    return ["https:", "http:"].includes(url.protocol) && !url.username && !url.password ? url.href : null;
  } catch {
    return null;
  }
}

export function listingPhotos(data: PhotoFields): string[] {
  return [...new Set([data.imageUrl, data.photoURL, ...(Array.isArray(data.photos) ? data.photos : [])]
    .map(safePhotoUrl).filter((url): url is string => url !== null))];
}

export function managedPhotoPath(path: unknown, uid: string, listingId: string): path is string {
  const prefix = `listingPhotos/${uid}/${listingId}/`;
  return typeof path === "string" && path.startsWith(prefix) &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.webp$/.test(path.slice(prefix.length));
}

export function photoAssets(data: PhotoFields, uid: string, listingId: string): PhotoAsset[] {
  if (!Array.isArray(data.photoAssets)) return [];
  return data.photoAssets.filter((asset): asset is PhotoAsset =>
    asset !== null && typeof asset === "object" && typeof asset.url === "string" &&
    safePhotoUrl(asset.url) !== null && managedPhotoPath(asset.path, uid, listingId));
}

export function photoFingerprint(data: PhotoFields): string {
  const stable = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(stable);
    if (value && typeof value === "object") return Object.fromEntries(
      Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, stable(item)]));
    return value;
  };
  return JSON.stringify(stable([data.imageUrl ?? null, data.photoURL ?? null, data.photos ?? null, data.photoAssets ?? null, data.photoPaths ?? null]));
}

// Read dimensions before decoding, so compressed pixel bombs never reach the canvas.
export function imageDimensions(bytes: Uint8Array): { width: number; height: number; type: string } {
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const ascii = (start: number, length: number) => String.fromCharCode(...bytes.slice(start, start + length));
  if (bytes.length >= 24 && bytes[0] === 137 && ascii(1, 7) === "PNG\r\n\x1a\n" && ascii(12, 4) === "IHDR") {
    return { width: v.getUint32(16), height: v.getUint32(20), type: "image/png" };
  }
  if (bytes.length > 12 && bytes[0] === 255 && bytes[1] === 216) {
    let pos = 2;
    while (pos + 4 <= bytes.length) {
      if (bytes[pos++] !== 255) break;
      while (bytes[pos] === 255) pos++;
      if (pos + 3 > bytes.length) break;
      const marker = bytes[pos++];
      if (marker === 218 || marker === 217) break;
      const length = v.getUint16(pos);
      if (length < 2 || pos + length > bytes.length) break;
      if ([192, 193, 194].includes(marker) && length >= 8) {
        return { width: v.getUint16(pos + 5), height: v.getUint16(pos + 3), type: "image/jpeg" };
      }
      pos += length;
    }
  }
  if (bytes.length >= 30 && ascii(0, 4) === "RIFF" && ascii(8, 4) === "WEBP") {
    const chunk = ascii(12, 4);
    if (chunk === "VP8X") return {
      width: 1 + bytes[24] + (bytes[25] << 8) + (bytes[26] << 16),
      height: 1 + bytes[27] + (bytes[28] << 8) + (bytes[29] << 16), type: "image/webp",
    };
    if (chunk === "VP8 " && ascii(23, 3) === "\x9d\x01\x2a") return {
      width: v.getUint16(26, true) & 16383, height: v.getUint16(28, true) & 16383, type: "image/webp",
    };
    if (chunk === "VP8L" && bytes[20] === 47) {
      const bits = v.getUint32(21, true);
      return { width: 1 + (bits & 16383), height: 1 + ((bits >>> 14) & 16383), type: "image/webp" };
    }
  }
  throw new Error("Unsupported or damaged image. Choose a JPEG, PNG, or WebP photo (not HEIC, GIF, or SVG).");
}

export function validatePhotoHeader(bytes: Uint8Array, size: number, type: string) {
  if (size > MAX_PHOTO_BYTES || size === 0) throw new Error("Each photo must be between 1 byte and 5 MiB.");
  const dimensions = imageDimensions(bytes);
  if (type !== dimensions.type) throw new Error("The file contents do not match its JPEG, PNG, or WebP type.");
  if (!dimensions.width || !dimensions.height || dimensions.width > 12000 || dimensions.height > 12000 ||
      dimensions.width * dimensions.height > 24000000) {
    throw new Error("Photo dimensions are too large. Use an image up to 24 megapixels and 12,000 pixels per side.");
  }
  return dimensions;
}
