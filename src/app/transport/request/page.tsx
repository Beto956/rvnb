"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import styles from "./page.module.css";

type Step = 1 | 2 | 3;
type FormStatus = "idle" | "submitting" | "success" | "error";

type TransportForm = {
  rvType: string; year: string; make: string; model: string; lengthFt: string; weightLb: string;
  condition: string; movementMethod: string; tires: string; lightsBrakes: string; slidesAwnings: string; connectedUtilities: string;
  pickupCity: string; pickupState: string; pickupZip: string; pickupLocationType: string;
  destinationCity: string; destinationState: string; destinationZip: string; destinationLocationType: string;
  pickupDate: string; flexibleDates: string; flexibilityNote: string; deliveryDate: string; timingPriority: string;
  tripType: string; restrictedAccess: string; accessDetails: string; specialInstructions: string;
  fullName: string; email: string; phone: string; contactMethod: string;
  confirmsAccuracy: boolean; confirmsNoGuarantee: boolean;
};

const initialForm: TransportForm = {
  rvType: "", year: "", make: "", model: "", lengthFt: "", weightLb: "", condition: "", movementMethod: "", tires: "", lightsBrakes: "", slidesAwnings: "", connectedUtilities: "",
  pickupCity: "", pickupState: "", pickupZip: "", pickupLocationType: "", destinationCity: "", destinationState: "", destinationZip: "", destinationLocationType: "",
  pickupDate: "", flexibleDates: "no", flexibilityNote: "", deliveryDate: "", timingPriority: "Flexible", tripType: "One-way", restrictedAccess: "no", accessDetails: "", specialInstructions: "",
  fullName: "", email: "", phone: "", contactMethod: "Email", confirmsAccuracy: false, confirmsNoGuarantee: false,
};

const storageKey = "rvnb-transport-request-draft";
const locationTypes = ["Residence", "Campground or RV park", "Dealership", "Storage facility", "Job site or workforce housing", "Other"];
const states = ["AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA", "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD", "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ", "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC", "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY"];

