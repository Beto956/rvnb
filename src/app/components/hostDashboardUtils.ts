export type HostAnalyticsListing = {
  id: string;
  title: string;
};

export type HostAnalyticsBookingStatus =
  | "requested"
  | "confirmed"
  | "cancelled"
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