"use client";

import { forwardRef } from "react";
import Link from "next/link";
import styles from "./hostDashboard.module.css";
import type { DaySummary, DayListingStatus } from "./hostDashboardUtils";

type Props = {
  dateISO: string;
  dateLabel: string;
  summary: DaySummary | null;
  loading: boolean;
  errorMessage?: string;
  align: "left" | "right";
  titleId: string;
  onClose: () => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
};

function signalLabel(signal: string): string {
  switch (signal) {
    case "high":
      return "High demand";
    case "maintenance":
      return "Maintenance";
    case "private":
      return "Private use";
    case "flex":
      return "Flexible";
    default:
      return signal;
  }
}

function statusLabel(status: DayListingStatus): string {
  if (status === "booked") return "Booked";
  if (status === "pending") return "Pending request";
  if (status === "blocked") return "Blocked";
  return "Available";
}

function statusChipClass(status: DayListingStatus): string {
  if (status === "booked") return styles.dayStatusChipBooked;
  if (status === "pending") return styles.dayStatusChipPending;
  if (status === "blocked") return styles.dayStatusChipBlocked;
  return styles.dayStatusChipAvailable;
}

const HostCalendarDayPopover = forwardRef<HTMLDivElement, Props>(function HostCalendarDayPopover(
  {
    dateISO,
    dateLabel,
    summary,
    loading,
    errorMessage,
    align,
    titleId,
    onClose,
    onMouseEnter,
    onMouseLeave,
  },
  ref
) {
  return (
    <div
      ref={ref}
      role="dialog"
      aria-modal="false"
      aria-labelledby={titleId}
      className={`${styles.dayPopover} ${align === "right" ? styles.dayPopoverRight : ""}`}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <div className={styles.dayPopoverHeader}>
        <span id={titleId} className={styles.dayPopoverDate}>
          {dateLabel}
        </span>
        <button
          type="button"
          className={styles.dayPopoverClose}
          onClick={onClose}
          aria-label="Close date details"
        >
          ✕
        </button>
      </div>

      {loading ? (
        <div className={styles.dayPopoverStateText}>Loading availability…</div>
      ) : errorMessage ? (
        <div className={styles.dayPopoverStateText}>{errorMessage}</div>
      ) : !summary || summary.totalListings === 0 ? (
        <div className={styles.dayPopoverStateText}>
          Add a listing to see availability for this date.
        </div>
      ) : (
        <>
          <div className={styles.dayPopoverSummaryLine}>
            {summary.availableCount} of {summary.totalListings} listing
            {summary.totalListings === 1 ? "" : "s"} available
          </div>

          <div className={styles.dayPopoverChipRow}>
            <span className={styles.dayPopoverChip}>{summary.bookedCount} booked</span>
            <span className={styles.dayPopoverChip}>{summary.blockedCount} blocked</span>
            {summary.pendingCount > 0 && (
              <span className={styles.dayPopoverChip}>{summary.pendingCount} pending</span>
            )}
          </div>

          {summary.signals.length > 0 && (
            <div className={styles.dayPopoverSignalRow}>
              {summary.signals.map((s) => (
                <span key={s} className={styles.dayPopoverSignalChip}>
                  ⚑ {signalLabel(s)}
                </span>
              ))}
            </div>
          )}

          <ul className={styles.dayPopoverListingList}>
            {summary.listings.map((l) => (
              <li key={l.listingId} className={styles.dayPopoverListingRow}>
                <span className={styles.dayPopoverListingTitle}>{l.title}</span>
                <span className={`${styles.dayStatusChip} ${statusChipClass(l.status)}`}>
                  {statusLabel(l.status)}
                </span>
                <Link
                  href={`/host/calendar?date=${encodeURIComponent(dateISO)}&listingId=${encodeURIComponent(
                    l.listingId
                  )}`}
                  className={styles.dayPopoverManageLink}
                  aria-label={`Manage ${l.title} on ${dateLabel}`}
                >
                  Manage
                </Link>
                {l.status === "booked" && l.guestLabel && (
                  <span className={styles.dayPopoverListingMeta}>{l.guestLabel}</span>
                )}
                {l.status === "blocked" && l.blockReason && (
                  <span className={styles.dayPopoverListingMeta}>{l.blockReason}</span>
                )}
                {l.note && <span className={styles.dayPopoverListingMeta}>📝 {l.note}</span>}
              </li>
            ))}
          </ul>
        </>
      )}

      <Link
        href={`/host/calendar?date=${encodeURIComponent(dateISO)}`}
        className={styles.dayPopoverManageBtn}
        aria-label={`Open full calendar for ${dateLabel}`}
      >
        Open full calendar →
      </Link>
    </div>
  );
});

export default HostCalendarDayPopover;
