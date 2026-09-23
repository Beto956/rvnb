export type ApprovedRange = {
  bookingId: string;
  guestId: string;
  checkIn: string;
  checkOut: string;
};

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function isValidDateOnly(value: unknown): value is string {
  if (typeof value !== "string" || !DATE_ONLY_PATTERN.test(value)) return false;

  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

export function isValidDateRange(checkIn: unknown, checkOut: unknown): boolean {
  return (
    isValidDateOnly(checkIn) &&
    isValidDateOnly(checkOut) &&
    checkIn < checkOut
  );
}

export function rangesOverlap(
  leftCheckIn: string,
  leftCheckOut: string,
  rightCheckIn: string,
  rightCheckOut: string
): boolean {
  return leftCheckIn < rightCheckOut && rightCheckIn < leftCheckOut;
}

export function isActiveApprovedRange(range: ApprovedRange, today = toDateOnly(new Date())) {
  return range.checkOut > today;
}

export function parseApprovedRanges(value: unknown): ApprovedRange[] {
  if (!Array.isArray(value)) return [];

  const parsed: ApprovedRange[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const candidate = item as Record<string, unknown>;
    const range = {
      bookingId: typeof candidate.bookingId === "string" ? candidate.bookingId.trim() : "",
      guestId: typeof candidate.guestId === "string" ? candidate.guestId.trim() : "",
      checkIn: candidate.checkIn,
      checkOut: candidate.checkOut,
    };

    if (
      !range.bookingId ||
      !range.guestId ||
      !isValidDateRange(range.checkIn, range.checkOut)
    ) {
      continue;
    }

    const checkIn = range.checkIn as string;
    const checkOut = range.checkOut as string;

    parsed.push({
      bookingId: range.bookingId,
      guestId: range.guestId,
      checkIn,
      checkOut,
    });
  }

  return deduplicateRanges(parsed);
}

export function deduplicateRanges(ranges: ApprovedRange[]): ApprovedRange[] {
  const seen = new Set<string>();
  return ranges.filter((range) => {
    if (seen.has(range.bookingId)) return false;
    seen.add(range.bookingId);
    return true;
  });
}

export function findRangeConflict(
  candidate: ApprovedRange,
  existingRanges: ApprovedRange[]
): ApprovedRange | null {
  return (
    existingRanges.find(
      (range) =>
        range.bookingId !== candidate.bookingId &&
        isActiveApprovedRange(range) &&
        rangesOverlap(candidate.checkIn, candidate.checkOut, range.checkIn, range.checkOut)
    ) ?? null
  );
}

export function removeRangeByBookingId(
  ranges: ApprovedRange[],
  bookingId: string
): ApprovedRange[] {
  return ranges.filter((range) => range.bookingId !== bookingId);
}

function toDateOnly(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
