"use client";

import { useState, type ReactNode } from "react";
import ListingPhoto from "./ListingPhoto";
import styles from "./listingPhotos.module.css";

export default function ListingPhotoGallery({ photos, fallback }: { photos: string[]; fallback: ReactNode }) {
  const [selected, setSelected] = useState<string | null>(null);
  if (!photos.length) return fallback;
  const active = selected && photos.includes(selected) ? selected : photos[0];
  return <section className={styles.gallery} aria-label="Listing photos">
    <div className={styles.galleryHero}>
      <ListingPhoto key={active} photos={[active]} fallback={<div className={styles.galleryFallback}>RVNB · Photo unavailable</div>} />
    </div>
    <div className={styles.thumbnails}>
      {photos.map((url, index) => <button type="button" key={url} aria-label={`View listing photo ${index + 1}`}
        aria-pressed={active === url} onClick={() => setSelected(url)}>
        <ListingPhoto photos={[url]} fallback={<span>Photo unavailable</span>} />
      </button>)}
    </div>
  </section>;
}
