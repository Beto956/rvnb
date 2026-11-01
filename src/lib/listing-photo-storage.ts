import { ref, uploadBytesResumable, getDownloadURL, deleteObject, getMetadata } from "firebase/storage";
import { doc, runTransaction } from "firebase/firestore";
import { auth, db, storage } from "./firebase";
import { MAX_PHOTO_BYTES, MAX_LISTING_PHOTOS, photoAssets, photoFingerprint, validatePhotoHeader, type PhotoAsset, type PhotoFields } from "./listing-photos";

export type EditablePhoto = { id: string; url: string; file?: Blob; asset?: PhotoAsset };

export async function preparePhoto(file: File): Promise<EditablePhoto> {
  validatePhotoHeader(new Uint8Array(await file.slice(0, MAX_PHOTO_BYTES + 1).arrayBuffer()), file.size, file.type);
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  try {
    if (!bitmap.width || !bitmap.height || bitmap.width > 12000 || bitmap.height > 12000 ||
        bitmap.width * bitmap.height > 24000000) throw new Error("Decoded photo dimensions exceed the 24 megapixel limit.");
    const scale = Math.min(1, 2400 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Your browser cannot prepare photos. Try a current browser.");
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(
      value => value ? resolve(value) : reject(new Error("Could not prepare this image.")), "image/webp", 0.86));
    if (blob.type !== "image/webp" || blob.size > MAX_PHOTO_BYTES) throw new Error("Could not prepare a WebP under 5 MiB. Choose a smaller image.");
    return { id: crypto.randomUUID(), file: blob, url: URL.createObjectURL(blob) };
  } finally {
    bitmap.close();
  }
}

export async function saveListingPhotos(
  listingId: string, uid: string, photos: EditablePhoto[], original: PhotoFields,
  progress: (id: string, percent: number) => void,
  uploaded: (id: string, asset: PhotoAsset) => void,
): Promise<{ fields: PhotoFields; cleanupFailed: number }> {
  if (photos.length > MAX_LISTING_PHOTOS) throw new Error("Keep up to 8 photos before saving.");
  if (auth.currentUser?.uid !== uid) throw new Error("Your account changed. Reload before saving photos.");
  const completed: EditablePhoto[] = [];
  for (const photo of photos) {
    if (!photo.file || photo.asset) { completed.push(photo); continue; }
    const path = `listingPhotos/${uid}/${listingId}/${photo.id}.webp`;
    const object = ref(storage, path);
    // A prior attempt may have uploaded successfully but lost its completion/download-URL response.
    let exists = false;
    try {
      const metadata = await getMetadata(object);
      if (metadata.contentType !== "image/webp" || metadata.size !== photo.file.size) {
        throw new Error("An unexpected file already occupies this upload path. Remove this preview and add it again.");
      }
      exists = true;
    } catch (error) {
      if ((error as { code?: string }).code !== "storage/object-not-found") throw error;
    }
    if (!exists) {
      const task = uploadBytesResumable(object, photo.file, { contentType: "image/webp", cacheControl: "public,max-age=31536000,immutable" });
      await new Promise<void>((resolve, reject) => task.on("state_changed",
        snap => progress(photo.id, Math.round(snap.bytesTransferred / snap.totalBytes * 100)), reject, resolve));
    } else progress(photo.id, 100);
    const asset = { path, url: await getDownloadURL(object) };
    // Retain each successful upload for retries, including a later Firestore failure.
    uploaded(photo.id, asset);
    completed.push({ ...photo, asset, url: asset.url });
  }
  const urls = completed.map(photo => photo.asset?.url ?? photo.url);
  const assets = completed.flatMap(photo => photo.asset ? [photo.asset] : []);
  const fields = { photos: urls, imageUrl: urls[0] ?? "", photoURL: urls[0] ?? "", photoAssets: assets, photoPaths: assets.map(asset => asset.path) };
  await runTransaction(db, async transaction => {
    const target = doc(db, "listings", listingId);
    const snap = await transaction.get(target);
    if (!snap.exists() || snap.data().hostId !== uid) throw new Error("You no longer own this listing.");
    if (photoFingerprint(snap.data()) === photoFingerprint(fields)) return;
    if (photoFingerprint(snap.data()) !== photoFingerprint(original)) {
      throw new Error("Photos changed in another session. Reload before saving; your uploads have not replaced them.");
    }
    transaction.update(target, fields);
  });
  const removed = photoAssets(original, uid, listingId).filter(asset => !assets.some(keep => keep.path === asset.path));
  let cleanupFailed = 0;
  for (const asset of removed) {
    try { await deleteObject(ref(storage, asset.path)); }
    catch (error) {
      if ((error as { code?: string }).code !== "storage/object-not-found") {
        console.error("[RVNB] photo saved but old object cleanup failed", error);
        cleanupFailed++;
      }
    }
  }
  return { fields, cleanupFailed };
}
