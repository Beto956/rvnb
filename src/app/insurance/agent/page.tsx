"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import styles from "./page.module.css";

type Step = 1 | 2 | 3;
type FormStatus = "idle" | "submitting" | "success" | "error";

type ProfessionalOnboardingForm = {
  step: Step;
  name: string;
  email: string;
  phone: string;
  agency: string;
  npn: string;
  residentState: string;
  otherStates: string;
  professionalType: "individual_agent" | "agency" | "brokerage" | "other" | "";
  experienceYears: "less_than_1" | "1_to_3" | "3_to_5" | "5_to_10" | "10_plus" | "";
  customerTypes: string[];
  serviceArea: string;
  website: string;
  notes: string;
  confirmsAccuracy: boolean;
  confirmsEarlyAccess: boolean;
};

const initialForm: ProfessionalOnboardingForm = {
  step: 1,
  name: "",
  email: "",
  phone: "",
  agency: "",
  npn: "",
  residentState: "",
  otherStates: "",
  professionalType: "individual_agent",
  experienceYears: "3_to_5",
  customerTypes: ["Full-time RV living", "Travel trailers & fifth wheels"],
  serviceArea: "",
  website: "",
  notes: "",
  confirmsAccuracy: false,
  confirmsEarlyAccess: false,
};

const STORAGE_KEY = "rvnb-insurance-pro-draft";
const DRAFT_EVENT_NAME = "rvnb_insurance_pro_draft_change";

function subscribeDraft(callback: () => void) {
  if (typeof window === "undefined") return () => {};
  window.addEventListener("storage", callback);
  window.addEventListener(DRAFT_EVENT_NAME, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(DRAFT_EVENT_NAME, callback);
  };
}

function getDraftSnapshot(): string {
  if (typeof window === "undefined") return "";
  try {
    return window.sessionStorage.getItem(STORAGE_KEY) || "";
  } catch {
    return "";
  }
}

function getServerDraftSnapshot(): string {
  return "";
}

function saveDraftToStorage(data: ProfessionalOnboardingForm) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    window.dispatchEvent(new Event(DRAFT_EVENT_NAME));
  } catch {
    // ignore
  }
}

function clearDraftFromStorage() {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(STORAGE_KEY);
    window.dispatchEvent(new Event(DRAFT_EVENT_NAME));
  } catch {
    // ignore
  }
}

const US_STATES = [
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA",
  "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD",
  "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ",
  "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC",
  "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY"
] as const;

const SPECIALTY_OPTIONS = [
  "Full-time RV living",
  "Travel trailers & fifth wheels",
  "Class A luxury motorhomes",
  "Class B camper vans & overlanding",
  "Total Loss Replacement / Agreed Value",
  "Attached accessories & solar riders",
  "Stationary park models",
  "Commercial & rental endorsements",
] as const;

const PRO_TYPE_LABELS: Record<string, string> = {
  individual_agent: "Independent Agent / Producer",
  agency: "Insurance Agency / Group",
  brokerage: "National Brokerage",
  other: "Managing General Agent / Other",
};

