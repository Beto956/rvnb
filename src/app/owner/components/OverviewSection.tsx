"use client";

import { OVERVIEW_DATASETS } from "@/lib/owner-dashboard";
import { useOwnerOverview } from "../use-owner-overview";
import styles from "../owner.module.css";

export default function OverviewSection({ uid }: { uid: string }) {
  const { counts, loading, error, retry } = useOwnerOverview(uid);

  return (
    <section className={styles.section} aria-labelledby="owner-section-overview">
      <div className={styles.sectionHeader}>
        <h2 className={styles.sectionTitle} id="owner-section-overview">Overview</h2>
      </div>
      <p className={styles.sectionHint}>
        Exact stored-record totals from server-side aggregation. No records are downloaded for these counts.
      </p>
      {loading ? (
        <div className={styles.state} role="status">Loading counts…</div>
      ) : error ? (
        <div className={styles.errorBox} role="alert">
          <span>{error}</span>
          <button type="button" className={styles.button} onClick={retry}>Retry</button>
        </div>
      ) : (
        <div className={styles.cardsGrid}>
          {OVERVIEW_DATASETS.map((dataset) => (
            <div className={styles.countCard} key={dataset.id}>
              <p className={styles.countValue}>{counts[dataset.id] ?? "—"}</p>
              <p className={styles.countName}>{dataset.label}</p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
