export const HOST_GROWTH_INTAKE_ENABLED = false;
export const HOST_GROWTH_CATEGORIES = ["Wi-Fi coverage", "Entrance signage", "Listing photography", "Site preparation"] as const;
export type GrowthValues = {
  listingId: string;
  city: string;
  stateRegion: string;
  category: string;
  description: string;
  estimatedCost: string;
  requestedSupport: string;
  propertyPermission: boolean;
  contactEmail: string;
  contactConsent: boolean;
};
export type GrowthErrors = Partial<Record<keyof GrowthValues, string>>;

export function growthRegistrationId(uid: string, listingId: string) {
  if (!uid || /[/]/.test(uid) || /[/]/.test(listingId) || listingId.length > 150) throw new Error("Invalid registration identity.");
  return `${uid}__${listingId ? `listing__${listingId}` : "proposed"}`;
}

export function validateGrowth(values: GrowthValues): GrowthErrors {
  const errors: GrowthErrors = {};
  if (!values.listingId) {
    if (!values.city.trim() || values.city.trim().length > 80) errors.city = "Enter a general city, up to 80 characters.";
    if (!values.stateRegion.trim() || values.stateRegion.trim().length > 80) errors.stateRegion = "Enter a state or region, up to 80 characters.";
  }
  if (!HOST_GROWTH_CATEGORIES.some(category => category === values.category)) errors.category = "Choose an improvement category.";
  if (values.description.trim().length < 20 || values.description.trim().length > 1000) errors.description = "Describe the project in 20 to 1,000 characters. Do not include private or financial details.";
  const cost = Number(values.estimatedCost);
  const support = Number(values.requestedSupport);
  const dollars = /^\d+(\.\d{1,2})?$/;
  if (!dollars.test(values.estimatedCost) || !Number.isFinite(cost) || cost < 0.01 || cost > 100000) errors.estimatedCost = "Enter an estimated USD cost from $0.01 to $100,000, with at most two decimal places.";
  if (!dollars.test(values.requestedSupport) || !Number.isFinite(support) || support < 0.01 || support > 500 || support > cost) errors.requestedSupport = "Enter an estimate from $0.01 to $500, no greater than the project cost, with at most two decimal places.";
  if (!values.propertyPermission) errors.propertyPermission = "Confirm ownership or written permission.";
  if (values.contactEmail.trim().length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.contactEmail.trim())) errors.contactEmail = "Enter a valid contact email.";
  if (!values.contactConsent) errors.contactConsent = "Permission to contact you about this registration is required.";
  return errors;
}
