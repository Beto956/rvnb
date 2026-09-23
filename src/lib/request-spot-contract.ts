export type SpotRequestStatus = "draft" | "open" | "closed" | "unknown";

export type SpotRequestOwnership = {
  requesterId?: string;
  status?: string;
  isFinalized?: boolean;
};

export function normalizeSpotRequestStatus(
  rawStatus?: unknown,
  isFinalized?: unknown
): SpotRequestStatus {
  const value = typeof rawStatus === "string" ? rawStatus.trim().toLowerCase() : "";

  if (value === "draft") return "draft";
  if (value === "open") return "open";
  if (value === "closed") return "closed";
  if (!value && isFinalized === true) return "open";
  return "unknown";
}

export function isFinalizedOpenRequest(request: SpotRequestOwnership): boolean {
  const status = normalizeSpotRequestStatus(request.status, request.isFinalized);
  return status === "open" && request.isFinalized !== false;
}

export function createLinkedResponseId(requestId: unknown, hostId: unknown): string | null {
  const safeRequestId = typeof requestId === "string" ? requestId.trim() : "";
  const safeHostId = typeof hostId === "string" ? hostId.trim() : "";
  if (!safeRequestId || !safeHostId) return null;

  return `${encodeURIComponent(safeRequestId)}__${encodeURIComponent(safeHostId)}`;
}

export function readNonEmptyString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}
