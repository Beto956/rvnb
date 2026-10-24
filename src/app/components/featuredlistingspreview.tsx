"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import styles from "../page.module.css";

import { db } from "@/lib/firebase";
import { collection, getDocs, limit, query } from "firebase/firestore";

type Listing = {
  id: string;
  title: string;
  city: string;
  state: string;
  hookups: string;
  maxLengthFt?: number;
  price?: number;
  pricePerNight?: number;
  pricingType: string;
  photos: string[];
};

type LoadState =
  | { limit: number; status: "loading" }
  | { limit: number; status: "error" }
  | { limit: number; status: "ready"; items: Listing[] };

function cleanText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function validAmount(value: unknown): number | undefined {
  return typeof value === "number" &&
    Number.isFinite(value) &&
    value >= 0
    ? value
    : undefined;
}

function safePhotoUrl(value: unknown): string | null {
  const candidate = cleanText(value);

  if (!candidate || /[\u0000-\u0020\\]/.test(candidate)) {
    return null;
  }

  // Support local images, excluding protocol-relative URLs.
  if (candidate.startsWith("/") && !candidate.startsWith("//")) {
    return candidate;
  }

  try {
    const url = new URL(candidate);

    if (
      (url.protocol === "https:" || url.protocol === "http:") &&
      !url.username &&
      !url.password
    ) {
      return url.href;
    }
  } catch {
    // Invalid URLs use the photo fallback.
  }

  return null;
}

function normalizeListing(
  id: string,
  data: Record<string, unknown>
): Listing {
  const candidates = [
    data.imageUrl,
    data.photoURL,
    ...(Array.isArray(data.photos) ? data.photos : []),
  ];

  const photos = candidates
    .map(safePhotoUrl)
    .filter((photo): photo is string => photo !== null);

  const maxLengthFt = validAmount(data.maxLengthFt);

  return {
    // Use Firestore's document ID rather than a stored "id" field.
    id,
    title: cleanText(data.title) || "Untitled Spot",
    city: cleanText(data.city),
    state: cleanText(data.state),
    hookups: cleanText(data.hookups) || "—",
    maxLengthFt:
      maxLengthFt !== undefined && maxLengthFt > 0
        ? maxLengthFt
        : undefined,
    price: validAmount(data.price),
    pricePerNight: validAmount(data.pricePerNight),
    pricingType:
      cleanText(data.pricingType).toLowerCase() || "night",
    photos: [...new Set(photos)],
  };
}

function formatPrice(listing: Listing): {
  value: string;
  label: string;
} {
  // Prefer current pricing when both formats exist.
  if (listing.price !== undefined) {
    let unit = listing.pricingType;

    switch (unit) {
      case "pernight":
      case "per night":
      case "nightly":
        unit = "night";
        break;
      case "weekly":
        unit = "week";
        break;
      case "monthly":
        unit = "month";
        break;
      case "daily":
        unit = "day";
        break;
    }

    return {
      value: `$${listing.price}`,
      label: `/ ${unit}`,
    };
  }

  if (listing.pricePerNight !== undefined) {
    return {
      value: `$${listing.pricePerNight}`,
      label: "/ night",
    };
  }

  return {
    value: "Contact host",
    label: "",
  };
}

function ListingPhoto({ photos }: { photos: string[] }) {
  const [photoIndex, setPhotoIndex] = useState(0);
  const photo = photos[photoIndex];

  return (
    <div
      style={{
        position: "relative",
        aspectRatio: "8 / 5",
        overflow: "hidden",
        borderRadius: 12,
        marginBottom: 14,
        background: "#17243a",
      }}
    >
      {photo ? (
        // Host images may use domains not configured for Next Image.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={photo}
          src={photo}
          alt=""
          width={640}
          height={400}
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => setPhotoIndex((index) => index + 1)}
          style={{
            display: "block",
            width: "100%",
            height: "100%",
            objectFit: "cover",
          }}
        />
      ) : (
        <div
          aria-hidden="true"
          style={{
            display: "grid",
            placeItems: "center",
            height: "100%",
            background:
              "linear-gradient(135deg, #203c49, #182336)",
          }}
        >
          <span
            style={{
              fontSize: "2rem",
              fontWeight: 900,
              letterSpacing: "0.15em",
              color: "white",
            }}
          >
            RVNB
          </span>
        </div>
      )}

      <span
        style={{
          position: "absolute",
          bottom: 10,
          left: 10,
          padding: "4px 8px",
          borderRadius: 8,
          background: "rgba(0, 0, 0, 0.75)",
          color: "white",
          fontSize: "0.8rem",
        }}
      >
        {photo
          ? "Host photo"
          : photos.length
            ? "Photo unavailable"
            : "Photos not added"}
      </span>
    </div>
  );
}

