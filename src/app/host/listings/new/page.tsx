"use client";

import React, { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { setDoc, doc, collection, serverTimestamp } from "firebase/firestore";
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
  const created = useRef<{ uid: string; id: string; saved: boolean } | null>(null);

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

      if (!created.current || created.current.uid !== userUid) {
        created.current = { uid: userUid, id: doc(collection(db, "listings")).id, saved: false };
      }
      const target = created.current;
      if (target.saved) delete basePayload.createdAt;
      await setDoc(doc(db, "listings", target.id), basePayload, { merge: true });
      target.saved = true;
      return target.id;
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
          key={userUid}
          initialValues={DEFAULT_LISTING_FORM_VALUES}
          saving={saving}
          status={status}
          submitLabel="Create Listing"
          savingLabel="Creating..."
          onSubmit={handleCreate}
          photoOwnerId={userUid}
          onComplete={() => router.push("/host")}
        />
      </main>
    </HostGuard>
  );
}
