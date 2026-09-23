export type BookingStatus =
  | "pending"
  | "approved"
  | "declined"
  | "cancelled"
  | "completed"
  | "unknown";

export function normalizeBookingStatus(raw?: string | null): BookingStatus {
  const value = String(raw ?? "").trim().toLowerCase();

  switch (value) {
    case "requested":
    case "pending":
      return "pending";
    case "confirmed":
    case "approved":
      return "approved";
    case "declined":
      return "declined";
    case "canceled":
    case "cancelled":
      return "cancelled";
    case "completed":
      return "completed";
    default:
      return "unknown";
  }
}

export function isBlockingBookingStatus(raw?: string | null): boolean {
  return normalizeBookingStatus(raw) === "approved";
}