export default function TransportRequestPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [step, setStep] = useState<Step>(1);
  const [form, setForm] = useState<TransportForm>(readDraft);
  const [status, setStatus] = useState<FormStatus>("idle");
  const [message, setMessage] = useState("");

  const formWithProfile = useMemo(() => ({
    ...form,
    fullName: form.fullName || user?.displayName || "",
    email: form.email || user?.email || "",
    phone: form.phone || user?.phoneNumber || "",
  }), [form, user]);

  const update = (field: keyof TransportForm, value: string | boolean) => {
    setForm((current) => ({ ...current, [field]: value }));
    setStatus("idle");
    setMessage("");
  };

  const errors = useMemo(() => validateStep(formWithProfile, step), [formWithProfile, step]);
  const review = useMemo(() => buildReview(formWithProfile), [formWithProfile]);

  function continueStep(event: FormEvent) {
    event.preventDefault();
    if (errors.length > 0) {
      setStatus("error");
      setMessage(errors[0]);
      return;
    }
    setMessage("");
    setStatus("idle");
    setStep((current) => (current === 1 ? 2 : 3) as Step);
  }

  function editStep(nextStep: Step) {
    setStep(nextStep);
    setStatus("idle");
    setMessage("");
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const finalErrors = validateStep(formWithProfile, 3);
    if (finalErrors.length > 0) {
      setStatus("error");
      setMessage(finalErrors[0]);
      return;
    }
    if (authLoading) return;
    if (!user) {
      sessionStorage.setItem(storageKey, JSON.stringify(form));
      router.push(`/login?next=${encodeURIComponent("/transport/request")}`);
      return;
    }

    try {
      setStatus("submitting");
      const request = normalizeRequest(formWithProfile, user.uid);
      await addDoc(collection(db, "transportRequests"), request);
      sessionStorage.removeItem(storageKey);
      setStatus("success");
      setMessage("Your transport request has been submitted for future RVNB transport coordination.");
    } catch (error) {
      console.error(error);
      setStatus("error");
      setMessage("We could not submit your request. Please check your connection and try again.");
    }
  }

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <Link href="/transport" className={styles.backLink}>← Back to Transport</Link>
        <header className={styles.header}>
          <p className={styles.kicker}>REQUEST RV TRANSPORT</p>
          <h1>Tell us what needs to move.</h1>
          <p>Share the RV, route, and timing details. RVNB will use your request to help build the right transport connection.</p>
        </header>

        {status === "success" ? (
          <section className={styles.successPanel} aria-live="polite">
            <span className={styles.successMark} aria-hidden="true">✓</span>
            <h2>Request received.</h2>
            <p>{message}</p>
            <Link href="/transport" className={styles.primaryButton}>Return to Transport</Link>
          </section>
        ) : (
          <form onSubmit={step === 3 ? submit : continueStep}>
            <nav className={styles.progress} aria-label="Transport request progress">
              {["RV Details", "Route and Timing", "Contact and Review"].map((label, index) => {
                const itemStep = (index + 1) as Step;
                return <button type="button" key={label} className={`${styles.progressItem} ${step === itemStep ? styles.progressCurrent : ""} ${step > itemStep ? styles.progressDone : ""}`} onClick={() => step > itemStep && editStep(itemStep)} aria-current={step === itemStep ? "step" : undefined} disabled={step < itemStep}><span>{itemStep}</span>{label}</button>;
              })}
            </nav>

            <section className={styles.panel}>
              {step === 1 && <StepOne form={formWithProfile} update={update} />}
              {step === 2 && <StepTwo form={formWithProfile} update={update} />}
              {step === 3 && <StepThree form={formWithProfile} update={update} review={review} editStep={editStep} />}
              {message && <p className={styles.errorMessage} role="alert">{message}</p>}
              <div className={styles.formActions}>
                {step > 1 && <button type="button" className={styles.secondaryButton} onClick={() => editStep((step - 1) as Step)}>Back</button>}
                <span className={styles.actionSpacer} />
                {step < 3 ? <button type="submit" className={styles.primaryButton}>Continue</button> : <button type="submit" className={styles.primaryButton} disabled={status === "submitting"}>{status === "submitting" ? "Submitting..." : "Submit Transport Request"}</button>}
              </div>
            </section>
          </form>
        )}
      </div>
    </main>
  );
}

function StepOne({ form, update }: { form: TransportForm; update: (field: keyof TransportForm, value: string | boolean) => void }) {
  return <>
    <SectionHeading eyebrow="01 / RV DETAILS" title="What are we moving?" text="A few basics help a future provider understand the rig and the safest movement method." />
    <div className={styles.fieldGrid}>
      <SelectField label="RV type" value={form.rvType} onChange={(value) => update("rvType", value)} required options={["Travel trailer", "Fifth wheel", "Motorhome", "Toy hauler", "Pop-up camper", "Truck camper", "Park model", "Other"]} />
      <TextField label="Year" value={form.year} onChange={(value) => update("year", value)} placeholder="Optional" inputMode="numeric" />
      <TextField label="Make" value={form.make} onChange={(value) => update("make", value)} placeholder="Optional" />
      <TextField label="Model" value={form.model} onChange={(value) => update("model", value)} placeholder="Optional" />
      <TextField label="Approximate length (feet)" value={form.lengthFt} onChange={(value) => update("lengthFt", value)} required placeholder="e.g. 35" inputMode="decimal" />
      <TextField label="Approximate weight (pounds)" value={form.weightLb} onChange={(value) => update("weightLb", value)} placeholder="Optional" inputMode="numeric" />
      <SelectField label="Current condition" value={form.condition} onChange={(value) => update("condition", value)} required options={["Roadworthy and ready to move", "Needs minor preparation", "Not currently roadworthy", "Unsure"]} />
      <SelectField label="Movement method" value={form.movementMethod} onChange={(value) => update("movementMethod", value)} required options={["Tow my RV", "Drive my motorhome", "Transport on a trailer", "Help me determine the right method"]} />
    </div>
    <Fieldset legend="Preparation questions">
      <ChoiceField label="Are the tires in usable condition?" value={form.tires} onChange={(value) => update("tires", value)} options={["Yes", "No", "Unsure"]} />
      <ChoiceField label="Are the lights and brakes working?" value={form.lightsBrakes} onChange={(value) => update("lightsBrakes", value)} options={["Yes", "No", "Unsure", "Not applicable"]} />
      <ChoiceField label="Are slides and awnings secured?" value={form.slidesAwnings} onChange={(value) => update("slidesAwnings", value)} options={["Yes", "No", "Not applicable", "Unsure"]} />
      <ChoiceField label="Is the RV currently connected to utilities?" value={form.connectedUtilities} onChange={(value) => update("connectedUtilities", value)} options={["Yes", "No"]} />
    </Fieldset>
  </>;
}

