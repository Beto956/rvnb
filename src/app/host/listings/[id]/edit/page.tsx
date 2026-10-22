"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { deleteField, doc, getDoc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";

import HostGuard from "../../../../components/HostGuard";
import HostListingForm, {
  GeocodeResult,
  Hookups,
  ListingFormValues,
  PricingType,
  backLink,
  buildListingFields,
  buildLocationFields,
  geocodeCityState,
  hero,
  heroSub,
  heroTitle,
  validateListingForm,
  wrap,
} from "../../../../components/HostListingForm";

type LoadState =
  | { kind: "loading" }
  | { kind: "not-found" }
  | { kind: "not-authorized" }
  | { kind: "error"; message: string }
  | { kind: "ready"; values: ListingFormValues; hadAutoCoords: boolean };

type ListingDoc = Record<string, unknown>;

function readString(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function readNumber(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function safeHookups(v: unknown): Hookups {
  return v === "Full" || v === "Partial" || v === "None" ? v : "None";
}

function safePricingType(v: unknown): PricingType {
  return v === "Night" || v === "Weekly" || v === "Monthly" ? v : "Night";
}

/** Reverse of buildListingFields: maps a stored listing doc back into form values. */
function listingToFormValues(data: ListingDoc): ListingFormValues {
  const legacyAmenities =
    data.amenities && typeof data.amenities === "object"
      ? (data.amenities as Record<string, unknown>)
      : {};

  const power = readString(data.power);
  const water = readString(data.water);
  const sewer = readString(data.sewer);
  const laundry = readString(data.laundry);

  const lat = readNumber(data.lat);
  const lng = readNumber(data.lng);
  const isManualPin = data.geocodeAddress === "MANUAL_PIN" && lat !== null && lng !== null;

  return {
    title: readString(data.title),
    city: readString(data.city),
    stateCode: readString(data.state).trim().toUpperCase(),
    price: readNumber(data.price) ?? readNumber(data.pricePerNight) ?? 0,
    pricingType: safePricingType(data.pricingType),
    maxLengthFt: readNumber(data.maxLengthFt) ?? 0,
    hookups: safeHookups(data.hookups),
    description: readString(data.description),
    nearbyAttractions: readString(data.nearbyAttractions),

    power30: power
      ? power === "30A" || power === "30A/50A"
      : legacyAmenities.power30 === true,
    power50: power
      ? power === "50A" || power === "30A/50A"
      : legacyAmenities.power50 === true,
    water: water ? water === "Yes" : legacyAmenities.water === true,
    sewer: sewer ? sewer === "Yes" : legacyAmenities.sewer === true,
    dump: sewer ? sewer === "Dump station" : legacyAmenities.dump === true,
    laundry: laundry
      ? laundry === "Washer/Dryer" || laundry === "Both"
      : legacyAmenities.laundry === true,
    washFold: laundry
      ? laundry === "Wash & Fold" || laundry === "Both"
      : legacyAmenities.washFold === true,

    wifi: data.wifi === true,
    petsAllowed: data.petsAllowed === true,
    firePit: data.firePit === true,
    picnicTable: data.picnicTable === true,
    pullThrough: data.pullThrough === true,
    trashPickup: data.trashPickup === true,
    securityCameras: data.securityCameras === true,
    gym: data.gym === true,
    bathrooms: data.bathrooms === true,
    showers: data.showers === true,

    manualLocationEnabled: isManualPin,
    manualLat: isManualPin ? lat : null,
    manualLng: isManualPin ? lng : null,
  };
}

export default function EditListingPage() {
  return (
    <HostGuard>
      <EditListingContent />
    </HostGuard>
  );
}

function EditListingContent() {
  const router = useRouter();
  const params = useParams<{ id?: string | string[] }>();
  const rawId = params?.id;
  const listingId = (Array.isArray(rawId) ? rawId[0] : rawId ?? "").trim();

  const { user, loading: authLoading } = useAuth();
  const userUid = user?.uid ?? "";

  const [loadState, setLoadState] = useState<LoadState>({ kind: "loading" });
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string>("");

  useEffect(() => {
    if (authLoading || !userUid) return;
    let cancelled = false;

    (async () => {
      if (!listingId) {
        if (!cancelled) setLoadState({ kind: "not-found" });
        return;
      }
      try {
        const snap = await getDoc(doc(db, "listings", listingId));
        if (cancelled) return;
        if (!snap.exists()) {
          setLoadState({ kind: "not-found" });
          return;
        }
        const data = snap.data() as ListingDoc;
        const ownerId = readString(data.hostId).trim();
        if (!ownerId || ownerId !== userUid) {
          setLoadState({ kind: "not-authorized" });
          return;
        }
        const values = listingToFormValues(data);
        const hadAutoCoords =
          !values.manualLocationEnabled &&
          readNumber(data.lat) !== null &&
          readNumber(data.lng) !== null;
        setLoadState({ kind: "ready", values, hadAutoCoords });
      } catch (e) {
        console.error(e);
        if (!cancelled) {
          setLoadState({ kind: "error", message: "Could not load this listing. Please try again." });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [authLoading, userUid, listingId]);

  async function handleSave(values: ListingFormValues) {
    if (loadState.kind !== "ready") return;

    setStatus("");
    const err = validateListingForm(values);
    if (err) {
      setStatus(`⚠️ ${err}`);
      return;
    }

    if (!userUid) {
      setStatus("⚠️ You must be logged in to edit a listing.");
      return;
    }

    const initial = loadState.values;
    const c = values.city.trim();
    const s = values.stateCode.trim().toUpperCase();

    // Keep existing auto-geocoded coordinates when the location inputs did not change.
    const locationUnchanged =
      !values.manualLocationEnabled &&
      loadState.hadAutoCoords &&
      c === initial.city.trim() &&
      s === initial.stateCode.trim().toUpperCase();

    setSaving(true);
    try {
      // Owner field (hostId) and createdAt are intentionally never written here.
      const updates: Record<string, unknown> = buildListingFields(values);

      if (!locationUnchanged) {
        let geo: GeocodeResult | null = null;
        if (!values.manualLocationEnabled && c && s) {
          geo = await geocodeCityState(c, s);
        }
        const location = buildLocationFields(values, geo);
        if (location) {
          Object.assign(updates, location);
        } else {
          // Same outcome as create when no location can be resolved: no stale pin is kept.
          updates.lat = deleteField();
          updates.lng = deleteField();
          updates.placeId = deleteField();
          updates.geocodeAddress = deleteField();
        }
      }

      await updateDoc(doc(db, "listings", listingId), updates);

      router.push("/host");
    } catch (e) {
      console.error(e);
      setStatus("❌ Could not save listing changes.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main style={wrap}>
      <div style={hero}>
        <div>
          <Link href="/host" style={backLink}>
            ← Back to dashboard
          </Link>
          <h1 style={heroTitle}>Edit listing</h1>
          <p style={heroSub}>
            Update your spot&apos;s details. Changes appear on your listing page as soon as you
            save.
          </p>
        </div>
      </div>

      {loadState.kind === "ready" ? (
        <HostListingForm
          initialValues={loadState.values}
          saving={saving}
          status={status}
          submitLabel="Save Changes"
          savingLabel="Saving..."
          onSubmit={handleSave}
        />
      ) : (
        <section style={stateCard}>
          {loadState.kind === "loading" && <div style={stateTitle}>Loading listing...</div>}
          {loadState.kind === "not-found" && (
            <>
              <div style={stateTitle}>Listing not found</div>
              <p style={stateText}>This listing doesn&apos;t exist or may have been removed.</p>
            </>
          )}
          {loadState.kind === "not-authorized" && (
            <>
              <div style={stateTitle}>Not authorized</div>
              <p style={stateText}>You can only edit listings that you host.</p>
            </>
          )}
          {loadState.kind === "error" && (
            <>
              <div style={stateTitle}>Something went wrong</div>
              <p style={stateText}>{loadState.message}</p>
            </>
          )}
          {loadState.kind !== "loading" && (
            <Link href="/host" style={backLink}>
              ← Back to dashboard
            </Link>
          )}
        </section>
      )}
    </main>
  );
}

const stateCard: React.CSSProperties = {
  padding: 20,
  borderRadius: 18,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(255,255,255,0.05)",
  maxWidth: 760,
  margin: "0 auto",
};

const stateTitle: React.CSSProperties = { fontSize: 20, fontWeight: 900 };
const stateText: React.CSSProperties = { marginTop: 8, opacity: 0.8, lineHeight: 1.5 };
