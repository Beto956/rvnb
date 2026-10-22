"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";

import HostGuard from "../../../components/HostGuard";
import HostListingForm, {
  DEFAULT_LISTING_FORM_VALUES,
  GeocodeResult,
  ListingFormValues,
  backLink,
  buildListingFields,
  buildLocationFields,
  geocodeCityState,
  hero,
  heroSub,
  heroTitle,
  validateListingForm,
  wrap,
} from "../../../components/HostListingForm";

export default function NewListingPage() {
  const router = useRouter();
  const { user } = useAuth();
  const userUid = user?.uid ?? "";

  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string>("");

  async function handleCreate(values: ListingFormValues) {
    setStatus("");
    const err = validateListingForm(values);
    if (err) {
      setStatus(`⚠️ ${err}`);
      return;
    }

    if (!userUid) {
      setStatus("⚠️ You must be logged in to create a listing.");
      return;
    }

    const c = values.city.trim();
    const s = values.stateCode.trim().toUpperCase();

    setSaving(true);
    try {
      let geo: GeocodeResult | null = null;
      if (!values.manualLocationEnabled && c && s) {
        geo = await geocodeCityState(c, s);
      }

      const basePayload: Record<string, unknown> = {
        hostId: userUid,
        ...buildListingFields(values),
        createdAt: serverTimestamp(),
      };

      const location = buildLocationFields(values, geo);
      if (location) Object.assign(basePayload, location);

      await addDoc(collection(db, "listings"), basePayload);

      router.push("/host");
    } catch (e) {
      console.error(e);
      setStatus("❌ Could not create listing.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <HostGuard>
      <main style={wrap}>
        <div style={hero}>
          <div>
            <Link href="/host" style={backLink}>
              ← Back to dashboard
            </Link>
            <h1 style={heroTitle}>Add a new listing</h1>
            <p style={heroSub}>
              These fields match what your listing pages read. Create your spot and
              it will appear on your dashboard immediately.
            </p>
          </div>
        </div>

        <HostListingForm
          initialValues={DEFAULT_LISTING_FORM_VALUES}
          saving={saving}
          status={status}
          submitLabel="Create Listing"
          savingLabel="Creating..."
          onSubmit={handleCreate}
        />
      </main>
    </HostGuard>
  );
}
