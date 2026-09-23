export type HostAnalyticsListing = {
  id: string;
  title: string;
};

export type HostAnalyticsBookingStatus =
  | "pending"
  | "approved"
  | "declined"
  | "cancelled"
  | "requested"
  | "confirmed"
  | "other";

export type HostAnalyticsBooking = {
  id: string;
  listingId: string;
  listingTitle: string;
  checkIn: string;
  checkOut: string;
  nights: number;
  estimatedTotal: number;
  status: HostAnalyticsBookingStatus;
  // Safe display label only — never a fabricated name (see host/page.tsx guestLabel logic).
  guestLabel?: string;
};

export type MonthlyRevenueItem = {
  key: string; // YYYY-MM
  label: string;
  revenue: number;
};

export type PerListingRevenueItem = {
  listingId: string;
  title: string;
  revenue: number;
};

export type PerListingOccupancyItem = {
  listingId: string;
  title: string;
  bookedDays: number;
  availableDays: number;
  occupancyPct: number;
};

export function parseYmd(value: string): Date | null {
  if (!value || typeof value !== "string") return null;

  const parts = value.split("-");
  if (parts.length !== 3) return null;

  const year = Number(parts[0]);
  const month = Number(parts[1]);
  const day = Number(parts[2]);

  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    return null;
  }

  const d = new Date(year, month - 1, day);
  if (Number.isNaN(d.getTime())) return null;

  return d;
}

export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function endOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
}

export function addDays(d: Date, days: number): Date {
  const next = new Date(d);
  next.setDate(next.getDate() + days);
  return next;
}

export function differenceInCalendarDaysInclusive(start: Date, end: Date): number {
  const s = startOfDay(start).getTime();
  const e = startOfDay(end).getTime();

  if (e < s) return 0;
  return Math.floor((e - s) / 86400000) + 1;
}

export function formatMoney(value: number): string {
  const safe = Number.isFinite(value) ? value : 0;
  return safe.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  });
}

export function toMonthKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

export function monthKeyToLabel(key: string): string {
  const [y, m] = key.split("-");
  const year = Number(y);
  const month = Number(m);

  if (!Number.isFinite(year) || !Number.isFinite(month)) return key;

  return new Date(year, month - 1, 1).toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });
}

export function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value < 0) return 0;
  if (value > 100) return 100;
  return value;
}

/**
 * For calendar marking.
 * Returns YYYY-MM-DD strings for every booked day inclusive.
 */
export function expandBookingDays(checkIn: string, checkOut: string): string[] {
  const start = parseYmd(checkIn);
  const end = parseYmd(checkOut);

  if (!start || !end) return [];

  const s = startOfDay(start);
  const e = startOfDay(end);

  if (e.getTime() < s.getTime()) return [];

  const days: string[] = [];
  let cur = new Date(s);

  while (cur.getTime() <= e.getTime()) {
    days.push(dateToYmd(cur));
    cur = addDays(cur, 1);
  }

  return days;
}

export function dateToYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function isUpcomingBooking(
  booking: HostAnalyticsBooking,
  now: Date = new Date()
): boolean {
  const start = parseYmd(booking.checkIn);
  if (!start) return false;

  return startOfDay(start).getTime() >= startOfDay(now).getTime();
}

export function getUpcomingBookings(
  bookings: HostAnalyticsBooking[],
  now: Date = new Date()
): HostAnalyticsBooking[] {
  return [...bookings]
    .filter((b) => b.status !== "cancelled")
    .filter((b) => isUpcomingBooking(b, now))
    .sort((a, b) => {
      const aTime = parseYmd(a.checkIn)?.getTime() ?? 0;
      const bTime = parseYmd(b.checkIn)?.getTime() ?? 0;
      return aTime - bTime;
    });
}

export function getLifetimeRevenue(bookings: HostAnalyticsBooking[]): number {
  return bookings
    .filter((b) => b.status !== "cancelled")
    .reduce((sum, b) => sum + (Number.isFinite(b.estimatedTotal) ? b.estimatedTotal : 0), 0);
}

export function getRevenueLast30Days(
  bookings: HostAnalyticsBooking[],
  now: Date = new Date()
): number {
  const windowStart = startOfDay(addDays(now, -29));
  const windowEnd = endOfDay(now);

  return bookings
    .filter((b) => b.status !== "cancelled")
    .reduce((sum, b) => {
      const start = parseYmd(b.checkIn);
      if (!start) return sum;

      const t = start.getTime();
      if (t >= windowStart.getTime() && t <= windowEnd.getTime()) {
        return sum + (Number.isFinite(b.estimatedTotal) ? b.estimatedTotal : 0);
      }

      return sum;
    }, 0);
}

