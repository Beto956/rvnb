"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import styles from "./hostDashboard.module.css";
import HostCalendarDayPopover from "./HostCalendarDayPopover";
import {
  HostAnalyticsBooking,
  HostAnalyticsListing,
  DayMetaLite,
  DaySummary,
  MAX_RANGE_DAYS,
  buildBookingsByDayAndListing,
  clampRangeEnd,
  computeDaySummary,
  enumerateDatesInclusive,
  getUpcomingBookings,
  normalizeDateRange,
  parseYmd,
  summarizeRangeByListing,
} from "./hostDashboardUtils";

type Props = {
  listings: HostAnalyticsListing[];
  bookings: HostAnalyticsBooking[];
  hostId: string;
  listingsLoading: boolean;
  listingsError: string;
  bookingsLoading: boolean;
  bookingsError: string;
};

type Cell = {
  key: string;
  date: Date;
  dateISO: string;
  inMonth: boolean;
};

function toYmdLocal(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatDateLabel(value: string) {
  const d = parseYmd(value);
  if (!d) return value;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function formatFullDateLabel(value: string) {
  const d = parseYmd(value);
  if (!d) return value;
  return d.toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" });
}

function tileStatusClass(summary: DaySummary | undefined): string {
  if (!summary) return "";
  if (summary.overallStatus === "blocked") return styles.dayBlocked;
  if (summary.overallStatus === "booked") return styles.dayBooked;
  if (summary.overallStatus === "unavailable") return styles.dayUnavailable;
  if (summary.overallStatus === "partial") return styles.dayPartial;
  return "";
}

function badgeFor(summary: DaySummary | undefined): { text: string; className: string } | null {
  if (!summary || summary.totalListings === 0) return null;

  if (summary.overallStatus === "blocked") return { text: "Blocked", className: styles.badgeBlocked };
  if (summary.overallStatus === "booked") return { text: "Booked", className: "" };
  if (summary.overallStatus === "unavailable") {
    return { text: "Unavailable", className: styles.badgeUnavailable };
  }
  if (summary.overallStatus === "partial") {
    return {
      text: `${summary.availableCount}/${summary.totalListings} available`,
      className: styles.badgePartial,
    };
  }
  return null;
}

function buildAriaLabel(
  dateLabel: string,
  summary: DaySummary | undefined,
  rangeHint: string
): string {
  if (!summary || summary.totalListings === 0) {
    return `${dateLabel}. No listings yet.${rangeHint}`;
  }

  const parts = [
    `${dateLabel}`,
    `${summary.availableCount} of ${summary.totalListings} listings available`,
    `${summary.bookedCount} booked`,
    `${summary.blockedCount} blocked`,
  ];

  if (summary.pendingCount > 0) {
    parts.push(`${summary.pendingCount} pending request${summary.pendingCount === 1 ? "" : "s"}`);
  }

  return `${parts.join(". ")}.${rangeHint}`;
}

export default function HostBookingCalendar({
  listings,
  bookings,
  hostId,
  listingsLoading,
  listingsError,
  bookingsLoading,
  bookingsError,
}: Props) {
  const [cursor, setCursor] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  const [dayMetaByDate, setDayMetaByDate] = useState<Map<string, Map<string, DayMetaLite>>>(
    new Map()
  );
  const [dayMetaError, setDayMetaError] = useState("");

  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [hoverDate, setHoverDate] = useState<string | null>(null);

  // Date-range selection mode (separate from the normal single-day popover above).
  const [rangeMode, setRangeMode] = useState(false);
  const [rangeStart, setRangeStart] = useState<string | null>(null);
  const [rangeEnd, setRangeEnd] = useState<string | null>(null);
  const [rangeHoverDate, setRangeHoverDate] = useState<string | null>(null);
  const [rangeMessage, setRangeMessage] = useState("");
  const [rangeListingId, setRangeListingId] = useState<string>("");
  const rangeToggleRef = useRef<HTMLButtonElement>(null);

  const gridRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const dayButtonRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const leaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const canHoverRef = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    canHoverRef.current = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  }, []);

  // Reset any open single-day popover when the visible month changes (range selections
  // are preserved across month navigation, per spec).
  useEffect(() => {
    setSelectedDate(null);
    setHoverDate(null);
  }, [cursor]);

  const year = cursor.getFullYear();
  const month = cursor.getMonth();

  async function fetchDayMetaRange(startISO: string, endISO: string) {
    if (!hostId || listings.length === 0) return;

    const next = new Map<string, Map<string, DayMetaLite>>();
    let anyListingFailed = false;

    function applyDayMetaDoc(data: {
      listingId?: string;
      date?: string;
      blocked?: boolean;
      blockReason?: string;
      signal?: string;
      note?: string;
    }) {
      if (!data.date || !data.listingId) return;
      if (data.date < startISO || data.date > endISO) return;

      let inner = next.get(data.date);
      if (!inner) {
        inner = new Map();
        next.set(data.date, inner);
      }

      inner.set(data.listingId, {
        blocked: data.blocked,
        blockReason: data.blockReason,
        signal: data.signal,
        note: data.note,
      });
    }

    await Promise.allSettled(
      listings.map(async (listing) => {
        try {
          const qy = query(
            collection(db, "dayMeta"),
            where("listingId", "==", listing.id),
            where("hostId", "==", hostId),
            where("date", ">=", startISO),
            where("date", "<=", endISO)
          );
          const snap = await getDocs(qy);
          snap.docs.forEach((d) => applyDayMetaDoc(d.data()));
        } catch (e) {
          const code = (e as { code?: string })?.code ?? "unknown";
          console.error(`[RVNB] dayMeta query failed for listing ${listing.id} (code: ${code})`, e);

          try {
            const qyFallback = query(
              collection(db, "dayMeta"),
              where("listingId", "==", listing.id),
              where("hostId", "==", hostId)
            );
            const snapFallback = await getDocs(qyFallback);
            snapFallback.docs.forEach((d) => applyDayMetaDoc(d.data()));
          } catch (e2) {
            const code2 = (e2 as { code?: string })?.code ?? "unknown";
            console.error(
              `[RVNB] dayMeta fallback query also failed for listing ${listing.id} (code: ${code2})`,
              e2
            );
            anyListingFailed = true;
          }
        }
      })
    );

    setDayMetaByDate((prev) => {
      const merged = new Map(prev);
      next.forEach((inner, date) => merged.set(date, inner));
      return merged;
    });

    if (anyListingFailed) {
      setDayMetaError("Blocked-day and note details couldn't be loaded for one or more listings.");
    }
  }

  // Load blocked days / notes / signals for the visible month only (reused per-listing
  // query shape from /host/calendar, not a competing data model).
  useEffect(() => {
    let active = true;

    async function run() {
      if (!hostId || listings.length === 0) {
        setDayMetaByDate(new Map());
        setDayMetaError("");
        return;
      }

      setDayMetaError("");
      const startISO = toYmdLocal(new Date(year, month, 1));
      const endISO = toYmdLocal(new Date(year, month + 1, 0));
      await fetchDayMetaRange(startISO, endISO);
      if (!active) return;
    }

    run();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hostId, listings, year, month]);

  // On-demand fetch once a range is committed, in case it extends beyond the visible month.
  useEffect(() => {
    if (!rangeStart || !rangeEnd) return;
    fetchDayMetaRange(rangeStart, rangeEnd);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rangeStart, rangeEnd]);

  const bookingsByDayListing = useMemo(() => buildBookingsByDayAndListing(bookings), [bookings]);
  const upcoming = useMemo(() => getUpcomingBookings(bookings).slice(0, 8), [bookings]);
  const monthLabel = cursor.toLocaleDateString(undefined, { month: "long", year: "numeric" });

  const cells = useMemo<Cell[]>(() => {
    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0);
    const firstWeekday = firstDayOfMonth.getDay();
    const daysInMonth = lastDayOfMonth.getDate();

    const out: Cell[] = [];

    for (let i = 0; i < firstWeekday; i++) {
      const d = new Date(year, month, 1 - (firstWeekday - i));
      out.push({ key: `prev-${toYmdLocal(d)}`, date: d, dateISO: toYmdLocal(d), inMonth: false });
    }
    for (let day = 1; day <= daysInMonth; day++) {
      const d = new Date(year, month, day);
      out.push({ key: `cur-${toYmdLocal(d)}`, date: d, dateISO: toYmdLocal(d), inMonth: true });
    }
    while (out.length % 7 !== 0) {
      const nextIndex = out.length - (firstWeekday + daysInMonth) + 1;
      const d = new Date(year, month + 1, nextIndex);
      out.push({ key: `next-${toYmdLocal(d)}`, date: d, dateISO: toYmdLocal(d), inMonth: false });
    }
    return out;
  }, [year, month]);

  function summaryFor(dateISO: string): DaySummary {
    return computeDaySummary(
      dateISO,
      listings,
      bookingsByDayListing.get(dateISO),
      dayMetaByDate.get(dateISO)
    );
  }

  const daySummaries = useMemo(() => {
    const map = new Map<string, DaySummary>();
    cells.forEach((cell) => map.set(cell.dateISO, summaryFor(cell.dateISO)));
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cells, listings, bookingsByDayListing, dayMetaByDate]);

  const todayISO = useMemo(() => toYmdLocal(new Date()), []);

  const coreDataLoading = listingsLoading || bookingsLoading;
  const coreDataError = listingsError || bookingsError;

  const openDateISO = selectedDate ?? hoverDate;
  const openCellIndex = cells.findIndex((c) => c.dateISO === openDateISO);
  const openColumn = openCellIndex === -1 ? 0 : openCellIndex % 7;
  const align: "left" | "right" = openColumn >= 4 ? "right" : "left";

  // ---------- Normal-mode (single day) interactions ----------

  function clearHoverTimers() {
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
    if (leaveTimerRef.current) {
      clearTimeout(leaveTimerRef.current);
      leaveTimerRef.current = null;
    }
  }

  function handleTileMouseEnter(dateISO: string) {
    if (!canHoverRef.current || selectedDate) return;
    if (leaveTimerRef.current) {
      clearTimeout(leaveTimerRef.current);
      leaveTimerRef.current = null;
    }
    hoverTimerRef.current = setTimeout(() => setHoverDate(dateISO), 350);
  }

  function handleTileMouseLeave() {
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
    leaveTimerRef.current = setTimeout(() => setHoverDate(null), 150);
  }

  function handlePopoverMouseEnter() {
    if (leaveTimerRef.current) {
      clearTimeout(leaveTimerRef.current);
      leaveTimerRef.current = null;
    }
  }

  function handlePopoverMouseLeave() {
    if (!selectedDate) {
      leaveTimerRef.current = setTimeout(() => setHoverDate(null), 150);
    }
  }

  function closePopover(returnFocus: boolean) {
    const focusTarget = selectedDate;
    setSelectedDate(null);
    setHoverDate(null);
    if (returnFocus && focusTarget) {
      dayButtonRefs.current.get(focusTarget)?.focus();
    }
  }

  // ---------- Range-mode interactions ----------

  function toggleRangeMode() {
    setRangeMode((prev) => {
      const next = !prev;
      if (!next) {
        setRangeStart(null);
        setRangeEnd(null);
        setRangeHoverDate(null);
        setRangeMessage("");
      } else {
        setSelectedDate(null);
        setHoverDate(null);
      }
      return next;
    });
  }

  function clearRangeSelection() {
    setRangeStart(null);
    setRangeEnd(null);
    setRangeHoverDate(null);
    setRangeMessage("");
  }

  function handleRangeTileClick(dateISO: string) {
    if (!rangeStart || rangeEnd) {
      // Starting a fresh range (either the very first click, or starting over after completion).
      setRangeStart(dateISO);
      setRangeEnd(null);
      setRangeHoverDate(null);
      setRangeMessage("");
      return;
    }

    const { start, end } = normalizeDateRange(rangeStart, dateISO);
    const clampResult = clampRangeEnd(start, end);
    setRangeStart(start);
    setRangeEnd(clampResult.end);
    setRangeHoverDate(null);
    setRangeMessage(
      clampResult.clamped ? `Range limited to ${MAX_RANGE_DAYS} days.` : ""
    );
  }

  function handleTileClick(dateISO: string, inMonth: boolean) {
    if (!inMonth) return;

    if (rangeMode) {
      handleRangeTileClick(dateISO);
      return;
    }

    clearHoverTimers();
    setHoverDate(null);
    setSelectedDate((cur) => (cur === dateISO ? null : dateISO));
  }

  // Outside click closes the pinned popover (clicking another tile is handled by its own onClick).
  useEffect(() => {
    if (!selectedDate) return;

    function handlePointerDown(event: MouseEvent | TouchEvent) {
      const target = event.target as Node;
      if (gridRef.current && !gridRef.current.contains(target)) {
        closePopover(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") closePopover(true);
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate]);

  // Escape cancels the in-progress or completed range selection while range mode is on.
  useEffect(() => {
    if (!rangeMode) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && (rangeStart || rangeEnd)) {
        clearRangeSelection();
        rangeToggleRef.current?.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [rangeMode, rangeStart, rangeEnd]);

  useEffect(() => {
    return () => clearHoverTimers();
  }, []);

  const openSummary = openDateISO ? daySummaries.get(openDateISO) : undefined;

  // ---------- Range summary ----------

  const committedRangeDates = useMemo(() => {
    if (!rangeStart || !rangeEnd) return [];
    return enumerateDatesInclusive(rangeStart, rangeEnd);
  }, [rangeStart, rangeEnd]);

  const tentativeRangeDates = useMemo(() => {
    if (!rangeStart || rangeEnd || !rangeHoverDate) return [];
    return enumerateDatesInclusive(rangeStart, rangeHoverDate);
  }, [rangeStart, rangeEnd, rangeHoverDate]);

  const rangeSummaries = useMemo(() => {
    if (committedRangeDates.length === 0) return [];
    return committedRangeDates.map((d) => summaryFor(d));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [committedRangeDates, listings, bookingsByDayListing, dayMetaByDate]);

  const rangeListingSummaries = useMemo(
    () => summarizeRangeByListing(listings, rangeSummaries),
    [listings, rangeSummaries]
  );

  useEffect(() => {
    if (rangeListingSummaries.length === 0) return;
    if (rangeListingSummaries.some((r) => r.listingId === rangeListingId)) return;
    const fullyAvailable = rangeListingSummaries.find((r) => r.fullyAvailable);
    setRangeListingId((fullyAvailable ?? rangeListingSummaries[0]).listingId);
  }, [rangeListingSummaries, rangeListingId]);

  const rangeNights = committedRangeDates.length > 0 ? committedRangeDates.length - 1 : 0;
  const fullyAvailableCount = rangeListingSummaries.filter((r) => r.fullyAvailable).length;

  const manageHref =
    rangeStart && rangeEnd && rangeListingId
      ? `/host/calendar?listingId=${encodeURIComponent(rangeListingId)}&start=${encodeURIComponent(
          rangeStart
        )}&end=${encodeURIComponent(rangeEnd)}`
      : "/host/calendar";

  const rangeGuidance = !rangeMode
    ? ""
    : !rangeStart
    ? "Choose a starting date."
    : !rangeEnd
    ? "Now choose an ending date."
    : "";

  return (
    <div className={styles.panel}>
      <div className={styles.panelHeader}>
        <div>
          <h2 className={styles.panelTitle}>Booking calendar</h2>
          <div className={styles.panelSub}>{monthLabel}</div>
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <button type="button" className={styles.btn} onClick={() => setCursor(new Date(year, month - 1, 1))} aria-label="Previous month">
            ←
          </button>
          <button
            type="button"
            className={styles.btn}
            onClick={() => {
              const now = new Date();
              setCursor(new Date(now.getFullYear(), now.getMonth(), 1));
            }}
          >
            Today
          </button>
          <button type="button" className={styles.btn} onClick={() => setCursor(new Date(year, month + 1, 1))} aria-label="Next month">
            →
          </button>

          <button
            type="button"
            ref={rangeToggleRef}
            className={`${styles.btn} ${rangeMode ? styles.btnActive : ""}`}
            aria-pressed={rangeMode}
            onClick={toggleRangeMode}
          >
            📅 Select date range
          </button>

          <Link href="/host/calendar" className={styles.panelLink}>
            Open full calendar →
          </Link>
        </div>
      </div>

      <div aria-live="polite" className={styles.srOnly}>
        {rangeMode && rangeGuidance}
        {rangeMode && rangeStart && rangeEnd && "Date range selected."}
      </div>

      {coreDataError ? (
        <div className={styles.errorBox} style={{ marginTop: 12 }}>
          <div className={styles.errorTitle}>Availability unavailable</div>
          <div className={styles.errorText}>
            Calendar data could not be loaded, so day-by-day availability can&apos;t be shown right now.
          </div>
        </div>
      ) : rangeMode ? (
        <div className={styles.rangeGuidanceBar}>
          {rangeGuidance || "Click another date to start a new range, or Clear selection below."}
          {rangeMessage && <span className={styles.rangeGuidanceWarning}> {rangeMessage}</span>}
        </div>
      ) : (
        <div className={styles.legendRow}>
          <span className={styles.legendItem}>
            <span className={styles.legendDot} style={{ background: "rgba(255,255,255,0.14)" }} aria-hidden="true" />
            Available
          </span>
          <span className={styles.legendItem}>
            <span className={styles.legendDot} style={{ background: "rgba(59,130,246,0.55)" }} aria-hidden="true" />
            Booked
          </span>
          <span className={styles.legendItem}>
            <span className={styles.legendDot} style={{ background: "rgba(250,204,21,0.65)" }} aria-hidden="true" />
            Pending
          </span>
          <span className={styles.legendItem}>
            <span className={styles.legendDot} style={{ background: "rgba(248,113,113,0.5)" }} aria-hidden="true" />
            Blocked
          </span>
          <span className={styles.legendItem}>
            <span
              className={styles.legendDot}
              style={{ background: "linear-gradient(135deg, rgba(59,130,246,0.6), rgba(250,204,21,0.6))" }}
              aria-hidden="true"
            />
            Partially available
          </span>
        </div>
      )}

      <div className={`${styles.calendarScroll} ${rangeMode ? styles.rangeModeActive : ""}`}>
        <div className={styles.calendarScrollInner}>
          <div className={styles.calendarGrid} ref={gridRef}>
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((label) => (
              <div key={label} className={styles.dow}>
                {label}
              </div>
            ))}

            {cells.map((cell) => {
              const summary = coreDataError ? undefined : daySummaries.get(cell.dateISO);
              const badge = badgeFor(summary);
              const isToday = cell.dateISO === todayISO;
              const isSelected = cell.dateISO === selectedDate;
              const isOpen = cell.dateISO === openDateISO;
              const dateLabel = formatFullDateLabel(cell.dateISO);

              const isRangeStart = rangeMode && cell.dateISO === rangeStart;
              const isRangeEnd = rangeMode && !!rangeEnd && cell.dateISO === rangeEnd;
              const isCommittedInterior =
                rangeMode && rangeStart && rangeEnd && cell.dateISO > rangeStart && cell.dateISO < rangeEnd;
              const isTentativeInRange =
                rangeMode && !rangeEnd && tentativeRangeDates.includes(cell.dateISO);

              let rangeHint = "";
              if (rangeMode && cell.inMonth) {
                rangeHint = !rangeStart
                  ? " Select as start date."
                  : !rangeEnd
                  ? " Select as end date."
                  : "";
              }

              return (
                <div key={cell.key} className={styles.dayWrapper}>
                  <button
                    type="button"
                    ref={(el) => {
                      if (el) dayButtonRefs.current.set(cell.dateISO, el);
                      else dayButtonRefs.current.delete(cell.dateISO);
                    }}
                    className={`${styles.day} ${!cell.inMonth ? styles.dayMuted : ""} ${tileStatusClass(summary)} ${
                      isToday ? styles.dayToday : ""
                    } ${isSelected ? styles.daySelected : ""} ${isRangeStart ? styles.dayRangeStart : ""} ${
                      isRangeEnd ? styles.dayRangeEnd : ""
                    } ${isCommittedInterior ? styles.dayRangeInterior : ""} ${
                      isTentativeInRange ? styles.dayRangeTentative : ""
                    }`}
                    disabled={!cell.inMonth}
                    tabIndex={cell.inMonth ? 0 : -1}
                    aria-label={cell.inMonth ? buildAriaLabel(dateLabel, summary, rangeHint) : undefined}
                    aria-expanded={!rangeMode && cell.inMonth ? isOpen : undefined}
                    onClick={() => handleTileClick(cell.dateISO, cell.inMonth)}
                    onMouseEnter={() => {
                      if (!cell.inMonth) return;
                      if (rangeMode) {
                        if (rangeStart && !rangeEnd) setRangeHoverDate(cell.dateISO);
                      } else {
                        handleTileMouseEnter(cell.dateISO);
                      }
                    }}
                    onMouseLeave={() => {
                      if (rangeMode) return;
                      handleTileMouseLeave();
                    }}
                    onFocus={() => !rangeMode && cell.inMonth && handleTileMouseEnter(cell.dateISO)}
                  >
                    <div className={styles.dayNum}>{cell.date.getDate()}</div>

                    <div className={styles.dayIndicatorRow} aria-hidden="true">
                      {summary && summary.pendingCount > 0 && (
                        <span className={styles.dayIndicatorDot} title="Pending request" />
                      )}
                      {summary?.hasNote && <span className={styles.dayIndicatorIcon}>📝</span>}
                      {summary && summary.signals.length > 0 && (
                        <span className={styles.dayIndicatorIcon}>⚑</span>
                      )}
                    </div>

                    {!rangeMode && badge && (
                      <div className={`${styles.badgeBooked} ${badge.className}`}>{badge.text}</div>
                    )}
                  </button>

                  {!rangeMode && isOpen && cell.inMonth && (
                    <>
                      <div className={styles.dayPopoverBackdrop} onClick={() => closePopover(false)} aria-hidden="true" />
                      <HostCalendarDayPopover
                        ref={popoverRef}
                        dateISO={cell.dateISO}
                        dateLabel={dateLabel}
                        summary={coreDataError ? null : openSummary ?? null}
                        loading={coreDataLoading}
                        errorMessage={
                          coreDataError
                            ? "Availability unavailable — calendar data could not be loaded."
                            : dayMetaError
                            ? "Some details (blocked days, notes) couldn't be loaded, but booking status below is accurate."
                            : undefined
                        }
                        align={align}
                        titleId={`day-popover-title-${cell.dateISO}`}
                        onClose={() => closePopover(true)}
                        onMouseEnter={handlePopoverMouseEnter}
                        onMouseLeave={handlePopoverMouseLeave}
                      />
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {rangeMode && rangeStart && rangeEnd && (
        <div className={styles.rangeSummaryPanel}>
          <div className={styles.rangeSummaryHeader}>
            <div className={styles.rangeSummaryTitle}>
              {formatDateLabel(rangeStart)} – {formatDateLabel(rangeEnd)} · {committedRangeDates.length} day
              {committedRangeDates.length === 1 ? "" : "s"} selected
              {rangeNights > 0 ? ` · ${rangeNights} night${rangeNights === 1 ? "" : "s"}` : ""}
            </div>
            <button type="button" className={styles.panelLink} onClick={clearRangeSelection}>
              Clear selection
            </button>
          </div>

          <div className={styles.rangeSummaryLine}>
            {fullyAvailableCount} of {rangeListingSummaries.length} listing
            {rangeListingSummaries.length === 1 ? "" : "s"} fully available throughout the range
          </div>

          <ul className={styles.rangeListingList}>
            {rangeListingSummaries.map((r) => (
              <li key={r.listingId} className={styles.rangeListingRow}>
                <span className={styles.rangeListingTitle}>{r.title}</span>
                {r.hasApprovedConflict && <span className={styles.rangeChipConflict}>Approved conflict</span>}
                {r.hasBlocked && <span className={styles.rangeChipBlocked}>Blocked dates</span>}
                {r.hasPending && <span className={styles.rangeChipPending}>Pending requests</span>}
                {r.fullyAvailable && <span className={styles.rangeChipAvailable}>Fully available</span>}
              </li>
            ))}
          </ul>

          <div className={styles.rangeActionsRow}>
            <select
              className={styles.rangeListingSelect}
              value={rangeListingId}
              onChange={(e) => setRangeListingId(e.target.value)}
              aria-label="Listing to manage"
            >
              {rangeListingSummaries.map((r) => (
                <option key={r.listingId} value={r.listingId}>
                  {r.title}
                </option>
              ))}
            </select>

            <Link href={manageHref} className={styles.btnPrimary}>
              Manage selected dates →
            </Link>
          </div>
        </div>
      )}

      <div className={styles.section}>
        <div className={styles.cardTitle}>Upcoming bookings</div>

        {upcoming.length === 0 ? (
          <div className={styles.stateBox}>
            <div className={styles.stateTitle}>No upcoming bookings</div>
            <div className={styles.stateText}>Your calendar is open for new reservations.</div>
          </div>
        ) : (
          <div className={styles.list}>
            {upcoming.map((booking) => (
              <div key={booking.id} className={styles.listItem}>
                <div className={styles.listTop}>
                  <strong>{booking.listingTitle}</strong>
                  <span className={styles.small}>
                    {booking.status.charAt(0).toUpperCase() + booking.status.slice(1)}
                  </span>
                </div>
                <div className={styles.small} style={{ marginTop: 4 }}>
                  {formatDateLabel(booking.checkIn)} → {formatDateLabel(booking.checkOut)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ marginTop: 14 }}>
        <Link href="/host/calendar" className={styles.btnSecondary}>
          Manage blocked days, notes &amp; signals →
        </Link>
      </div>
    </div>
  );
}
