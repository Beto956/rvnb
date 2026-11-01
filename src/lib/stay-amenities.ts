import { record } from "./listing-types";

export const AMENITY_STATES = ["unknown", "available", "private", "shared", "unavailable", "not_applicable"] as const;
export type AmenityState = typeof AMENITY_STATES[number];
export const AMENITY_STATE_LABELS: Record<AmenityState, string> = {
  unknown: "Not provided", available: "Available (arrangement not specified)", private: "Private / in-unit",
  shared: "Shared", unavailable: "Unavailable", not_applicable: "Not applicable",
};
export const STAY_AMENITIES = [
  ["wifi", "Wi-Fi", "Comfort", "signal"],
  ["heating", "Heating", "Comfort", "climate"],
  ["airConditioning", "Air conditioning", "Comfort", "climate"],
  ["fullKitchen", "Full kitchen", "Kitchen & bathroom", "home"],
  ["kitchenette", "Kitchenette", "Kitchen & bathroom", "home"],
  ["refrigerator", "Refrigerator", "Kitchen & bathroom", "home"],
  ["microwave", "Microwave", "Kitchen & bathroom", "home"],
  ["cooktop", "Stove / cooktop", "Kitchen & bathroom", "home"],
  ["oven", "Oven", "Kitchen & bathroom", "home"],
  ["bathroom", "Bathroom facilities", "Kitchen & bathroom", "water"],
  ["shower", "Shower", "Kitchen & bathroom", "water"],
  ["hotWater", "Hot water", "Kitchen & bathroom", "water"],
  ["linens", "Bed linens", "Comfort", "home"],
  ["towels", "Towels", "Comfort", "home"],
  ["laundry", "Laundry access", "Comfort", "home"],
  ["parking", "Parking", "Outdoors & access", "outdoors"],
  ["outdoorSeating", "Outdoor seating", "Outdoors & access", "outdoors"],
  ["picnicTable", "Picnic table", "Outdoors & access", "outdoors"],
  ["grill", "Grill", "Outdoors & access", "outdoors"],
  ["firePit", "Fire pit", "Outdoors & access", "outdoors"],
  ["porchDeck", "Porch / deck", "Outdoors & access", "outdoors"],
  ["petsAllowed", "Pets allowed (see house rules)", "Outdoors & access", "outdoors"],
  ["stepFreeEntrance", "Step-free entrance (host-described)", "Outdoors & access", "home"],
  ["connectedPower", "Connected electrical power", "RV utilities", "power"],
  ["potableWater", "Potable water supply", "RV utilities", "water"],
  ["sewerConnection", "Sewer connection", "RV utilities", "water"],
  ["holdingTank", "Host-managed holding tank", "RV utilities", "water"],
  ["smokeAlarm", "Smoke alarm", "Host safety declarations", "shield"],
  ["coAlarm", "Carbon-monoxide alarm", "Host safety declarations", "shield"],
  ["fireExtinguisher", "Fire extinguisher", "Host safety declarations", "shield"],
] as const;
export type StayAmenityKey = typeof STAY_AMENITIES[number][0];
export type StayAmenities = Partial<Record<StayAmenityKey, AmenityState>>;
export function amenityAvailable(state: unknown) { return state === "available" || state === "private" || state === "shared"; }
export function normalizeStayAmenities(data: Record<string, unknown>): StayAmenities {
  const stored = record(data.stayAmenities);
  const result: StayAmenities = {};
  for (const [key] of STAY_AMENITIES) {
    if (Object.hasOwn(stored, key)) {
      result[key] = AMENITY_STATES.includes(stored[key] as AmenityState) ? stored[key] as AmenityState : "unknown";
      continue;
    }
    // Only verified, meaning-equivalent fields. No inference of utility connections or private facilities.
    const legacy = key === "shower" ? data.showers : key === "bathroom" ? data.bathrooms : data[key];
    if (["wifi", "petsAllowed", "firePit", "picnicTable", "bathroom", "shower"].includes(key) && typeof legacy === "boolean") result[key] = legacy ? "available" : "unavailable";
    else if (key === "laundry" && ["Washer/Dryer", "Wash & Fold", "Both", "None"].includes(String(data.laundry))) result[key] = data.laundry === "None" ? "unavailable" : "available";
    else result[key] = "unknown";
  }
  return result;
}
export function relevantAmenities(type: unknown) {
  return STAY_AMENITIES.filter(([, , group]) => group !== "RV utilities" || type === "host_rv");
}
export function amenityProjections(amenities: StayAmenities): Record<string, boolean> {
  const result: Record<string, boolean> = {};
  for (const [key, legacy] of [["wifi", "wifi"], ["petsAllowed", "petsAllowed"], ["firePit", "firePit"],
    ["picnicTable", "picnicTable"], ["bathroom", "bathrooms"], ["shower", "showers"]] as const) {
    if (amenities[key] && amenities[key] !== "unknown" && amenities[key] !== "not_applicable") result[legacy] = amenityAvailable(amenities[key]);
  }
  return result;
}
