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
  providerType: "independent",
  services: ["travel_trailer", "fifth_wheel"],
  equipment: ["heavy_duty_truck", "fifth_wheel_hitch"],
  serviceArea: "",
  operatingScope: "regional",
  cdlStatus: "none",
  insuranceStatus: "active",
  experienceYears: "1_to_3",
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
  } catch {
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
  } catch {
    // ignore quota errors
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

type OptionHelp = {
  definition: string;
  example: string;
  clarification?: string;
};

type OptionItem = {
  id: string;
  label: string;
  help: OptionHelp;
};

const SERVICE_OPTIONS: readonly OptionItem[] = [
  {
    id: "travel_trailer",
    label: "Travel-trailer transport",
    help: {
      definition: "Tow conventional bumper-pull travel trailers using a properly rated tow vehicle and hitch setup.",
      example: "Moving a 30-foot travel trailer from an RV dealership to the owner’s seasonal campsite.",
    },
  },
  {
    id: "fifth_wheel",
    label: "Fifth-wheel transport",
    help: {
      definition: "Tow RVs that connect to a fifth-wheel hitch mounted in the bed of a suitable pickup truck.",
      example: "Relocating a 40-foot fifth wheel between an RV park in Texas and a winter site in Arizona.",
    },
  },
  {
    id: "driveaway",
    label: "Motorhome drive-away",
    help: {
      definition: "A qualified driver operates the customer’s motorhome itself instead of towing it on a trailer.",
      example: "Driving a roadworthy Class A motorhome from the owner’s home to a repair facility.",
      clarification: "The motorhome must be legally operable and suitable for the planned trip.",
    },
  },
  {
    id: "towaway",
    label: "Tow-away & hitch service",
    help: {
      definition: "The provider supplies the tow vehicle and appropriate hitch equipment to move a towable RV.",
      example: "Picking up a bumper-pull camper from a private seller and delivering it to the buyer.",
    },
  },
  {
    id: "local_relocation",
    label: "Local campsite & storage moves",
    help: {
      definition: "Short-distance RV relocation between nearby properties, campgrounds, dealerships, or storage facilities.",
      example: "Moving a fifth wheel from a storage lot to a campsite within the same city.",
    },
  },
  {
    id: "long_distance",
    label: "Long-distance & cross-country routes",
    help: {
      definition: "RV transportation across longer regional, interstate, or nationwide routes.",
      example: "Transporting a travel trailer from Florida to Colorado.",
    },
  },
  {
    id: "non_operational",
    label: "Non-operational / flatbed hauling",
    help: {
      definition: "Transport for an RV that cannot be safely driven or conventionally towed and may require a winch, flatbed, or equipment trailer.",
      example: "Hauling a damaged camper with unsafe tires to a repair facility.",
      clarification: "Select this only when you have suitable loading and securement equipment.",
    },
  },
  {
    id: "oversized",
    label: "Specialized or oversized transport",
    help: {
      definition: "Movement of unusually wide, tall, long, or heavy RVs requiring specialized equipment or additional route planning.",
      example: "Moving a wide-body park model that may require permits or escort coordination.",
      clarification: "Select this only if you are appropriately equipped and qualified. Requirements vary by route and jurisdiction.",
    },
  },
] as const;

const EQUIPMENT_OPTIONS: readonly OptionItem[] = [
  {
    id: "heavy_duty_truck",
    label: "Heavy-duty pickup / dually",
    help: {
      definition: "A properly rated pickup truck suitable for the RV weights and towing configuration you accept.",
      example: "A one-ton dually configured to tow a large fifth wheel.",
    },
  },
  {
    id: "fifth_wheel_hitch",
    label: "Fifth-wheel hitch",
    help: {
      definition: "An in-bed coupling system designed for fifth-wheel RV trailers.",
      example: "A properly rated fifth-wheel hitch mounted in the bed of a pickup.",
    },
  },
  {
    id: "gooseneck",
    label: "Gooseneck ball",
    help: {
      definition: "An in-bed ball coupling used for compatible gooseneck trailers or properly approved configurations.",
      example: "Moving a trailer specifically designed for an in-bed gooseneck-ball connection.",
      clarification: "A gooseneck ball is not automatically interchangeable with every fifth-wheel RV connection.",
    },
  },
  {
    id: "bumper_pull",
    label: "Bumper-pull / weight distribution",
    help: {
      definition: "A receiver-hitch system for conventional travel trailers, sometimes using weight-distribution and sway-control equipment.",
      example: "Towing a bumper-pull travel trailer using a rated weight-distribution hitch.",
    },
  },
  {
    id: "flatbed_trailer",
    label: "Flatbed / equipment trailer",
    help: {
      definition: "A trailer capable of carrying RVs or units that cannot be moved through conventional towing.",
      example: "Loading a non-operational camper onto a suitably rated flatbed trailer.",
    },
  },
  {
    id: "chase_vehicle",
    label: "Escort / chase vehicle",
    help: {
      definition: "An additional support vehicle used when a move requires route assistance, visibility, or specialized coordination.",
      example: "Supporting the movement of an oversized park model where legally required.",
    },
  },
  {
    id: "other",
    label: "Other specialized gear",
    help: {
      definition: "Additional professional equipment used for loading, securement, safety, or uncommon RV configurations.",
      example: "Winches, wheel straps, heavy-duty tie-downs, loading ramps, or specialized adapters.",
      clarification: "The provider can describe this equipment in the application’s additional-information field.",
    },
  },
] as const;

const PROVIDER_TYPE_LABELS: Record<string, string> = {
  independent: "Independent transporter / Hotshot driver",
  company: "Transport company / Fleet operator",
  driveaway: "Motorhome drive-away specialist",
  towaway: "Tow-away / Dealership relocator",
  other: "Other specialized transport",
};

const OPERATING_SCOPE_LABELS: Record<string, string> = {
  intrastate: "Intrastate only (within home state)",
  regional: "Regional & multi-state corridors",
  nationwide: "Nationwide / Lower 48",
};

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

  const isMounted = useSyncExternalStore(subscribeClient, getClientSnapshot, getServerClientSnapshot);
  const rawDraft = useSyncExternalStore(subscribeDraft, getDraftSnapshot, getServerDraftSnapshot);

  const [status, setStatus] = useState<FormStatus>("idle");
  const [message, setMessage] = useState("");
  const [activeHelpId, setActiveHelpId] = useState<string | null>(null);

  const savedForm = useMemo<ProviderForm>(() => {
    if (!isMounted || !rawDraft) return initialForm;
    try {
      const parsed = JSON.parse(rawDraft) as Partial<ProviderForm>;
      return {
        ...initialForm,
        ...parsed,
        step: (parsed.step === 1 || parsed.step === 2 || parsed.step === 3 ? parsed.step : 1) as Step,
      };
    } catch {
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
    const next = { ...savedForm, [field]: value };
    saveDraftToStorage(next);
    setStatus("idle");
    setMessage("");
  };

  const toggleArrayItem = (field: "services" | "equipment", item: string) => {
    const list = savedForm[field];
    const nextList = list.includes(item)
      ? list.filter((val) => val !== item)
      : [...list, item];
    const next = { ...savedForm, [field]: nextList };
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
      return null;
    }

    if (currentStep === 2) {
      if (data.services.length === 0) return "Select at least one transport service offered.";
      if (data.equipment.length === 0) return "Select at least one equipment capability.";
      if (!data.serviceArea.trim()) return "Describe your preferred service area or operating corridors.";
      return null;
    }

    if (currentStep === 3) {
      if (!data.cdlStatus) return "Select your CDL status.";
      if (!data.insuranceStatus) return "Select your commercial insurance status.";
      if (!data.experienceYears) return "Select your experience level.";
      if (!data.confirmsAccuracy || !data.confirmsEarlyAccess) {
        return "Confirm both statements before submitting your application.";
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

    if (authLoading) return;

    if (!user) {
      saveDraftToStorage(formWithProfile);
      router.push(`/login?next=${encodeURIComponent("/transport/provider")}`);
      return;
    }

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
      setMessage("Your transporter profile has been received. You are now registered for RVNB Transport Network early onboarding.");
      scrollToFormTop();
    } catch (err) {
      console.error("Provider submission failed:", err);
      setStatus("error");
      setMessage("Could not submit your provider profile right now. Please check your connection and try again.");
    }
  }

  // Summary labels for Step 3 review
  const selectedServicesText = useMemo(() => {
    const list = SERVICE_OPTIONS.filter((s) => formWithProfile.services.includes(s.id)).map((s) => s.label);
    return list.length > 0 ? list.join(", ") : "";
  }, [formWithProfile.services]);

  const selectedEquipmentText = useMemo(() => {
    const list = EQUIPMENT_OPTIONS.filter((e) => formWithProfile.equipment.includes(e.id)).map((e) => e.label);
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
                <span>Early Access • Transporter Onboarding</span>
              </div>
              <p className={styles.kicker}>RVNB TRANSPORT NETWORK</p>
              <h1>Put your rig, route, and hauling capacity on the map.</h1>
              <p className={styles.heroLead}>
                Join the developing RVNB Transport Network. Connect with RV owners, employers, and hosts who need trusted equipment movement across local corridors and national lanes.
              </p>
              <div className={styles.heroActions}>
                <a className={styles.primaryButton} href="#onboard-form">
                  Join the Transport Network
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
                <span>Demand-First Matching</span>
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
                <span>Verified equipment readiness</span>
                <span>Direct customer coordination</span>
              </div>
            </div>
          </div>
        </header>

        {/* TRANSPORTER BENEFITS */}
        <section className={styles.section} aria-labelledby="benefits-heading">
          <div className={styles.sectionIntro}>
            <p className={styles.kicker}>WHY JOIN RVNB TRANSPORT</p>
            <h2 id="benefits-heading">Built around real RV movement and driver lanes.</h2>
            <p>
              Rather than scrolling generic freight boards, RVNB is designing route-aligned RV movement so qualified haulers and drivers can maximize their active lanes.
            </p>
          </div>
          <div className={styles.benefitsGrid}>
            <article className={styles.benefitCard}>
              <div className={styles.benefitIcon} aria-hidden="true"><RouteIcon /></div>
              <h3>Discover RV Transport Demand</h3>
              <p>Gain visibility into real move requests from travelers, seasonal workers, campground hosts, and employers.</p>
            </article>
            <article className={styles.benefitCard}>
              <div className={styles.benefitIcon} aria-hidden="true"><CompassIcon /></div>
              <h3>Choose Preferred Routes</h3>
              <p>Specify the exact regions, interstate corridors, or local radiuses you want to operate within.</p>
            </article>
            <article className={styles.benefitCard}>
              <div className={styles.benefitIcon} aria-hidden="true"><ShieldCheckIcon /></div>
              <h3>Build a Trusted Profile</h3>
              <p>Showcase equipment capabilities, towing ratings, and experience to stand out with rig owners.</p>
            </article>
            <article className={styles.benefitCard}>
              <div className={styles.benefitIcon} aria-hidden="true"><CalendarIcon /></div>
              <h3>Organized Availability</h3>
              <p>Keep your active lanes, travel schedules, and empty deadhead capacity visible for route matching.</p>
            </article>
            <article className={styles.benefitCard}>
              <div className={styles.benefitIcon} aria-hidden="true"><UserGroupIcon /></div>
              <h3>Direct Rig Owner Connection</h3>
              <p>Align pickup schedules, site drop-offs, and staging directly with clear customer context.</p>
            </article>
            <article className={styles.benefitCard}>
              <div className={styles.benefitIcon} aria-hidden="true"><LockIcon /></div>
              <h3>Early Network Access</h3>
              <p>Registered providers receive first review when formal carrier verification and matching open.</p>
            </article>
          </div>
        </section>

        {/* HOW IT WORKS */}
        <section className={styles.section} id="how-it-works" aria-labelledby="how-it-works-heading">
          <div className={styles.sectionIntro}>
            <p className={styles.kicker}>HOW ONBOARDING WORKS</p>
            <h2 id="how-it-works-heading">From initial intake to future route coordination.</h2>
            <p>The network is launching in structured phases to ensure verified readiness and safety on every move.</p>
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
              <p>Complete license, insurance, and operating documentation as verification opens.</p>
            </article>
            <article className={styles.stepCard}>
              <span className={styles.stepNumber}>04</span>
              <h3>Discover Routes</h3>
              <p>Receive route-matched transport requests matching your preferred lanes.</p>
            </article>
            <article className={styles.stepCard}>
              <span className={styles.stepNumber}>05</span>
              <h3>Coordinate Delivery</h3>
              <p>Align timing, access logistics, and handoff directly with the customer.</p>
            </article>
          </div>
        </section>

        {/* CAPABILITIES & EQUIPMENT */}
        <section className={styles.section} aria-labelledby="capabilities-heading">
          <div className={styles.sectionIntro}>
            <p className={styles.kicker}>SERVICES & EQUIPMENT</p>
            <h2 id="capabilities-heading">Movement support for diverse RV classifications.</h2>
            <p>We are welcoming providers with specialized equipment across all major recreational and workforce housing classes.</p>
          </div>
          <div className={styles.capabilitiesGrid}>
            <article className={styles.capabilityCard}>
              <span className={styles.capabilityPill} aria-hidden="true" />
              <h3>Travel Trailers</h3>
              <p>Bumper-pull, weight-distribution, and sway-control setups for standard trailers.</p>
            </article>
            <article className={styles.capabilityCard}>
              <span className={styles.capabilityPill} aria-hidden="true" />
              <h3>Fifth Wheels</h3>
              <p>Heavy-duty fifth-wheel and gooseneck hitch capabilities for luxury and multi-slide rigs.</p>
            </article>
            <article className={styles.capabilityCard}>
              <span className={styles.capabilityPill} aria-hidden="true" />
              <h3>Motorhome Drive-Away</h3>
              <p>Qualified, insured drivers for Class A, Class B, and Class C motorized relocations.</p>
            </article>
            <article className={styles.capabilityCard}>
              <span className={styles.capabilityPill} aria-hidden="true" />
              <h3>Tow-Away Service</h3>
              <p>Direct tow-away delivery for dealer inventory, private owners, and camp staging.</p>
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
              <p>Flatbed or winch-equipped transport for unready, damaged, or stored trailers.</p>
            </article>
            <article className={styles.capabilityCard}>
              <span className={styles.capabilityPill} aria-hidden="true" />
              <h3>Specialized / Oversized</h3>
              <p>Park models, tiny homes, and wide-body workforce housing units where qualified.</p>
            </article>
          </div>
        </section>

        {/* TRUST & READINESS EXPECTATIONS */}
        <section className={styles.section} aria-labelledby="trust-heading">
          <div className={styles.sectionIntro}>
            <p className={styles.kicker}>TRUST, SAFETY & READINESS</p>
            <h2 id="trust-heading">General onboarding expectations.</h2>
            <p>To ensure high standards across the ecosystem, providers will be expected to demonstrate readiness in key operational areas.</p>
          </div>
          <div className={styles.trustPanel}>
            <ul className={styles.trustList}>
              <li><strong>Valid Driver Information:</strong> Appropriate driver’s licensing, CDL where applicable for gross vehicle weight ratings.</li>
              <li><strong>Current Insurance Coverage:</strong> Commercial auto liability, cargo protection, or verified towing insurance riders.</li>
              <li><strong>Rated Equipment:</strong> Correctly rated hitches, brake controllers, safety chains, breakaways, and tires.</li>
              <li><strong>Regulatory Compliance:</strong> Willingness to adhere to applicable federal (DOT/FMCSA), state, and municipal regulations.</li>
              <li><strong>Clear Communication:</strong> Commitment to transparent scheduling, pre-trip inspections, and customer handoffs.</li>
            </ul>
            <div className={styles.disclaimerBox}>
              <strong>Onboarding Note & Disclaimer</strong>
              <p>
                Requirements vary depending on vehicle weight, equipment, jurisdictional boundaries (intrastate vs. interstate), and service type. Submitting this early-access form expresses interest and does not guarantee formal carrier verification, platform approval, or job assignments.
              </p>
            </div>
          </div>
        </section>

        {/* 3-STEP ONBOARDING FORM */}
        <section className={styles.formSection} id="onboard-form" aria-labelledby="form-heading">
          {status === "success" ? (
            <div className={styles.successPanel} aria-live="polite">
              <span className={styles.successMark} aria-hidden="true">✓</span>
              <h2>Transporter Profile Received</h2>
              <p>{message}</p>
              <Link href="/transport" className={styles.primaryButton}>
                Return to Transport Hub
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
              <nav className={styles.stepperNav} aria-label="Transporter application progress">
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
                  Feel free to review all three sections before completing your application.
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
                      {SERVICE_OPTIONS.map((srv) => {
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
                      {EQUIPMENT_OPTIONS.map((eq) => {
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
                    <h2 id="form-heading">Review & Confirm Readiness</h2>
                    <p>Review your details and share your operating readiness before submitting.</p>
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
                          • {PROVIDER_TYPE_LABELS[formWithProfile.providerType] || "Classification not selected yet"}
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
                          <strong>Scope:</strong> {OPERATING_SCOPE_LABELS[formWithProfile.operatingScope] || "Scope not selected yet"}<br />
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
                        I understand that this is an early-access onboarding intake and does not guarantee verification approval, customer matches, or earnings.
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
                    {status === "submitting" ? "Submitting Application..." : "Submit Early-Access Application"}
                  </button>
                )}
              </div>

              {formWithProfile.step === 3 && (
                <p className={styles.reassuranceNote}>
                  Submitting expresses interest in joining the RVNB Transport Network. It does not guarantee approval, job access, or earnings.
                </p>
              )}
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
  help: OptionHelp;
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
