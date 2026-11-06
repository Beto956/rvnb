import { readNonEmptyString } from "./request-spot-contract";
import { normalizeMyRequest, type MyRequest } from "./my-requests";
import {
  normalizeMyTransportProvider,
  normalizeMyTransportRequest,
  type MyTransportProvider,
  type MyTransportRequest,
} from "./my-transport";

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

export function timestampMs(value: unknown): number {
  return value && typeof value === "object" && "seconds" in value && typeof value.seconds === "number"
    ? value.seconds * 1000
    : 0;
}

export function formatDateTime(ms: number): string {
  if (!ms) return "Unknown date";
  const date = new Date(ms);
  return Number.isNaN(date.getTime()) ? "Unknown date" : date.toLocaleString("en-US", {
    month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit",
  });
}

function text(value: unknown, fallback = "Not provided"): string {
  return readNonEmptyString(value) || fallback;
}

// ---------------------------------------------------------------------------
// Overview datasets (counts via server-side aggregation only)
// ---------------------------------------------------------------------------

export const OVERVIEW_DATASETS = [
  { id: "listings", label: "Listings" },
  { id: "bookings", label: "Booking inquiries" },
  { id: "spotRequests", label: "Traveler requests" },
  { id: "hostOpportunities", label: "Host responses & applications" },
  { id: "transportRequests", label: "Transport requests" },
  { id: "transportProviders", label: "Transport providers" },
  { id: "transportInterest", label: "Transport interest" },
  { id: "communityPosts", label: "Community posts" },
  { id: "communityReports", label: "Community reports" },
  { id: "reviewReports", label: "Review reports" },
  { id: "reviews", label: "Reviews" },
  { id: "users", label: "Member accounts" },
] as const;

export type OverviewDatasetId = (typeof OVERVIEW_DATASETS)[number]["id"];

// ---------------------------------------------------------------------------
// Record normalizers — missing fields stay "not provided"/"unknown"; nothing
// is invented.
// ---------------------------------------------------------------------------

export type OwnerListing = {
  id: string;
  title: string;
  location: string;
  priceLabel: string;
  typeLabel: string;
  hostId: string;
  createdAt: number;
};

const LISTING_TYPE_LABELS: Record<string, string> = {
  rv_space: "RV space",
  land_space: "Land space",
  host_rv: "Host RV stay",
  mobile_home: "Mobile home",
  cabin: "Cabin",
};

export function normalizeOwnerListing(id: string, data: Record<string, unknown>): OwnerListing {
  const price = typeof data.price === "number" && Number.isFinite(data.price) ? data.price : undefined;
  const pricingType = readNonEmptyString(data.pricingType);
  return {
    id,
    title: text(data.title, "Untitled listing"),
    location: [readNonEmptyString(data.city), readNonEmptyString(data.state)].filter(Boolean).join(", ") || "Location not provided",
    priceLabel: price === undefined ? "Price not provided" : `$${price}${pricingType ? ` / ${pricingType.toLowerCase()}` : ""}`,
    typeLabel: LISTING_TYPE_LABELS[readNonEmptyString(data.listingType)] || "RV space",
    hostId: readNonEmptyString(data.hostId),
    createdAt: timestampMs(data.createdAt),
  };
}

export type OwnerBooking = {
  id: string;
  listingId: string;
  guestId: string;
  hostId: string;
  checkIn: string;
  checkOut: string;
  status: string;
  createdAt: number;
};

export function normalizeOwnerBooking(id: string, data: Record<string, unknown>): OwnerBooking {
  return {
    id,
    listingId: readNonEmptyString(data.listingId),
    guestId: readNonEmptyString(data.guestId),
    hostId: readNonEmptyString(data.hostId),
    checkIn: readNonEmptyString(data.checkIn),
    checkOut: readNonEmptyString(data.checkOut),
    status: readNonEmptyString(data.status) || "unknown",
    createdAt: timestampMs(data.createdAt),
  };
}

export type OwnerRequest = MyRequest & { requesterId: string };

export function normalizeOwnerRequest(id: string, data: Record<string, unknown>): OwnerRequest {
  return normalizeMyRequest(id, data);
}

export type OwnerRequestPrivate = {
  contactName: string;
  contactEmail: string;
  finalNotes: string;
};

export function normalizeOwnerRequestPrivate(data: Record<string, unknown>): OwnerRequestPrivate {
  return {
    contactName: text(data.contactName),
    contactEmail: text(data.contactEmail),
    finalNotes: readNonEmptyString(data.finalNotes),
  };
}

export type OwnerOpportunity = {
  id: string;
  kind: "response" | "application";
  requestId: string;
  hostId: string;
  requesterId: string;
  name: string;
  location: string;
  summary: string;
  createdAt: number;
};

