"use client";

import Link from "next/link";
import styles from "../account.module.css";

export type HostedReviewOpportunity = {
  bookingId: string;
  listingTitle: string;
  guestLabel: string;
  checkOutLabel: string;
};

type Props = {
  loading: boolean;
  opportunities: HostedReviewOpportunity[];
};

export default function AccountReviewsToWritePanel({ loading, opportunities }: Props) {
  if (loading || opportunities.length === 0) return null;

  return (
    <section className={styles.sectionBlock} aria-label="Reviews to write">
      <div className={styles.sectionHeader}>
        <div>
          <h2 className={styles.sectionTitle}>Reviews to write</h2>
          <p className={styles.sectionSub}>Completed stays at your listings you haven&apos;t reviewed yet.</p>
        </div>
      </div>

      <div className={styles.tripGrid}>
        {opportunities.map((o) => (
          <article key={o.bookingId} className={styles.tripCard}>
            <div className={styles.placeholderMedia}>
              <span className={styles.placeholderMediaIcon} aria-hidden="true">
                🧭
              </span>
              Completed stay
            </div>
            <div className={styles.tripBody}>
              <h3 className={styles.itemTitle}>{o.listingTitle}</h3>
              <p className={styles.itemMeta}>Guest: {o.guestLabel}</p>
              <p className={styles.itemText}>Checked out {o.checkOutLabel}</p>

              <div className={styles.itemActions}>
                <Link href={`/reviews/new?bookingId=${o.bookingId}`} className={styles.itemActionBtn}>
                  Leave a review
                </Link>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