function StepTwo({ form, update }: { form: TransportForm; update: (field: keyof TransportForm, value: string | boolean) => void }) {
  return <>
    <SectionHeading eyebrow="02 / ROUTE AND TIMING" title="Where and when does it need to move?" text="City, state, and optional ZIP are enough for this initial request. Please do not include an exact street address." />
    <div className={styles.routeGrid}>
      <LocationFields title="Pickup" prefix="pickup" form={form} update={update} />
      <LocationFields title="Destination" prefix="destination" form={form} update={update} />
    </div>
    <div className={styles.fieldGrid}>
      <TextField label="Preferred pickup date" value={form.pickupDate} onChange={(value) => update("pickupDate", value)} required type="date" />
      <SelectField label="Flexible dates?" value={form.flexibleDates} onChange={(value) => update("flexibleDates", value)} required options={["yes", "no"]} />
      <TextField label="Desired delivery date" value={form.deliveryDate} onChange={(value) => update("deliveryDate", value)} type="date" placeholder="Optional" />
      <SelectField label="Timing priority" value={form.timingPriority} onChange={(value) => update("timingPriority", value)} required options={["Flexible", "Standard", "Time-sensitive"]} />
    </div>
    {form.flexibleDates === "yes" && <TextAreaField label="Flexibility note or date window" value={form.flexibilityNote} onChange={(value) => update("flexibilityNote", value)} placeholder="Optional" rows={3} />}
    <Fieldset legend="Access and logistics">
      <ChoiceField label="Trip type" value={form.tripType} onChange={(value) => update("tripType", value)} options={["One-way", "Round trip"]} />
      <ChoiceField label="Are there narrow roads, gates, low branches, soft ground, restricted access, or limited turning room?" value={form.restrictedAccess} onChange={(value) => update("restrictedAccess", value)} options={["yes", "no"]} />
      {form.restrictedAccess === "yes" && <TextAreaField label="Access details" value={form.accessDetails} onChange={(value) => update("accessDetails", value)} placeholder="Describe the access considerations." rows={3} />}
      <TextAreaField label="Special instructions" value={form.specialInstructions} onChange={(value) => update("specialInstructions", value)} placeholder="Optional details for future transport planning." rows={3} />
    </Fieldset>
  </>;
}

function StepThree({ form, update, review, editStep }: { form: TransportForm; update: (field: keyof TransportForm, value: string | boolean) => void; review: Record<string, string>; editStep: (step: Step) => void }) {
  return <>
    <SectionHeading eyebrow="03 / CONTACT AND REVIEW" title="Check the details before you send." text="Your contact details stay private to your request during this phase. Submission does not guarantee a provider match, price, or confirmed service." />
    <div className={styles.reviewList}>
      <ReviewSection title="RV" value={review.rv} onEdit={() => editStep(1)} />
      <ReviewSection title="Route and timing" value={review.route} onEdit={() => editStep(2)} />
      <ReviewSection title="Access considerations" value={review.access} onEdit={() => editStep(2)} />
    </div>
    <div className={styles.fieldGrid}>
      <TextField label="Full name" value={form.fullName} onChange={(value) => update("fullName", value)} required autoComplete="name" />
      <TextField label="Email address" value={form.email} onChange={(value) => update("email", value)} required type="email" autoComplete="email" />
      <TextField label="Phone number" value={form.phone} onChange={(value) => update("phone", value)} required type="tel" autoComplete="tel" />
      <SelectField label="Preferred contact method" value={form.contactMethod} onChange={(value) => update("contactMethod", value)} required options={["Email", "Phone call", "Text message"]} />
    </div>
    <div className={styles.confirmations}>
      <label><input type="checkbox" checked={form.confirmsAccuracy} onChange={(event) => update("confirmsAccuracy", event.target.checked)} /> I confirm that the information provided is accurate to the best of my knowledge.</label>
      <label><input type="checkbox" checked={form.confirmsNoGuarantee} onChange={(event) => update("confirmsNoGuarantee", event.target.checked)} /> I understand this is a transport request and does not guarantee a provider match, price, or confirmed service.</label>
    </div>
  </>;
}

