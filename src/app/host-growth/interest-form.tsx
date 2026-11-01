"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { collection, getDocsFromServer, query, where } from "firebase/firestore";
import { useAuth } from "@/lib/auth-context";
import { auth, db } from "@/lib/firebase";
import { HOST_GROWTH_CATEGORIES, HOST_GROWTH_INTAKE_ENABLED, validateGrowth, type GrowthErrors, type GrowthValues } from "@/lib/host-growth";
import { saveGrowthRegistration } from "@/lib/host-growth-storage";
import styles from "./hostgrowth.module.css";

type OwnedListing = { id: string; title: string };

export default function GrowthInterestForm() {
  const { user, loading } = useAuth();
  if (loading) return <p role="status">Checking sign-in...</p>;
  if (!user) return <div className={styles.notice}>
    <p>Sign in to prepare an interest registration. Submission remains paused pending an approved privacy notice.</p>
    <Link className={styles.primary} href="/login?next=%2Fhost-growth%23register-interest">Sign in</Link>
  </div>;
  return <SignedInForm key={user.uid} uid={user.uid} initialEmail={user.email ?? ""} />;
}

function SignedInForm({ uid, initialEmail }: { uid: string; initialEmail: string }) {
  const [values, setValues] = useState<GrowthValues>({
    listingId: "", city: "", stateRegion: "", category: "", description: "", estimatedCost: "",
    requestedSupport: "", propertyPermission: false, contactEmail: initialEmail, contactConsent: false,
  });
  const [listings, setListings] = useState<OwnedListing[]>([]);
  const [listingState, setListingState] = useState<"loading" | "ready" | "error">("loading");
  const [retry, setRetry] = useState(0);
  const [errors, setErrors] = useState<GrowthErrors>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [result, setResult] = useState<"created" | "existing">();
  const lock = useRef(false);
  const mounted = useRef(true);
  const form = useRef<HTMLFormElement>(null);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  useEffect(() => {
    let active = true;
    async function load() {
      setListingState("loading");
      try {
        const snap = await getDocsFromServer(query(collection(db, "listings"), where("hostId", "==", uid)));
        if (active) {
          setListings(snap.docs.map(doc => ({
            id: doc.id, title: typeof doc.data().title === "string" ? doc.data().title : "Untitled listing",
          })));
          setListingState("ready");
        }
      } catch (error) {
        console.error("[RVNB] Host Growth owned listings failed", error);
        if (active) setListingState("error");
      }
    }
    void load();
    return () => { active = false; };
  }, [uid, retry]);

  function change<K extends keyof GrowthValues>(key: K, value: GrowthValues[K]) {
    setValues(previous => ({ ...previous, [key]: value }));
    setErrors(previous => ({ ...previous, [key]: undefined }));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (lock.current) return;
    const nextErrors = validateGrowth(values);
    setErrors(nextErrors);
    setSaveError("");
    if (Object.keys(nextErrors).length) {
      const first = Object.keys(nextErrors)[0];
      form.current?.querySelector<HTMLElement>(`[name="${first}"]`)?.focus();
      return;
    }
    if (!HOST_GROWTH_INTAKE_ENABLED) {
      setSaveError("Submission is paused pending an approved privacy notice. Nothing was sent.");
      return;
    }
    if (auth.currentUser?.uid !== uid) {
      setSaveError("Your sign-in changed. Sign in again before registering.");
      return;
    }
    lock.current = true;
    setSaving(true);
    try {
      const saved = await saveGrowthRegistration(uid, values);
      if (mounted.current && auth.currentUser?.uid === uid) setResult(saved);
    } catch (error) {
      console.error("[RVNB] Host Growth registration failed", error);
      if (mounted.current) setSaveError("We couldn't confirm your registration. Retry with the same property selection; an existing registration will not be duplicated.");
    } finally {
      lock.current = false;
      if (mounted.current) setSaving(false);
    }
  }

  function fieldError(key: keyof GrowthValues) {
    return errors[key] ? <span id={`growth-${key}-error`} className={styles.error}>{errors[key]}</span> : null;
  }
  function accessibility(key: keyof GrowthValues) {
    return {
      "aria-invalid": !!errors[key],
      "aria-describedby": errors[key] ? `growth-${key}-error` : undefined,
      onBlur: () => setErrors(previous => ({ ...previous, [key]: validateGrowth(values)[key] })),
    };
  }

  if (result) return <div className={styles.notice} role="status">
    <h3>{result === "created" ? "Interest registered" : "Interest already registered"}</h3>
    <p>{result === "created" ? "Your expression of interest was saved." : "A registration for this property already exists. It was not overwritten or duplicated."} No funding is guaranteed or reserved, and there is no guaranteed response time. Selected applicants may be contacted; there are no automatic notifications or awards.</p>
    <Link href="/host-growth">Back to program information</Link>
  </div>;

  return <form ref={form} onSubmit={submit} className={styles.form} noValidate aria-busy={saving}>
    <div className={styles.notice} id="growth-privacy">
      <strong>Submission paused — privacy notice approval required.</strong>
      <div>No covering privacy notice is currently available. You can explore these fields, but registration details are not sent or saved while intake is paused. Avoid entering sensitive information. This page does not save unfinished entries.</div>
    </div>
    {listingState === "loading" && <p role="status">Loading your owned listings...</p>}
    {listingState === "error" && <div role="alert" className={styles.error}>Your listings could not be loaded. You may describe a proposed property instead, or <button type="button" className={styles.primary} onClick={() => setRetry(value => value + 1)}>Retry listings</button>.</div>}
    <div className={styles.field}>
      <label htmlFor="growth-listingId">Property</label>
      <select id="growth-listingId" name="listingId" value={values.listingId} disabled={saving || listingState !== "ready"} onChange={event => change("listingId", event.target.value)}>
        <option value="">Proposed property — general city and state/region</option>
        {listings.map(listing => <option key={listing.id} value={listing.id}>{listing.title}</option>)}
      </select>
      <span className={styles.help}>Only your owned listings are loaded. No reviews or public profile are required.</span>
    </div>
    {!values.listingId && <div className={styles.fields}>
      {(["city", "stateRegion"] as const).map(key => <div className={styles.field} key={key}>
        <label htmlFor={`growth-${key}`}>{key === "city" ? "General city" : "State or region"}</label>
        <input id={`growth-${key}`} name={key} value={values[key]} maxLength={80} required disabled={saving} {...accessibility(key)} onChange={event => change(key, event.target.value)} />
        {fieldError(key)}
      </div>)}
    </div>}
    <div className={styles.field}>
      <label htmlFor="growth-category">Improvement category</label>
      <select id="growth-category" name="category" required value={values.category} disabled={saving} {...accessibility("category")} onChange={event => change("category", event.target.value)}>
        <option value="">Choose a category</option>{HOST_GROWTH_CATEGORIES.map(category => <option key={category}>{category}</option>)}
      </select>{fieldError("category")}
    </div>
    <div className={styles.field}>
      <label htmlFor="growth-description">Short project description (20–1,000 characters)</label>
      <textarea id="growth-description" name="description" required minLength={20} maxLength={1000} value={values.description} disabled={saving} {...accessibility("description")} onChange={event => change("description", event.target.value)} />
      <span className={styles.help}>General project details only. Do not include an exact address or sensitive information.</span>{fieldError("description")}
    </div>
    <div className={styles.fields}>
      {(["estimatedCost", "requestedSupport"] as const).map(key => <div key={key} className={styles.field}>
        <label htmlFor={`growth-${key}`}>{key === "estimatedCost" ? "Estimated project cost (USD)" : "Requested support estimate (USD)"}</label>
        <input type="number" inputMode="decimal" id={`growth-${key}`} name={key} min="0.01" max={key === "estimatedCost" ? 100000 : 500} step="0.01" required value={values[key]} disabled={saving} {...accessibility(key)} onChange={event => change(key, event.target.value)} />
        {fieldError(key)}
      </div>)}
    </div>
    <span className={styles.help}>Estimates only, not an offer or commitment. The proposed first pilot is up to $500 total for one selected property.</span>
    <label className={styles.check}><input type="checkbox" name="propertyPermission" required checked={values.propertyPermission} disabled={saving} {...accessibility("propertyPermission")} onChange={event => change("propertyPermission", event.target.checked)} />I own the property or have written permission to make the proposed improvements.</label>
    {fieldError("propertyPermission")}
    <div className={styles.field}>
      <label htmlFor="growth-contactEmail">Contact email</label>
      <input id="growth-contactEmail" name="contactEmail" type="email" autoComplete="email" maxLength={254} required value={values.contactEmail} disabled={saving} {...accessibility("contactEmail")} onChange={event => change("contactEmail", event.target.value)} />
      {fieldError("contactEmail")}
    </div>
    <label className={styles.check}><input type="checkbox" name="contactConsent" required checked={values.contactConsent} disabled={saving} {...accessibility("contactConsent")} onChange={event => change("contactConsent", event.target.checked)} />I give RVNB permission to contact me by email about this registration. This is not permission for unrelated marketing.</label>
    {fieldError("contactConsent")}
    <p className={styles.help}>Registration is not a funding application, approval, loan offer, or contract. No funding is guaranteed or reserved. No guaranteed response time. Registration does not authorize deductions or access to financial accounts.</p>
    {Object.values(errors).some(Boolean) && <div role="alert" className={styles.error}>Please correct the highlighted fields.</div>}
    {saveError && <div role="alert" className={styles.error}>{saveError}</div>}
    {saving && <p role="status">Saving your expression of interest...</p>}
    <button type="submit" className={styles.primary} disabled={!HOST_GROWTH_INTAKE_ENABLED || saving} aria-describedby="growth-privacy">
      {saving ? "Saving registration..." : !HOST_GROWTH_INTAKE_ENABLED ? "Registration paused" : saveError ? "Retry registration" : "Register interest"}
    </button>
  </form>;
}
