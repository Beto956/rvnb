import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  runTransaction,
  serverTimestamp,
  where,
} from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { normalizeBookingStatus } from "@/lib/booking-status";
import {
  ApprovedRange,
  deduplicateRanges,
  findRangeConflict,
  isActiveApprovedRange,
  isValidDateRange,
  parseApprovedRanges,
} from "@/lib/booking-reservations";

type BookingRecord = Record<string, unknown>;

type OperationCode =
  | "unauthenticated"
  | "not-found"
  | "unauthorized"
  | "invalid-data"
  | "conflict"
  | "invalid-state"
  | "unknown";

export type BookingOperationResult =
  | { ok: true; bookingId: string }
  | { ok: false; code: OperationCode; message: string };

export class BookingOperationError extends Error {
  constructor(public readonly code: Exclude<OperationCode, "unknown">, message: string) {
    super(message);
    this.name = "BookingOperationError";
  }
}

const ledgerCollection = collection(db, "listingReservations");

export async function approveBooking(bookingId: string): Promise<BookingOperationResult> {
  try {
    const user = auth.currentUser;
    if (!user) throw new BookingOperationError("unauthenticated", "Please sign in again.");
    if (!bookingId.trim()) {
      throw new BookingOperationError("invalid-data", "This booking has no valid ID.");
    }

    const bookingRef = doc(db, "bookings", bookingId);
    const initialBookingSnap = await getDoc(bookingRef);
    const initialBooking = initialBookingSnap.exists()
      ? (initialBookingSnap.data() as BookingRecord)
      : undefined;
    const initialListingId = readString(initialBooking?.listingId);

    if (!initialBooking || !initialListingId) {
      throw new BookingOperationError("invalid-data", "This booking is missing a valid listing.");
    }

    const seededRanges = await loadLegacyApprovedRanges(initialListingId);
    const listingRef = doc(db, "listings", initialListingId);
    const ledgerRef = doc(ledgerCollection, initialListingId);

    await runTransaction(db, async (transaction) => {
      const currentBookingSnap = await transaction.get(bookingRef);
      if (!currentBookingSnap.exists()) {
        throw new BookingOperationError("not-found", "This booking no longer exists.");
      }

      const currentBooking = currentBookingSnap.data() as BookingRecord;
      const currentListingId = readString(currentBooking.listingId);
      if (currentListingId !== initialListingId) {
        throw new BookingOperationError(
          "invalid-data",
          "This booking changed listings while approval was starting. Refresh and try again."
        );
      }

      const listingSnap = await transaction.get(listingRef);
      const ledgerSnap = await transaction.get(ledgerRef);
      if (!listingSnap.exists()) {
        throw new BookingOperationError("invalid-data", "The booking listing no longer exists.");
      }

      const listing = listingSnap.data() as BookingRecord;
      const listingHostId = readString(listing.hostId);
      if (!listingHostId || listingHostId !== user.uid) {
        throw new BookingOperationError("unauthorized", "You are not authorized to approve this listing's bookings.");
      }

      const bookingHostId = readString(currentBooking.hostId);
      if (bookingHostId && bookingHostId !== listingHostId) {
        throw new BookingOperationError("invalid-data", "Booking and listing ownership contradict each other.");
      }

      const bookingGuestId = resolveGuestId(currentBooking);
      if (!bookingGuestId) {
        throw new BookingOperationError("invalid-data", "This legacy booking has no single valid guest identity.");
      }
      if (bookingGuestId === listingHostId) {
        throw new BookingOperationError("invalid-data", "A host cannot approve a booking for the same account.");
      }

      const checkIn = readString(currentBooking.checkIn);
      const checkOut = readString(currentBooking.checkOut);
      if (!isValidDateRange(checkIn, checkOut)) {
        throw new BookingOperationError("invalid-data", "This booking has an invalid date range.");
      }

      const status = normalizeBookingStatus(readString(currentBooking.status));
      if (status !== "pending") {
        throw new BookingOperationError("invalid-state", "Only pending booking inquiries can be approved.");
      }

      const currentRanges = ledgerSnap.exists()
        ? parseApprovedRanges((ledgerSnap.data() as BookingRecord).approvedRanges)
        : seededRanges;
      const candidate: ApprovedRange = {
        bookingId,
        guestId: bookingGuestId,
        checkIn,
        checkOut,
      };
      const conflict = findRangeConflict(candidate, currentRanges);
      if (conflict) {
        throw new BookingOperationError(
          "conflict",
          "Those dates were just approved for another inquiry. This inquiry remains pending."
        );
      }

      const nextRanges = deduplicateRanges([
        ...currentRanges.filter((range) => isActiveApprovedRange(range)),
        candidate,
      ]);
      const bookingUpdates: BookingRecord = {
        status: "approved",
        approvedAt: serverTimestamp(),
      };
      if (!bookingHostId) bookingUpdates.hostId = listingHostId;
      if (!readString(currentBooking.guestId)) bookingUpdates.guestId = bookingGuestId;

      transaction.update(bookingRef, bookingUpdates);
      transaction.set(
        ledgerRef,
        {
          listingId: initialListingId,
          hostId: listingHostId,
          approvedRanges: nextRanges,
          updatedAt: serverTimestamp(),
        },
        { merge: false }
      );
    });

    return { ok: true, bookingId };
  } catch (error) {
    return toOperationFailure(error);
  }
}

