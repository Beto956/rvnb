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

type OwnerRequestForm = {
  step: Step;
  rvType: string;
  usageType: string;
  state: string;
  rigYear: string;
  rigMakeModel: string;
  primaryInterest: "new_policy" | "renewal_comparison" | "full_time_coverage" | "high_value_custom" | "roadside_emergency" | "rental_use" | "general_guidance" | "other" | "";
  email: string;
  confirmsAccuracy: boolean;
  confirmsEarlyAccess: boolean;
};

const initialForm: OwnerRequestForm = {
  step: 1,
  rvType: "Travel trailer",
  usageType: "Occasional / Weekend travel",
  state: "",
  rigYear: "",
  rigMakeModel: "",
  primaryInterest: "new_policy",
  email: "",
  confirmsAccuracy: false,
  confirmsEarlyAccess: false,
};

const STORAGE_KEY = "rvnb-insurance-owner-draft";
const DRAFT_EVENT_NAME = "rvnb_insurance_owner_draft_change";

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

function saveDraftToStorage(data: OwnerRequestForm) {
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

const RV_TYPES = [
  "Travel trailer",
  "Fifth wheel",
  "Class A motorhome",
  "Class B camper van",
  "Class C motorhome",
  "Toy hauler",
  "Truck camper / Pop-up",
  "Park model / Destination",
  "Custom / High-value build",
  "Other",
] as const;

const USAGE_TYPES = [
  "Occasional / Weekend travel",
  "Seasonal travel / Snowbird",
  "Full-time RV living",
  "Stationary / Seasonal campsite",
  "Stored / Winterized",
  "Peer-to-peer rental eligible",
] as const;

const INTEREST_OPTIONS = [
  {
    id: "new_policy",
    title: "New policy for an upcoming RV purchase",
    description: "Preparing quote options and binders for newly purchased or ordered rigs.",
  },
  {
    id: "renewal_comparison",
    title: "Renewal rate & coverage comparison",
    description: "Evaluating current policy rates, deductibles, and endorsement options.",
  },
  {
    id: "full_time_coverage",
    title: "Full-time RV residential liability & contents",
    description: "Personal liability, premises liability, and high-limit personal property protection.",
  },
  {
    id: "high_value_custom",
    title: "High-value, agreed value, or custom build protection",
    description: "Appraisal-backed agreed value settlements and aftermarket accessory riders.",
  },
  {
    id: "roadside_emergency",
    title: "Specialized RV roadside assistance & heavy towing",
    description: "Commercial wrecker dispatch, mechanical roadside, and emergency lodging support.",
  },
  {
    id: "rental_use",
    title: "Rental-use or commercial endorsement guidance",
    description: "Coverage options for peer-to-peer platform rental or commercial usage.",
  },
  {
    id: "general_guidance",
    title: "General RV policy educational guidance",
    description: "Understanding core bodily injury, collision, comprehensive, and deductible options.",
  },
  {
    id: "other",
    title: "Other specialized coverage requirement",
    description: "Custom vintage restoration, international travel, or unique destination rigs.",
  },
] as const;

const INTEREST_LABELS: Record<string, string> = {
  new_policy: "New policy for upcoming purchase",
  renewal_comparison: "Renewal rate & coverage comparison",
  full_time_coverage: "Full-time RV liability & contents",
  high_value_custom: "High-value / Agreed value protection",
  roadside_emergency: "Specialized roadside & heavy towing",
  rental_use: "Rental-use / Commercial endorsement",
  general_guidance: "General RV policy guidance",
  other: "Other specialized coverage",
};

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export default function InsuranceRequestPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const formRef = useRef<HTMLFormElement | null>(null);

  const isMounted = useSyncExternalStore(subscribeDraft, () => true, () => false);
  const rawDraft = useSyncExternalStore(subscribeDraft, getDraftSnapshot, getServerDraftSnapshot);

  const [status, setStatus] = useState<FormStatus>("idle");
  const [message, setMessage] = useState("");

  const savedForm = useMemo<OwnerRequestForm>(() => {
    if (!isMounted || !rawDraft) return initialForm;
    try {
      const parsed = JSON.parse(rawDraft) as Partial<OwnerRequestForm>;
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
      email: savedForm.email || user?.email || "",
    };
  }, [savedForm, user, isMounted]);

  const updateField = <K extends keyof OwnerRequestForm>(field: K, value: OwnerRequestForm[K]) => {
    const next = { ...savedForm, [field]: value };
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

  const isStep1Complete = (data: OwnerRequestForm) => {
    return data.rvType.trim().length > 0 && data.usageType.trim().length > 0 && data.state.length === 2;
  };

  const isStep2Complete = (data: OwnerRequestForm) => {
    return data.primaryInterest !== "";
  };

  const isStep3Complete = (data: OwnerRequestForm) => {
    return isValidEmail(data.email) && data.confirmsAccuracy && data.confirmsEarlyAccess;
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

  function validateStep(currentStep: Step, data: OwnerRequestForm): string | null {
    if (currentStep === 1) {
      if (!data.rvType) return "Select your RV classification.";
      if (!data.usageType) return "Select how you primarily use your RV.";
      if (!data.state) return "Select your home registration or storage state.";
      return null;
    }

    if (currentStep === 2) {
      if (!data.primaryInterest) return "Select a primary coverage topic to discuss.";
      return null;
    }

    if (currentStep === 3) {
      if (!isValidEmail(data.email)) return "Enter a valid email address.";
      if (!data.confirmsAccuracy || !data.confirmsEarlyAccess) {
        return "Confirm both statements before submitting your request.";
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
      router.push(`/login?next=${encodeURIComponent("/insurance/request")}`);
      return;
    }

    try {
      setStatus("submitting");

      const payload = {
        userId: user.uid,
        email: formWithProfile.email.trim().toLowerCase(),
        state: formWithProfile.state,
        rvType: formWithProfile.rvType,
        usageType: formWithProfile.usageType,
        primaryInterest: formWithProfile.primaryInterest,
        confirmations: {
          informationAccurate: formWithProfile.confirmsAccuracy,
          earlyAccessUnderstood: formWithProfile.confirmsEarlyAccess,
        },
        source: "ecosystem_page",
        page: "Owner Insurance Request",
        createdAt: serverTimestamp(),
      };

      await addDoc(collection(db, "insuranceInterest"), payload);

      clearDraftFromStorage();
      setStatus("success");
      setMessage("Your RV coverage interest has been received. We will notify you when licensed agent matching opens in your state.");
      scrollToFormTop();
    } catch (err) {
      console.error("Owner request submission error:", err);
      setStatus("error");
      setMessage("Could not submit your coverage request right now. Please check your connection and try again.");
    }
  }

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        {/* TOP NAVIGATION */}
        <nav className={styles.topNav} aria-label="Insurance navigation">
          <Link href="/insurance" className={styles.backLink}>
            ← Back to Insurance Hub
          </Link>
          <Link href="/insurance/agent" className={styles.altLink}>
            Are you an insurance professional? Join network →
          </Link>
        </nav>

        {/* HEADER */}
        <header className={styles.header}>
          <p className={styles.kicker}>EXPLORE RV COVERAGE</p>
          <h1>Tell us what needs protection.</h1>
          <p>
            Share your rig details and preferred coverage topics. We’ll help you prepare the right questions for licensed insurance specialists in your state.
          </p>
        </header>

        {/* 3-STEP FORM */}
        <section id="owner-request-form" aria-labelledby="form-heading">
          {status === "success" ? (
            <div className={styles.successPanel} aria-live="polite">
              <span className={styles.successMark} aria-hidden="true">✓</span>
              <h2>Coverage Interest Received</h2>
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
              <nav className={styles.stepperNav} aria-label="Coverage interest application progress">
                <div className={styles.stepperHeader}>
                  <span className={styles.stepperCounter}>
                    Section {formWithProfile.step} of 3 • {completedCount} of 3 complete
                  </span>
                  <span className={styles.stepperLabel}>
                    {formWithProfile.step === 1 && "Your RV"}
                    {formWithProfile.step === 2 && "Coverage Interests"}
                    {formWithProfile.step === 3 && "Contact & Review"}
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
                      <span className={styles.stepPillTitle}>Your RV</span>
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
                      <span className={styles.stepPillTitle}>Coverage Interests</span>
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
                      <span className={styles.stepPillTitle}>Contact & Review</span>
                      <span className={styles.stepPillStatus}>{step3Done ? "Complete" : "Section 3"}</span>
                    </span>
                  </button>
                </div>
                <p className={styles.stepperHint}>
                  Feel free to review all three sections before completing your request.
                </p>
              </nav>

              {/* STEP 1: YOUR RV */}
              {formWithProfile.step === 1 && (
                <div>
                  <div className={styles.stepIntro}>
                    <p className={styles.kicker}>STEP 01 / YOUR RIG</p>
                    <h2 id="form-heading">Start with the basics about your RV.</h2>
                    <p>Tell us what kind of rig you have, how you travel, and where it is garaged or stored.</p>
                  </div>

                  <div className={styles.fieldGrid}>
                    <label className={styles.field}>
                      <span>RV classification <span className={styles.required}>Required</span></span>
                      <select
                        value={formWithProfile.rvType}
                        onChange={(e) => updateField("rvType", e.target.value)}
                        required
                      >
                        {RV_TYPES.map((type) => (
                          <option key={type} value={type}>{type}</option>
                        ))}
                      </select>
                    </label>

                    <label className={styles.field}>
                      <span>Primary travel pattern <span className={styles.required}>Required</span></span>
                      <select
                        value={formWithProfile.usageType}
                        onChange={(e) => updateField("usageType", e.target.value)}
                        required
                      >
                        {USAGE_TYPES.map((uType) => (
                          <option key={uType} value={uType}>{uType}</option>
                        ))}
                      </select>
                    </label>

                    <label className={styles.field}>
                      <span>Home registration or storage state <span className={styles.required}>Required</span></span>
                      <select
                        value={formWithProfile.state}
                        onChange={(e) => updateField("state", e.target.value)}
                        required
                      >
                        <option value="">Select state...</option>
                        {US_STATES.map((st) => (
                          <option key={st} value={st}>{st}</option>
                        ))}
                      </select>
                    </label>

                    <label className={styles.field}>
                      <span>Model year (optional)</span>
                      <input
                        type="text"
                        value={formWithProfile.rigYear}
                        onChange={(e) => updateField("rigYear", e.target.value)}
                        placeholder="e.g. 2023"
                        inputMode="numeric"
                      />
                    </label>

                    <label className={styles.field} style={{ gridColumn: "1 / -1" }}>
                      <span>Make and model (optional)</span>
                      <input
                        type="text"
                        value={formWithProfile.rigMakeModel}
                        onChange={(e) => updateField("rigMakeModel", e.target.value)}
                        placeholder="e.g. Grand Design Reflection 312BHTS, Airstream Flying Cloud, Tiffin Allegro"
                      />
                    </label>
                  </div>
                </div>
              )}

              {/* STEP 2: COVERAGE INTERESTS */}
              {formWithProfile.step === 2 && (
                <div>
                  <div className={styles.stepIntro}>
                    <p className={styles.kicker}>STEP 02 / COVERAGE TOPICS</p>
                    <h2 id="form-heading">What would you like to discuss?</h2>
                    <p>Choose the topics you’d like to discuss with a licensed professional. (Topics to explore—not bound coverage).</p>
                  </div>

                  <fieldset className={styles.fieldset}>
                    <legend>Primary coverage interest <span className={styles.required}>Required</span></legend>
                    <div className={styles.radioGroup}>
                      {INTEREST_OPTIONS.map((opt) => {
                        const isSelected = formWithProfile.primaryInterest === opt.id;
                        return (
                          <label
                            key={opt.id}
                            className={`${styles.radioLabel} ${isSelected ? styles.radioLabelSelected : ""}`}
                          >
                            <input
                              type="radio"
                              name="primaryInterest"
                              checked={isSelected}
                              onChange={() => updateField("primaryInterest", opt.id as OwnerRequestForm["primaryInterest"])}
                            />
                            <div className={styles.radioText}>
                              <strong>{opt.title}</strong>
                              <p style={{ margin: "2px 0 0", fontSize: "0.76rem", color: "rgba(226, 232, 240, 0.65)" }}>
                                {opt.description}
                              </p>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </fieldset>
                </div>
              )}

              {/* STEP 3: CONTACT & REVIEW */}
              {formWithProfile.step === 3 && (
                <div>
                  <div className={styles.stepIntro}>
                    <p className={styles.kicker}>STEP 03 / CONTACT & REVIEW</p>
                    <h2 id="form-heading">Check your details before submitting.</h2>
                    <p>Confirm your contact details and review your selections before sending your request.</p>
                  </div>

                  {/* COMPACT REVIEW SUMMARY */}
                  <div className={styles.reviewCard}>
                    <div className={styles.reviewSection}>
                      <div className={styles.reviewInfo}>
                        <h4>Rig & Garaging Details</h4>
                        <p>
                          <strong>{formWithProfile.rvType}</strong> • {formWithProfile.usageType} •{" "}
                          {formWithProfile.state ? `State: ${formWithProfile.state}` : "State not selected yet"}
                          {formWithProfile.rigYear || formWithProfile.rigMakeModel ? ` • ${formWithProfile.rigYear} ${formWithProfile.rigMakeModel}`.trim() : ""}
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
                        <h4>Primary Coverage Interest</h4>
                        <p>
                          <strong>{INTEREST_LABELS[formWithProfile.primaryInterest] || "Topic not selected yet"}</strong>
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

                  {/* CONTACT INPUT */}
                  <div className={styles.fieldGrid}>
                    <label className={styles.field} style={{ gridColumn: "1 / -1" }}>
                      <span>Email address <span className={styles.required}>Required</span></span>
                      <input
                        type="email"
                        value={formWithProfile.email}
                        onChange={(e) => updateField("email", e.target.value)}
                        placeholder="you@example.com"
                        autoComplete="email"
                        required
                      />
                    </label>
                  </div>

                  {/* CONFIRMATIONS */}
                  <div className={styles.confirmations}>
                    <label>
                      <input
                        type="checkbox"
                        checked={formWithProfile.confirmsAccuracy}
                        onChange={(e) => updateField("confirmsAccuracy", e.target.checked)}
                      />
                      <span>I confirm that the information provided is accurate to the best of my knowledge.</span>
                    </label>
                    <label>
                      <input
                        type="checkbox"
                        checked={formWithProfile.confirmsEarlyAccess}
                        onChange={(e) => updateField("confirmsEarlyAccess", e.target.checked)}
                      />
                      <span>
                        I understand that this is an early-access request and does not constitute an insurance application, quote, binder, or guarantee of coverage.
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
                    Continue to Coverage Interests →
                  </button>
                )}

                {formWithProfile.step === 2 && (
                  <button type="submit" className={styles.primaryButton}>
                    Continue to Review →
                  </button>
                )}

                {formWithProfile.step === 3 && (
                  <button
                    type="submit"
                    className={styles.primaryButton}
                    disabled={status === "submitting"}
                  >
                    {status === "submitting" ? "Submitting..." : "Submit Coverage Interest"}
                  </button>
                )}
              </div>

              {formWithProfile.step === 3 && (
                <p className={styles.reassuranceNote}>
                  This is an early-interest request, not an insurance application or quote. Coverage and eligibility depend on the insurer, policy, state, vehicle, and usage.
                </p>
              )}
            </form>
          )}
        </section>
      </div>
    </main>
  );
}
