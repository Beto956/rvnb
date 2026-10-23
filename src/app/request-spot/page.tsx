"use client";

import Link from "next/link";
import React, { CSSProperties, useEffect, useId, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import styles from "./page.module.css";

type RequestType = "Personal Travel" | "Work Stay" | "Employer / Team Housing";
type StayDurationType = "Short-term" | "Long-term";
type RigType =
  | "5th Wheel"
  | "Travel Trailer"
  | "Class A"
  | "Class B"
  | "Class C"
  | "Toy Hauler"
  | "Bumper Pull";
type HookupsPref =
  | "Any"
  | "Full Hookups"
  | "30A + Water"
  | "50A + Water"
  | "30A + Sewer"
  | "50A + Sewer"
  | "Water Only"
  | "None";
type PullThroughPref = "Any" | "Yes" | "Preferred" | "No";
type LaundryPref = "Any" | "Preferred" | "Required" | "No";
type BudgetPeriod = "Night" | "Week" | "Month";
type YesNo = "Yes" | "No";

type AdditionalRv = {
  id: string;
  rigType: RigType;
  rigLength: string;
  hookupsPreference: HookupsPref;
  pullThroughPreference: PullThroughPref;
  laundryNeed: LaundryPref;
  petsTraveling: boolean;
};

const rigTypeOptions: RigType[] = [
  "5th Wheel",
  "Travel Trailer",
  "Class A",
  "Class B",
  "Class C",
  "Toy Hauler",
  "Bumper Pull",
];

const hookupsOptions: HookupsPref[] = [
  "Any",
  "Full Hookups",
  "30A + Water",
  "50A + Water",
  "30A + Sewer",
  "50A + Sewer",
  "Water Only",
  "None",
];

const pullThroughOptions: PullThroughPref[] = ["Any", "Yes", "Preferred", "No"];
const laundryOptions: LaundryPref[] = ["Any", "Preferred", "Required", "No"];
const budgetPeriodOptions: BudgetPeriod[] = ["Night", "Week", "Month"];
const rigLengthOptions = ["20", "24", "28", "30", "32", "35", "38", "40", "45"];
const yesNoOptions: YesNo[] = ["Yes", "No"];

const requestTypeDescriptions: Record<RequestType, string> = {
  "Personal Travel": "An individual or family looking for an RV stay.",
  "Work Stay": "A worker arranging spots for themselves and coworkers.",
  "Employer / Team Housing": "A company representative coordinating RV housing for a crew.",
};

const requestTypeHints: Record<RequestType, string> = {
  "Personal Travel": "Use this when you are planning your own stay and need a practical place for one primary RV.",
  "Work Stay": "Use this when you are part of the group and booking for yourself plus a few coworkers coming into town for a job.",
  "Employer / Team Housing": "Use this when you represent the company or crew. RVNB does not currently promise company billing, contracts, or guaranteed placement.",
};

function createAdditionalRv(idSeed: number): AdditionalRv {
  return {
    id: `rv-${Date.now()}-${idSeed}`,
    rigType: "Travel Trailer",
    rigLength: "30",
    hookupsPreference: "Any",
    pullThroughPreference: "Any",
    laundryNeed: "Any",
    petsTraveling: false,
  };
}

function normalizeState(value: string) {
  return value.trim().toUpperCase().slice(0, 2);
}

function toLegacyHookups(value: HookupsPref): "Full" | "Partial" | "None" {
  if (value === "None") return "None";
  if (value === "Any") return "Partial";
  if (value === "Water Only") return "Partial";
  return "Full";
}

function buildPrimaryRvSummary(
  rigType: RigType,
  rigLength: string,
  hookupsPreference: HookupsPref
) {
  return `${rigType} • ${rigLength} ft • ${hookupsPreference}`;
}

function buildAllRvSummary(
  primary: {
    rigType: RigType;
    rigLength: string;
    hookupsPreference: HookupsPref;
  },
  additionalRvs: AdditionalRv[]
) {
  const parts = [
    `Primary: ${primary.rigType} ${primary.rigLength}ft (${primary.hookupsPreference})`,
    ...additionalRvs.map(
      (rv, index) =>
        `RV ${index + 2}: ${rv.rigType} ${rv.rigLength}ft (${rv.hookupsPreference})`
    ),
  ];

  return parts.join(" | ").slice(0, 500);
}

const heroMetaRow: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 10,
  marginTop: 18,
};