export async function declineBooking(bookingId: string): Promise<BookingOperationResult> {
  try {
    const user = auth.currentUser;
    if (!user) throw new BookingOperationError("unauthenticated", "Please sign in again.");

    const bookingRef = doc(db, "bookings", bookingId);
    const initialBookingSnap = await getDoc(bookingRef);
    if (!initialBookingSnap.exists()) {
      throw new BookingOperationError("not-found", "This booking no longer exists.");
    }

    const initialBooking = initialBookingSnap.data() as BookingRecord;
    const initialListingId = readString(initialBooking.listingId);
    if (!initialListingId) {
      throw new BookingOperationError("invalid-data", "This booking is missing a valid listing.");
    }

    const listingRef = doc(db, "listings", initialListingId);
    await runTransaction(db, async (transaction) => {
      const bookingSnap = await transaction.get(bookingRef);
      if (!bookingSnap.exists()) {
        throw new BookingOperationError("not-found", "This booking no longer exists.");
      }

      const booking = bookingSnap.data() as BookingRecord;
      const currentListingId = readString(booking.listingId);
      if (currentListingId !== initialListingId) {
        throw new BookingOperationError(
          "invalid-data",
          "This booking changed listings while decline was starting. Refresh and try again."
        );
      }

      const listingSnap = await transaction.get(listingRef);
      if (!listingSnap.exists()) {
        throw new BookingOperationError("invalid-data", "The booking listing no longer exists.");
      }

      const listing = listingSnap.data() as BookingRecord;
      const listingHostId = readString(listing.hostId);
      if (!listingHostId || listingHostId !== user.uid) {
        throw new BookingOperationError("unauthorized", "You are not authorized to decline this listing's bookings.");
      }

      const bookingHostId = readString(booking.hostId);
      if (bookingHostId && bookingHostId !== listingHostId) {
        throw new BookingOperationError("invalid-data", "Booking and listing ownership contradict each other.");
      }
      if (normalizeBookingStatus(readString(booking.status)) !== "pending") {
        throw new BookingOperationError("invalid-state", "Only pending booking inquiries can be declined.");
      }

      const updates: BookingRecord = {
        status: "declined",
        declinedAt: serverTimestamp(),
      };
      if (!bookingHostId) updates.hostId = listingHostId;

      transaction.update(bookingRef, updates);
    });

    return { ok: true, bookingId };
  } catch (error) {
    return toOperationFailure(error);
  }
}

async function loadLegacyApprovedRanges(listingId: string): Promise<ApprovedRange[]> {
  const snap = await getDocs(
    query(collection(db, "bookings"), where("listingId", "==", listingId))
  );
  const ranges: ApprovedRange[] = [];

  for (const bookingDoc of snap.docs) {
    const booking = bookingDoc.data() as BookingRecord;
    if (normalizeBookingStatus(readString(booking.status)) !== "approved") continue;

    const checkIn = readString(booking.checkIn);
    const checkOut = readString(booking.checkOut);
    const guestId = resolveGuestId(booking);
    if (!guestId || !isValidDateRange(checkIn, checkOut)) {
      throw new BookingOperationError(
        "invalid-data",
        "An existing approved booking contains invalid legacy ownership or dates."
      );
    }

    const range = { bookingId: bookingDoc.id, guestId, checkIn, checkOut };
    if (isActiveApprovedRange(range)) ranges.push(range);
  }

  return deduplicateRanges(ranges);
}

function resolveGuestId(booking: BookingRecord): string | null {
  const canonicalGuestId = readString(booking.guestId);
  const legacyIds = ["userId", "renterId", "travelerId", "uid"]
    .map((field) => readString(booking[field]))
    .filter((value): value is string => Boolean(value));
  const allIds = canonicalGuestId ? [canonicalGuestId, ...legacyIds] : legacyIds;
  const uniqueIds = [...new Set(allIds)];
  if (uniqueIds.length !== 1) return null;
  return uniqueIds[0];
}

function readString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function toOperationFailure(error: unknown): BookingOperationResult {
  if (error instanceof BookingOperationError) {
    return { ok: false, code: error.code, message: error.message };
  }

  console.error(error);
  return { ok: false, code: "unknown", message: "The booking operation could not be completed." };
}