export function getRevenueThisMonth(
  bookings: HostAnalyticsBooking[],
  now: Date = new Date()
): number {
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = endOfDay(now);

  return bookings
    .filter((b) => b.status !== "cancelled")
    .reduce((sum, b) => {
      const start = parseYmd(b.checkIn);
      if (!start) return sum;

      const t = start.getTime();
      if (t >= monthStart.getTime() && t <= monthEnd.getTime()) {
        return sum + (Number.isFinite(b.estimatedTotal) ? b.estimatedTotal : 0);
      }

      return sum;
    }, 0);
}

export function getMonthlyRevenueBreakdown(
  bookings: HostAnalyticsBooking[]
): MonthlyRevenueItem[] {
  const buckets = new Map<string, number>();

  bookings
    .filter((b) => b.status !== "cancelled")
    .forEach((b) => {
      const start = parseYmd(b.checkIn);
      if (!start) return;

      const key = toMonthKey(start);
      const current = buckets.get(key) ?? 0;
      buckets.set(key, current + (Number.isFinite(b.estimatedTotal) ? b.estimatedTotal : 0));
    });

  return Array.from(buckets.entries())
    .map(([key, revenue]) => ({
      key,
      label: monthKeyToLabel(key),
      revenue,
    }))
    .sort((a, b) => (a.key < b.key ? 1 : -1));
}

export function getRevenuePerListing(
  listings: HostAnalyticsListing[],
  bookings: HostAnalyticsBooking[]
): PerListingRevenueItem[] {
  const byListing = new Map<string, number>();

  bookings
    .filter((b) => b.status !== "cancelled")
    .forEach((b) => {
      const current = byListing.get(b.listingId) ?? 0;
      byListing.set(
        b.listingId,
        current + (Number.isFinite(b.estimatedTotal) ? b.estimatedTotal : 0)
      );
    });

  return listings
    .map((listing) => ({
      listingId: listing.id,
      title: listing.title || "Untitled Listing",
      revenue: byListing.get(listing.id) ?? 0,
    }))
    .sort((a, b) => b.revenue - a.revenue);
}

export function getOccupancyStats(
  listings: HostAnalyticsListing[],
  bookings: HostAnalyticsBooking[],
  now: Date = new Date()
): {
  overallBookedDays: number;
  overallAvailableDays: number;
  overallOccupancyPct: number;
  perListing: PerListingOccupancyItem[];
} {
  const windowStart = startOfDay(addDays(now, -29));
  const windowEnd = endOfDay(now);
  const availableDaysPerListing = 30;

  const perListingBookedMap = new Map<string, number>();

  listings.forEach((l) => {
    perListingBookedMap.set(l.id, 0);
  });

  bookings
    .filter((b) => b.status !== "cancelled")
    .forEach((b) => {
      const start = parseYmd(b.checkIn);
      const end = parseYmd(b.checkOut);

      if (!start || !end) return;

      const bookingStart = startOfDay(start);
      const bookingEnd = startOfDay(end);

      const overlapStart =
        bookingStart.getTime() > windowStart.getTime() ? bookingStart : windowStart;
      const overlapEnd =
        bookingEnd.getTime() < startOfDay(windowEnd).getTime()
          ? bookingEnd
          : startOfDay(windowEnd);

      if (overlapEnd.getTime() < overlapStart.getTime()) return;

      const overlapDays = differenceInCalendarDaysInclusive(overlapStart, overlapEnd);
      const current = perListingBookedMap.get(b.listingId) ?? 0;
      perListingBookedMap.set(b.listingId, current + overlapDays);
    });

  const perListing: PerListingOccupancyItem[] = listings
    .map((listing) => {
      const bookedDays = perListingBookedMap.get(listing.id) ?? 0;
      const availableDays = availableDaysPerListing;
      const occupancyPct =
        availableDays > 0 ? clampPercent((bookedDays / availableDays) * 100) : 0;

      return {
        listingId: listing.id,
        title: listing.title || "Untitled Listing",
        bookedDays,
        availableDays,
        occupancyPct,
      };
    })
    .sort((a, b) => b.occupancyPct - a.occupancyPct);

  const overallBookedDays = perListing.reduce((sum, row) => sum + row.bookedDays, 0);
  const overallAvailableDays = listings.length * availableDaysPerListing;
  const overallOccupancyPct =
    overallAvailableDays > 0
      ? clampPercent((overallBookedDays / overallAvailableDays) * 100)
      : 0;

  return {
    overallBookedDays,
    overallAvailableDays,
    overallOccupancyPct,
    perListing,
  };
}

