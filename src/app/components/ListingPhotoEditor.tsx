"use client";

import { useEffect, useRef, useState } from "react";
import { listingPhotos, photoAssets, MAX_LISTING_PHOTOS, type PhotoFields } from "@/lib/listing-photos";
import { preparePhoto, saveListingPhotos, type EditablePhoto } from "@/lib/listing-photo-storage";
import styles from "./listingPhotos.module.css";

export type PhotoSave = (listingId: string) => Promise<boolean>;

export default function ListingPhotoEditor({ initial, uid, listingId = "", busy, register, onPreparing }: {
  initial: PhotoFields; uid: string; listingId?: string; busy: boolean; register: (save: PhotoSave) => void; onPreparing: (value: boolean) => void;
}) {
  const [photos, setPhotos] = useState<EditablePhoto[]>(() => listingPhotos(initial).map((url, index) => ({
    id: `existing-${index}`, url, asset: photoAssets(initial, uid, listingId).find(asset => asset.url === url),
  })));
  const [original, setOriginal] = useState(initial);
  const [changed, setChanged] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [progress, setProgress] = useState<Record<string, number>>({});
  const [message, setMessage] = useState("");
  const [failed, setFailed] = useState(false);
  const previews = useRef<string[]>([]);
  const preparingRef = useRef(false);
  useEffect(() => () => previews.current.forEach(url => URL.revokeObjectURL(url)), []);
  useEffect(() => {
    if (!changed) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [changed]);

  async function add(files: FileList | null) {
    if (!files || preparingRef.current) return;
    preparingRef.current = true;
    setPreparing(true);
    onPreparing(true);
    setFailed(false);
    const errors: string[] = [];
    const added: EditablePhoto[] = [];
    try {
      for (const file of Array.from(files)) {
        if (photos.length + added.length >= MAX_LISTING_PHOTOS) {
          errors.push("You can keep up to 8 photos. Remove one before adding another.");
          break;
        }
        try {
          const photo = await preparePhoto(file);
          previews.current.push(photo.url);
          added.push(photo);
        } catch (error) { errors.push(`${file.name}: ${error instanceof Error ? error.message : "Could not prepare photo."}`); }
      }
      if (added.length) { setPhotos(current => [...current, ...added]); setChanged(true); }
      setMessage(errors.join(" "));
      setFailed(errors.length > 0);
    } finally { preparingRef.current = false; setPreparing(false); onPreparing(false); }
  }

  // Registration is scoped to the mounted form; uploaded results stay available for retries.
  register(async id => {
    if (preparingRef.current) throw new Error("Wait for the photo previews to finish.");
    if (!changed) return true;
    if (photos.length > MAX_LISTING_PHOTOS) throw new Error("Keep up to 8 photos before saving.");
    setFailed(false);
    setMessage("Listing details saved. Saving photos...");
    try {
      const result = await saveListingPhotos(id, uid, photos, original,
        (photoId, percent) => setProgress(current => ({ ...current, [photoId]: percent })),
        (photoId, asset) => setPhotos(current => current.map(photo => photo.id === photoId ? { ...photo, asset, url: asset.url } : photo)));
      setOriginal(result.fields);
      setChanged(false);
      setMessage(result.cleanupFailed
        ? "Listing and photos saved. Some removed files could not be cleaned up; they are no longer displayed. You can leave this page."
        : "Listing and photos saved.");
      return result.cleanupFailed === 0;
    } catch (error) {
      console.error("[RVNB] listing photo save failed", error);
      setFailed(true);
      setMessage(`Listing details saved, but photo saving could not be completed or confirmed. ${error instanceof Error ? error.message : "Upload failed."} Use Retry save; successful uploads are retained. Keep this page open.`);
      return false;
    }
  });

  return <section className={styles.editor} aria-labelledby="listing-photos-title">
    <h2 id="listing-photos-title">Listing photos</h2>
    <p id="listing-photos-help">Photos are public. Add up to 8 JPEG, PNG, or WebP files, 5 MiB each. HEIC, GIF, and SVG are not supported.
      Images are resized to 2,400 pixels and re-encoded without original metadata. Do not include private information.</p>
    <label className={styles.fileLabel} htmlFor="listing-photos">Add photos ({photos.length}/8)</label>
    <input id="listing-photos" type="file" accept="image/jpeg,image/png,image/webp" multiple
      aria-describedby="listing-photos-help" disabled={busy || preparing || photos.length >= 8}
      onChange={event => { void add(event.target.files); event.target.value = ""; }} />
    <p role={failed ? "alert" : "status"} aria-live="polite">{preparing ? "Preparing photo previews..." : message}</p>
    <div className={styles.grid}>
      {photos.map((photo, index) => <div key={photo.id} className={styles.photo}>
        {/* Blob previews and host-controlled domains cannot use the configured Next image loader. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={photo.url} alt={`Listing photo ${index + 1}`} referrerPolicy="no-referrer" />
        <div>{index === 0 ? "Cover photo" : `Photo ${index + 1}`}</div>
        {progress[photo.id] !== undefined && <label>Upload {progress[photo.id]}%<progress max={100} value={progress[photo.id]} /></label>}
        <div className={styles.actions}>
          <button type="button" disabled={busy || preparing || index === 0} aria-pressed={index === 0}
            onClick={() => { setPhotos(current => [photo, ...current.filter(item => item.id !== photo.id)]); setChanged(true); }}>Use as cover</button>
          <button type="button" disabled={busy || preparing}
            onClick={() => { setPhotos(current => current.filter(item => item.id !== photo.id)); setChanged(true); }}>Remove photo {index + 1}</button>
        </div>
      </div>)}
    </div>
    {changed && <p>Photo changes take effect when you save the listing. Keep this page open until saving finishes.</p>}
  </section>;
}
