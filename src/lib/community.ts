export type CommunityCategory =
  | "destinations_campgrounds"
  | "routes_road_conditions"
  | "ownership_maintenance"
  | "full_time_living"
  | "boondocking_dry_camping"
  | "families_pets"
  | "safety_preparedness"
  | "hosting_guest_advice"
  | "repairs_roadside"
  | "events_meetups"
  | "general_discussion";

export const COMMUNITY_CATEGORIES: readonly { id: CommunityCategory; label: string }[] = [
  { id: "destinations_campgrounds", label: "Destinations & Campgrounds" },
  { id: "routes_road_conditions", label: "Routes & Road Conditions" },
  { id: "ownership_maintenance", label: "RV Ownership & Maintenance" },
  { id: "full_time_living", label: "Full-Time RV Living" },
  { id: "boondocking_dry_camping", label: "Boondocking & Dry Camping" },
  { id: "families_pets", label: "Families & Pets" },
  { id: "safety_preparedness", label: "Safety & Preparedness" },
  { id: "hosting_guest_advice", label: "Hosting & Guest Advice" },
  { id: "repairs_roadside", label: "Repairs & Roadside Help" },
  { id: "events_meetups", label: "Events & Meetups" },
  { id: "general_discussion", label: "General Discussion" },
] as const;

export function categoryLabel(id: string): string {
  return COMMUNITY_CATEGORIES.find((c) => c.id === id)?.label ?? "General Discussion";
}

export type ReportReason =
  | "spam"
  | "scam_fraud"
  | "harassment"
  | "dangerous_advice"
  | "private_information"
  | "misinformation"
  | "other";

export const REPORT_REASONS: readonly { id: ReportReason; label: string }[] = [
  { id: "spam", label: "Spam" },
  { id: "scam_fraud", label: "Scam or fraud" },
  { id: "harassment", label: "Harassment" },
  { id: "dangerous_advice", label: "Dangerous advice" },
  { id: "private_information", label: "Private information" },
  { id: "misinformation", label: "Misinformation" },
  { id: "other", label: "Other" },
] as const;

export const NEUTRAL_AUTHOR_LABEL = "RVNB Member";

export function safeAuthorName(name: string | null | undefined): string {
  const trimmed = (name ?? "").trim();
  return trimmed.length > 0 ? trimmed : NEUTRAL_AUTHOR_LABEL;
}

export function formatCommunityDate(value: unknown): string {
  const date = toDate(value);
  if (!date) return "";
  return date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function toDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === "object" && value !== null && "toDate" in value && typeof (value as { toDate: unknown }).toDate === "function") {
    return (value as { toDate: () => Date }).toDate();
  }
  return null;
}

export function wasEdited(createdAt: unknown, updatedAt: unknown): boolean {
  const created = toDate(createdAt)?.getTime();
  const updated = toDate(updatedAt)?.getTime();
  if (created == null || updated == null) return false;
  return updated - created > 60_000;
}

export function initialsFromName(name: string | null | undefined): string {
  const safe = safeAuthorName(name);
  const parts = safe.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function formatRelativeTime(value: unknown): string {
  const date = toDate(value);
  if (!date) return "";
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.round(diffMs / 60_000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.round(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d ago`;
  return formatCommunityDate(value);
}