const heroMetaPill: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  minHeight: 38,
  padding: "0 14px",
  borderRadius: 999,
  border: "1px solid rgba(255,255,255,0.12)",
  background:
    "linear-gradient(180deg, rgba(255,255,255,0.09) 0%, rgba(255,255,255,0.05) 100%)",
  color: "rgba(255,255,255,0.92)",
  fontWeight: 800,
  fontSize: "0.92rem",
  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)",
};

const introEyebrow: CSSProperties = {
  margin: 0,
  fontSize: 12,
  fontWeight: 900,
  letterSpacing: "0.14em",
  textTransform: "uppercase",
  color: "rgba(255,255,255,0.58)",
};

const sectionNote: CSSProperties = {
  margin: "0 0 4px",
  color: "rgba(255,255,255,0.62)",
  fontSize: "0.92rem",
  lineHeight: 1.6,
};

const statusBox: CSSProperties = {
  marginTop: 18,
  padding: "14px 16px",
  borderRadius: 14,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(255,255,255,0.06)",
  fontWeight: 800,
};

function SelectMenu<T extends string>({
  ariaLabel,
  value,
  options,
  onChange,
  formatOption = (option) => option,
}: {
  ariaLabel: string;
  value: T;
  options: readonly T[];
  onChange: (value: T) => void;
  formatOption?: (option: T) => string;
}) {
  const id = useId();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const selectedIndex = Math.max(0, options.indexOf(value));
  const [activeIndex, setActiveIndex] = useState(selectedIndex);

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [open]);

  useEffect(() => {
    if (open) setActiveIndex(selectedIndex);
  }, [open, selectedIndex]);

  function choose(index: number) {
    const next = options[index];
    if (!next) return;
    onChange(next);
    setOpen(false);
  }

  function moveActive(delta: number) {
    setActiveIndex((current) => {
      const next = current + delta;
      if (next < 0) return options.length - 1;
      if (next >= options.length) return 0;
      return next;
    });
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLButtonElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (!open) setOpen(true);
      else moveActive(1);
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      if (!open) setOpen(true);
      else moveActive(-1);
      return;
    }

    if (event.key === "Home") {
      event.preventDefault();
      setOpen(true);
      setActiveIndex(0);
      return;
    }

    if (event.key === "End") {
      event.preventDefault();
      setOpen(true);
      setActiveIndex(options.length - 1);
      return;
    }

    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      if (open) choose(activeIndex);
      else setOpen(true);
      return;
    }

    if (event.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div className={styles.selectMenu} ref={rootRef}>
      <button
        type="button"
        className={styles.selectButton}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={`${id}-listbox`}
        onClick={() => setOpen((current) => !current)}
        onKeyDown={handleKeyDown}
      >
        <span>{formatOption(value)}</span>
        <span className={styles.selectChevron} aria-hidden="true">⌄</span>
      </button>

      {open ? (
        <ul id={`${id}-listbox`} className={styles.selectListbox} role="listbox" aria-label={ariaLabel}>
          {options.map((option, index) => {
            const selected = option === value;
            const active = index === activeIndex;

            return (
              <li
                id={`${id}-option-${index}`}
                key={option}
                role="option"
                aria-selected={selected}
                className={`${styles.selectOption} ${selected ? styles.selectOptionSelected : ""} ${active ? styles.selectOptionActive : ""}`}
                onMouseEnter={() => setActiveIndex(index)}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => choose(index)}
              >
                {formatOption(option)}
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}

export default function RequestSpotPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [requestType, setRequestType] =
    useState<RequestType>("Personal Travel");

  const [locationText, setLocationText] = useState("");
  const [stateCode, setStateCode] = useState("");
  const [arrivalDate, setArrivalDate] = useState("");
  const [departureDate, setDepartureDate] = useState("");
  const [flexibleDates, setFlexibleDates] = useState(true);

  const [employerName, setEmployerName] = useState("");
  const [workGroupName, setWorkGroupName] = useState("");
  const [workLocation, setWorkLocation] = useState("");
  const [employerProjectName, setEmployerProjectName] = useState("");
  const [employerJobsiteArea, setEmployerJobsiteArea] = useState("");
  const [representativeRole, setRepresentativeRole] = useState("");
  const [workersCount, setWorkersCount] = useState("4");
  const [rigsCount, setRigsCount] = useState("3");
  const [spotsNeeded, setSpotsNeeded] = useState("3");
  const [separateSpotsNeeded, setSeparateSpotsNeeded] = useState<YesNo>("Yes");
  const [singleCoordinator, setSingleCoordinator] = useState<YesNo>("Yes");
  const [stayDurationType, setStayDurationType] =
    useState<StayDurationType>("Long-term");

  const [rigType, setRigType] = useState<RigType>("5th Wheel");
  const [rigLength, setRigLength] = useState("35");
  const [hookupsPreference, setHookupsPreference] =
    useState<HookupsPref>("50A + Sewer");
  const [pullThroughPreference, setPullThroughPreference] =
    useState<PullThroughPref>("Yes");
  const [laundryNeed, setLaundryNeed] = useState<LaundryPref>("Preferred");
  const [petsTraveling, setPetsTraveling] = useState(false);

  const [moreThanOneRv, setMoreThanOneRv] = useState(false);
  const [additionalRvs, setAdditionalRvs] = useState<AdditionalRv[]>([]);

  const [budgetAmount, setBudgetAmount] = useState("");
  const [budgetPeriod, setBudgetPeriod] = useState<BudgetPeriod>("Month");

  const [notes, setNotes] = useState("");

  const [requestSaving, setRequestSaving] = useState(false);
  const [requestMsg, setRequestMsg] = useState("");

  const notesCount = useMemo(() => notes.length, [notes]);

  const showWorkFields =
    requestType === "Work Stay" || requestType === "Employer / Team Housing";
  const showEmployerFields = requestType === "Employer / Team Housing";

  function handleToggleMoreThanOneRv(checked: boolean) {
    setMoreThanOneRv(checked);

    if (checked && additionalRvs.length === 0) {
      setAdditionalRvs([createAdditionalRv(1)]);
    }

    if (!checked) {
      setAdditionalRvs([]);
    }
  }

  function addAnotherRv() {
    setAdditionalRvs((prev) => [...prev, createAdditionalRv(prev.length + 1)]);
  }

  function removeAdditionalRv(id: string) {
    setAdditionalRvs((prev) => prev.filter((rv) => rv.id !== id));
  }

  function updateAdditionalRv<K extends keyof AdditionalRv>(
    id: string,
    field: K,
    value: AdditionalRv[K]
  ) {
    setAdditionalRvs((prev) =>
      prev.map((rv) => (rv.id === id ? { ...rv, [field]: value } : rv))
    );
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setRequestMsg("");

    const cleanLocation = locationText.trim().slice(0, 80);
    const cleanState = normalizeState(stateCode);
    const cleanEmployer = employerName.trim().slice(0, 100);
    const cleanTeamName = (showEmployerFields ? employerProjectName : workGroupName).trim().slice(0, 100);
    const cleanTeamLocation = (showEmployerFields ? employerJobsiteArea : workLocation).trim().slice(0, 120);
    const cleanRepresentativeRole = representativeRole.trim().slice(0, 80);
    const cleanBudget = Math.max(0, Number(budgetAmount) || 0);
    const cleanNotes = notes.trim().slice(0, 500);

    if (!cleanLocation) {
      setRequestMsg("⚠️ Please add a city or location.");
      return;
    }

    if (!cleanState || cleanState.length !== 2) {
      setRequestMsg("⚠️ Please enter a valid 2-letter state.");
      return;
    }

    if (
      arrivalDate &&
      departureDate &&
      !(new Date(departureDate) > new Date(arrivalDate))
    ) {
      setRequestMsg("⚠️ Departure date must be after arrival date.");
      return;
    }

    if (showWorkFields && !cleanTeamLocation) {
      setRequestMsg(
        "⚠️ Please add the work location or jobsite area for this request."
      );
      return;
    }

    if (showEmployerFields && !cleanEmployer) {
      setRequestMsg("⚠️ Please enter the company or employer name.");
      return;
    }

    if (showEmployerFields && !cleanRepresentativeRole) {
      setRequestMsg("⚠️ Please enter your representative or contact role.");
      return;
    }

    if (authLoading) {
      setRequestMsg("Please wait while we check your login status.");
      return;
    }

    if (!user) {
      setRequestMsg("Please sign in before starting a request.");
      router.push(`/login?next=${encodeURIComponent("/request-spot")}`);
      return;
    }

    const primaryRv = {
      rigType,
      rigLength,
      hookupsPreference,
      pullThroughPreference,
      laundryNeed,
      petsTraveling,
    };

    const filteredAdditionalRvs = moreThanOneRv ? additionalRvs : [];

    const rvDetails =
      filteredAdditionalRvs.length > 0
        ? buildAllRvSummary(
            {
              rigType,
              rigLength,
              hookupsPreference,
            },
            filteredAdditionalRvs
          )
        : buildPrimaryRvSummary(rigType, rigLength, hookupsPreference);

    setRequestSaving(true);

    try {
      const docRef = await addDoc(collection(db, "spotRequests"), {
        requesterId: user.uid,
        publicVersion: 2,
        status: "draft",
        isFinalized: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),

        requestType,

        locationText: cleanLocation,
        city: "",
        state: cleanState,
        startDate: arrivalDate || "",
        endDate: departureDate || "",
        flexibleDates,

        employerName: cleanEmployer,
        teamName: cleanTeamName,
        teamLocation: cleanTeamLocation,
        representativeRole: cleanRepresentativeRole,
        workersCount: Number(workersCount) || 0,
        rigsCount: Number(rigsCount) || 0,
        spotsNeeded: Number(spotsNeeded) || 0,
        separateSpotsNeeded: separateSpotsNeeded === "Yes",
        singleCoordinator: singleCoordinator === "Yes",
        stayDurationType,

        primaryRv,
        moreThanOneRv,
        additionalRvs: filteredAdditionalRvs.map((rv) => ({
          rigType: rv.rigType,
          rigLength: rv.rigLength,
          hookupsPreference: rv.hookupsPreference,
          pullThroughPreference: rv.pullThroughPreference,
          laundryNeed: rv.laundryNeed,
          petsTraveling: rv.petsTraveling,
        })),

        hookupsNeeded: toLegacyHookups(hookupsPreference),
        budgetMax: cleanBudget,
        budgetPeriod,

        rvDetails,
        note: cleanNotes,

      });

      setRequestMsg("✅ Request submitted successfully.");
      router.push(`/request-spot/details?requestId=${docRef.id}`);

      setRequestType("Personal Travel");
      setLocationText("");
      setStateCode("");
      setArrivalDate("");
      setDepartureDate("");
      setFlexibleDates(true);

      setEmployerName("");
      setWorkGroupName("");
      setWorkLocation("");
      setEmployerProjectName("");
      setEmployerJobsiteArea("");
      setRepresentativeRole("");
      setWorkersCount("4");
      setRigsCount("3");
      setSpotsNeeded("3");
      setSeparateSpotsNeeded("Yes");
      setSingleCoordinator("Yes");
      setStayDurationType("Long-term");

      setRigType("5th Wheel");
      setRigLength("35");
      setHookupsPreference("50A + Sewer");
      setPullThroughPreference("Yes");
      setLaundryNeed("Preferred");
      setPetsTraveling(false);

      setMoreThanOneRv(false);
      setAdditionalRvs([]);

      setBudgetAmount("");
      setBudgetPeriod("Month");
      setNotes("");
    } catch (error) {
      console.error(error);
      setRequestMsg("❌ Could not submit request. Please try again.");
    } finally {
      setRequestSaving(false);
    }
  }

  const requestTypeHelper =
    requestTypeHints[requestType];

  return (
    <main className={styles.page}>
      <div className={styles.pageOverlay} />

      <div className={styles.pageInner}>
        <section className={styles.shell}>
          <div className={styles.topBar}>
            <div className={styles.ecosystemNav}>
              <Link href="/search" className={styles.topNavLink}>
                Search
              </Link>
              <Link href="/listings" className={styles.topNavLink}>
                Listings
              </Link>
              <Link href="/request-spot" className={styles.topNavLinkActive}>
                Requests
              </Link>
              <Link href="/transport" className={styles.topNavLink}>
                Transport
              </Link>
              <Link href="/insurance" className={styles.topNavLink}>
                Insurance
              </Link>
              <Link href="/community" className={styles.topNavLink}>
                Community
              </Link>
            </div>

            <div className={styles.topActions}>
              <Link href="/search" className={styles.topLink}>
                ← Back to Search
              </Link>
              <Link href="/listings" className={styles.topLink}>
                Browse Listings →
              </Link>
            </div>
          </div>

          <header className={styles.hero}>
            <h1 className={styles.title}>Request a Road-Ready RV Spot</h1>
            <p className={styles.subtitle}>
              Tell RVNB where you need to stay, what your rig needs, and whether this is personal travel, a work stay, or team housing. Start with location and dates, then continue to the next step to refine follow-up details.
            </p>

            <div style={heroMetaRow}>
              <span style={heroMetaPill}>Traveler-first request</span>
              <span style={heroMetaPill}>Work stays and teams supported</span>
              <span style={heroMetaPill}>Next step: contact preferences</span>
            </div>
          </header>

          <form className={styles.formShell} onSubmit={handleSubmit}>
            <section className={styles.section}>
              <div className={styles.sectionHeader}>
                <h2 className={styles.sectionTitle}>Request Type</h2>
              </div>

              <p style={sectionNote}>
                Choose the request lane that best matches how you&apos;ll be
                traveling or coordinating this stay.
              </p>

              <div className={styles.segmentedControl}>
                {(
                  [
                    "Personal Travel",
                    "Work Stay",
                    "Employer / Team Housing",
                  ] as const
                ).map((type) => (
                  <button
                    key={type}
                    type="button"
                    className={
                      requestType === type
                        ? styles.segmentButtonActive
                        : styles.segmentButton
                    }
                    onClick={() => setRequestType(type)}
                  >
                    <span className={styles.segmentTitle}>{type}</span>
                    <span className={styles.segmentDescription}>{requestTypeDescriptions[type]}</span>
                  </button>
                ))}
              </div>

              <p className={styles.helperText}>{requestTypeHelper}</p>
            </section>

            <div className={styles.divider} />

            <section className={styles.section}>
              <div className={styles.sectionHeader}>
                <h2 className={styles.sectionTitle}>Location & Dates</h2>
              </div>

              <p style={sectionNote}>
                Give us the core timing and area first. This becomes the
                starting point for RVNB matching and future request tracking.
              </p>

              <div className={styles.gridTwo}>
                <div className={styles.field}>
                  <label className={styles.label}>City/Location (quick)</label>
                  <input
                    className={styles.input}
                    aria-label="City or location"
                    value={locationText}
                    onChange={(e) => setLocationText(e.target.value)}
                    placeholder="Pecos"
                  />
                </div>

                <div className={styles.field}>
                  <label className={styles.label}>State</label>
                  <input
                    className={styles.input}
                    aria-label="State"
                    value={stateCode}
                    onChange={(e) =>
                      setStateCode(e.target.value.toUpperCase().slice(0, 2))
                    }
                    placeholder="TX"
                    maxLength={2}
                  />
                </div>

                <div className={styles.field}>
                  <label className={styles.label}>Arrival date</label>
                  <input
                    className={styles.input}
                    type="date"
                    aria-label="Arrival date"
                    value={arrivalDate}
                    onChange={(e) => setArrivalDate(e.target.value)}
                  />
                </div>

                <div className={styles.field}>
                  <label className={styles.label}>Departure date</label>
                  <input
                    className={styles.input}
                    type="date"
                    aria-label="Departure date"
                    value={departureDate}
                    onChange={(e) => setDepartureDate(e.target.value)}
                  />
                </div>
              </div>

              <label className={styles.checkRow}>
                <input
                  type="checkbox"
                  checked={flexibleDates}
                  onChange={(e) => setFlexibleDates(e.target.checked)}
                />
                <span>Dates flexible</span>
              </label>
            </section>

            {showWorkFields && (
              <>
                <div className={styles.divider} />

                <section className={styles.section}>
                  <div className={styles.sectionHeader}>
                    <h2 className={styles.sectionTitle}>
                      {showEmployerFields ? "Employer / Team Housing Details" : "Work Stay Details"}
                    </h2>
                  </div>

                  <p style={sectionNote}>
                    {showEmployerFields
                      ? "For company representatives coordinating RV housing for a crew. These details help RVNB understand the group and jobsite context without promising company billing, contracts, or guaranteed placement."
                      : "For a worker arranging RV spots for themselves and a few coworkers coming into town for a job. Keep it practical: headcount, RV count, jobsite area, and whether separate spots are needed."}
                  </p>

                  {showEmployerFields ? (
                    <div className={styles.gridThree}>
                      <div className={styles.field}>
                        <label className={styles.label}>Company / Employer Name</label>
                        <input
                          className={styles.input}
                          value={employerName}
                          onChange={(e) => setEmployerName(e.target.value)}
                          placeholder="Company name"
                        />
                      </div>

                      <div className={styles.field}>
                        <label className={styles.label}>Your Role</label>
                        <input
                          className={styles.input}
                          value={representativeRole}
                          onChange={(e) => setRepresentativeRole(e.target.value)}
                          placeholder="HR, operations, crew lead..."
                        />
                      </div>

                      <div className={styles.field}>
                        <label className={styles.label}>Crew / Project Name</label>
                        <input
                          className={styles.input}
                          value={employerProjectName}
                          onChange={(e) => setEmployerProjectName(e.target.value)}
                          placeholder="Optional project or crew name"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className={styles.gridTwo}>
                      <div className={styles.field}>
                        <label className={styles.label}>Coworker / Crew Label</label>
                        <input
                          className={styles.input}
                          value={workGroupName}
                          onChange={(e) => setWorkGroupName(e.target.value)}
                          placeholder="Optional: West Crew A"
                        />
                      </div>

                      <div className={styles.field}>
                        <label className={styles.label}>Work Location / Jobsite Area</label>
                        <input
                          className={styles.input}
                          value={workLocation}
                          onChange={(e) => setWorkLocation(e.target.value)}
                          placeholder="Jobsite, refinery, project area..."
                        />
                      </div>
                    </div>
                  )}

                  {showEmployerFields ? (
                    <div className={styles.gridTwo}>
                      <div className={styles.field}>
                        <label className={styles.label}>Jobsite Area</label>
                        <input
                          className={styles.input}
                          value={employerJobsiteArea}
                          onChange={(e) => setEmployerJobsiteArea(e.target.value)}
                          placeholder="City, facility, project area..."
                        />
                      </div>

                      <div className={styles.field}>
                        <label className={styles.label}>One person coordinating?</label>
                        <SelectMenu
                          ariaLabel="One person coordinating"
                          value={singleCoordinator}
                          options={yesNoOptions}
                          onChange={setSingleCoordinator}
                        />
                      </div>
                    </div>
                  ) : null}

                  <div className={styles.gridThree}>
                    <div className={styles.field}>
                      <label className={styles.label}>{showEmployerFields ? "Expected Crew Count" : "Workers Coming"}</label>
                      <SelectMenu
                        ariaLabel="Workers count"
                        value={workersCount}
                        options={["1", "2", "3", "4", "5", "6", "8", "10+"]}
                        onChange={setWorkersCount}
                      />
                    </div>

                    <div className={styles.field}>
                      <label className={styles.label}>{showEmployerFields ? "Expected RV Count" : "RVs Coming"}</label>
                      <SelectMenu
                        ariaLabel="Rigs count"
                        value={rigsCount}
                        options={["1", "2", "3", "4", "5", "6", "8+"]}
                        onChange={setRigsCount}
                        formatOption={(value) => `${value} RVs`}
                      />
                    </div>

                    <div className={styles.field}>
                      <label className={styles.label}>Separate spots needed?</label>
                      <SelectMenu
                        ariaLabel="Separate spots needed"
                        value={separateSpotsNeeded}
                        options={yesNoOptions}
                        onChange={setSeparateSpotsNeeded}
                      />
                    </div>
                  </div>

                  <div className={styles.gridTwo}>
                    <div className={styles.field}>
                      <label className={styles.label}>Approximate RV spots needed</label>
                      <SelectMenu
                        ariaLabel="Spots needed"
                        value={spotsNeeded}
                        options={["1", "2", "3", "4", "5", "6", "8+"]}
                        onChange={setSpotsNeeded}
                        formatOption={(value) => `${value} spots`}
                      />
                    </div>

                    <div className={styles.field}>
                      <label className={styles.label}>Stay length expectation</label>
                      <div className={styles.durationRow}>
                        <button
                          type="button"
                          className={
                            stayDurationType === "Short-term"
                              ? styles.durationButtonActive
                              : styles.durationButton
                          }
                          onClick={() => setStayDurationType("Short-term")}
                        >
                          Short-term
                        </button>
                        <button
                          type="button"
                          className={
                            stayDurationType === "Long-term"
                              ? styles.durationButtonActive
                              : styles.durationButton
                          }
                          onClick={() => setStayDurationType("Long-term")}
                        >
                          Long-term
                        </button>
                      </div>
                    </div>
                  </div>
                </section>
              </>
            )}

            <div className={styles.divider} />

            <section className={styles.section}>
              <div className={styles.sectionHeader}>
                <h2 className={styles.sectionTitle}>RV/Stay Needs</h2>
              </div>

              <p style={sectionNote}>
                Start with the primary RV, then add more if this request
                involves multiple rigs, trailers, or team units.
              </p>

              <div className={styles.subsectionLabel}>Primary RV</div>

              <div className={styles.gridThree}>
                <div className={styles.field}>
                  <label className={styles.label}>RV type</label>
                  <SelectMenu
                    ariaLabel="RV type"
                    value={rigType}
                    options={rigTypeOptions}
                    onChange={setRigType}
                  />
                </div>

                <div className={styles.field}>
                  <label className={styles.label}>Rig length</label>
                  <SelectMenu
                    ariaLabel="Rig length"
                    value={rigLength}
                    options={rigLengthOptions}
                    onChange={setRigLength}
                    formatOption={(value) => `${value} ft.`}
                  />
                </div>

                <div className={styles.field}>
                  <label className={styles.label}>Hookups</label>
                  <SelectMenu
                    ariaLabel="Hookups"
                    value={hookupsPreference}
                    options={hookupsOptions}
                    onChange={setHookupsPreference}
                  />
                </div>
              </div>

              <div className={styles.gridThree}>
                {!showWorkFields ? (
                  <div className={styles.field}>
                    <label className={styles.label}>Duration</label>
                    <div className={styles.durationRow}>
                      <button
                        type="button"
                        className={
                          stayDurationType === "Short-term"
                            ? styles.durationButtonActive
                            : styles.durationButton
                        }
                        onClick={() => setStayDurationType("Short-term")}
                      >
                        Short-term
                      </button>
                      <button
                        type="button"
                        className={
                          stayDurationType === "Long-term"
                            ? styles.durationButtonActive
                            : styles.durationButton
                        }
                        onClick={() => setStayDurationType("Long-term")}
                      >
                        Long-term
                      </button>
                    </div>
                  </div>
                ) : null}

                <div className={styles.field}>
                  <label className={styles.label}>Pull-through</label>
                  <SelectMenu
                    ariaLabel="Pull-through"
                    value={pullThroughPreference}
                    options={pullThroughOptions}
                    onChange={setPullThroughPreference}
                  />
                </div>

                <div className={styles.field}>
                  <label className={styles.label}>Laundry Area</label>
                  <SelectMenu
                    ariaLabel="Laundry area"
                    value={laundryNeed}
                    options={laundryOptions}
                    onChange={setLaundryNeed}
                  />
                </div>
              </div>

              <label className={styles.checkRow}>
                <input
                  type="checkbox"
                  checked={petsTraveling}
                  onChange={(e) => setPetsTraveling(e.target.checked)}
                />
                <span>Pets traveling</span>
              </label>

              <div className={styles.multiRvToggleWrap}>
                <label className={styles.checkRow}>
                  <input
                    type="checkbox"
                    checked={moreThanOneRv}
                    onChange={(e) => handleToggleMoreThanOneRv(e.target.checked)}
                  />
                  <span>More than 1 RV</span>
                </label>
              </div>

              {moreThanOneRv && (
                <div className={styles.additionalRvsWrap}>
                  <div className={styles.additionalRvsHeader}>
                    <div className={styles.subsectionLabel}>Additional RVs</div>
                    <button
                      type="button"
                      className={styles.addAnotherButton}
                      onClick={addAnotherRv}
                    >
                      + Add another RV
                    </button>
                  </div>

                  <div className={styles.additionalRvsList}>
                    {additionalRvs.map((rv, index) => (
                      <div key={rv.id} className={styles.additionalRvCard}>
                        <div className={styles.additionalRvTop}>
                          <div className={styles.additionalRvTitle}>
                            Additional RV {index + 1}
                          </div>

                          <button
                            type="button"
                            className={styles.removeRvButton}
                            onClick={() => removeAdditionalRv(rv.id)}
                          >
                            Remove
                          </button>
                        </div>

                        <div className={styles.gridThree}>
                          <div className={styles.field}>
                            <label className={styles.label}>RV type</label>
                            <SelectMenu
                              ariaLabel={`Additional RV ${index + 1} type`}
                              value={rv.rigType}
                              options={rigTypeOptions}
                              onChange={(value) => updateAdditionalRv(rv.id, "rigType", value)}
                            />
                          </div>

                          <div className={styles.field}>
                            <label className={styles.label}>Rig length</label>
                            <SelectMenu
                              ariaLabel={`Additional RV ${index + 1} rig length`}
                              value={rv.rigLength}
                              options={rigLengthOptions}
                              onChange={(value) => updateAdditionalRv(rv.id, "rigLength", value)}
                              formatOption={(value) => `${value} ft.`}
                            />
                          </div>

                          <div className={styles.field}>
                            <label className={styles.label}>Hookups</label>
                            <SelectMenu
                              ariaLabel={`Additional RV ${index + 1} hookups`}
                              value={rv.hookupsPreference}
                              options={hookupsOptions}
                              onChange={(value) => updateAdditionalRv(rv.id, "hookupsPreference", value)}
                            />
                          </div>
                        </div>

                        <div className={styles.gridThree}>
                          <div className={styles.field}>
                            <label className={styles.label}>Pull-through</label>
                            <SelectMenu
                              ariaLabel={`Additional RV ${index + 1} pull-through`}
                              value={rv.pullThroughPreference}
                              options={pullThroughOptions}
                              onChange={(value) => updateAdditionalRv(rv.id, "pullThroughPreference", value)}
                            />
                          </div>

                          <div className={styles.field}>
                            <label className={styles.label}>Laundry Area</label>
                            <SelectMenu
                              ariaLabel={`Additional RV ${index + 1} laundry area`}
                              value={rv.laundryNeed}
                              options={laundryOptions}
                              onChange={(value) => updateAdditionalRv(rv.id, "laundryNeed", value)}
                            />
                          </div>

                          <div className={styles.field}>
                            <label className={styles.label}>Pets traveling</label>
                            <label className={styles.checkRowCard}>
                              <input
                                type="checkbox"
                                checked={rv.petsTraveling}
                                onChange={(e) =>
                                  updateAdditionalRv(
                                    rv.id,
                                    "petsTraveling",
                                    e.target.checked
                                  )
                                }
                              />
                              <span>Include pets for this RV</span>
                            </label>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>

            <div className={styles.divider} />

            <section className={styles.section}>
              <div className={styles.sectionHeader}>
                <h2 className={styles.sectionTitle}>Budget</h2>
              </div>

              <p style={sectionNote}>
                Set the budget lane that best fits this stay so RVNB has a
                better starting point when this request moves into matching.
              </p>

              <div className={styles.gridTwo}>
                <div className={styles.field}>
                  <label className={styles.label}>Budget amount</label>
                  <input
                    className={styles.input}
                    type="number"
                    min={0}
                    aria-label="Budget amount"
                    value={budgetAmount}
                    onChange={(e) => setBudgetAmount(e.target.value)}
                    placeholder="4000"
                  />
                </div>

                <div className={styles.field}>
                  <label className={styles.label}>Budget period</label>
                  <SelectMenu
                    ariaLabel="Budget period"
                    value={budgetPeriod}
                    options={budgetPeriodOptions}
                    onChange={setBudgetPeriod}
                    formatOption={(value) => `/ ${value}`}
                  />
                </div>
              </div>
            </section>

            <div className={styles.divider} />

            <section className={styles.section}>
              <div className={styles.sectionHeader}>
                <h2 className={styles.sectionTitle}>Additional Notes</h2>
              </div>

              <p style={sectionNote}>
                Use this area for access needs, jobsite context, timing notes,
                special requests, or anything that helps RVNB understand your
                stay more clearly.
              </p>

              <div className={styles.field}>
                <textarea
                  className={styles.textarea}
                  aria-label="Additional notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value.slice(0, 500))}
                  placeholder="Describe any specific requirements, jobsite details, access needs, or preferences."
                  maxLength={500}
                />
              </div>

              <div className={styles.countRow}>{notesCount}/500</div>
            </section>

            {requestMsg ? <div style={statusBox}>{requestMsg}</div> : null}

            <div className={styles.submitWrap}>
              <button
                type="submit"
                className={styles.submitButton}
                disabled={requestSaving}
                style={{ opacity: requestSaving ? 0.75 : 1 }}
              >
                {requestSaving ? "Saving..." : "Continue Request"}
              </button>

              <p className={styles.submitNote}>
                After continuing, you&apos;ll go to the next step to confirm follow-up details and finalize the request profile. This does not guarantee a match yet; it gives RVNB the information needed to support matching and host response workflows.
              </p>
            </div>
          </form>

          <section className={styles.offerSpaceSection}>
            <div className={styles.offerSpaceCard}>
              <div className={styles.offerSpaceContent}>
                <div className={styles.offerSpaceTextWrap}>
                  <p style={introEyebrow}>For hosts</p>
                  <h4 className={styles.offerSpaceTitle}>Have space near traveler demand?</h4>
                  <p className={styles.offerSpaceText}>
                    If you have RV-friendly space near job sites, travel corridors, or high-demand areas, you can respond from the host side without interrupting this traveler request form.
                  </p>
                </div>

                <Link href="/request-spot/respond" className={styles.offerSpaceBtn}>
                  Offer Space →
                </Link>
              </div>
            </div>
          </section>
        </section>
      </div>
    </main>
  );
}