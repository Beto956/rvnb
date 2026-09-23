"use client";

import styles from "./hostDashboard.module.css";

export type HostBookingRequestData = {
  id: string;
  listingTitle: string;
  guestLabel: string;
  checkInLabel: string;
  checkOutLabel: string;
  nights: number;
  estimatedTotal: number;
  status: "pending" | "approved" | "declined" | "cancelled" | "other";
  note: string;
};

type Props = {
  bookings: HostBookingRequestData[];
  loading: boolean;
  error: string;
  updatingId: string;
  onApprove: (bookingId: string) => void;
  onDecline: (bookingId: string) => void;
};

function statusChipClass(status: HostBookingRequestData["status"]) {
  if (status === "pending") return styles.statusPending;
  if (status === "approved") return styles.statusApproved;
  if (status === "declined") return styles.statusDeclined;
  if (status === "cancelled") return styles.statusCancelled;
  return styles.statusOther;
}

export default function HostBookingRequestsPanel({
  bookings,
  loading,
  error,
  updatingId,
  onApprove,
  onDecline,
}: Props) {
  const pendingCount = bookings.filter((b) => b.status === "pending").length;

  return (
    <section className={styles.panel} aria-labelledby="host-booking-requests-title">
      <div className={styles.panelHeader}>
        <div>
          <h2 id="host-booking-requests-title" className={styles.panelTitle}>
            Booking requests
          </h2>
          <p className={styles.panelSub}>
            Pending: {pendingCount} · Approved and cancelled requests appear here too.
          </p>
        </div>
      </div>

      {loading ? (
        <div className={styles.stateBox}>
          <div className={styles.stateTitle}>Loading booking requests…</div>
        </div>
      ) : error ? (
        <div className={styles.errorBox}>
          <div className={styles.errorTitle}>Couldn&apos;t load booking requests</div>
          <div className={styles.errorText}>{error}</div>
        </div>
      ) : bookings.length === 0 ? (
        <div className={styles.stateBox}>
          <div className={styles.stateTitle}>No booking requests yet</div>
          <div className={styles.stateText}>
            When guests request bookings, they&apos;ll appear here for your review.
          </div>
        </div>
      ) : (
        <div className={styles.bookingList}>
          {bookings.map((b) => (
            <div className={styles.bookingRow} key={b.id}>
              <div className={styles.bookingTopRow}>
                <div>
                  <div className={styles.bookingGuest}>{b.guestLabel}</div>
                  <div className={styles.bookingListing}>{b.listingTitle}</div>
                  <div className={styles.bookingDates}>
                    {b.checkInLabel} → {b.checkOutLabel} · {b.nights} night
                    {b.nights === 1 ? "" : "s"} · ${b.estimatedTotal}
                  </div>
                </div>

                <span className={`${styles.statusChip} ${statusChipClass(b.status)}`}>
                  {b.status}
                </span>
              </div>

              {b.note && <div className={styles.panelSub}>Guest note: {b.note}</div>}

              {b.status === "pending" ? (
                <div className={styles.bookingActionsRow}>
                  <button
                    type="button"
                    className={styles.approveBtn}
                    onClick={() => onApprove(b.id)}
                    disabled={updatingId === b.id}
                  >
                    {updatingId === b.id ? "Updating…" : "Approve"}
                  </button>
                  <button
                    type="button"
                    className={styles.declineBtn}
                    onClick={() => onDecline(b.id)}
                    disabled={updatingId === b.id}
                  >
                    {updatingId === b.id ? "Updating…" : "Decline"}
                  </button>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
