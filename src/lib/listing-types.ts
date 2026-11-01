export const LISTING_TYPES = {
  rv_space: "Bring-your-own-RV space",
  land_space: "Land / space",
  host_rv: "Host-provided RV",
  mobile_home: "Mobile home",
  cabin: "Cabin",
} as const;
export type ListingType = keyof typeof LISTING_TYPES;
export type AccommodationType = "host_rv" | "mobile_home" | "cabin";
export type PricingPeriod = "Night" | "Weekly" | "Monthly";
export function accommodationRate(data: Record<string, unknown>) {
  const amount = data.price === undefined ? data.pricePerNight : data.price;
  const price = typeof amount === "number" && Number.isFinite(amount) && amount >= 0 ? amount : null;
  const pricingType: PricingPeriod | null = data.pricingType === "Night" || data.pricingType === "Weekly" || data.pricingType === "Monthly"
    ? data.pricingType : data.price === undefined && typeof data.pricePerNight === "number" ? "Night" : null;
  return { price, pricingType, label: pricingType === "Night" ? "night" : pricingType === "Weekly" ? "week" : pricingType === "Monthly" ? "month" : "" };
}
export function listingType(value: unknown): ListingType | null {
  return typeof value === "string" && Object.hasOwn(LISTING_TYPES, value) ? value as ListingType : null;
}
export function isAccommodation(value: unknown): value is AccommodationType {
  return value === "host_rv" || value === "mobile_home" || value === "cabin";
}
export function listingTypeLabel(value: unknown): string {
  const type = listingType(value);
  return type ? LISTING_TYPES[type] : "Legacy RV / land space";
}
export const BED_TYPES = ["single", "double", "queen", "king", "bunk", "sofa"] as const;
export type BedType = typeof BED_TYPES[number];
export type Accommodation = {
  maxGuests: number;
  bedrooms: number;
  sleepingAreas: number;
  beds: Record<BedType, number>;
  bathrooms: number;
  checkInFrom: string;
  checkInTo: string;
  checkOutBy: string;
  houseRules: string;
  rvType: string;
  rvLengthFt: number | null;
  utilityNotes: string;
  accessNotes: string;
};
export const EMPTY_ACCOMMODATION: Accommodation = {
  maxGuests: 0, bedrooms: 0, sleepingAreas: 1,
  beds: { single: 0, double: 0, queen: 0, king: 0, bunk: 0, sofa: 0 },
  bathrooms: 0, checkInFrom: "", checkInTo: "", checkOutBy: "", houseRules: "",
  rvType: "", rvLengthFt: null, utilityNotes: "", accessNotes: "",
};
export function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
export function capacity(data: Record<string, unknown>): number | null {
  const value = record(data.accommodation).maxGuests;
  return typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 30 ? value : null;
}
export function readAccommodation(value: unknown): Accommodation {
  const data = record(value), beds = record(data.beds);
  const number = (key: string, fallback: number) => typeof data[key] === "number" && Number.isFinite(data[key]) ? data[key] as number : fallback;
  const text = (key: string) => typeof data[key] === "string" ? data[key] as string : "";
  return {
    maxGuests: number("maxGuests", 0), bedrooms: number("bedrooms", 0), sleepingAreas: number("sleepingAreas", 1),
    bathrooms: number("bathrooms", 0), beds: Object.fromEntries(BED_TYPES.map(key => [key, typeof beds[key] === "number" ? beds[key] : 0])) as Record<BedType, number>,
    checkInFrom: text("checkInFrom"), checkInTo: text("checkInTo"), checkOutBy: text("checkOutBy"),
    houseRules: text("houseRules"), rvType: text("rvType"), rvLengthFt: typeof data.rvLengthFt === "number" ? data.rvLengthFt : null,
    utilityNotes: text("utilityNotes"), accessNotes: text("accessNotes"),
  };
}
export function validateAccommodation(value: Accommodation, type: ListingType): string | null {
  if (!Number.isInteger(value.maxGuests) || value.maxGuests < 1 || value.maxGuests > 30) return "Maximum guests must be a whole number from 1 to 30.";
  for (const key of ["bedrooms", "sleepingAreas"] as const) {
    if (!Number.isInteger(value[key]) || value[key] < (key === "sleepingAreas" ? 1 : 0) || value[key] > 20) return "Enter bedrooms (0 for a studio) and sleeping areas from 1 to 20.";
  }
  if (!Number.isFinite(value.bathrooms) || value.bathrooms < 0 || value.bathrooms > 20 || !Number.isInteger(value.bathrooms * 2)) return "Bathrooms must be 0 to 20 in half-bath increments.";
  if (BED_TYPES.some(key => !Number.isInteger(value.beds[key]) || value.beds[key] < 0 || value.beds[key] > 30) || !BED_TYPES.some(key => value.beds[key] > 0)) return "Declare at least one bed; each bed count must be 0 to 30.";
  for (const key of ["checkInFrom", "checkInTo", "checkOutBy"] as const) if (value[key] && !/^([01]\d|2[0-3]):[0-5]\d$/.test(value[key])) return "Use valid 24-hour arrival and departure times.";
  if (value.checkInFrom && value.checkInTo && value.checkInFrom > value.checkInTo) return "Check-in end must not precede its start. Describe overnight arrangements in house rules.";
  if (value.houseRules.length > 2000 || value.utilityNotes.length > 1000 || value.accessNotes.length > 500) return "House rules, utility notes, or access notes exceed their length limit.";
  if (value.rvType.length > 80 || (value.rvLengthFt !== null && (!Number.isFinite(value.rvLengthFt) || value.rvLengthFt <= 0 || value.rvLengthFt > 100))) return "Retained RV details must use a type up to 80 characters and a size over 0 and up to 100 ft.";
  if (type === "host_rv" && (!value.rvType.trim() || value.rvType.length > 80 || value.rvLengthFt === null || !Number.isFinite(value.rvLengthFt) || value.rvLengthFt <= 0 || value.rvLengthFt > 100)) return "Describe the host-provided RV type and approximate size (up to 100 ft).";
  return null;
}
export function sleepingLabel(data: Record<string, unknown>): string {
  const a = record(data.accommodation), beds = record(a.beds);
  const descriptions = BED_TYPES.filter(key => typeof beds[key] === "number" && Number.isInteger(beds[key]) && Number(beds[key]) > 0 && Number(beds[key]) <= 30)
    .map(key => `${beds[key]} ${key === "bunk" ? "bunk bed" : key === "sofa" ? "sofa bed" : key}${Number(beds[key]) === 1 ? "" : "s"}`);
  return descriptions.length ? descriptions.join(", ") : "Sleeping arrangements not provided";
}
export function inquiryEstimate(rate: number, period: string, nights: number): number | null {
  return (period === "Night" || period === "night") && Number.isFinite(rate) && rate >= 0 && Number.isInteger(nights) && nights > 0
    ? Math.round(rate * nights * 100) / 100 : null;
}
export function inquiryNights(checkIn: string, checkOut: string): number {
  const day = (value: string) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return NaN;
    const date = new Date(`${value}T00:00:00Z`);
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value ? date.getTime() : NaN;
  };
  const nights = (day(checkOut) - day(checkIn)) / 86400000;
  return Number.isInteger(nights) && nights > 0 && nights <= 3660 ? nights : 0;
}
export function listingFieldEdits(initial: Record<string, unknown>, next: Record<string, unknown>): Record<string, unknown> {
  const edits: Record<string, unknown> = {};
  const visit = (before: unknown, after: unknown, path: string) => {
    if (JSON.stringify(before) === JSON.stringify(after)) return;
    if (after !== null && typeof after === "object" && !Array.isArray(after)) {
      for (const [key, value] of Object.entries(after)) visit(record(before)[key], value, `${path}.${key}`);
    } else edits[path] = after;
  };
  for (const [key, value] of Object.entries(next)) {
    if (key === "accommodation" || key === "stayAmenities") visit(initial[key], value, key);
    else if (JSON.stringify(initial[key]) !== JSON.stringify(value)) edits[key] = value;
  }
  return edits;
}
export function inquiryBookingType(type: ListingType | null): "RV" | "LAND" | "RV_PROVIDED" {
  return isAccommodation(type) ? "RV_PROVIDED" : type === "land_space" ? "LAND" : "RV";
}
