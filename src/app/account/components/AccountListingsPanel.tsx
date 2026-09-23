"use client";

import Link from "next/link";
import styles from "../account.module.css";

export type AccountListing = {
  id: string;
  title: string;
  city: string;
  state: string;
  priceLabel: string;
  description: string;
};

type Props = {
  loading: boolean;
  error: string;
  listings: AccountListing[];
};

export default function AccountListingsPanel({ loading, error, listings }: Props) {
  return (
    <section className={styles.sectionBlock} aria-label="My listings">
      <div className={styles.sectionHeader}>
        <div>
          <h2 className={styles.sectionTitle}>My Listings</h2>
          <p className={styles.sectionSub}>The RV spaces connected to your host profile.</p>
        </div>

        <Link href="/host" className={styles.sectionLink}>
          Manage Listings
        </Link>
      </div>

      {loading ? (
        <div className={styles.placeholderPanel}>
          <div className={styles.placeholderIcon}>⏳</div>
          <h3 className={styles.placeholderTitle}>Loading listings...</h3>
          <p className={styles.placeholderText}>Pulling your hosted RV spots from Firestore.</p>
        </div>
      ) : error ? (
        <div className={styles.placeholderPanel}>
          <div className={styles.placeholderIcon}>⚠️</div>
          <h3 className={styles.placeholderTitle}>Couldn&apos;t load your listings</h3>
          <p className={styles.placeholderText}>{error}</p>
        </div>
      ) : listings.length === 0 ? (
        <div className={styles.placeholderPanel}>
          <div className={styles.placeholderIcon}>🏕</div>
          <h3 className={styles.placeholderTitle}>No listings yet</h3>
          <p className={styles.placeholderText}>
            When you create hosted RV spots, they&apos;ll appear here.
          </p>
        </div>
      ) : (
        <div className={styles.cardGrid}>
          {listings.slice(0, 3).map((listing) => (
            <article key={listing.id} className={styles.itemCard}>
              <div className={styles.placeholderMedia}>
                <span className={styles.statusPillActive} style={{ alignSelf: "flex-start", margin: "10px" }}>
                  Active
                </span>
                <span className={styles.placeholderMediaIcon} aria-hidden="true">
                  🚐
                </span>
                Photos coming soon
              </div>
              <div className={styles.itemBody}>
                <div className={styles.itemTopRow}>
                  <h3 className={styles.itemTitle}>{listing.title}</h3>
                  <span className={styles.itemPrice}>{listing.priceLabel}</span>
                </div>
                <p className={styles.itemMeta}>
                  {[listing.city, listing.state].filter(Boolean).join(", ") || "Location not set"}
                </p>
                <p className={styles.itemText}>
                  {listing.description ||
                    "This hosted RV space is connected to your profile and ready to be managed from your dashboard."}
                </p>

                <div className={styles.itemActions}>
                  <Link href={`/listings/${listing.id}`} className={styles.itemActionBtn}>
                    View listing
                  </Link>
                  <Link href="/host" className={styles.itemActionBtn}>
                    Manage
                  </Link>
                  <Link href="/host/calendar" className={styles.itemActionBtn}>
                    Calendar
                  </Link>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
