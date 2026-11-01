"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import {
  TRANSPORT_EQUIPMENT_OPTIONS,
  TRANSPORT_OPERATING_SCOPE_LABELS,
  TRANSPORT_PROVIDER_TYPE_LABELS,
  TRANSPORT_SERVICE_OPTIONS,
  type TransportOptionHelp,
} from "@/lib/transport-options";
import styles from "./page.module.css";

type Step = 1 | 2 | 3;
type FormStatus = "idle" | "submitting" | "success" | "error";

type ProviderForm = {
  step: Step;
  name: string;
  email: string;
  phone: string;
  company: string;
  homeCity: string;
  homeState: string;
  providerType: "independent" | "company" | "driveaway" | "towaway" | "other" | "";
  services: string[];
  equipment: string[];
  serviceArea: string;
  operatingScope: "intrastate" | "regional" | "nationwide" | "";
  cdlStatus: "none" | "class_a" | "class_b" | "class_c" | "not_applicable" | "";
  insuranceStatus: "active" | "in_process" | "none_planning" | "not_applicable" | "";
  experienceYears: "less_than_1" | "1_to_3" | "3_to_5" | "5_to_10" | "10_plus" | "";
  notes: string;
  confirmsAccuracy: boolean;
  confirmsEarlyAccess: boolean;
};

const initialForm: ProviderForm = {
  step: 1,
  name: "",
  email: "",
  phone: "",
  company: "",
  homeCity: "",
  homeState: "",
  providerType: "",
  services: [],
  equipment: [],
  serviceArea: "",
  operatingScope: "",
  cdlStatus: "",
  insuranceStatus: "",
  experienceYears: "",
  notes: "",
  confirmsAccuracy: false,
  confirmsEarlyAccess: false,
};

const STORAGE_KEY = "rvnb-transport-provider-draft";
const DRAFT_EVENT_NAME = "rvnb_transport_provider_draft_change";

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
  } catch (error) {
    console.error("Could not read provider draft:", error);
    return "";
  }
}

function getServerDraftSnapshot(): string {
  return "";
}

function saveDraftToStorage(data: ProviderForm) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    window.dispatchEvent(new Event(DRAFT_EVENT_NAME));
  } catch (error) {
    console.error("Could not save provider draft:", error);
    throw error;
  }
}

function clearDraftFromStorage() {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(STORAGE_KEY);
    window.dispatchEvent(new Event(DRAFT_EVENT_NAME));
  } catch (error) {
    console.error("Could not clear submitted provider draft:", error);
  }
}

const US_STATES = [
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA",
  "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD",
  "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ",
  "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC",
  "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY"
] as const;

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function subscribeClient(callback: () => void) {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(DRAFT_EVENT_NAME, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(DRAFT_EVENT_NAME, callback);
    window.removeEventListener("storage", callback);
  };
}

function getClientSnapshot(): boolean {
  return true;
}

function getServerClientSnapshot(): boolean {
  return false;
}

