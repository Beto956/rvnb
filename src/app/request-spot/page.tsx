"use client";

import Link from "next/link";
import React, { CSSProperties, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
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

const introGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1.15fr 1fr 1fr",
  gap: 16,
  marginBottom: 26,
};

const introCard: CSSProperties = {
  borderRadius: 22,
  border: "1px solid rgba(255,255,255,0.09)",
  background:
    "linear-gradient(180deg, rgba(255,255,255,0.07) 0%, rgba(255,255,255,0.03) 100%)",
  padding: 18,
  boxShadow:
    "inset 0 1px 0 rgba(255,255,255,0.04), 0 10px 30px rgba(0,0,0,0.12)",
};

const introEyebrow: CSSProperties = {
  margin: 0,
  fontSize: 12,
  fontWeight: 900,
  letterSpacing: "0.14em",
  textTransform: "uppercase",
  color: "rgba(255,255,255,0.58)",
};

const introTitle: CSSProperties = {
  margin: "8px 0 10px",
  fontSize: "1.08rem",
  fontWeight: 900,
  color: "#ffffff",
  letterSpacing: "-0.02em",
};

const introText: CSSProperties = {
  margin: 0,
  color: "rgba(255,255,255,0.76)",
  lineHeight: 1.65,
  fontSize: "0.95rem",
};

const sectionNote: CSSProperties = {
  margin: "0 0 4px",
  color: "rgba(255,255,255,0.62)",
  fontSize: "0.92rem",
  lineHeight: 1.6,
};

const requestFlowCard: CSSProperties = {
  marginBottom: 24,
  borderRadius: 22,
  border: "1px solid rgba(255,255,255,0.08)",
  background:
    "linear-gradient(180deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.025) 100%)",
  padding: 18,
  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.03)",
};

const requestFlowGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
  gap: 14,
};

const flowStep: CSSProperties = {
  borderRadius: 18,
  border: "1px solid rgba(255,255,255,0.08)",
  background: "rgba(255,255,255,0.03)",
  padding: 14,
};

const flowStepNumber: CSSProperties = {
  width: 28,
  height: 28,
  borderRadius: 999,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  fontWeight: 900,
  fontSize: "0.9rem",
  marginBottom: 10,
  background:
    "linear-gradient(180deg, rgba(255,255,255,0.16) 0%, rgba(255,255,255,0.08) 100%)",
  border: "1px solid rgba(255,255,255,0.14)",
};

const flowStepTitle: CSSProperties = {
  margin: "0 0 6px",
  fontSize: "1rem",
  fontWeight: 900,
  color: "#ffffff",
};