export default function FeaturedListingsPreview({
  limitCount = 3,
}: {
  limitCount?: number;
}) {
  const safeLimit = Number.isFinite(limitCount)
    ? Math.max(1, Math.min(12, Math.floor(limitCount)))
    : 3;

  const [state, setState] = useState<LoadState>({
    limit: safeLimit,
    status: "loading",
  });

  useEffect(() => {
    let alive = true;

    async function loadListings() {
      try {
        const listingsQuery = query(
          collection(db, "listings"),
          limit(safeLimit)
        );

        const snapshot = await getDocs(listingsQuery);

        if (!alive) return;

        const items = snapshot.docs.map((document) =>
          normalizeListing(document.id, document.data())
        );

        setState({
          limit: safeLimit,
          status: "ready",
          items,
        });
      } catch {
        if (!alive) return;

        setState({
          limit: safeLimit,
          status: "error",
        });
      }
    }

    void loadListings();

    return () => {
      // Ignore results after unmount or a change to the query.
      alive = false;
    };
  }, [safeLimit]);

  if (state.limit !== safeLimit || state.status === "loading") {
    return (
      <div className={styles.previewState} role="status">
        Loading featured listings…
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className={styles.previewState} role="status">
        <div className={styles.previewErrorTitle}>
          Couldn’t load featured listings
        </div>

        <div className={styles.previewErrorBody}>
          Please try again later, or browse all listings.
        </div>

        <Link
          className={styles.previewFallbackLink}
          href="/listings"
        >
          View All Listings
        </Link>
      </div>
    );
  }

  if (state.items.length === 0) {
    return (
      <div className={styles.previewState} role="status">
        No listings found yet.{" "}
        <Link
          className={styles.previewFallbackLink}
          href="/host"
        >
          Create the first listing
        </Link>
        .
      </div>
    );
  }

  return (
    <div className={styles.previewGrid}>
      {state.items.map((listing) => {
        const price = formatPrice(listing);

        const location =
          [listing.city, listing.state]
            .filter(Boolean)
            .join(", ") || "—";

        return (
          <Link
            key={listing.id}
            href={`/listings/${encodeURIComponent(listing.id)}`}
            className={styles.previewCardLink}
            style={{ minWidth: 0 }}
          >
            <article className={styles.previewCard}>
              <ListingPhoto
                key={JSON.stringify(listing.photos)}
                photos={listing.photos}
              />

              <div
                className={styles.previewCardTop}
                style={{ flexWrap: "wrap" }}
              >
                <h3
                  className={styles.previewTitle}
                  style={{
                    minWidth: 0,
                    overflowWrap: "anywhere",
                  }}
                >
                  {listing.title}
                </h3>

                <div
                  className={styles.previewPrice}
                  style={{
                    whiteSpace: "normal",
                    overflowWrap: "anywhere",
                  }}
                >
                  <span className={styles.previewPriceValue}>
                    {price.value}
                  </span>

                  {price.label ? (
                    <span className={styles.previewPriceLabel}>
                      {price.label}
                    </span>
                  ) : null}
                </div>
              </div>

              <div className={styles.previewMeta}>
                {[
                  ["Location", location],
                  ["Hookups", listing.hookups],
                  [
                    "Max length",
                    listing.maxLengthFt !== undefined
                      ? `${listing.maxLengthFt} ft`
                      : "—",
                  ],
                ].map(([label, value]) => (
                  <div
                    key={label}
                    className={styles.previewMetaRow}
                  >
                    <span className={styles.previewMetaKey}>
                      {label}
                    </span>

                    <span
                      className={styles.previewMetaVal}
                      style={{
                        minWidth: 0,
                        overflowWrap: "anywhere",
                        textAlign: "right",
                      }}
                    >
                      {value}
                    </span>
                  </div>
                ))}
              </div>

              <div className={styles.previewCardCta}>
                View spot →
              </div>
            </article>
          </Link>
        );
      })}
    </div>
  );
}