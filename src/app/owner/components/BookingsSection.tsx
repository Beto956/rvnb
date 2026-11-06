"use client";

import Link from "next/link";
import { formatDateTime, normalizeOwnerBooking } from "@/lib/owner-dashboard";
import { useOwnerSection } from "../use-owner-section";
import SectionShell from "./SectionShell";
import LoadMore from "./LoadMore";
import styles from "../owner.module.css";

function statusBadgeClass(status: string): string {
  if (status === "approved") return styles.badge;
  if (status === "declined") return `${styles.badge} ${styles.badgeMuted}`;
  if (status === "pending" || status === "requested") return `${styles.badge} ${styles.badgeWarn}`;
  return `${styles.badge} ${styles.badgeMuted}`;
}

export default function BookingsSection({ uid }: { uid: string }) {
  const section = useOwnerSection(uid, "bookings", normalizeOwnerBooking);

  return (
    <SectionShell
      title="Booking & stay inquiries"
      hint="All booking and stay inquiries, newest first. These are inquiries between travelers and hosts — not confirmed payments."
      total={section.total}
      shown={section.items.length}
      missingTimestamp={section.missingTimestamp}
      loading={section.loading}
      error={section.error}
      emptyText="No booking inquiries stored yet."
      onRetry={section.retry}
      footer={<LoadMore loadingMore={section.loadingMore} endReached={section.endReached} onLoadMore={section.loadMore} />}
    >
      <ul className={styles.list}>
        {section.items.map((booking) => (
          <li className={styles.row} key={booking.id}>
            <div className={styles.rowMain}>
              <span className={styles.rowTitle}>
                {booking.listingId ? (
                  <Link href={`/listings/${booking.listingId}`} target="_blank" rel="noopener noreferrer">
                    Listing {booking.listingId}
                  </Link>
                ) : (
                  "Listing not linked"
                )}
              </span>
              <span className={statusBadgeClass(booking.status)}>{booking.status}</span>
            </div>
            <div className={styles.rowMeta}>
              {booking.checkIn || "Check-in not set"} → {booking.checkOut || "Check-out not set"} · Guest {booking.guestId || "unknown"} · Host {booking.hostId || "unknown"} · Created {formatDateTime(booking.createdAt)}
            </div>
          </li>
        ))}
      </ul>
    </SectionShell>
  );
}