const flowStepText: CSSProperties = {
  margin: 0,
  fontSize: "0.92rem",
  color: "rgba(255,255,255,0.74)",
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

export default function RequestSpotPage() {
  const router = useRouter();

  const [requestType, setRequestType] =
    useState<RequestType>("Personal Travel");

  const [locationText, setLocationText] = useState("Pecos");
  const [stateCode, setStateCode] = useState("TX");
  const [arrivalDate, setArrivalDate] = useState("2024-04-30");
  const [departureDate, setDepartureDate] = useState("2024-06-14");
  const [flexibleDates, setFlexibleDates] = useState(true);

  const [employerName, setEmployerName] = useState("");
  const [teamName, setTeamName] = useState("");
  const [teamLocation, setTeamLocation] = useState("");
  const [workersCount, setWorkersCount] = useState("4");
  const [rigsCount, setRigsCount] = useState("3");
  const [spotsNeeded, setSpotsNeeded] = useState("3");
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

  const [budgetAmount, setBudgetAmount] = useState("4000");
  const [budgetPeriod, setBudgetPeriod] = useState<BudgetPeriod>("Month");

  const [notes, setNotes] = useState("");

  const [requestSaving, setRequestSaving] = useState(false);
  const [requestMsg, setRequestMsg] = useState("");

  const notesCount = useMemo(() => notes.length, [notes]);

  const showWorkFields =
    requestType === "Work Stay" || requestType === "Employer / Team Housing";

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
    const cleanTeamName = teamName.trim().slice(0, 100);
    const cleanTeamLocation = teamLocation.trim().slice(0, 120);
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

    if (showWorkFields && !cleanTeamName) {
      setRequestMsg(
        "⚠️ Please enter a Team Name so this request stays grouped together."
      );
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
        workersCount: Number(workersCount) || 0,
        rigsCount: Number(rigsCount) || 0,
        spotsNeeded: Number(spotsNeeded) || 0,
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

        status: "open",
        createdAt: serverTimestamp(),
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
      setTeamName("");
      setTeamLocation("");
      setWorkersCount("4");
      setRigsCount("3");
      setSpotsNeeded("3");
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
    requestType === "Personal Travel"
      ? "Best for individual travelers, couples, families, and standard one-rig stays."
      : requestType === "Work Stay"
      ? "Built for workers traveling to active jobsites who need a dependable setup near work."
      : "Designed for companies and team coordinators needing multiple RV spaces grouped under one request.";

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
              Submit a request to let RVNB know what you need. We&apos;re here
              to help you find the right spot whether you&apos;re traveling
              personally, staying for work, or coordinating for a team.
            </p>

            <div style={heroMetaRow}>
              <span style={heroMetaPill}>Built for real RV life</span>
              <span style={heroMetaPill}>Team and work-ready</span>
              <span style={heroMetaPill}>Match-driven request flow</span>
            </div>
          </header>

          <section style={introGrid}>
            <div style={introCard}>
              <p style={introEyebrow}>Why request through RVNB</p>
              <h3 style={introTitle}>Not just a form — a better matching path</h3>
              <p style={introText}>
                This request helps RVNB understand your stay, your setup, and
                your must-haves so we can guide you toward stronger host fits,
                team-ready options, and future support tools.
              </p>
            </div>

            <div style={introCard}>
              <p style={introEyebrow}>How it works</p>
              <h3 style={introTitle}>Step 1 of 2</h3>
              <p style={introText}>
                Start here by submitting your request details. In the next step,
                you&apos;ll refine contact preferences and help us complete your
                matching profile.
              </p>
            </div>

            <div style={introCard}>
              <p style={introEyebrow}>Best for</p>
              <h3 style={introTitle}>Travelers, workers, and teams</h3>
              <p style={introText}>
                From solo rigs to employer housing requests, RVNB is being
                shaped to support flexible stays, multiple RVs, and jobsite-side
                coordination.
              </p>
            </div>
          </section>

          <section style={requestFlowCard}>
            <p style={introEyebrow}>Request Journey</p>
            <div style={requestFlowGrid}>
              <div style={flowStep}>
                <div style={flowStepNumber}>1</div>
                <h4 style={flowStepTitle}>Build your request</h4>
                <p style={flowStepText}>
                  Tell RVNB where you need to stay, what kind of RV setup you
                  have, and whether this is personal travel or a work-related
                  stay.
                </p>
              </div>

              <div style={flowStep}>
                <div style={flowStepNumber}>2</div>
                <h4 style={flowStepTitle}>Refine your details</h4>
                <p style={flowStepText}>
                  On the next screen, you&apos;ll confirm contact preferences and
                  complete your matching profile before final submission.
                </p>
              </div>

              <div style={flowStep}>
                <div style={flowStepNumber}>3</div>
                <h4 style={flowStepTitle}>Move toward matching</h4>
                <p style={flowStepText}>
                  RVNB can then use your request details to support matching,
                  future host responses, and the next layer of our request hub
                  workflow.
                </p>
              </div>
            </div>
          </section>

          <section className={styles.offerSpaceSection}>
            <div className={styles.offerSpaceCard}>
              <div className={styles.offerSpaceContent}>
                <div className={styles.offerSpaceTextWrap}>
                  <h4 className={styles.offerSpaceTitle}>
                    Have space near high-demand areas?
                  </h4>
                  <p className={styles.offerSpaceText}>
                    If you live near job sites, refineries, or travel-heavy
                    areas, you may be able to offer temporary RV space and earn
                    extra income. RVNB connects real requests with nearby
                    opportunities — even if your property isn&apos;t a full RV
                    setup.
                  </p>
                </div>

                <Link
                  href="/request-spot/respond"
                  className={styles.offerSpaceBtn}
                >
                  Offer Space →
                </Link>
              </div>
            </div>
          </section>

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
                    {type}
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
                    value={locationText}
                    onChange={(e) => setLocationText(e.target.value)}
                    placeholder="Pecos"
                  />
                </div>

                <div className={styles.field}>
                  <label className={styles.label}>State</label>
                  <input
                    className={styles.input}
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
                    value={arrivalDate}
                    onChange={(e) => setArrivalDate(e.target.value)}
                  />
                </div>

                <div className={styles.field}>
                  <label className={styles.label}>Departure date</label>
                  <input
                    className={styles.input}
                    type="date"
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
                    <h2 className={styles.sectionTitle}>Team Details</h2>
                  </div>

                  <p style={sectionNote}>
                    These details stay grouped together in one request so teams,
                    workers, and multiple RV spaces can be coordinated under the
                    same request profile.
                  </p>

                  <div className={styles.gridThree}>
                    <div className={styles.field}>
                      <label className={styles.label}>Employer/Company</label>
                      <input
                        className={styles.input}
                        value={employerName}
                        onChange={(e) => setEmployerName(e.target.value)}
                        placeholder="Company name"
                      />
                    </div>

                    <div className={styles.field}>
                      <label className={styles.label}>Team Name</label>
                      <input
                        className={styles.input}
                        value={teamName}
                        onChange={(e) => setTeamName(e.target.value)}
                        placeholder="Example: West Crew A"
                      />
                    </div>

                    <div className={styles.field}>
                      <label className={styles.label}>Team/Jobsite Location</label>
                      <input
                        className={styles.input}
                        value={teamLocation}
                        onChange={(e) => setTeamLocation(e.target.value)}
                        placeholder="Jobsite or area"
                      />
                    </div>
                  </div>

                  <div className={styles.gridThree}>
                    <div className={styles.field}>
                      <label className={styles.label}>Workers Count</label>
                      <select
                        className={styles.select}
                        value={workersCount}
                        onChange={(e) => setWorkersCount(e.target.value)}
                      >
                        {["1", "2", "3", "4", "5", "6", "8", "10+"].map((value) => (
                          <option key={value} value={value}>
                            {value}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className={styles.field}>
                      <label className={styles.label}>Rigs Count</label>
                      <select
                        className={styles.select}
                        value={rigsCount}
                        onChange={(e) => setRigsCount(e.target.value)}
                      >
                        {["1", "2", "3", "4", "5", "6", "8+"].map((value) => (
                          <option key={value} value={value}>
                            {value} RVs
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className={styles.field}>
                      <label className={styles.label}>Spots Needed</label>
                      <select
                        className={styles.select}
                        value={spotsNeeded}
                        onChange={(e) => setSpotsNeeded(e.target.value)}
                      >
                        {["1", "2", "3", "4", "5", "6", "8+"].map((value) => (
                          <option key={value} value={value}>
                            {value} spots
                          </option>
                        ))}
                      </select>
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
                  <select
                    className={styles.select}
                    value={rigType}
                    onChange={(e) => setRigType(e.target.value as RigType)}
                  >
                    {rigTypeOptions.map((value) => (
                      <option key={value} value={value}>
                        {value}
                      </option>
                    ))}
                  </select>
                </div>

                <div className={styles.field}>
                  <label className={styles.label}>Rig length</label>
                  <select
                    className={styles.select}
                    value={rigLength}
                    onChange={(e) => setRigLength(e.target.value)}
                  >
                    {rigLengthOptions.map((value) => (
                      <option key={value} value={value}>
                        {value} ft.
                      </option>
                    ))}
                  </select>
                </div>

                <div className={styles.field}>
                  <label className={styles.label}>Hookups</label>
                  <select
                    className={styles.select}
                    value={hookupsPreference}
                    onChange={(e) =>
                      setHookupsPreference(e.target.value as HookupsPref)
                    }
                  >
                    {hookupsOptions.map((value) => (
                      <option key={value} value={value}>
                        {value}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className={styles.gridThree}>
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

                <div className={styles.field}>
                  <label className={styles.label}>Pull-through</label>
                  <select
                    className={styles.select}
                    value={pullThroughPreference}
                    onChange={(e) =>
                      setPullThroughPreference(
                        e.target.value as PullThroughPref
                      )
                    }
                  >
                    {pullThroughOptions.map((value) => (
                      <option key={value} value={value}>
                        {value}
                      </option>
                    ))}
                  </select>
                </div>

                <div className={styles.field}>
                  <label className={styles.label}>Laundry Area</label>
                  <select
                    className={styles.select}
                    value={laundryNeed}
                    onChange={(e) => setLaundryNeed(e.target.value as LaundryPref)}
                  >
                    {laundryOptions.map((value) => (
                      <option key={value} value={value}>
                        {value}
                      </option>
                    ))}
                  </select>
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
                            <select
                              className={styles.select}
                              value={rv.rigType}
                              onChange={(e) =>
                                updateAdditionalRv(
                                  rv.id,
                                  "rigType",
                                  e.target.value as RigType
                                )
                              }
                            >
                              {rigTypeOptions.map((value) => (
                                <option key={value} value={value}>
                                  {value}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div className={styles.field}>
                            <label className={styles.label}>Rig length</label>
                            <select
                              className={styles.select}
                              value={rv.rigLength}
                              onChange={(e) =>
                                updateAdditionalRv(rv.id, "rigLength", e.target.value)
                              }
                            >
                              {rigLengthOptions.map((value) => (
                                <option key={value} value={value}>
                                  {value} ft.
                                </option>
                              ))}
                            </select>
                          </div>

                          <div className={styles.field}>
                            <label className={styles.label}>Hookups</label>
                            <select
                              className={styles.select}
                              value={rv.hookupsPreference}
                              onChange={(e) =>
                                updateAdditionalRv(
                                  rv.id,
                                  "hookupsPreference",
                                  e.target.value as HookupsPref
                                )
                              }
                            >
                              {hookupsOptions.map((value) => (
                                <option key={value} value={value}>
                                  {value}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>

                        <div className={styles.gridThree}>
                          <div className={styles.field}>
                            <label className={styles.label}>Pull-through</label>
                            <select
                              className={styles.select}
                              value={rv.pullThroughPreference}
                              onChange={(e) =>
                                updateAdditionalRv(
                                  rv.id,
                                  "pullThroughPreference",
                                  e.target.value as PullThroughPref
                                )
                              }
                            >
                              {pullThroughOptions.map((value) => (
                                <option key={value} value={value}>
                                  {value}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div className={styles.field}>
                            <label className={styles.label}>Laundry Area</label>
                            <select
                              className={styles.select}
                              value={rv.laundryNeed}
                              onChange={(e) =>
                                updateAdditionalRv(
                                  rv.id,
                                  "laundryNeed",
                                  e.target.value as LaundryPref
                                )
                              }
                            >
                              {laundryOptions.map((value) => (
                                <option key={value} value={value}>
                                  {value}
                                </option>
                              ))}
                            </select>
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
                    value={budgetAmount}
                    onChange={(e) => setBudgetAmount(e.target.value)}
                    placeholder="4000"
                  />
                </div>

                <div className={styles.field}>
                  <label className={styles.label}>Budget period</label>
                  <select
                    className={styles.select}
                    value={budgetPeriod}
                    onChange={(e) =>
                      setBudgetPeriod(e.target.value as BudgetPeriod)
                    }
                  >
                    {budgetPeriodOptions.map((value) => (
                      <option key={value} value={value}>
                        / {value}
                      </option>
                    ))}
                  </select>
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
                After continuing, we&apos;ll take you to the next step so you can
                refine your request, confirm your follow-up details, and help us
                move this request toward the matching stage.
              </p>
            </div>
          </form>
        </section>
      </div>
    </main>
  );
}