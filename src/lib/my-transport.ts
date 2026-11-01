import { readNonEmptyString } from "./request-spot-contract";
import {
  TRANSPORT_OPERATING_SCOPE_LABELS,
  TRANSPORT_PROVIDER_TYPE_LABELS,
  transportServiceLabel,
} from "./transport-options";

export type MyTransportRequest = {
  id: string;
  route: string;
  rvSummary: string;
  method: string;
  pickupDate: string;
  status: string;
  createdAt: number;
};

export type MyTransportProvider = {
  id: string;
  name: string;
  typeLabel: string;
  scopeLabel: string;
  services: string[];
  serviceArea: string;
  createdAt: number;
};

function timestampMs(value: unknown): number {
  return value && typeof value === "object" && "seconds" in value && typeof value.seconds === "number"
    ? value.seconds * 1000
    : 0;
}

function dateLabel(value: unknown): string {
  const text = readNonEmptyString(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return "";
  const date = new Date(`${text}T12:00:00`);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  });
}

function regionLabel(value: unknown): string {
  const region = value && typeof value === "object" ? value as Record<string, unknown> : {};
  return [readNonEmptyString(region.city), readNonEmptyString(region.state)].filter(Boolean).join(", ");
}

export function normalizeMyTransportRequest(id: string, data: Record<string, unknown>): MyTransportRequest {
  const rv = data.rv && typeof data.rv === "object" ? data.rv as Record<string, unknown> : {};
  const timing = data.timing && typeof data.timing === "object" ? data.timing as Record<string, unknown> : {};
  const length = typeof rv.lengthFt === "number" && Number.isFinite(rv.lengthFt) && rv.lengthFt > 0 ? `${rv.lengthFt} ft` : "";
  const pickup = regionLabel(data.pickup);
  const destination = regionLabel(data.destination);
  return {
    id,
    route: pickup || destination
      ? `${pickup || "Pickup not provided"} → ${destination || "Destination not provided"}`
      : "Route not provided",
    rvSummary: [readNonEmptyString(rv.type), length].filter(Boolean).join(" • ") || "RV details not provided",
    method: readNonEmptyString(rv.movementMethod),
    pickupDate: dateLabel(timing.pickupDate),
    status: readNonEmptyString(data.status) === "submitted" ? "Submitted" : "Status unknown",
    createdAt: timestampMs(data.createdAt),
  };
}

export function normalizeMyTransportProvider(id: string, data: Record<string, unknown>): MyTransportProvider {
  const services = Array.isArray(data.services)
    ? data.services.filter((item): item is string => typeof item === "string").map(transportServiceLabel).filter(Boolean)
    : [];
  return {
    id,
    name: readNonEmptyString(data.name) || "Provider registration",
    typeLabel: TRANSPORT_PROVIDER_TYPE_LABELS[readNonEmptyString(data.providerType)] || "",
    scopeLabel: TRANSPORT_OPERATING_SCOPE_LABELS[readNonEmptyString(data.operatingScope)] || "",
    services,
    serviceArea: readNonEmptyString(data.serviceArea),
    createdAt: timestampMs(data.createdAt),
  };
}
