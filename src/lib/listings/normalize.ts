// src/lib/listings/normalize.ts

export type Hookups = "Full" | "Partial" | "None";
export type PricingType = "Night" | "Weekly" | "Monthly";

export type UiListing = {
  id: string;
  title: string;
  city: string;
  state: string;
  price: number;
  pricingType: PricingType;
  maxLengthFt: number;
  hookups: Hookups;

  amenityTags?: string[];
  environmentTags?: string[];

  amenities?: {
    power30?: boolean;
    power50?: boolean;
    water?: boolean;
    sewer?: boolean;
    dump?: boolean;
    laundry?: boolean;
    washFold?: boolean;
  };
};

function safeHookups(v: any): Hookups {
  return v === "Full" || v === "Partial" || v === "None" ? v : "None";
}

function safePricingType(v: any): PricingType {
  return v === "Night" || v === "Weekly" || v === "Monthly" ? v : "Night";
}

export function normalizeListing(id: string, data: any): UiListing {
  const title = String(data?.title ?? data?.name ?? "Untitled");
  const city = String(data?.city ?? "");
  const state = String(data?.state ?? "");

  const price =
    typeof data?.price === "number"
      ? data.price
      : typeof data?.pricePerNight === "number"
      ? data.pricePerNight
      : 0;

  const pricingType = safePricingType(data?.pricingType ?? "Night");

  const maxLengthFt =
    typeof data?.maxLengthFt === "number"
      ? data.maxLengthFt
      : 0;

  const hookups = safeHookups(data?.hookups);

  return {
    id,
    title,
    city,
    state,
    price,
    pricingType,
    maxLengthFt,
    hookups,
    amenityTags: Array.isArray(data?.amenityTags) ? data.amenityTags : undefined,
    environmentTags: Array.isArray(data?.environmentTags) ? data.environmentTags : undefined,
    amenities:
      data?.amenities && typeof data.amenities === "object"
        ? data.amenities
        : undefined,
  };
}