/* ================================
   Per-day calendar summaries (dashboard preview + day popover)
   ================================ */

export type DayListingStatus = "available" | "booked" | "pending" | "blocked";

export type DayOverallStatus =
  | "no-listings"
  | "available"
  | "partial"
  | "booked"
  | "blocked"
  | "unavailable";

export type DayListingBreakdown = {
  listingId: string;
  title: string;
  status: DayListingStatus;
  guestLabel?: string;
  bookingId?: string;
  checkIn?: string;
  checkOut?: string;
  blockReason?: string;
  signal?: string;
  note?: string;
};

/** Minimal day-level host settings, independent of the Firestore `dayMeta` doc shape. */
export type DayMetaLite = {
  blocked?: boolean;
  blockReason?: string;
  signal?: string;
  note?: string;
};

export type DaySummary = {
  dateISO: string;
  totalListings: number;
  availableCount: number;
  bookedCount: number;
  pendingCount: number;
  blockedCount: number;
  overallStatus: DayOverallStatus;
  hasNote: boolean;
  signals: string[];
  listings: DayListingBreakdown[];
};

const YMD_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** Validates a `YYYY-MM-DD` string represents a real calendar date (for query params, etc.). */
export function isValidYmd(value: string | null | undefined): value is string {
  if (!value || !YMD_PATTERN.test(value)) return false;
  return parseYmd(value) !== null;
}

/** Checkout day is excluded (matches /host/calendar's booking-covers-day convention). */
export function bookingCoversDay(checkIn: string, checkOut: string, day: Date): boolean {
  const start = parseYmd(checkIn);
  const end = parseYmd(checkOut);
  if (!start || !end) return false;

  const x = startOfDay(day).getTime();
  return x >= startOfDay(start).getTime() && x < startOfDay(end).getTime();
}

/**
 * Groups active (approved/pending) bookings by day and listing in a single pass, so
 * per-day summaries don't need to re-scan every booking on every render.
 * Approved bookings take precedence over pending ones for the same listing/day.
 */
export function buildBookingsByDayAndListing(
  bookings: HostAnalyticsBooking[]
): Map<string, Map<string, HostAnalyticsBooking>> {
  const byDay = new Map<string, Map<string, HostAnalyticsBooking>>();

  bookings
    .filter((b) => b.status === "approved" || b.status === "pending")
    .forEach((b) => {
      const start = parseYmd(b.checkIn);
      const end = parseYmd(b.checkOut);
      if (!start || !end) return;

      const stop = startOfDay(end).getTime();
      let cur = startOfDay(start);

      while (cur.getTime() < stop) {
        const key = dateToYmd(cur);
        let dayMap = byDay.get(key);
        if (!dayMap) {
          dayMap = new Map();
          byDay.set(key, dayMap);
        }

        const existing = dayMap.get(b.listingId);
        if (!existing || (existing.status !== "approved" && b.status === "approved")) {
          dayMap.set(b.listingId, b);
        }

        cur = addDays(cur, 1);
      }
    });

  return byDay;
}

/**
 * Computes an availability summary for one calendar day across all of a host's listings.
 * Pending requests never reduce availability (only blocked days and approved bookings do),
 * matching the project's existing overlap-protection rules.
 */
