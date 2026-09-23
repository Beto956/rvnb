"use client";

import Link from "next/link";
import styles from "./hostDashboard.module.css";

export default function HostOpportunityCard() {
  return (
    <section className={styles.opportunityCard} aria-labelledby="host-opportunity-title">
      <div className={styles.opportunityImage}>
        <svg
          className={styles.opportunityIcon}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.6}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M3 16V9a1 1 0 0 1 1-1h9l4 3h2a1 1 0 0 1 1 1v4" />
          <path d="M3 16h16" />
          <circle cx="7" cy="18" r="1.6" />
          <circle cx="17" cy="18" r="1.6" />
        </svg>
      </div>
      <div className={styles.opportunityBody}>
        <p className={styles.opportunityEyebrow}>Suggestion</p>
        <h2 id="host-opportunity-title" className={styles.opportunityTitle}>
          List more. Earn more.
        </h2>
        <p className={styles.opportunityText}>
          Reach more RV travelers by reviewing new hosting opportunities, landowner
          leads, and seasonal demand insights curated by the RVNB team.
        </p>
        <div style={{ marginTop: 14 }}>
          <Link href="/host/opportunities" className={styles.btnPrimary}>
            Explore opportunities →
          </Link>
        </div>
      </div>
    </section>
  );
}