function LocationFields({ title, prefix, form, update }: { title: string; prefix: "pickup" | "destination"; form: TransportForm; update: (field: keyof TransportForm, value: string | boolean) => void }) {
  return <div className={styles.locationBlock}><h3>{title}</h3><div className={styles.fieldGrid}><TextField label={`${title} city`} value={form[`${prefix}City`]} onChange={(value) => update(`${prefix}City`, value)} required autoComplete="address-level2" /><SelectField label={`${title} state`} value={form[`${prefix}State`]} onChange={(value) => update(`${prefix}State`, value)} required options={states} /><TextField label={`${title} ZIP code`} value={form[`${prefix}Zip`]} onChange={(value) => update(`${prefix}Zip`, value)} placeholder="Optional" inputMode="numeric" /><SelectField label={`${title} location type`} value={form[`${prefix}LocationType`]} onChange={(value) => update(`${prefix}LocationType`, value)} required options={locationTypes} /></div></div>;
}

function SectionHeading({ eyebrow, title, text }: { eyebrow: string; title: string; text: string }) { return <div className={styles.sectionHeading}><p className={styles.kicker}>{eyebrow}</p><h2>{title}</h2><p>{text}</p></div>; }
function Fieldset({ legend, children }: { legend: string; children: React.ReactNode }) { return <fieldset className={styles.fieldset}><legend>{legend}</legend>{children}</fieldset>; }
function TextField({ label, value, onChange, required, placeholder, type = "text", inputMode, autoComplete }: { label: string; value: string; onChange: (value: string) => void; required?: boolean; placeholder?: string; type?: string; inputMode?: "numeric" | "decimal"; autoComplete?: string }) { return <label className={styles.field}>{label}{required && <span className={styles.required}>Required</span>}<input type={type} value={value} onChange={(event) => onChange(event.target.value)} required={required} placeholder={placeholder} inputMode={inputMode} autoComplete={autoComplete} /></label>; }
function SelectField({ label, value, onChange, options, required }: { label: string; value: string; onChange: (value: string) => void; options: readonly string[]; required?: boolean }) { return <label className={styles.field}>{label}{required && <span className={styles.required}>Required</span>}<select value={value} onChange={(event) => onChange(event.target.value)} required={required}><option value="">Select...</option>{options.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>; }
function TextAreaField({ label, value, onChange, placeholder, rows = 3 }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string; rows?: number }) { return <label className={styles.field}>{label}<textarea value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} rows={rows} /></label>; }
function ChoiceField({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: readonly string[] }) { return <div className={styles.choiceField}><span>{label}</span><div className={styles.choiceRow}>{options.map((option) => <label key={option}><input type="radio" name={label} value={option} checked={value === option} onChange={() => onChange(option)} required={!value} />{option}</label>)}</div></div>; }
function ReviewSection({ title, value, onEdit }: { title: string; value: string; onEdit: () => void }) { return <article className={styles.reviewSection}><div><h3>{title}</h3><p>{value}</p></div><button type="button" className={styles.editButton} onClick={onEdit}>Edit</button></article>; }

