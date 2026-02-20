"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import styles from "../page.module.css";

import { db } from "@/lib/firebase";
import { collection, getDocs, limit, query } from "firebase/firestore";

type Hookups = "Full" | "Partial" | "None" | string;

type ListingDoc = {
  id: string;
  title?: string;
  city?: string;
  state?: string;
  hookups?: Hookups;
  maxLengthFt?: number;

  // Old pricing format:
  pricePerNight?: number;

  // New pricing format (supported):
  price?: number;
  pricingType?: string; // e.g. "night", "day", "week", etc.
};

function formatPrice(listing: ListingDoc): { label: string; value: string } {
  // Backward compatible:
  // - If pricePerNight exists, treat as per night.
  // - Else if price exists, use pricingType (default "night").
  // - Else show "Contact host" pricing.
  if (typeof listing.pricePerNight === "number") {
    return { label: "/ night", value: `$${listing.pricePerNight}` };
  }

  if (typeof listing.price === "number") {
    const rawType = (listing.pricingType || "night").toLowerCase();
    const normalized =
      rawType === "pernight" || rawType === "night" ? "night" : rawType;

    return { label: ` / ${normalized}`, value: `$${listing.price}` };
  }

  return { label: "", value: "Contact host" };
}

export default function FeaturedListingsPreview({ limitCount = 3 }: { limitCount?: number }) {
  const [items, setItems] = useState<ListingDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");

  const safeLimit = useMemo(() => Math.max(1, Math.min(limitCount, 12)), [limitCount]);

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setLoading(true);
        setError("");

        const q = query(collection(db, "listings"), limit(safeLimit));
        const snap = await getDocs(q);

        const rows: ListingDoc[] = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<ListingDoc, "id">),
        }));

        if (!alive) return;
        setItems(rows);
      } catch (e: any) {
        if (!alive) return;
        setError(e?.message || "Failed to load featured listings.");
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [safeLimit]);

  if (loading) {
    return <div className={styles.previewState}>Loading featured listings…</div>;
  }

  if (error) {
    return (
      <div className={styles.previewState}>
        <div className={styles.previewErrorTitle}>Couldn’t load featured listings</div>
        <div className={styles.previewErrorBody}>{error}</div>
        <Link className={styles.previewFallbackLink} href="/listings">
          View All Listings
        </Link>
      </div>
    );
  }

  if (!items.length) {
    return (
      <div className={styles.previewState}>
        No listings found yet.{" "}
        <Link className={styles.previewFallbackLink} href="/host">
          Create the first listing
        </Link>
        .
      </div>
    );
  }

  return (
    <div className={styles.previewGrid}>
      {items.map((l) => {
        const price = formatPrice(l);

        return (
          <Link key={l.id} href={`/listings/${l.id}`} className={styles.previewCardLink}>
            <article className={styles.previewCard}>
              <div className={styles.previewCardTop}>
                <h3 className={styles.previewTitle}>{l.title || "Untitled Spot"}</h3>
                <div className={styles.previewPrice}>
                  <span className={styles.previewPriceValue}>{price.value}</span>
                  {price.label ? <span className={styles.previewPriceLabel}>{price.label}</span> : null}
                </div>
              </div>

              <div className={styles.previewMeta}>
                <div className={styles.previewMetaRow}>
                  <span className={styles.previewMetaKey}>Location</span>
                  <span className={styles.previewMetaVal}>
                    {(l.city || "—") + ", " + (l.state || "—")}
                  </span>
                </div>

                <div className={styles.previewMetaRow}>
                  <span className={styles.previewMetaKey}>Hookups</span>
                  <span className={styles.previewMetaVal}>{l.hookups || "—"}</span>
                </div>

                <div className={styles.previewMetaRow}>
                  <span className={styles.previewMetaKey}>Max length</span>
                  <span className={styles.previewMetaVal}>
                    {typeof l.maxLengthFt === "number" ? `${l.maxLengthFt} ft` : "—"}
                  </span>
                </div>
              </div>

              <div className={styles.previewCardCta}>View spot →</div>
            </article>
          </Link>
        );
      })}
    </div>
  );
}
