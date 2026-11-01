import { normalizeSpotRequestStatus, readNonEmptyString } from "./request-spot-contract";

export type MyRequest = {
  id: string;
  requesterId: string;
  status: ReturnType<typeof normalizeSpotRequestStatus>;
  title: string;
  location: string;
  dates: string;
  rigSummary: string;
  createdAt: number;
};

function dateLabel(value: unknown): string {
  const text = readNonEmptyString(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return "";
  const date = new Date(`${text}T12:00:00`);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  });
}

export function normalizeMyRequest(id: string, data: Record<string, unknown>): MyRequest {
  const location = [readNonEmptyString(data.locationText) || readNonEmptyString(data.city), readNonEmptyString(data.state)]
    .filter(Boolean).join(", ") || "Location not set";
  const start = dateLabel(data.startDate);
  const end = dateLabel(data.endDate);
  const primary = data.primaryRv && typeof data.primaryRv === "object" ? data.primaryRv : {};
  const hookups = "hookupsPreference" in primary ? readNonEmptyString(primary.hookupsPreference) : "";
  const requestType = readNonEmptyString(data.requestType);
  const teamRequest = requestType === "Work Stay" || requestType === "Employer / Team Housing";
  const hasPrimary = "rigType" in primary && Boolean(readNonEmptyString(primary.rigType));
  const additionalCount = data.moreThanOneRv === true && Array.isArray(data.additionalRvs) ? data.additionalRvs.length : 0;
  // The form also persists hidden team-count defaults on personal requests.
  const rigCount = teamRequest && typeof data.rigsCount === "number" && Number.isInteger(data.rigsCount) && data.rigsCount > 0
    ? data.rigsCount : hasPrimary ? 1 + additionalCount : undefined;
  const rigs = rigCount ? `${rigCount} ${rigCount === 1 ? "RV" : "RVs"}` : "";
  const created = data.createdAt;
  const createdAt = created && typeof created === "object" && "seconds" in created && typeof created.seconds === "number"
    ? created.seconds * 1000 : 0;
  return {
    id, requesterId: readNonEmptyString(data.requesterId),
    status: normalizeSpotRequestStatus(data.status, data.isFinalized),
    title: requestType || "RV stay",
    location, dates: start || end ? `${start || "Arrival not set"} - ${end || "Departure not set"}` : "Dates not set",
    rigSummary: [rigs, hookups].filter(Boolean).join(" · ") || "RV preferences not provided",
    createdAt,
  };
}

function booleanField(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

export function validHostEmail(value: unknown): string {
  const email = readNonEmptyString(value);
  return /^[^\s@<>?&#%]+@[^\s@<>?&#%]+\.[^\s@<>?&#%]+$/.test(email) ? email : "";
}

export function normalizeHostResponse(id: string, data: Record<string, unknown>) {
  const amenities: string[] = [];
  for (const [field, yes, no] of [
    ["hasWater", "Water", "No water"],
    ["hasSewer", "Sewer", "No sewer"],
    ["hasWifi", "Wi-Fi", "No Wi-Fi"],
    ["allowsPets", "Pets allowed", "No pets"],
    ["fencedArea", "Fenced area", "Not fenced"],
  ]) {
    const value = booleanField(data[field]);
    if (value !== undefined) amenities.push(value ? yes : no);
  }
  const offered = readNonEmptyString(data.rvSpotsOffered);
  // Both verified writers store rvSpotsOffered as a string, including "5+".
  const count = typeof data.rvSpotsCount === "number" ? data.rvSpotsCount : /^[1-5]$/.test(offered) ? Number(offered) : undefined;
  const spots = offered === "5+" ? "5+ spots" : typeof count === "number" && Number.isInteger(count) && count > 0
    ? `${count} ${count === 1 ? "spot" : "spots"}` : "";
  const power = readNonEmptyString(data.powerOption);
  return {
    id, hostId: readNonEmptyString(data.hostId),
    name: readNonEmptyString(data.fullName) || "Host",
    location: [readNonEmptyString(data.cityLocation),
      readNonEmptyString(data.stateRegion)].filter(Boolean).join(", ") || "Location not provided",
    description: readNonEmptyString(data.spaceDescription),
    notes: readNonEmptyString(data.extraNotes),
    distance: readNonEmptyString(data.distanceToArea),
    timeFrame: readNonEmptyString(data.timeFrame),
    stayLength: readNonEmptyString(data.stayLength),
    access: readNonEmptyString(data.accessType),
    readiness: readNonEmptyString(data.hostingReadiness),
    email: validHostEmail(data.email),
    phone: readNonEmptyString(data.phone),
    openToCall: booleanField(data.openToCall),
    amenities: [spots, power && power !== "Not Sure Yet" ? power : "", ...amenities].filter(Boolean),
  };
}

export type HostResponse = ReturnType<typeof normalizeHostResponse>;
