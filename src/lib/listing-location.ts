export function hasListingCoordinates(value: { lat?: unknown; lng?: unknown }): value is { lat: number; lng: number } {
  return typeof value.lat === "number" && Number.isFinite(value.lat) && value.lat >= -90 && value.lat <= 90
    && typeof value.lng === "number" && Number.isFinite(value.lng) && value.lng >= -180 && value.lng <= 180;
}
