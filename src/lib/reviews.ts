export type ReviewDirection = "traveler_to_host" | "host_to_traveler";

export type ReviewDoc = {
  bookingId: string;
  listingId: string;
  reviewerId: string;
  revieweeId: string;
  direction: ReviewDirection;
  rating: number;
  categoryRatings: Record<string, number>;
  comment: string;
  createdAt?: unknown;
  status: "published";
};

export const REVIEW_COMMENT_MAX_LENGTH = 1000;

export const TRAVELER_TO_HOST_CATEGORIES = ["accuracy", "communication", "location", "overall"] as const;
export const HOST_TO_TRAVELER_CATEGORIES = ["communication", "respect", "cleanliness", "overall"] as const;

export function categoriesForDirection(direction: ReviewDirection): readonly string[] {
  return direction === "traveler_to_host" ? TRAVELER_TO_HOST_CATEGORIES : HOST_TO_TRAVELER_CATEGORIES;
}

export function categoryLabel(key: string): string {
  switch (key) {
    case "accuracy":
      return "Accuracy";
    case "communication":
      return "Communication";
    case "location":
      return "Location";
    case "respect":
      return "Respect for property";
    case "cleanliness":
      return "Cleanliness";
    case "overall":
      return "Overall experience";
    default:
      return key;
  }
}

export function directionLabel(direction: ReviewDirection): string {
  return direction === "traveler_to_host" ? "Traveler review" : "Host review";
}

export function reviewDocId(bookingId: string, reviewerId: string): string {
  return `${bookingId}_${reviewerId}`;
}

export function isValidRatingValue(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 5;
}

export type RatingSummary = { average: number | null; count: number };

/** Never call this with only a partial/paginated page of reviews — see summarizeRatings docs. */
export function summarizeRatings(reviews: { rating: number }[]): RatingSummary {
  if (reviews.length === 0) return { average: null, count: 0 };
  const sum = reviews.reduce((total, r) => total + r.rating, 0);
  return { average: Math.round((sum / reviews.length) * 10) / 10, count: reviews.length };
}