export function computeDaySummary(
  dateISO: string,
  listings: HostAnalyticsListing[],
  bookingsForDay: Map<string, HostAnalyticsBooking> | undefined,
  dayMetaForDay: Map<string, DayMetaLite> | undefined
): DaySummary {
  let availableCount = 0;
  let bookedCount = 0;
  let pendingCount = 0;
  let blockedCount = 0;
  let hasNote = false;
  const signalsSet = new Set<string>();

  const listingBreakdown: DayListingBreakdown[] = listings.map((listing) => {
    const meta = dayMetaForDay?.get(listing.id);
    const booking = bookingsForDay?.get(listing.id);

    let status: DayListingStatus;
    if (meta?.blocked) {
      status = "blocked";
      blockedCount += 1;
    } else if (booking?.status === "approved") {
      status = "booked";
      bookedCount += 1;
    } else if (booking?.status === "pending") {
      status = "pending";
      pendingCount += 1;
    } else {
      status = "available";
      availableCount += 1;
    }

    if (meta?.note?.trim()) hasNote = true;
    if (meta?.signal && meta.signal !== "none") signalsSet.add(meta.signal);

    return {
      listingId: listing.id,
      title: listing.title || "Untitled Listing",
      status,
      guestLabel: booking?.guestLabel,
      bookingId: booking?.id,
      checkIn: booking?.checkIn,
      checkOut: booking?.checkOut,
      blockReason: meta?.blockReason,
      signal: meta?.signal && meta.signal !== "none" ? meta.signal : undefined,
      note: meta?.note,
    };
  });

  const totalListings = listings.length;

  let overallStatus: DayOverallStatus;
  if (totalListings === 0) {
    overallStatus = "no-listings";
  } else if (blockedCount === totalListings) {
    overallStatus = "blocked";
  } else if (bookedCount === totalListings) {
    overallStatus = "booked";
  } else if (bookedCount === 0 && blockedCount === 0) {
    // Pending-only (or fully open) days remain bookable — never claim they're unavailable.
    overallStatus = "available";
  } else if (bookedCount + blockedCount === totalListings) {
    overallStatus = "unavailable";
  } else {
    overallStatus = "partial";
  }

  return {
    dateISO,
    totalListings,
    availableCount,
    bookedCount,
    pendingCount,
    blockedCount,
    overallStatus,
    hasNote,
    signals: Array.from(signalsSet),
    listings: listingBreakdown,
  };
}

/* ================================
   Date-range selection (mini + full calendar)
   ================================ */

/** Safe upper bound on a single host-managed range, to keep bulk writes bounded. */
export const MAX_RANGE_DAYS = 365;

export function normalizeDateRange(aISO: string, bISO: string): { start: string; end: string } {
  return aISO <= bISO ? { start: aISO, end: bISO } : { start: bISO, end: aISO };
}

export function daysBetweenInclusive(startISO: string, endISO: string): number {
  const start = parseYmd(startISO);
  const end = parseYmd(endISO);
  if (!start || !end) return 0;
  return differenceInCalendarDaysInclusive(start, end);
}

/** Clamps an end date so the range never exceeds `maxDays` (defaults to MAX_RANGE_DAYS). */
export function clampRangeEnd(
  startISO: string,
  endISO: string,
  maxDays: number = MAX_RANGE_DAYS
): { end: string; clamped: boolean } {
  const { start, end } = normalizeDateRange(startISO, endISO);
  const span = daysBetweenInclusive(start, end);
  if (span <= maxDays) return { end, clamped: false };

  const startDate = parseYmd(start);
  if (!startDate) return { end, clamped: false };
  return { end: dateToYmd(addDays(startDate, maxDays - 1)), clamped: true };
}

export function enumerateDatesInclusive(startISO: string, endISO: string): string[] {
  const { start, end } = normalizeDateRange(startISO, endISO);
  const startDate = parseYmd(start);
  const endDate = parseYmd(end);
  if (!startDate || !endDate) return [];

  const out: string[] = [];
  let cur = startOfDay(startDate);
  const stop = startOfDay(endDate).getTime();
  while (cur.getTime() <= stop) {
    out.push(dateToYmd(cur));
    cur = addDays(cur, 1);
  }
  return out;
}

export type RangeListingSummary = {
  listingId: string;
  title: string;
  fullyAvailable: boolean;
  hasApprovedConflict: boolean;
  hasBlocked: boolean;
  hasPending: boolean;
  conflictDates: string[];
  blockedDates: string[];
};

/** Aggregates per-day DaySummary rows (already computed for the range) into per-listing status. */
export function summarizeRangeByListing(
  listings: HostAnalyticsListing[],
  daySummariesInRange: DaySummary[]
): RangeListingSummary[] {
  return listings.map((listing) => {
    const conflictDates: string[] = [];
    const blockedDates: string[] = [];
    let hasPending = false;

    daySummariesInRange.forEach((day) => {
      const row = day.listings.find((l) => l.listingId === listing.id);
      if (!row) return;
      if (row.status === "booked") conflictDates.push(day.dateISO);
      if (row.status === "blocked") blockedDates.push(day.dateISO);
      if (row.status === "pending") hasPending = true;
    });

    return {
      listingId: listing.id,
      title: listing.title || "Untitled Listing",
      fullyAvailable: conflictDates.length === 0 && blockedDates.length === 0,
      hasApprovedConflict: conflictDates.length > 0,
      hasBlocked: blockedDates.length > 0,
      hasPending,
      conflictDates,
      blockedDates,
    };
  });
}