function validateStep(form: TransportForm, step: Step): string[] {
  if (step === 1) {
    if (!form.rvType) return ["Select an RV type."];
    if (!positiveNumber(form.lengthFt)) return ["Enter an approximate RV length greater than zero."];
    if (form.weightLb && !nonNegativeNumber(form.weightLb)) return ["Enter an approximate weight of zero or greater."];
    if (!form.condition) return ["Select the current condition."];
    if (!form.movementMethod) return ["Select a movement method."];
    if (!form.tires || !form.lightsBrakes || !form.slidesAwnings || !form.connectedUtilities) return ["Answer all preparation questions."];
  }
  if (step === 2) {
    if (!form.pickupCity.trim() || !form.pickupState || !form.pickupLocationType || !form.destinationCity.trim() || !form.destinationState || !form.destinationLocationType) return ["Complete both pickup and destination regions."];
    if (!form.pickupDate) return ["Choose a preferred pickup date."];
    if (form.pickupDate < today()) return ["Pickup date cannot be in the past."];
    if (form.deliveryDate && form.deliveryDate < form.pickupDate) return ["Delivery date cannot be before pickup date."];
    if (!form.tripType || !form.restrictedAccess) return ["Complete the access and logistics questions."];
  }
  if (step === 3) {
    if (!form.fullName.trim() || !isValidEmail(form.email) || !form.phone.trim()) return ["Enter your name, a valid email, and phone number."];
    if (!form.contactMethod) return ["Select a preferred contact method."];
    if (!form.confirmsAccuracy || !form.confirmsNoGuarantee) return ["Confirm both statements before submitting."];
  }
  return [];
}

function normalizeRequest(form: TransportForm, requesterId: string) {
  return {
    schemaVersion: 1,
    requesterId,
    status: "submitted",
    rv: { type: form.rvType, year: form.year.trim(), make: form.make.trim(), model: form.model.trim(), lengthFt: Number(form.lengthFt), weightLb: form.weightLb ? Number(form.weightLb) : 0, condition: form.condition, movementMethod: form.movementMethod, tires: form.tires, lightsBrakes: form.lightsBrakes, slidesAwnings: form.slidesAwnings, connectedUtilities: form.connectedUtilities },
    pickup: { city: form.pickupCity.trim(), state: form.pickupState, zip: form.pickupZip.trim(), locationType: form.pickupLocationType },
    destination: { city: form.destinationCity.trim(), state: form.destinationState, zip: form.destinationZip.trim(), locationType: form.destinationLocationType },
    timing: { pickupDate: form.pickupDate, flexibleDates: form.flexibleDates === "yes", flexibilityNote: form.flexibilityNote.trim(), deliveryDate: form.deliveryDate, priority: form.timingPriority },
    logistics: { tripType: form.tripType, restrictedAccess: form.restrictedAccess === "yes", accessDetails: form.accessDetails.trim(), specialInstructions: form.specialInstructions.trim() },
    contact: { fullName: form.fullName.trim(), email: form.email.trim().toLowerCase(), phone: form.phone.trim(), preferredMethod: form.contactMethod },
    confirmations: { informationAccurate: form.confirmsAccuracy, noGuaranteeUnderstood: form.confirmsNoGuarantee },
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
}

function buildReview(form: TransportForm) { return { rv: `${form.rvType} • ${form.lengthFt} ft • ${form.condition} • ${form.movementMethod}`, route: `${form.pickupCity}, ${form.pickupState} → ${form.destinationCity}, ${form.destinationState} • ${form.pickupDate}${form.deliveryDate ? ` → ${form.deliveryDate}` : ""} • ${form.timingPriority}`, access: `${form.restrictedAccess === "yes" ? form.accessDetails || "Access considerations provided" : "No special access considerations"} • ${form.contactMethod} contact` }; }
function positiveNumber(value: string) { return Number.isFinite(Number(value)) && Number(value) > 0; }
function nonNegativeNumber(value: string) { return Number.isFinite(Number(value)) && Number(value) >= 0; }
function isValidEmail(value: string) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim()); }
function today() { const date = new Date(); return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`; }
function readDraft(): TransportForm {
  if (typeof window === "undefined") return initialForm;
  try {
    const saved = window.sessionStorage.getItem(storageKey);
    return saved ? { ...initialForm, ...(JSON.parse(saved) as Partial<TransportForm>) } : initialForm;
  } catch {
    window.sessionStorage.removeItem(storageKey);
    return initialForm;
  }
}