const EXPERIENCE_LABELS: Record<string, string> = {
  less_than_1: "Less than 1 year",
  "1_to_3": "1 to 3 years",
  "3_to_5": "3 to 5 years",
  "5_to_10": "5 to 10 years",
  "10_plus": "10+ years",
};

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export default function InsuranceAgentPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const formRef = useRef<HTMLFormElement | null>(null);

  const isMounted = useSyncExternalStore(subscribeDraft, () => true, () => false);
  const rawDraft = useSyncExternalStore(subscribeDraft, getDraftSnapshot, getServerDraftSnapshot);

  const [status, setStatus] = useState<FormStatus>("idle");
  const [message, setMessage] = useState("");

  const savedForm = useMemo<ProfessionalOnboardingForm>(() => {
    if (!isMounted || !rawDraft) return initialForm;
    try {
      const parsed = JSON.parse(rawDraft) as Partial<ProfessionalOnboardingForm>;
      return {
        ...initialForm,
        ...parsed,
        step: (parsed.step === 1 || parsed.step === 2 || parsed.step === 3 ? parsed.step : 1) as Step,
      };
    } catch {
      return initialForm;
    }
  }, [isMounted, rawDraft]);

  const formWithProfile = useMemo(() => {
    if (!isMounted) return initialForm;
    return {
      ...savedForm,
      name: savedForm.name || user?.displayName || "",
      email: savedForm.email || user?.email || "",
      phone: savedForm.phone || user?.phoneNumber || "",
    };
  }, [savedForm, user, isMounted]);

  const updateField = <K extends keyof ProfessionalOnboardingForm>(field: K, value: ProfessionalOnboardingForm[K]) => {
    const next = { ...savedForm, [field]: value };
    saveDraftToStorage(next);
    setStatus("idle");
    setMessage("");
  };

  const toggleSpecialty = (specialty: string) => {
    const list = savedForm.customerTypes;
    const nextList = list.includes(specialty)
      ? list.filter((item) => item !== specialty)
      : [...list, specialty];
    const next = { ...savedForm, customerTypes: nextList };
    saveDraftToStorage(next);
    setStatus("idle");
    setMessage("");
  };

  const scrollToFormTop = () => {
    if (formRef.current) {
      formRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const goToStep = (nextStep: Step) => {
    if (status === "submitting") return;
    updateField("step", nextStep);
    setStatus("idle");
    setMessage("");
    scrollToFormTop();
  };

  const isStep1Complete = (data: ProfessionalOnboardingForm) => {
    return data.name.trim().length > 0 && isValidEmail(data.email) && data.phone.trim().length > 0 && data.professionalType !== "";
  };

  const isStep2Complete = (data: ProfessionalOnboardingForm) => {
    return data.residentState.length === 2 && data.serviceArea.trim().length > 0;
  };

  const isStep3Complete = (data: ProfessionalOnboardingForm) => {
    return data.experienceYears !== "" && data.customerTypes.length > 0 && data.confirmsAccuracy && data.confirmsEarlyAccess;
  };

  const step1Done = useMemo(() => isMounted && isStep1Complete(formWithProfile), [formWithProfile, isMounted]);
  const step2Done = useMemo(() => isMounted && isStep2Complete(formWithProfile), [formWithProfile, isMounted]);
  const step3Done = useMemo(() => isMounted && isStep3Complete(formWithProfile), [formWithProfile, isMounted]);

  const completedCount = (step1Done ? 1 : 0) + (step2Done ? 1 : 0) + (step3Done ? 1 : 0);

  const progressPercent = useMemo(() => {
    if (completedCount === 0) return 10;
    if (completedCount === 1) return 33.3;
    if (completedCount === 2) return 66.6;
    return 100;
  }, [completedCount]);

  function validateStep(currentStep: Step, data: ProfessionalOnboardingForm): string | null {
    if (currentStep === 1) {
      if (!data.name.trim()) return "Enter your full name.";
      if (!isValidEmail(data.email)) return "Enter a valid professional email address.";
      if (!data.phone.trim()) return "Enter a valid phone number.";
      if (!data.professionalType) return "Select an organization type.";
      return null;
    }

    if (currentStep === 2) {
      if (!data.residentState) return "Select your resident licensing state.";
      if (!data.serviceArea.trim()) return "Describe your primary service area or territory.";
      return null;
    }

    if (currentStep === 3) {
      if (!data.experienceYears) return "Select your years of RV insurance experience.";
      if (data.customerTypes.length === 0) return "Select at least one customer or policy specialty.";
      if (!data.confirmsAccuracy || !data.confirmsEarlyAccess) {
        return "Confirm both statements before submitting your inquiry.";
      }
      return null;
    }

    return null;
  }

  function handleContinue(event: FormEvent) {
    event.preventDefault();
    const error = validateStep(savedForm.step, formWithProfile);
    if (error) {
      setStatus("error");
      setMessage(error);
      return;
    }

    const next = (savedForm.step === 1 ? 2 : 3) as Step;
    goToStep(next);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const step1Error = validateStep(1, formWithProfile);
    if (step1Error) {
      goToStep(1);
      setStatus("error");
      setMessage(`A few details are still needed in Step 1 before you can submit: ${step1Error}`);
      return;
    }

    const step2Error = validateStep(2, formWithProfile);
    if (step2Error) {
      goToStep(2);
      setStatus("error");
      setMessage(`A few details are still needed in Step 2 before you can submit: ${step2Error}`);
      return;
    }

    const step3Error = validateStep(3, formWithProfile);
    if (step3Error) {
      setStatus("error");
      setMessage(`A few details are still needed before you can submit: ${step3Error}`);
      return;
    }

    if (authLoading) return;

    if (!user) {
      saveDraftToStorage(formWithProfile);
      router.push(`/login?next=${encodeURIComponent("/insurance/agent")}`);
      return;
    }

    try {
      setStatus("submitting");

      const payload = {
        userId: user.uid,
        name: formWithProfile.name.trim(),
        email: formWithProfile.email.trim().toLowerCase(),
        phone: formWithProfile.phone.trim(),
        agency: formWithProfile.agency.trim() || null,
        npn: formWithProfile.npn.trim() || null,
        residentState: formWithProfile.residentState,
        otherStates: formWithProfile.otherStates.trim() || null,
        professionalType: formWithProfile.professionalType,
        experienceYears: formWithProfile.experienceYears,
        customerTypes: formWithProfile.customerTypes,
        serviceArea: formWithProfile.serviceArea.trim(),
        website: formWithProfile.website.trim() || null,
        notes: formWithProfile.notes.trim() || null,
        confirmations: {
          informationAccurate: formWithProfile.confirmsAccuracy,
          earlyAccessUnderstood: formWithProfile.confirmsEarlyAccess,
        },
        source: "ecosystem_page",
        page: "Professional Insurance Onboarding",
        createdAt: serverTimestamp(),
      };

      await addDoc(collection(db, "insuranceProviders"), payload);

      clearDraftFromStorage();
      setStatus("success");
      setMessage("Your professional inquiry has been received. We will contact you when licensed agent onboarding launches.");
      scrollToFormTop();
    } catch (err) {
      console.error("Pro submission error:", err);
      setStatus("error");
      setMessage("Could not submit your professional interest right now. Please check your connection and try again.");
    }
  }

  const selectedSpecialtiesText = useMemo(() => {
    return formWithProfile.customerTypes.length > 0 ? formWithProfile.customerTypes.join(", ") : "";
  }, [formWithProfile.customerTypes]);

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        {/* TOP NAVIGATION */}
        <nav className={styles.topNav} aria-label="Insurance navigation">
          <Link href="/insurance" className={styles.backLink}>
            ← Back to Insurance Hub
          </Link>
          <Link href="/insurance/request" className={styles.altLink}>
            Looking for personal RV coverage? Request coverage →
          </Link>
        </nav>

        {/* HEADER */}
        <header className={styles.header}>
          <p className={styles.kicker}>LICENSED PRODUCER ONBOARDING</p>
          <h1>Bring your RV insurance expertise to RVNB.</h1>
          <p>
            Licensed insurance agents, brokers, and agencies specializing in RV coverage can express early onboarding interest.
          </p>
        </header>

        {/* 3-STEP FORM */}
        <section id="pro-onboarding-form" aria-labelledby="form-heading">
          {status === "success" ? (
            <div className={styles.successPanel} aria-live="polite">
              <span className={styles.successMark} aria-hidden="true">✓</span>
              <h2>Professional Inquiry Received</h2>
              <p>{message}</p>
              <Link href="/insurance" className={styles.primaryButton}>
                Return to Insurance Hub
              </Link>
            </div>
          ) : (
            <form
              ref={formRef}
              className={styles.formCard}
              onSubmit={formWithProfile.step === 3 ? handleSubmit : handleContinue}
              noValidate
            >
              {/* COMPACT PROGRESS INDICATOR */}
              <nav className={styles.stepperNav} aria-label="Insurance professional onboarding progress">
                <div className={styles.stepperHeader}>
                  <span className={styles.stepperCounter}>
                    Section {formWithProfile.step} of 3 • {completedCount} of 3 complete
                  </span>
                  <span className={styles.stepperLabel}>
                    {formWithProfile.step === 1 && "Professional Profile"}
                    {formWithProfile.step === 2 && "Licensing & Service Area"}
                    {formWithProfile.step === 3 && "RV Specialties & Review"}
                  </span>
                </div>
                <div
                  className={styles.progressTrack}
                  role="progressbar"
                  aria-valuenow={completedCount}
                  aria-valuemin={0}
                  aria-valuemax={3}
                  aria-label="Application completion progress"
                >
                  <div
                    className={styles.progressBar}
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
                <div className={styles.stepPills} role="tablist" aria-label="Application sections">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={formWithProfile.step === 1}
                    className={`${styles.stepPill} ${formWithProfile.step === 1 ? styles.stepPillActive : step1Done ? styles.stepPillCompleted : ""}`}
                    onClick={() => goToStep(1)}
                    disabled={status === "submitting"}
                  >
                    <span className={styles.stepPillNum}>{step1Done ? "✓" : "1"}</span>
                    <span className={styles.stepPillContent}>
                      <span className={styles.stepPillTitle}>Profile</span>
                      <span className={styles.stepPillStatus}>{step1Done ? "Complete" : "Section 1"}</span>
                    </span>
                  </button>

                  <button
                    type="button"
                    role="tab"
                    aria-selected={formWithProfile.step === 2}
                    className={`${styles.stepPill} ${formWithProfile.step === 2 ? styles.stepPillActive : step2Done ? styles.stepPillCompleted : ""}`}
                    onClick={() => goToStep(2)}
                    disabled={status === "submitting"}
                  >
                    <span className={styles.stepPillNum}>{step2Done ? "✓" : "2"}</span>
                    <span className={styles.stepPillContent}>
                      <span className={styles.stepPillTitle}>Licensing</span>
                      <span className={styles.stepPillStatus}>{step2Done ? "Complete" : "Section 2"}</span>
                    </span>
                  </button>

                  <button
                    type="button"
                    role="tab"
                    aria-selected={formWithProfile.step === 3}
                    className={`${styles.stepPill} ${formWithProfile.step === 3 ? styles.stepPillActive : step3Done ? styles.stepPillCompleted : ""}`}
                    onClick={() => goToStep(3)}
                    disabled={status === "submitting"}
                  >
                    <span className={styles.stepPillNum}>{step3Done ? "✓" : "3"}</span>
                    <span className={styles.stepPillContent}>
                      <span className={styles.stepPillTitle}>Specialties</span>
                      <span className={styles.stepPillStatus}>{step3Done ? "Complete" : "Section 3"}</span>
                    </span>
                  </button>
                </div>
                <p className={styles.stepperHint}>
                  Feel free to review all three sections before completing your application.
                </p>
              </nav>

              {/* STEP 1: PROFESSIONAL PROFILE */}
              {formWithProfile.step === 1 && (
                <div>
                  <div className={styles.stepIntro}>
                    <p className={styles.kicker}>STEP 01 / PRODUCER PROFILE</p>
                    <h2 id="form-heading">Start with your professional profile.</h2>
                    <p>Tell us who you are, your contact info, and the agency or organization you represent.</p>
                  </div>

                  <div className={styles.fieldGrid}>
                    <label className={styles.field}>
                      <span>Full name <span className={styles.required}>Required</span></span>
                      <input
                        type="text"
                        value={formWithProfile.name}
                        onChange={(e) => updateField("name", e.target.value)}
                        placeholder="Your full name"
                        autoComplete="name"
                        required
                      />
                    </label>

                    <label className={styles.field}>
                      <span>Professional email address <span className={styles.required}>Required</span></span>
                      <input
                        type="email"
                        value={formWithProfile.email}
                        onChange={(e) => updateField("email", e.target.value)}
                        placeholder="agent@agency.com"
                        autoComplete="email"
                        required
                      />
                    </label>

                    <label className={styles.field}>
                      <span>Phone number <span className={styles.required}>Required</span></span>
                      <input
                        type="tel"
                        value={formWithProfile.phone}
                        onChange={(e) => updateField("phone", e.target.value)}
                        placeholder="(555) 000-0000"
                        autoComplete="tel"
                        required
                      />
                    </label>

                    <label className={styles.field}>
                      <span>Agency or company name</span>
                      <input
                        type="text"
                        value={formWithProfile.agency}
                        onChange={(e) => updateField("agency", e.target.value)}
                        placeholder="e.g. Apex RV Insurance Group"
                      />
                    </label>

                    <label className={styles.field}>
                      <span>Organization type <span className={styles.required}>Required</span></span>
                      <select
                        value={formWithProfile.professionalType}
                        onChange={(e) => updateField("professionalType", e.target.value as ProfessionalOnboardingForm["professionalType"])}
                        required
                      >
                        <option value="individual_agent">Independent Agent / Producer</option>
                        <option value="agency">Insurance Agency / Group</option>
                        <option value="brokerage">National Brokerage</option>
                        <option value="other">Managing General Agent / Other</option>
                      </select>
                    </label>

                    <label className={styles.field}>
                      <span>Agency website (optional)</span>
                      <input
                        type="url"
                        value={formWithProfile.website}
                        onChange={(e) => updateField("website", e.target.value)}
                        placeholder="https://agency.example.com"
                      />
                    </label>
                  </div>
                </div>
              )}

              {/* STEP 2: LICENSING & SERVICE AREA */}
              {formWithProfile.step === 2 && (
                <div>
                  <div className={styles.stepIntro}>
                    <p className={styles.kicker}>STEP 02 / LICENSING & SERVICE AREA</p>
                    <h2 id="form-heading">Tell us where you’re licensed.</h2>
                    <p>Share your resident licensing state, other jurisdictions, and primary operating territories.</p>
                  </div>

                  <div className={styles.fieldGrid}>
                    <label className={styles.field}>
                      <span>Resident licensing state <span className={styles.required}>Required</span></span>
                      <select
                        value={formWithProfile.residentState}
                        onChange={(e) => updateField("residentState", e.target.value)}
                        required
                      >
                        <option value="">Select state...</option>
                        {US_STATES.map((st) => (
                          <option key={st} value={st}>{st}</option>
                        ))}
                      </select>
                    </label>

                    <label className={styles.field}>
                      <span>National Producer Number (NPN)</span>
                      <input
                        type="text"
                        value={formWithProfile.npn}
                        onChange={(e) => updateField("npn", e.target.value)}
                        placeholder="Optional during early interest"
                      />
                    </label>

                    <label className={styles.field} style={{ gridColumn: "1 / -1" }}>
                      <span>Non-resident licensed states</span>
                      <input
                        type="text"
                        value={formWithProfile.otherStates}
                        onChange={(e) => updateField("otherStates", e.target.value)}
                        placeholder="e.g. AZ, NM, CO, UT, nationwide"
                      />
                    </label>

                    <label className={styles.field} style={{ gridColumn: "1 / -1" }}>
                      <span>Primary service area / territory <span className={styles.required}>Required</span></span>
                      <input
                        type="text"
                        value={formWithProfile.serviceArea}
                        onChange={(e) => updateField("serviceArea", e.target.value)}
                        placeholder="e.g. Texas, Sunbelt corridor, Mountain West, nationwide"
                        required
                      />
                    </label>
                  </div>
                </div>
              )}

              {/* STEP 3: RV SPECIALTIES & REVIEW */}
              {formWithProfile.step === 3 && (
                <div>
                  <div className={styles.stepIntro}>
                    <p className={styles.kicker}>STEP 03 / SPECIALTIES & REVIEW</p>
                    <h2 id="form-heading">Review & Confirm Professional Interest</h2>
                    <p>Review your producer credentials and indicate your RV customer specialties.</p>
                  </div>

                  {/* COMPACT REVIEW SUMMARY */}
                  <div className={styles.reviewCard}>
                    <div className={styles.reviewSection}>
                      <div className={styles.reviewInfo}>
                        <h4>Producer & Agency Profile</h4>
                        <p>
                          <strong>{formWithProfile.name.trim() || "Name not provided yet"}</strong>
                          {formWithProfile.agency.trim() ? ` (${formWithProfile.agency.trim()})` : ""} •{" "}
                          {PRO_TYPE_LABELS[formWithProfile.professionalType] || "Type not selected yet"} •{" "}
                          {formWithProfile.email.trim() || "Email not provided yet"}
                        </p>
                      </div>
                      <button
                        type="button"
                        className={styles.reviewEditBtn}
                        onClick={() => goToStep(1)}
                      >
                        Edit
                      </button>
                    </div>

                    <div className={styles.reviewSection}>
                      <div className={styles.reviewInfo}>
                        <h4>Licensing & Territory</h4>
                        <p>
                          <strong>Resident State:</strong> {formWithProfile.residentState || "Not selected yet"}<br />
                          <strong>Other States:</strong> {formWithProfile.otherStates.trim() || "None declared"}<br />
                          <strong>Territory:</strong> {formWithProfile.serviceArea.trim() || "Not provided yet"}
                          {formWithProfile.npn ? ` • NPN: ${formWithProfile.npn.trim()}` : ""}
                        </p>
                      </div>
                      <button
                        type="button"
                        className={styles.reviewEditBtn}
                        onClick={() => goToStep(2)}
                      >
                        Edit
                      </button>
                    </div>
                  </div>

                  <fieldset className={styles.fieldset}>
                    <legend>Experience & Specialties</legend>
                    <div className={styles.fieldGrid}>
                      <label className={styles.field} style={{ gridColumn: "1 / -1" }}>
                        <span>Years of RV Insurance experience <span className={styles.required}>Required</span></span>
                        <select
                          value={formWithProfile.experienceYears}
                          onChange={(e) => updateField("experienceYears", e.target.value as ProfessionalOnboardingForm["experienceYears"])}
                          required
                        >
                          <option value="less_than_1">Less than 1 year</option>
                          <option value="1_to_3">1 to 3 years</option>
                          <option value="3_to_5">3 to 5 years</option>
                          <option value="5_to_10">5 to 10 years</option>
                          <option value="10_plus">10+ years</option>
                        </select>
                      </label>
                    </div>

                    <div className={styles.field} style={{ marginTop: 12 }}>
                      <span>Customer types & policy specialties (select all that apply) <span className={styles.required}>Required</span></span>
                      <div className={styles.checkGroup}>
                        {SPECIALTY_OPTIONS.map((cType) => (
                          <label key={cType} className={styles.checkLabel}>
                            <input
                              type="checkbox"
                              checked={formWithProfile.customerTypes.includes(cType)}
                              onChange={() => toggleSpecialty(cType)}
                            />
                            <span>{cType}</span>
                          </label>
                        ))}
                      </div>
                    </div>

                    <div className={styles.field} style={{ marginTop: 12 }}>
                      <span>Additional program notes or carrier partnerships</span>
                      <textarea
                        value={formWithProfile.notes}
                        onChange={(e) => updateField("notes", e.target.value)}
                        placeholder="Describe your carrier appointments, underwriting strengths, or specialized RV programs..."
                        rows={3}
                      />
                    </div>
                  </fieldset>

                  {/* CONFIRMATIONS */}
                  <div className={styles.confirmations}>
                    <label>
                      <input
                        type="checkbox"
                        checked={formWithProfile.confirmsAccuracy}
                        onChange={(e) => updateField("confirmsAccuracy", e.target.checked)}
                      />
                      <span>I confirm that the licensing and professional details provided are accurate and representative.</span>
                    </label>
                    <label>
                      <input
                        type="checkbox"
                        checked={formWithProfile.confirmsEarlyAccess}
                        onChange={(e) => updateField("confirmsEarlyAccess", e.target.checked)}
                      />
                      <span>
                        I understand that this is an early-access intake and does not guarantee verification approval, platform promotion, leads, or sales.
                      </span>
                    </label>
                  </div>
                </div>
              )}

              {message && (
                <p className={styles.errorMessage} role="alert">
                  {message}
                </p>
              )}

              {/* ACTIONS */}
              <div className={styles.formActions}>
                {formWithProfile.step > 1 && (
                  <button
                    type="button"
                    className={styles.secondaryButton}
                    onClick={() => goToStep((formWithProfile.step - 1) as Step)}
                  >
                    ← Back
                  </button>
                )}

                <span className={styles.actionSpacer} />

                {formWithProfile.step === 1 && (
                  <button type="submit" className={styles.primaryButton}>
                    Continue to Licensing →
                  </button>
                )}

                {formWithProfile.step === 2 && (
                  <button type="submit" className={styles.primaryButton}>
                    Continue to Specialties →
                  </button>
                )}

                {formWithProfile.step === 3 && (
                  <button
                    type="submit"
                    className={styles.primaryButton}
                    disabled={status === "submitting"}
                  >
                    {status === "submitting" ? "Submitting..." : "Submit Professional Interest"}
                  </button>
                )}
              </div>

              {formWithProfile.step === 3 && (
                <p className={styles.reassuranceNote}>
                  Submission expresses interest in the future RVNB Insurance Network and does not guarantee verification, approval, promotion, leads, or access.
                </p>
              )}
            </form>
          )}
        </section>
      </div>
    </main>
  );
}
