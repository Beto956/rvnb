import { doc, runTransaction, serverTimestamp } from "firebase/firestore";
import { auth, db } from "./firebase";
import { growthRegistrationId, HOST_GROWTH_INTAKE_ENABLED, validateGrowth, type GrowthValues } from "./host-growth";

export async function saveGrowthRegistration(uid: string, values: GrowthValues): Promise<"created" | "existing"> {
  if (!HOST_GROWTH_INTAKE_ENABLED) throw new Error("Registration is paused pending an approved privacy notice.");
  if (auth.currentUser?.uid !== uid) throw new Error("Sign in again before registering.");
  if (Object.keys(validateGrowth(values)).length) throw new Error("Correct the highlighted registration fields.");
  const ref = doc(db, "hostGrowthRegistrations", growthRegistrationId(uid, values.listingId));
  return runTransaction(db, async transaction => {
    const existing = await transaction.get(ref);
    if (existing.exists()) return "existing";
    if (values.listingId) {
      const listing = await transaction.get(doc(db, "listings", values.listingId));
      if (!listing.exists() || listing.data().hostId !== uid) throw new Error("Choose a listing you currently own.");
    }
    transaction.set(ref, {
      schemaVersion: 1, pilotId: "pilot-01", ownerId: uid, listingId: values.listingId || null,
      city: values.listingId ? "" : values.city.trim(),
      stateRegion: values.listingId ? "" : values.stateRegion.trim(),
      category: values.category, description: values.description.trim(),
      estimatedCostCents: Math.round(Number(values.estimatedCost) * 100),
      requestedSupportCents: Math.round(Number(values.requestedSupport) * 100),
      propertyPermission: true, contactEmail: values.contactEmail.trim(),
      contactConsent: true, status: "registered", createdAt: serverTimestamp(),
    });
    return "created";
  });
}
