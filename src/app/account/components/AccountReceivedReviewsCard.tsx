"use client";

import styles from "../account.module.css";
import { directionLabel, type ReviewDirection } from "@/lib/reviews";

export type AccountReceivedReview = {
  id: string;
  rating: number;
  comment: string;
  direction: ReviewDirection;
  dateLabel: string;
  reviewerName: string;
  verified: boolean;
};

type Props = {
  loading: boolean;
  error: string;
  average: number | null;
  count: number;
  recent: AccountReceivedReview[];
};

export default function AccountReceivedReviewsCard({ loading, error, average, count, recent }: Props) {
  if (loading) {
    return (
      <div className={styles.sideCard}>
        <h3 className={styles.sideCardTitle}>Ratings &amp; reviews</h3>
        <p className={styles.smallEmpty}>Loading your reviews...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.sideCard}>
        <h3 className={styles.sideCardTitle}>Ratings &amp; reviews</h3>
        <p className={styles.smallEmpty}>{error}</p>
      </div>
    );
  }

  if (count === 0) {
    return (
      <div className={styles.sideCard}>
        <h3 className={styles.sideCardTitle}>Ratings &amp; reviews</h3>
        <p className={styles.smallEmpty}>No reviews yet</p>
      </div>
    );
  }

  return (
    <div className={styles.sideCard}>
      <h3 className={styles.sideCardTitle}>Ratings &amp; reviews</h3>
      <p className={styles.sideCardSub}>
        ⭐ {average?.toFixed(1)} average · {count} review{count === 1 ? "" : "s"}
      </p>

      <div className={styles.activityList}>
        {recent.map((r) => (
          <div className={styles.activityItem} key={r.id}>
            <div className={styles.activityText}>
              ⭐ {r.rating} · {directionLabel(r.direction)} · {r.reviewerName}
            </div>
            <p className={styles.smallEmpty} style={{ marginTop: 4 }}>
              {r.comment}
            </p>
            <div className={styles.activityDate}>
              {r.verified ? "Verified stay" : ""}{r.verified && r.dateLabel ? " · " : ""}{r.dateLabel}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
