"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import styles from "../account.module.css";
import type { TripClassification } from "../accountUtils";

export type AccountTrip = {
  id: string;
  listingId: string;
  listingTitle: string;
  destination: string;
  checkInLabel: string;
  checkOutLabel: string;
  nights: number;
  classification: TripClassification;
  reviewed: boolean;
};

type Props = {
  loading: boolean;
  error: string;
  trips: AccountTrip[];
};

const TABS: { key: TripClassification | "cancelledOrDeclined"; label: string }[] = [
  { key: "upcoming", label: "Upcoming" },
  { key: "completed", label: "Completed" },
  { key: "pending", label: "Pending" },
  { key: "cancelledOrDeclined", label: "Cancelled" },
];

function badgeClass(classification: TripClassification): string {
  if (classification === "pending") return styles.tripBadgePending;
  if (classification === "cancelled" || classification === "declined") return styles.tripBadgeCancelled;
  if (classification === "upcoming") return styles.tripBadgeUpcoming;
  return styles.tripBadge;
}

function badgeLabel(classification: TripClassification): string {
  if (classification === "pending") return "Pending";
  if (classification === "declined") return "Declined";
  if (classification === "cancelled") return "Cancelled";
  if (classification === "upcoming") return "Upcoming";
  if (classification === "completed") return "Completed";
  return "Unavailable";
}

export default function AccountTripsPanel({ loading, error, trips }: Props) {
  const [activeTab, setActiveTab] = useState<(typeof TABS)[number]["key"]>("upcoming");

  const filtered = useMemo(() => {
    return trips.filter((t) =>
      activeTab === "cancelledOrDeclined"
        ? t.classification === "cancelled" || t.classification === "declined"
        : t.classification === activeTab
    );
  }, [trips, activeTab]);

  const counts = useMemo(() => {
    const map: Record<string, number> = {};
    TABS.forEach((tab) => {
      map[tab.key] = trips.filter((t) =>
        tab.key === "cancelledOrDeclined"
          ? t.classification === "cancelled" || t.classification === "declined"
          : t.classification === tab.key
      ).length;
    });
    return map;
  }, [trips]);

  return (
    <section className={styles.sectionBlock} aria-label="My trips">
      <div className={styles.sectionHeader}>
        <div>
          <h2 className={styles.sectionTitle}>My Trips</h2>
          <p className={styles.sectionSub}>Your travel-side booking activity appears here.</p>
        </div>

        <Link href="/search" className={styles.sectionLink}>
          Find More Spots
        </Link>
      </div>

      {loading ? (
        <div className={styles.placeholderPanel}>
          <div className={styles.placeholderIcon}>⏳</div>
          <h3 className={styles.placeholderTitle}>Loading trips...</h3>
          <p className={styles.placeholderText}>Pulling your traveler bookings from Firestore.</p>
        </div>
      ) : error ? (
        <div className={styles.placeholderPanel}>
          <div className={styles.placeholderIcon}>⚠️</div>
          <h3 className={styles.placeholderTitle}>Couldn&apos;t load your trips</h3>
          <p className={styles.placeholderText}>{error}</p>
        </div>
      ) : trips.length === 0 ? (
        <div className={styles.placeholderPanel}>
          <div className={styles.placeholderIcon}>🧭</div>
          <h3 className={styles.placeholderTitle}>No trips yet</h3>
          <p className={styles.placeholderText}>
            When you book a stay through RVNB, it will appear here.
          </p>
        </div>
      ) : (
        <>
          <div className={styles.tripTabsRow} role="tablist" aria-label="Filter trips">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                type="button"
                role="tab"
                aria-selected={activeTab === tab.key}
                className={`${styles.tripTab} ${activeTab === tab.key ? styles.tripTabActive : ""}`}
                onClick={() => setActiveTab(tab.key)}
              >
                {tab.label} ({counts[tab.key] ?? 0})
              </button>
            ))}
          </div>

          {filtered.length === 0 ? (
            <div className={styles.placeholderPanel}>
              <div className={styles.placeholderIcon}>🧭</div>
              <h3 className={styles.placeholderTitle}>No {TABS.find((t) => t.key === activeTab)?.label.toLowerCase()} trips</h3>
              <p className={styles.placeholderText}>Nothing to show in this filter yet.</p>
            </div>
          ) : (
            <div className={styles.tripGrid}>
              {filtered.map((trip) => (
                <article key={trip.id} className={styles.tripCard}>
                  <div className={styles.placeholderMedia}>
                    <span className={styles.placeholderMediaIcon} aria-hidden="true">
                      🏞️
                    </span>
                    Trip photo unavailable
                  </div>
                  <div className={styles.tripBody}>
                    <div className={styles.tripTopRow}>
                      <h3 className={styles.itemTitle}>{trip.listingTitle}</h3>
                      <span className={`${styles.tripBadge} ${badgeClass(trip.classification)}`}>
                        {badgeLabel(trip.classification)}
                      </span>
                    </div>
                    <p className={styles.itemMeta}>{trip.destination}</p>
                    <p className={styles.itemText}>
                      {trip.checkInLabel} → {trip.checkOutLabel}
                      {trip.nights > 0 ? ` · ${trip.nights} night${trip.nights === 1 ? "" : "s"}` : ""}
                    </p>

                    <div className={styles.itemActions}>
                      <Link href={`/listings/${trip.listingId}`} className={styles.itemActionBtn}>
                        View listing
                      </Link>
                    </div>

                    {trip.classification === "completed" && (
                      <div className={styles.reviewNotice}>
                        {trip.reviewed ? (
                          "Review submitted"
                        ) : (
                          <Link href={`/reviews/new?bookingId=${trip.id}`} className={styles.itemActionBtn}>
                            Leave a review
                          </Link>
                        )}
                      </div>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
}
