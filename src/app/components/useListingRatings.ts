"use client";
import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { loadListingRatingBatch, RATING_BATCH_SIZE, type ListingRatingState } from "@/lib/listing-ratings";

export default function useListingRatings(listings: { id: string }[]) {
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{ source: typeof listings; attempt: number; values: Record<string, ListingRatingState> }>();
  useEffect(() => {
    let active = true, next = 0;
    const ids = [...new Set(listings.map(listing => listing.id))];
    function update(values: Record<string, ListingRatingState>) {
      if (active) setResult(previous => ({
        source: listings, attempt, values: { ...(previous?.source === listings && previous.attempt === attempt ? previous.values : {}), ...values },
      }));
    }
    async function worker() {
      while (active && next < ids.length) {
        const batch = ids.slice(next, next + RATING_BATCH_SIZE);
        next += RATING_BATCH_SIZE;
        try { update(await loadListingRatingBatch(db, batch)); }
        catch (error) {
          console.error("[RVNB] listing card ratings query failed", error);
          update(Object.fromEntries(batch.map(id => [id, { status: "error", message: "Reviews could not be loaded. Retry below." } satisfies ListingRatingState])));
        }
      }
    }
    void worker(); void worker();
    return () => { active = false; };
  }, [listings, attempt]);
  return {
    ratings: result?.source === listings && result.attempt === attempt ? result.values : {},
    retry: () => setAttempt(value => value + 1),
  };
}
