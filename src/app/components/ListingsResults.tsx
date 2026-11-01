"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { hasListingCoordinates } from "@/lib/listing-location";
import useListingRatings from "./useListingRatings";
import { capacity, isAccommodation, listingTypeLabel, sleepingLabel, type ListingType } from "@/lib/listing-types";
import ListingPhoto from "./ListingPhoto";
import ListingRating from "./ListingRating";
import ListingsMapPanel from "./ListingsMapPanel";
import styles from "../listings/listings.module.css";

export type ListingResult = {
  listingType?: ListingType | null;
  accommodation?: Record<string, unknown>;
  id: string;
  title: string;
  city: string;
  state: string;
  hookups: string;
  maxLengthFt: number;
  lat?: number;
  lng?: number;
  displayPriceValue: number | null;
  displayPriceLabel: string;
  photos: string[];
};

export default function ListingsResults({ listings }: { listings: ListingResult[] }) {
  const { ratings: currentRatings, retry: retryRatings } = useListingRatings(listings);
  const [selection, setSelection] = useState<{ id: string; sequence: number }>();
  const mapRef = useRef<HTMLDivElement>(null);

  function viewOnMap(id: string) {
    setSelection(previous => ({ id, sequence: (previous?.sequence ?? 0) + 1 }));
    mapRef.current?.scrollIntoView({ block: "start" });
    mapRef.current?.focus({ preventScroll: true });
  }

  const hasRatingError = Object.values(currentRatings).some(value => value.status === "error");
  const currentSelection = selection && listings.some(listing => listing.id === selection.id && hasListingCoordinates(listing))
    ? selection : undefined;

  return <div className={styles.resultsLayout}>
    <div className={styles.mapCol} ref={mapRef} tabIndex={-1} role="region" aria-label="Listing locations" id="listings-map">
      <ListingsMapPanel listings={listings} selection={currentSelection} />
    </div>
    <div className={styles.cardsCol}>
      <div className={styles.grid}>
        {listings.map(listing => <article key={listing.id} className={styles.card}>
          <Link href={`/listings/${encodeURIComponent(listing.id)}`} className={styles.cardLink}>
            <div className={styles.photoArea}>
              <ListingPhoto photos={listing.photos} className={styles.cardPhoto} fill badgeClassName={styles.photoBadge} fallback={
                <span className={styles.cardFallbackPhoto} aria-hidden="true"><span className={styles.fallbackWordmark}>RVNB</span></span>
              } />
            </div>
            <div className={styles.cardTop}>
              <div className={styles.cardTitle}>{listing.title}</div>
              <div className={styles.price}>
                <span className={styles.priceValue}>{listing.displayPriceValue === null ? "Rate not provided" : `$${listing.displayPriceValue}`}</span>
                <span className={styles.per}>{listing.displayPriceLabel ? `/ ${listing.displayPriceLabel}` : "Billing period not provided"}</span>
              </div>
            </div>
            <div className={styles.cardRating}>
              <ListingRating state={currentRatings[listing.id] ?? { status: "loading" }} />
            </div>
            <div className={styles.cardMeta}>
              <span className={styles.pill}>{listingTypeLabel(listing.listingType)}</span>
              <span className={styles.pill}>{listing.city}, {listing.state}</span>
              {isAccommodation(listing.listingType) ? <>
                <span className={styles.pill}>{capacity(listing) ? `Up to ${capacity(listing)} guests` : "Guest capacity not provided"}</span>
                <span className={styles.pill}>{sleepingLabel(listing)}</span>
              </> : <><span className={styles.pill}>{listing.hookups} hookups</span>
                <span className={styles.pill}>Max {listing.maxLengthFt} ft</span></>}
            </div>
            <div className={styles.cardCta}>View listing →</div>
          </Link>
          <div className={styles.cardActions}>
            {hasListingCoordinates(listing) ? <button type="button" className={styles.viewMapButton}
              aria-label={`View ${listing.title} on map`} aria-controls="listings-map" onClick={() => viewOnMap(listing.id)}>
              View on map
            </button> : <span className={styles.pillMuted}>Location not mapped yet</span>}
          </div>
        </article>)}
      </div>
      {hasRatingError && <div className={styles.ratingError} role="status">
        Some ratings are unavailable. Open a listing for its complete reviews, or retry.
        <button type="button" className={styles.viewMapButton} onClick={retryRatings}>Retry ratings</button>
      </div>}
    </div>
  </div>;
}