export default function TransporterProviderPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const formRef = useRef<HTMLFormElement | null>(null);
  const submitLock = useRef(false);

  const isMounted = useSyncExternalStore(subscribeClient, getClientSnapshot, getServerClientSnapshot);
  const rawDraft = useSyncExternalStore(subscribeDraft, getDraftSnapshot, getServerDraftSnapshot);

  const [status, setStatus] = useState<FormStatus>("idle");
  const [message, setMessage] = useState("");
  const [activeHelpId, setActiveHelpId] = useState<string | null>(null);

  const savedForm = useMemo<ProviderForm>(() => {
    if (!isMounted || !rawDraft) return initialForm;
    try {
      const parsed: unknown = JSON.parse(rawDraft);
      if (!parsed || typeof parsed !== "object") throw new Error("Invalid provider draft");
      const restored = { ...initialForm };
      for (const key of Object.keys(initialForm) as (keyof ProviderForm)[]) {
        if (!(key in parsed)) continue;
        const value = (parsed as Record<string, unknown>)[key];
        const expected = initialForm[key];
        if (Array.isArray(expected) ? !Array.isArray(value) || !value.every(item => typeof item === "string") : typeof value !== typeof expected) {
          throw new Error("Invalid provider draft field");
        }
        Object.assign(restored, { [key]: value });
      }
      return {
        ...restored,
        step: restored.step === 1 || restored.step === 2 || restored.step === 3 ? restored.step : 1,
      };
    } catch (error) {
      console.error("Could not restore provider draft:", error);
      return initialForm;
    }
  }, [isMounted, rawDraft]);

  // Close help popover on click outside or escape
  useEffect(() => {
    function handleGlobalClick(event: MouseEvent) {
      if (activeHelpId && !(event.target as HTMLElement).closest(`.${styles.helpWrapper}`)) {
        setActiveHelpId(null);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setActiveHelpId(null);
      }
    }
    document.addEventListener("mousedown", handleGlobalClick);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleGlobalClick);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [activeHelpId]);

  const formWithProfile = useMemo(() => {
    if (!isMounted) return initialForm;
    return {
      ...savedForm,
      name: savedForm.name || user?.displayName || "",
      email: savedForm.email || user?.email || "",
      phone: savedForm.phone || user?.phoneNumber || "",
    };
  }, [savedForm, user, isMounted]);

  const updateField = <K extends keyof ProviderForm>(field: K, value: ProviderForm[K]) => {
    if (submitLock.current) return;
    const next = { ...savedForm, [field]: value };
    try { saveDraftToStorage(next); }
    catch {
      setStatus("error");
      setMessage("Your browser could not save this change. Allow session storage, then try again.");
      return false;
    }
    setStatus("idle");
    setMessage("");
    return true;
  };

  const toggleArrayItem = (field: "services" | "equipment", item: string) => {
    if (submitLock.current) return;
    const list = savedForm[field];
    const nextList = list.includes(item)
      ? list.filter((val) => val !== item)
      : [...list, item];
    const next = { ...savedForm, [field]: nextList };
    try { saveDraftToStorage(next); }
    catch {
      setStatus("error");
      setMessage("Your browser could not save this change. Allow session storage, then try again.");
      return;
    }
    setStatus("idle");
    setMessage("");
  };

  const scrollToFormTop = () => {
    if (formRef.current) {
      formRef.current.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
    }
  };

  const goToStep = (nextStep: Step) => {
    if (status === "submitting") return;
    if (!updateField("step", nextStep)) return;
    setStatus("idle");
    setMessage("");
    scrollToFormTop();
  };

  const isStep1Complete = (data: ProviderForm) => {
    return (
      data.name.trim().length > 0 &&
      isValidEmail(data.email) &&
      data.phone.trim().length > 0 &&
      data.homeCity.trim().length > 0 &&
      data.homeState.length > 0 &&
      data.providerType !== "" &&
      data.operatingScope !== ""
    );
  };

  const isStep2Complete = (data: ProviderForm) => {
    return (
      data.services.length > 0 &&
      data.equipment.length > 0 &&
      data.serviceArea.trim().length > 0
    );
  };

  const isStep3Complete = (data: ProviderForm) => {
    return (
      data.cdlStatus !== "" &&
      data.insuranceStatus !== "" &&
      data.experienceYears !== "" &&
      data.confirmsAccuracy &&
      data.confirmsEarlyAccess
    );
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

  function validateStep(currentStep: Step, data: ProviderForm): string | null {
    if (currentStep === 1) {
      if (!data.name.trim()) return "Enter your full name or contact name.";
      if (!isValidEmail(data.email)) return "Enter a valid email address.";
      if (!data.phone.trim()) return "Enter a valid contact phone number.";
      if (!data.homeCity.trim() || !data.homeState) return "Enter your primary base city and state.";
      if (!data.providerType) return "Select a provider category.";
      if (!data.operatingScope) return "Select an operating scope (intrastate, regional, or nationwide).";
      if (data.name.trim().length > 100 || data.homeCity.trim().length > 100 || data.company.trim().length > 100) return "Keep name, city, and company to 100 characters or fewer.";
      if (data.email.trim().length > 120) return "Keep email to 120 characters or fewer.";
      if (data.phone.trim().length < 5 || data.phone.trim().length > 30) return "Use a contact phone number between 5 and 30 characters.";
      return null;
    }

    if (currentStep === 2) {
      if (data.services.length === 0) return "Select at least one transport service offered.";
      if (data.equipment.length === 0) return "Select at least one equipment capability.";
      if (!data.serviceArea.trim()) return "Describe your preferred service area or operating corridors.";
      if (data.serviceArea.trim().length > 500) return "Keep your service area description to 500 characters or fewer.";
      return null;
    }

    if (currentStep === 3) {
      if (!data.cdlStatus) return "Select your CDL status.";
      if (!data.insuranceStatus) return "Select your commercial insurance status.";
      if (!data.experienceYears) return "Select your experience level.";
      if (data.notes.trim().length > 2000) return "Keep notes to 2,000 characters or fewer.";
      if (!data.confirmsAccuracy || !data.confirmsEarlyAccess) {
        return "Confirm both statements before sending your registration.";
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
    if (submitLock.current || status === "success") return;

    // Validate the entire form in step order
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

    if (authLoading) {
      setStatus("error");
      setMessage("Your sign-in status is still loading. Please try again shortly.");
      return;
    }

    if (!user) {
      try {
        saveDraftToStorage(formWithProfile);
        router.push(`/login?next=${encodeURIComponent("/transport/provider")}`);
      } catch {
        setStatus("error");
        setMessage("Your browser could not save this draft for sign-in. Allow session storage, then try again.");
      }
      return;
    }

    submitLock.current = true;
    try {
      setStatus("submitting");

      const payload = {
        userId: user.uid,
        name: formWithProfile.name.trim(),
        email: formWithProfile.email.trim().toLowerCase(),
        phone: formWithProfile.phone.trim(),
        company: formWithProfile.company.trim() || null,
        homeCity: formWithProfile.homeCity.trim(),
        homeState: formWithProfile.homeState,
        providerType: formWithProfile.providerType,
        services: formWithProfile.services,
        equipment: formWithProfile.equipment,
        serviceArea: formWithProfile.serviceArea.trim(),
        operatingScope: formWithProfile.operatingScope,
        cdlStatus: formWithProfile.cdlStatus,
        insuranceStatus: formWithProfile.insuranceStatus,
        experienceYears: formWithProfile.experienceYears,
        notes: formWithProfile.notes.trim() || null,
        confirmations: {
          informationAccurate: formWithProfile.confirmsAccuracy,
          earlyAccessUnderstood: formWithProfile.confirmsEarlyAccess,
        },
        source: "ecosystem_page",
        page: "Transporter Onboarding",
        createdAt: serverTimestamp(),
      };

      await addDoc(collection(db, "transportProviders"), payload);

      clearDraftFromStorage();
      setStatus("success");
      setMessage("Thanks—your provider information is recorded for future network planning. You can review it in My Account. It does not create a public listing or guarantee work.");
      scrollToFormTop();
    } catch (err) {
      submitLock.current = false;
      console.error("Provider submission failed:", err);
      setStatus("error");
      setMessage("Could not submit your provider profile right now. Please check your connection and try again.");
    }
  }

  // Summary labels for Step 3 review
  const selectedServicesText = useMemo(() => {
    const list = TRANSPORT_SERVICE_OPTIONS.filter((s) => formWithProfile.services.includes(s.id)).map((s) => s.label);
    return list.length > 0 ? list.join(", ") : "";
  }, [formWithProfile.services]);

  const selectedEquipmentText = useMemo(() => {
    const list = TRANSPORT_EQUIPMENT_OPTIONS.filter((e) => formWithProfile.equipment.includes(e.id)).map((e) => e.label);
    return list.length > 0 ? list.join(", ") : "";
  }, [formWithProfile.equipment]);

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <nav className={styles.topNav} aria-label="Transport navigation">
          <Link href="/transport" className={styles.backLink}>
            ← Back to Transport
          </Link>
          <Link href="/transport/request" className={styles.altLink}>
            Need an RV moved? Request transport →
          </Link>
        </nav>

        {/* HERO SECTION */}
        <header className={styles.hero}>
          <div className={styles.heroGlow} aria-hidden="true" />
          <div className={styles.heroInner}>
            <div className={styles.heroCopy}>
              <div className={styles.earlyAccessBadge}>
                <span className={styles.badgeDot} aria-hidden="true" />
                <span>Early Access • Provider Interest</span>
              </div>
              <p className={styles.kicker}>RVNB TRANSPORT NETWORK</p>
              <h1>Tell us how you move RVs.</h1>
              <p className={styles.heroLead}>
                Share your services, equipment, and operating areas to express interest in the developing RVNB transport network. Your registration is private and does not verify credentials, guarantee work, or guarantee a response time.
              </p>
              <div className={styles.heroActions}>
                <a className={styles.primaryButton} href="#onboard-form">
                  Register as a transport provider
                </a>
                <a className={styles.secondaryButton} href="#how-it-works">
                  How It Works
                </a>
              </div>
            </div>

            <div className={styles.hudCard} aria-label="Example transport lanes">
              <div className={styles.hudHeader}>
                <span className={styles.hudStatus}>
                  <span className={styles.badgeDot} aria-hidden="true" />
                  <span>Example Transport Lanes</span>
                </span>
                <span>Illustration only · Not live demand</span>
              </div>
              <div className={styles.hudLanes}>
                <div className={styles.hudLane}>
                  <div>
                    <span className={styles.hudLaneTitle}>Dallas, TX → Phoenix, AZ</span>
                  </div>
                  <span className={styles.hudLaneTag}>Fifth Wheel / Hotshot</span>
                </div>
                <div className={styles.hudLane}>
                  <div>
                    <span className={styles.hudLaneTitle}>Denver, CO → Moab, UT</span>
                  </div>
                  <span className={styles.hudLaneTag}>Travel Trailer Tow</span>
                </div>
                <div className={styles.hudLane}>
                  <div>
                    <span className={styles.hudLaneTitle}>Regional Sunbelt Corridor</span>
                  </div>
                  <span className={styles.hudLaneTag}>Multi-Rig Staging</span>
                </div>
              </div>
              <div className={styles.hudFooter}>
                <span>Self-reported equipment</span>
                <span>Illustration only · Not live demand</span>
              </div>
            </div>
          </div>
        </header>

        {/* TRANSPORTER BENEFITS */}
        <section className={styles.section} aria-labelledby="benefits-heading">
          <div className={styles.sectionIntro}>
            <p className={styles.kicker}>SHARE YOUR EXPERIENCE</p>
            <h2 id="benefits-heading">Tell us where and how you work.</h2>
            <p>
              We are exploring how route and service-area information could help RV transport providers and travelers in the future.
            </p>
          </div>
          <div className={styles.benefitsGrid}>
            <article className={styles.benefitCard}>
              <div className={styles.benefitIcon} aria-hidden="true"><RouteIcon /></div>
              <h3>Help us understand demand</h3>
              <p>Your registration helps us learn where RV transport services may be needed.</p>
            </article>
            <article className={styles.benefitCard}>
              <div className={styles.benefitIcon} aria-hidden="true"><CompassIcon /></div>
              <h3>Share your service area</h3>
              <p>Share the regions, routes, or local areas where you prefer to work.</p>
            </article>
            <article className={styles.benefitCard}>
              <div className={styles.benefitIcon} aria-hidden="true"><ShieldCheckIcon /></div>
              <h3>Share Your Capabilities</h3>
              <p>Record equipment and experience privately. This does not create a public profile or verify your details.</p>
            </article>
            <article className={styles.benefitCard}>
              <div className={styles.benefitIcon} aria-hidden="true"><CalendarIcon /></div>
              <h3>Share preferred routes</h3>
              <p>Share the routes and areas where you prefer to operate.</p>
            </article>
            <article className={styles.benefitCard}>
              <div className={styles.benefitIcon} aria-hidden="true"><UserGroupIcon /></div>
              <h3>Plan future moves directly</h3>
              <p>Any future move would need to be arranged directly between provider and customer.</p>
            </article>
            <article className={styles.benefitCard}>
              <div className={styles.benefitIcon} aria-hidden="true"><LockIcon /></div>
              <h3>Register your interest</h3>
              <p>Register interest. Approval, work assignments, and earnings are not guaranteed.</p>
            </article>
          </div>
        </section>

        {/* HOW IT WORKS */}
        <section className={styles.section} id="how-it-works" aria-labelledby="how-it-works-heading">
          <div className={styles.sectionIntro}>
            <p className={styles.kicker}>WHAT TO EXPECT</p>
            <h2 id="how-it-works-heading">From initial intake to future route coordination.</h2>
            <p>Share your details and equipment now. The later steps describe possible future plans.</p>
          </div>
          <div className={styles.stepsGrid}>
            <article className={styles.stepCard}>
              <span className={styles.stepNumber}>01</span>
              <h3>Submit Profile</h3>
              <p>Share your driver details, company background, and operating base.</p>
            </article>
            <article className={styles.stepCard}>
              <span className={styles.stepNumber}>02</span>
              <h3>Define Equipment</h3>
              <p>List hitch setups, truck classifications, trailer decks, and capacities.</p>
            </article>
            <article className={styles.stepCard}>
              <span className={styles.stepNumber}>03</span>
              <h3>Future Verification</h3>
              <p>Credential and insurance checks may be considered later; this form does not verify them.</p>
            </article>
            <article className={styles.stepCard}>
              <span className={styles.stepNumber}>04</span>
              <h3>Discover Routes</h3>
              <p>Route information and provider tools are possible future plans, not live services.</p>
            </article>
            <article className={styles.stepCard}>
              <span className={styles.stepNumber}>05</span>
              <h3>Coordinate Delivery</h3>
              <p>Providers and customers would arrange any future move directly.</p>
            </article>
          </div>
        </section>

        {/* CAPABILITIES & EQUIPMENT */}
        <section className={styles.section} aria-labelledby="capabilities-heading">
          <div className={styles.sectionIntro}>
            <p className={styles.kicker}>SERVICES & EQUIPMENT</p>
            <h2 id="capabilities-heading">Movement support for diverse RV classifications.</h2>
            <p>Share which services and equipment describe your work. Suitability depends on the RV, route, and provider equipment.</p>
          </div>
          <div className={styles.capabilitiesGrid}>
            <article className={styles.capabilityCard}>
              <span className={styles.capabilityPill} aria-hidden="true" />
              <h3>Travel Trailers</h3>
              <p>Tow-away support for travel trailers, depending on the vehicle, setup, route, and provider equipment.</p>
            </article>
            <article className={styles.capabilityCard}>
              <span className={styles.capabilityPill} aria-hidden="true" />
              <h3>Fifth Wheels</h3>
              <p>Tow-away support for fifth wheels, depending on the hitch, setup, route, and provider equipment.</p>
            </article>
            <article className={styles.capabilityCard}>
              <span className={styles.capabilityPill} aria-hidden="true" />
              <h3>Motorhome Drive-Away</h3>
              <p>Drive-away moves for operable motorhomes, arranged directly with a suitable provider.</p>
            </article>
            <article className={styles.capabilityCard}>
              <span className={styles.capabilityPill} aria-hidden="true" />
              <h3>Tow-Away Service</h3>
              <p>Tow-away moves for compatible trailers and fifth wheels.</p>
            </article>
            <article className={styles.capabilityCard}>
              <span className={styles.capabilityPill} aria-hidden="true" />
              <h3>Local Relocation</h3>
              <p>Short-range moves between campsites, storage lots, maintenance shops, and properties.</p>
            </article>
            <article className={styles.capabilityCard}>
              <span className={styles.capabilityPill} aria-hidden="true" />
              <h3>Long-Distance Lanes</h3>
              <p>Cross-country relocation for seasonal snowbirds, relocations, and full-time travelers.</p>
            </article>
            <article className={styles.capabilityCard}>
              <span className={styles.capabilityPill} aria-hidden="true" />
              <h3>Non-Operational Rigs</h3>
              <p>Trailer or flatbed transport may suit some non-operational RVs, depending on condition and equipment.</p>
            </article>
            <article className={styles.capabilityCard}>
              <span className={styles.capabilityPill} aria-hidden="true" />
              <h3>Specialized / Oversized</h3>
              <p>Some larger units may need specialized equipment and a provider familiar with the configuration.</p>
            </article>
          </div>
        </section>

        {/* TRUST & READINESS EXPECTATIONS */}
        <section className={styles.section} aria-labelledby="trust-heading">
          <div className={styles.sectionIntro}>
            <p className={styles.kicker}>BEFORE A MOVE</p>
            <h2 id="trust-heading">Details to confirm with a provider.</h2>
            <p>Before agreeing to a move, discuss safe handling and applicable requirements directly with the provider.</p>
          </div>
          <div className={styles.trustPanel}>
            <ul className={styles.trustList}>
              <li><strong>Requirements:</strong> Confirm applicable licensing and requirements for the service and route.</li>
              <li><strong>Insurance:</strong> Discuss coverage and exclusions directly with the customer and insurer. Intake answers are self-reported, not verified.</li>
              <li><strong>Equipment:</strong> Confirm equipment is suitable for the RV and route.</li>
              <li><strong>Handoff:</strong> Agree on timing, condition documentation, access, and delivery details.</li>
            </ul>
            <div className={styles.disclaimerBox}>
              <strong>Before making arrangements</strong>
              <p>
                Requirements vary by RV, equipment, route, and service. This early-access registration does not verify credentials, approve a provider, or guarantee work.
              </p>
            </div>
          </div>
        </section>

        {/* 3-STEP ONBOARDING FORM */}
        <section className={styles.formSection} id="onboard-form" aria-labelledby="form-heading">
          {status === "success" ? (
            <div className={styles.successPanel} aria-live="polite">
              <span className={styles.successMark} aria-hidden="true">✓</span>
              <h2>Registration received</h2>
              <p>{message}</p>
              <Link href="/transport" className={styles.primaryButton}>
                Return to Transport Hub
              </Link>{" "}
              <Link href="/account" className={styles.secondaryButton}>
                View in My Account
              </Link>
            </div>
          ) : (
            <form
              ref={formRef}
              className={styles.formCard}
              onSubmit={formWithProfile.step === 3 ? handleSubmit : handleContinue}
              noValidate
            >
              <fieldset className={styles.formFields} disabled={status === "submitting"} aria-busy={status === "submitting"}>
              {/* COMPACT PROGRESS INDICATOR */}
              <nav className={styles.stepperNav} aria-label="Transport provider registration progress">
                <div className={styles.stepperHeader}>
                  <span className={styles.stepperCounter}>
                    Section {formWithProfile.step} of 3 • {completedCount} of 3 complete
                  </span>
                  <span className={styles.stepperLabel}>
                    {formWithProfile.step === 1 && "About You"}
                    {formWithProfile.step === 2 && "Services & Equipment"}
                    {formWithProfile.step === 3 && "Readiness & Submit"}
                  </span>
                </div>
                <div
                  className={styles.progressTrack}
                  role="progressbar"
                  aria-valuenow={completedCount}
                  aria-valuemin={0}
                  aria-valuemax={3}
                  aria-label="Registration completion progress"
                >
                  <div
                    className={styles.progressBar}
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
                <div className={styles.stepPills} role="tablist" aria-label="Registration sections">
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
                      <span className={styles.stepPillTitle}>About You</span>
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
                      <span className={styles.stepPillTitle}>Services & Gear</span>
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
                      <span className={styles.stepPillTitle}>Readiness</span>
                      <span className={styles.stepPillStatus}>{step3Done ? "Complete" : "Section 3"}</span>
                    </span>
                  </button>
                </div>
                <p className={styles.stepperHint}>
                  Review your details before sending your registration.
                </p>
              </nav>

              {/* STEP 1: ABOUT YOU */}
              {formWithProfile.step === 1 && (
                <div>
                  <div className={styles.stepIntro}>
                    <p className={styles.kicker}>STEP 01 / ABOUT YOU</p>
                    <h2 id="form-heading">Let’s start with the basics.</h2>
                    <p>This should only take a moment. Tell us who you are and where you base your operations.</p>
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
                      <span>Company or DBA name</span>
                      <input
                        type="text"
                        value={formWithProfile.company}
                        onChange={(e) => updateField("company", e.target.value)}
                        placeholder="Optional company name"
                      />
                    </label>

                    <label className={styles.field}>
                      <span>Base city <span className={styles.required}>Required</span></span>
                      <input
                        type="text"
                        value={formWithProfile.homeCity}
                        onChange={(e) => updateField("homeCity", e.target.value)}
                        placeholder="e.g. Dallas, Denver, Tampa"
                        required
                      />
                    </label>

                    <label className={styles.field}>
                      <span>Base state <span className={styles.required}>Required</span></span>
                      <select
                        value={formWithProfile.homeState}
                        onChange={(e) => updateField("homeState", e.target.value)}
                        required
                      >
                        <option value="">Select state...</option>
                        {US_STATES.map((st) => (
                          <option key={st} value={st}>{st}</option>
                        ))}
                      </select>
                    </label>

                    <label className={styles.field}>
                      <span>Provider classification <span className={styles.required}>Required</span></span>
                      <select
                        value={formWithProfile.providerType}
                        onChange={(e) => updateField("providerType", e.target.value as ProviderForm["providerType"])}
                        required
                      >
                        <option value="independent">Independent transporter / Hotshot driver</option>
                        <option value="company">Transport company / Fleet operator</option>
                        <option value="driveaway">Motorhome drive-away specialist</option>
                        <option value="towaway">Tow-away / Dealership relocator</option>
                        <option value="other">Other specialized transport</option>
                      </select>
                    </label>

                    <label className={styles.field}>
                      <span>Operating scope <span className={styles.required}>Required</span></span>
                      <select
                        value={formWithProfile.operatingScope}
                        onChange={(e) => updateField("operatingScope", e.target.value as ProviderForm["operatingScope"])}
                        required
                      >
                        <option value="intrastate">Intrastate only (within home state)</option>
                        <option value="regional">Regional & multi-state corridors</option>
                        <option value="nationwide">Nationwide / Lower 48</option>
                      </select>
                    </label>
                  </div>
                </div>
              )}

              {/* STEP 2: SERVICES & EQUIPMENT */}
              {formWithProfile.step === 2 && (
                <div>
                  <div className={styles.stepIntro}>
                    <p className={styles.kicker}>STEP 02 / SERVICES & EQUIPMENT</p>
                    <h2 id="form-heading">What can you handle?</h2>
                    <p>Tell us what you can handle and where you prefer to operate. Tap any row to select.</p>
                  </div>

                  <p className={styles.stepHelpBanner}>
                    Not sure which option fits? Select the <span className={styles.helpBadgeInline}>?</span> beside any service or equipment type for an example.
                  </p>

                  <fieldset className={styles.fieldset}>
                    <legend>Services offered (select all that apply) <span className={styles.required}>Required</span></legend>
                    <div className={styles.checkGroup}>
                      {TRANSPORT_SERVICE_OPTIONS.map((srv) => {
                        const isSelected = formWithProfile.services.includes(srv.id);
                        return (
                          <label
                            key={srv.id}
                            className={`${styles.checkLabel} ${isSelected ? styles.checkLabelSelected : ""}`}
                          >
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleArrayItem("services", srv.id)}
                            />
                            <span className={styles.checkLabelText}>{srv.label}</span>
                            <OptionHelpButton
                              id={`srv_${srv.id}`}
                              title={srv.label}
                              help={srv.help}
                              activeId={activeHelpId}
                              onToggle={(id) => setActiveHelpId((curr) => (curr === id ? null : id))}
                            />
                          </label>
                        );
                      })}
                    </div>
                  </fieldset>

                  <fieldset className={styles.fieldset}>
                    <legend>Equipment & setup capabilities (select all that apply) <span className={styles.required}>Required</span></legend>
                    <div className={styles.checkGroup}>
                      {TRANSPORT_EQUIPMENT_OPTIONS.map((eq) => {
                        const isSelected = formWithProfile.equipment.includes(eq.id);
                        return (
                          <label
                            key={eq.id}
                            className={`${styles.checkLabel} ${isSelected ? styles.checkLabelSelected : ""}`}
                          >
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleArrayItem("equipment", eq.id)}
                            />
                            <span className={styles.checkLabelText}>{eq.label}</span>
                            <OptionHelpButton
                              id={`eq_${eq.id}`}
                              title={eq.label}
                              help={eq.help}
                              activeId={activeHelpId}
                              onToggle={(id) => setActiveHelpId((curr) => (curr === id ? null : id))}
                            />
                          </label>
                        );
                      })}
                    </div>
                  </fieldset>

                  <div style={{ marginTop: 22 }}>
                    <label className={styles.field}>
                      <span>Preferred service areas, routes, or operating lanes <span className={styles.required}>Required</span></span>
                      <input
                        type="text"
                        value={formWithProfile.serviceArea}
                        onChange={(e) => updateField("serviceArea", e.target.value)}
                        placeholder="e.g. Texas & Southwest corridors, I-10 / I-35 / I-40 lanes, regional 500-mile radius, or nationwide"
                        required
                      />
                    </label>
                  </div>
                </div>
              )}

              {/* STEP 3: READINESS & SUBMIT */}
              {formWithProfile.step === 3 && (
                <div>
                  <div className={styles.stepIntro}>
                    <p className={styles.kicker}>STEP 03 / READINESS & SUBMIT</p>
                    <h2 id="form-heading">Review your details</h2>
                    <p>Check your information before sending it privately for future planning.</p>
                  </div>

                  {/* COMPACT REVIEW SUMMARY */}
                  <div className={styles.reviewCard}>
                    <div className={styles.reviewSection}>
                      <div className={styles.reviewInfo}>
                        <h4>Provider & Base</h4>
                        <p>
                          <strong>{formWithProfile.name.trim() || "Name not provided yet"}</strong>
                          {formWithProfile.company.trim() ? ` (${formWithProfile.company.trim()})` : ""} •{" "}
                          {formWithProfile.homeCity.trim() && formWithProfile.homeState
                            ? `${formWithProfile.homeCity.trim()}, ${formWithProfile.homeState}`
                            : "Base location not selected yet"}{" "}
                          • {TRANSPORT_PROVIDER_TYPE_LABELS[formWithProfile.providerType] || "Classification not selected yet"}
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
                        <h4>Services & Operating Scope</h4>
                        <p>
                          <strong>Scope:</strong> {TRANSPORT_OPERATING_SCOPE_LABELS[formWithProfile.operatingScope] || "Scope not selected yet"}<br />
                          <strong>Services:</strong> {selectedServicesText || "No services selected yet"}<br />
                          <strong>Equipment:</strong> {selectedEquipmentText || "No equipment selected yet"}<br />
                          <strong>Lanes:</strong> {formWithProfile.serviceArea.trim() || "Operating lanes not provided yet"}
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

                  {/* READINESS QUESTIONS */}
                  <div className={styles.fieldGrid}>
                    <label className={styles.field}>
                      <span>Commercial Driver’s License (CDL) <span className={styles.required}>Required</span></span>
                      <select
                        value={formWithProfile.cdlStatus}
                        onChange={(e) => updateField("cdlStatus", e.target.value as ProviderForm["cdlStatus"])}
                        required
                      >
                        <option value="none">Standard Driver’s License (non-CDL)</option>
                        <option value="class_a">Class A CDL</option>
                        <option value="class_b">Class B CDL</option>
                        <option value="class_c">Class C CDL</option>
                        <option value="not_applicable">Not applicable</option>
                      </select>
                    </label>

                    <label className={styles.field}>
                      <span>Commercial / Cargo Insurance Status <span className={styles.required}>Required</span></span>
                      <select
                        value={formWithProfile.insuranceStatus}
                        onChange={(e) => updateField("insuranceStatus", e.target.value as ProviderForm["insuranceStatus"])}
                        required
                      >
                        <option value="active">Active commercial auto & cargo insurance</option>
                        <option value="in_process">In process of obtaining coverage</option>
                        <option value="none_planning">Personal insurance / planning commercial</option>
                        <option value="not_applicable">Not applicable</option>
                      </select>
                    </label>

                    <label className={styles.field}>
                      <span>Years of relevant towing/hauling experience <span className={styles.required}>Required</span></span>
                      <select
                        value={formWithProfile.experienceYears}
                        onChange={(e) => updateField("experienceYears", e.target.value as ProviderForm["experienceYears"])}
                        required
                      >
                        <option value="less_than_1">Less than 1 year</option>
                        <option value="1_to_3">1 to 3 years</option>
                        <option value="3_to_5">3 to 5 years</option>
                        <option value="5_to_10">5 to 10 years</option>
                        <option value="10_plus">10+ years</option>
                      </select>
                    </label>

                    <label className={styles.field}>
                      <span>Additional details, rig specs, or special capabilities</span>
                      <textarea
                        value={formWithProfile.notes}
                        onChange={(e) => updateField("notes", e.target.value)}
                        placeholder="e.g. 1-ton dually with auxiliary fuel tank, air-ride hitch, 25k lbs towing capacity..."
                        rows={3}
                      />
                    </label>
                  </div>

                  {/* LEGAL & EARLY ACCESS AFFIRMATIONS */}
                  <div className={styles.confirmations}>
                    <label>
                      <input
                        type="checkbox"
                        checked={formWithProfile.confirmsAccuracy}
                        onChange={(e) => updateField("confirmsAccuracy", e.target.checked)}
                      />
                      <span>I confirm that the information provided is accurate and representative of my capabilities.</span>
                    </label>
                    <label>
                      <input
                        type="checkbox"
                        checked={formWithProfile.confirmsEarlyAccess}
                        onChange={(e) => updateField("confirmsEarlyAccess", e.target.checked)}
                      />
                      <span>
                        I understand that this is early-access registration. My information is self-reported and does not guarantee verification, work, or earnings.
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

              {/* ACTION BUTTONS */}
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
                    Continue to Services →
                  </button>
                )}

                {formWithProfile.step === 2 && (
                  <button type="submit" className={styles.primaryButton}>
                    Continue to Readiness →
                  </button>
                )}

                {formWithProfile.step === 3 && (
                  <button
                    type="submit"
                    className={styles.primaryButton}
                    disabled={status === "submitting"}
                  >
                    {status === "submitting" ? "Sending registration..." : "Send provider registration"}
                  </button>
                )}
              </div>

              {formWithProfile.step === 3 && (
                <p className={styles.reassuranceNote}>
                  Submitting records your interest for future planning. It does not guarantee verification or work.
                </p>
              )}
              </fieldset>
            </form>
          )}
        </section>
      </div>
    </main>
  );
}

function RouteIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="6" cy="19" r="3" />
      <path d="M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15" />
      <circle cx="18" cy="5" r="3" />
    </svg>
  );
}

function CompassIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
    </svg>
  );
}

function ShieldCheckIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
      <line x1="16" x2="16" y1="2" y2="6" />
      <line x1="8" x2="8" y1="2" y2="6" />
      <line x1="3" x2="21" y1="10" y2="10" />
    </svg>
  );
}

function UserGroupIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

function OptionHelpButton({
  id,
  title,
  help,
  activeId,
  onToggle,
}: {
  id: string;
  title: string;
  help: TransportOptionHelp;
  activeId: string | null;
  onToggle: (id: string) => void;
}) {
  const isOpen = activeId === id;

  return (
    <span className={styles.helpWrapper}>
      <button
        type="button"
        className={`${styles.helpButton} ${isOpen ? styles.helpButtonActive : ""}`}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onToggle(id);
        }}
        onPointerDown={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        aria-label={`Learn more about ${title}`}
        aria-expanded={isOpen}
        aria-controls={isOpen ? `help-popover-${id}` : undefined}
      >
        <span aria-hidden="true">?</span>
      </button>

      {isOpen && (
        <span
          id={`help-popover-${id}`}
          role="region"
          aria-label={`${title} definition and example`}
          className={styles.helpPopover}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          onPointerDown={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <span className={styles.helpPopoverHeader}>
            <span className={styles.helpPopoverTitle}>{title}</span>
            <button
              type="button"
              className={styles.helpCloseButton}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onToggle(id);
              }}
              aria-label={`Close ${title} help`}
            >
              ✕
            </button>
          </span>
          <span className={styles.helpDefinition}>{help.definition}</span>
          <span className={styles.helpExample}>
            <strong>Example:</strong> {help.example}
          </span>
          {help.clarification && (
            <span className={styles.helpClarification}>
              <strong>Note:</strong> {help.clarification}
            </span>
          )}
        </span>
      )}
    </span>
  );
}
