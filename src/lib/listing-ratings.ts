import { collection, getDocsFromServer, limit, query, where, type Firestore } from "firebase/firestore";
import { isValidRatingValue, summarizeRatings, type RatingSummary } from "./reviews";

export const RATING_BATCH_SIZE = 30;
export const RATING_REVIEW_CAP = 500;
export type ListingRatingState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; summary: RatingSummary };

export function publishedListingReviews(db: Firestore, listingId: string) {
  return query(collection(db, "reviews"), where("listingId", "==", listingId),
    where("direction", "==", "traveler_to_host"), where("status", "==", "published"));
}

export function summarizeListingReviewBatch(
  ids: string[], reviews: Record<string, unknown>[], overflow: boolean,
): Record<string, ListingRatingState> {
  if (overflow) return Object.fromEntries(ids.map(id => [id,
    { status: "error", message: "Ratings unavailable for this group. Open a listing for its complete reviews." }]));
  const result: Record<string, ListingRatingState> = {};
  for (const id of ids) {
    const eligible = reviews.filter(review => review.listingId === id &&
      review.direction === "traveler_to_host" && review.status === "published");
    result[id] = eligible.some(review => !isValidRatingValue(review.rating))
      ? { status: "error", message: "Ratings unavailable: a published rating is invalid." }
      : { status: "ready", summary: summarizeRatings(eligible.map(review => ({ rating: Number(review.rating) }))) };
  }
  return result;
}

/** At most 30 listing IDs, 501 documents, and no collection-wide scan. */
export async function loadListingRatingBatch(db: Firestore, ids: string[]): Promise<Record<string, ListingRatingState>> {
  if (!ids.length || ids.length > RATING_BATCH_SIZE) throw new Error("Rating batches require 1 to 30 listing IDs.");
  const snap = await getDocsFromServer(query(collection(db, "reviews"),
    where("listingId", "in", ids), where("direction", "==", "traveler_to_host"),
    where("status", "==", "published"), limit(RATING_REVIEW_CAP + 1)));
  if (snap.size > RATING_REVIEW_CAP) console.warn("[RVNB] Card rating batch exceeded its review limit; complete ratings require rollups.", ids);
  return summarizeListingReviewBatch(ids, snap.docs.map(doc => doc.data()), snap.size > RATING_REVIEW_CAP);
}
