import { accommodationRate, capacity, isAccommodation, listingType, record, type AccommodationType, type PricingPeriod } from "./listing-types";
import { listingPhotos } from "./listing-photos";
import { amenityAvailable, normalizeStayAmenities, relevantAmenities, type StayAmenityKey, STAY_AMENITIES } from "./stay-amenities";
import { hasListingCoordinates } from "./listing-location";

export type UniqueStay = {
  id: string; title: string; city: string; state: string; listingType: AccommodationType;
  accommodation: Record<string, unknown>; photos: string[];
  price: number | null; pricingType: PricingPeriod | null; raw: Record<string, unknown>;
  lat?: number; lng?: number;
};
export function normalizeUniqueStay(id: string, data: Record<string, unknown>): UniqueStay | null {
  const type = listingType(data.listingType);
  if (!isAccommodation(type)) return null;
  const rate = accommodationRate(data);
  return {
    id, listingType: type, accommodation: record(data.accommodation), raw: data,
    title: typeof data.title === "string" && data.title.trim() ? data.title : "Untitled accommodation",
    city: typeof data.city === "string" ? data.city : "", state: typeof data.state === "string" ? data.state : "",
    photos: listingPhotos(data), price: rate.price, pricingType: rate.pricingType,
    ...(hasListingCoordinates(data) ? { lat: data.lat, lng: data.lng } : {}),
  };
}
export type StayFilters = { q: string; type: string; guests: number; amenities: StayAmenityKey[]; privateOnly: boolean };
export function readStayFilters(params: URLSearchParams): StayFilters {
  const guests = Number(params.get("guests"));
  return {
    q: (params.get("q") ?? "").trim().slice(0, 120),
    type: isAccommodation(params.get("type")) ? params.get("type")! : "",
    guests: Number.isInteger(guests) && guests >= 1 && guests <= 30 ? guests : 0,
    amenities: STAY_AMENITIES.filter(([key]) => params.getAll("amenity").includes(key)).map(([key]) => key),
    privateOnly: params.get("private") === "true",
  };
}
export function matchesUniqueStay(stay: UniqueStay, filters: StayFilters) {
  if (filters.type && stay.listingType !== filters.type) return false;
  if (filters.q && !`${stay.title} ${stay.city} ${stay.state}`.toLowerCase().includes(filters.q.toLowerCase())) return false;
  const maximum = capacity(stay.raw);
  if (filters.guests && (maximum === null || maximum < filters.guests)) return false;
  const amenities = normalizeStayAmenities(stay.raw);
  const applicable = new Set(relevantAmenities(stay.listingType).map(([key]) => key));
  return filters.amenities.every(key => applicable.has(key) && (filters.privateOnly ? amenities[key] === "private" : amenityAvailable(amenities[key])));
}
