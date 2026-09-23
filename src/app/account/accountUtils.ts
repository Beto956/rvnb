import { parseYmd, startOfDay } from "@/app/components/hostDashboardUtils";

export type TripClassification =
  | "pending"
  | "upcoming"
  | "completed"
  | "cancelled"
  | "declined"
  | "other";

/**
 * Classifies a booking from the traveler's (or host's) point of view.
 *
 * Rule: approved/confirmed stays are "completed" once checkout has arrived or passed
 * (checkout is exclusive — the guest doesn't occupy the checkout night, so by the
 * checkout date the stay is over), otherwise they're "upcoming". Pending/declined/
 * cancelled map directly from the existing normalized status. Anything else (legacy or
 * unrecognized status, or an unparsable date) is bucketed as "other" rather than guessed.
 */
export function classifyBooking(
  normalizedStatus: string,
  checkOut: string,
  today: Date = new Date()
): TripClassification {
  if (normalizedStatus === "pending") return "pending";
  if (normalizedStatus === "declined") return "declined";
  if (normalizedStatus === "cancelled") return "cancelled";

  if (normalizedStatus === "approved" || normalizedStatus === "completed") {
    const out = parseYmd(checkOut);
    if (!out) return "other";
    return startOfDay(out).getTime() <= startOfDay(today).getTime() ? "completed" : "upcoming";
  }

  return "other";
}

export function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}

export function nightsBetween(checkIn: string, checkOut: string): number {
  const start = parseYmd(checkIn);
  const end = parseYmd(checkOut);
  if (!start || !end) return 0;
  const ms = startOfDay(end).getTime() - startOfDay(start).getTime();
  return Math.max(0, Math.round(ms / 86400000));
}

export function formatYmdLabel(value: string | undefined): string {
  const d = value ? parseYmd(value) : null;
  if (!d) return value || "Date pending";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}
