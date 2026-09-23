"use client";

import styles from "../account.module.css";

type Props = {
  loading: boolean;
  listingsCount: number;
  tripsTakenCount: number;
  bookingsHostedCount: number;
  reviewsLoading: boolean;
  reviewsError: string;
  reviewsAverage: number | null;
  reviewsCount: number;
};

export default function AccountStatsRow({
  loading,
  listingsCount,
  tripsTakenCount,
  bookingsHostedCount,
  reviewsLoading,
  reviewsError,
  reviewsAverage,
  reviewsCount,
}: Props) {
  const stats = [
    { icon: "🅿", label: "Listings", sub: "Your hosted RV spots", value: listingsCount },
    { icon: "🧭", label: "Trips Taken", sub: "Completed stays you've taken", value: tripsTakenCount },
    { icon: "🏕", label: "Bookings Hosted", sub: "Completed stays at your spots", value: bookingsHostedCount },
  ];

  return (
    <div className={styles.statsGrid}>
      {stats.map((s) => (
        <div className={styles.statCard} key={s.label}>
          <div className={styles.statTop}>
            <span className={styles.statIcon}>{s.icon}</span>
            <span className={styles.statValue}>{loading ? "--" : s.value}</span>
          </div>
          <div className={styles.statLabel}>{s.label}</div>
          <div className={styles.statSub}>{s.sub}</div>
        </div>
      ))}

      <div className={styles.statCard}>
        <div className={styles.statTop}>
          <span className={styles.statIcon}>⭐</span>
          <span className={styles.statValue}>
            {reviewsLoading || reviewsError || reviewsAverage === null ? "--" : reviewsAverage.toFixed(1)}
          </span>
        </div>
        <div className={styles.statLabel}>Member rating</div>
        <div className={styles.statSub}>
          {reviewsError
            ? "Rating unavailable"
            : reviewsLoading
              ? "Loading rating..."
              : reviewsCount === 0
                ? "No reviews yet"
                : `${reviewsCount} received review${reviewsCount === 1 ? "" : "s"}; host and traveler feedback`}
        </div>
      </div>
    </div>
  );
}
