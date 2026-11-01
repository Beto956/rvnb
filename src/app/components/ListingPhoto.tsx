"use client";

import { useState, type ReactNode } from "react";

/** Keeps each surface's existing fallback and tries the remaining legacy photos on failure. */
export default function ListingPhoto({ photos, fallback, className, badgeClassName, fill = false }: {
  photos: string[]; fallback: ReactNode; className?: string; badgeClassName?: string; fill?: boolean;
}) {
  const [failed, setFailed] = useState<string[]>([]);
  const photo = photos.find(url => !failed.includes(url));
  return <>
    {photo ? (
      // Public host images can use legacy domains not configured for Next Image.
      // eslint-disable-next-line @next/next/no-img-element
      <img src={photo} alt="" className={className} loading="lazy" decoding="async" referrerPolicy="no-referrer"
        onError={() => setFailed(current => [...current, photo])}
        style={{ objectFit: "cover", width: "100%", height: "100%", ...(fill ? { position: "absolute", inset: 0 } : {}) }} />
    ) : fallback}
    {badgeClassName && <span className={badgeClassName}>{photo ? "Host photo" : "Photos not added"}</span>}
  </>;
}