export function normalizeOwnerOpportunity(id: string, data: Record<string, unknown>): OwnerOpportunity {
  const requestId = readNonEmptyString(data.requestId);
  const location = [
    readNonEmptyString(data.cityLocation) || readNonEmptyString(data.city),
    readNonEmptyString(data.stateRegion) || readNonEmptyString(data.state),
  ].filter(Boolean).join(", ");
  const spots = typeof data.rvSpotsCount === "number" && Number.isInteger(data.rvSpotsCount) && data.rvSpotsCount > 0
    ? `${data.rvSpotsCount} ${data.rvSpotsCount === 1 ? "spot" : "spots"}`
    : readNonEmptyString(data.rvSpotsOffered) ? `${readNonEmptyString(data.rvSpotsOffered)} spots` : "";
  return {
    id,
    // Linked host responses always carry requestId; host applications never do.
    kind: requestId ? "response" : "application",
    requestId,
    hostId: readNonEmptyString(data.hostId),
    requesterId: readNonEmptyString(data.requesterId),
    name: readNonEmptyString(data.fullName),
    location: location || "Location not provided",
    summary: [spots, readNonEmptyString(data.powerOption)].filter(Boolean).join(" · "),
    createdAt: timestampMs(data.createdAt),
  };
}

export type OwnerTransportRequest = MyTransportRequest & {
  requesterId: string;
  contactName: string;
  contactEmail: string;
};

export function normalizeOwnerTransportRequest(id: string, data: Record<string, unknown>): OwnerTransportRequest {
  const contact = data.contact && typeof data.contact === "object" ? data.contact as Record<string, unknown> : {};
  return {
    ...normalizeMyTransportRequest(id, data),
    requesterId: readNonEmptyString(data.requesterId),
    contactName: text(contact.fullName),
    contactEmail: text(contact.email),
  };
}

export type OwnerTransportProvider = MyTransportProvider & {
  email: string;
  phone: string;
  company: string;
};

export function normalizeOwnerTransportProvider(id: string, data: Record<string, unknown>): OwnerTransportProvider {
  return {
    ...normalizeMyTransportProvider(id, data),
    email: text(data.email),
    phone: text(data.phone),
    company: readNonEmptyString(data.company),
  };
}

export type OwnerTransportInterest = {
  id: string;
  email: string;
  interestType: string;
  page: string;
  createdAt: number;
};

export function normalizeOwnerTransportInterest(id: string, data: Record<string, unknown>): OwnerTransportInterest {
  return {
    id,
    email: text(data.email),
    interestType: readNonEmptyString(data.interestType) || "unknown",
    page: readNonEmptyString(data.page),
    createdAt: timestampMs(data.createdAt),
  };
}

export type OwnerCommunityReport = {
  id: string;
  reporterId: string;
  targetType: string;
  postId: string;
  replyId: string;
  reason: string;
  details: string;
  status: string;
  createdAt: number;
};

export function normalizeOwnerCommunityReport(id: string, data: Record<string, unknown>): OwnerCommunityReport {
  return {
    id,
    reporterId: readNonEmptyString(data.reporterId),
    targetType: readNonEmptyString(data.targetType) || "unknown",
    postId: readNonEmptyString(data.postId),
    replyId: readNonEmptyString(data.replyId),
    reason: readNonEmptyString(data.reason) || "unknown",
    details: readNonEmptyString(data.details),
    status: readNonEmptyString(data.status) || "unknown",
    createdAt: timestampMs(data.createdAt),
  };
}

export type OwnerReviewReport = {
  id: string;
  reviewId: string;
  reporterId: string;
  reason: string;
  details: string;
  status: string;
  createdAt: number;
};

export function normalizeOwnerReviewReport(id: string, data: Record<string, unknown>): OwnerReviewReport {
  return {
    id,
    reviewId: readNonEmptyString(data.reviewId),
    reporterId: readNonEmptyString(data.reporterId),
    reason: readNonEmptyString(data.reason) || "unknown",
    details: readNonEmptyString(data.details),
    status: readNonEmptyString(data.status) || "unknown",
    createdAt: timestampMs(data.createdAt),
  };
}

export type OwnerReportedContent = {
  title: string;
  body: string;
  author: string;
  status: string;
};

export function normalizeOwnerReportedPost(data: Record<string, unknown>): OwnerReportedContent {
  return {
    title: text(data.title, "Untitled post"),
    body: readNonEmptyString(data.body),
    author: readNonEmptyString(data.authorDisplayName) || "Unknown author",
    status: readNonEmptyString(data.status) || "unknown",
  };
}

export function normalizeOwnerReportedReply(data: Record<string, unknown>): OwnerReportedContent {
  return {
    title: "Reply",
    body: readNonEmptyString(data.body),
    author: readNonEmptyString(data.authorDisplayName) || "Unknown author",
    status: readNonEmptyString(data.status) || "unknown",
  };
}

export function normalizeOwnerReportedReview(data: Record<string, unknown>): OwnerReportedContent {
  const rating = typeof data.rating === "number" && data.rating >= 1 && data.rating <= 5 ? `${data.rating}/5` : "Unrated";
  return {
    title: `Review · ${rating}`,
    body: readNonEmptyString(data.comment),
    author: readNonEmptyString(data.reviewerId) ? `Reviewer ${readNonEmptyString(data.reviewerId)}` : "Unknown reviewer",
    status: readNonEmptyString(data.status) || "unknown",
  };
}

export type OwnerUser = {
  id: string;
  email: string;
  displayName: string;
  role: string;
  createdAt: number;
};

export function normalizeOwnerUser(id: string, data: Record<string, unknown>): OwnerUser {
  const role = readNonEmptyString(data.role);
  return {
    id,
    email: text(data.email),
    displayName: text(data.displayName, "No display name"),
    role: role === "host" || role === "guest" ? role : "unknown",
    createdAt: timestampMs(data.createdAt),
  };
}
