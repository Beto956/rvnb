import type { ListingRatingState } from "@/lib/listing-ratings";
import styles from "./listingRating.module.css";

export default function ListingRating({ state }: { state: ListingRatingState }) {
  if (state.status === "loading") return <span className={styles.quiet} role="status">Loading reviews...</span>;
  if (state.status === "error") return <span className={styles.quiet} title={state.message}>Ratings unavailable</span>;
  const { average, count } = state.summary;
  if (count === 0) return <span className={styles.quiet}>No reviews yet</span>;
  if (average === null) return <span className={styles.quiet}>Ratings unavailable</span>;
  const label = `${average.toFixed(1)} out of 5 from ${count} ${count === 1 ? "review" : "reviews"}`;
  return <span className={styles.rating} role="img" aria-label={label}>
    <span className={styles.stars} aria-hidden="true">
      <span className={styles.starBase}>★★★★★</span>
      <span className={styles.starFill} style={{ width: `${Math.max(0, Math.min(5, average)) / 5 * 100}%` }}>★★★★★</span>
    </span>
    <span aria-hidden="true">{average.toFixed(1)} <span className={styles.quiet}>({count} {count === 1 ? "review" : "reviews"})</span></span>
  </span>;
}
