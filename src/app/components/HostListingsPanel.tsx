"use client";

import Link from "next/link";
import styles from "./hostDashboard.module.css";

export type HostListingCardData = {
  id: string;
  title: string;
  city: string;
  state: string;
  price: number;
  pricingType: "Night" | "Weekly" | "Monthly";
  hasCoords: boolean;
  upcomingBookingCount: number;
  pendingBookingCount: number;
};

type Props = {
  listings: HostListingCardData[];
  loading: boolean;
  error: string;
};

function periodLabel(pricingType: HostListingCardData["pricingType"]) {
  if (pricingType === "Weekly") return "week";
  if (pricingType === "Monthly") return "month";
  return "night";
}

function RvPlaceholderIcon() {
  return (
    <svg
      className={styles.listingImageIcon}
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
  );
}

export default function HostListingsPanel({ listings, loading, error }: Props) {
  return (
    <section className={styles.panel} aria-labelledby="host-listings-title">
      <div className={styles.panelHeader}>
        <div>
          <h2 id="host-listings-title" className={styles.panelTitle}>
            Your listings
          </h2>
          <p className={styles.panelSub}>
            {listings.length} listing{listings.length === 1 ? "" : "s"} · manage,
            update, and optimize your properties.
          </p>
        </div>
        <Link href="/host/listings/new" className={styles.panelLink}>
          + Add new listing
        </Link>
      </div>

      {loading ? (
        <div className={styles.stateBox}>
          <div className={styles.stateTitle}>Loading your listings…</div>
        </div>
      ) : error ? (
        <div className={styles.errorBox}>
          <div className={styles.errorTitle}>Couldn&apos;t load listings</div>
          <div className={styles.errorText}>{error}</div>
        </div>
      ) : (
        <div className={styles.listingsGrid}>
          {listings.map((l) => (
            <article className={styles.listingCard} key={l.id}>
              <div className={styles.listingImage}>
                <span className={styles.listingStatusBadge}>Active</span>
                <RvPlaceholderIcon />
                Photos coming soon
              </div>

              <div className={styles.listingBody}>
                <div className={styles.listingTitle}>{l.title}</div>
                <div className={styles.listingLocation}>
                  {l.city}, {l.state}
                </div>

                <div className={styles.listingMetaRow}>
                  <span className={styles.listingMetaPill}>
                    ${l.price} / {periodLabel(l.pricingType)}
                  </span>
                  <span className={styles.listingMetaPill}>
                    {l.upcomingBookingCount} upcoming
                  </span>
                  {l.pendingBookingCount > 0 && (
                    <span className={styles.listingMetaPill}>
                      {l.pendingBookingCount} pending
                    </span>
                  )}
                  {!l.hasCoords && (
                    <span className={styles.listingMetaPill}>No coords yet</span>
                  )}
                </div>

                <div className={styles.listingActions}>
                  <Link href={`/listings/${l.id}`} className={`${styles.actionBtn} ${styles.actionBtnPrimary}`}>
                    View
                  </Link>
                  <Link href="/host/calendar" className={styles.actionBtn}>
                    Calendar
                  </Link>
                  <button
                    type="button"
                    className={styles.actionBtn}
                    disabled
                    title="Listing editing isn't available yet — coming soon"
                  >
                    Edit
                  </button>
                </div>
              </div>
            </article>
          ))}

          <Link href="/host/listings/new" className={styles.addListingCard}>
            <span className={styles.addListingPlus} aria-hidden="true">
              +
            </span>
            Add new listing
          </Link>
        </div>
      )}

      {!loading && !error && listings.length === 0 && (
        <div className={styles.stateBox}>
          <div className={styles.stateTitle}>You don&apos;t have any listings yet</div>
          <div className={styles.stateText}>
            Create your first listing to start receiving booking requests.
          </div>
        </div>
      )}
    </section>
  );
}
