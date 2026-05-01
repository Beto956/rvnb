"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { doc, getDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import styles from "./page.module.css";

type SpotRequestDoc = {
  requestType?: string;
  locationText?: string;
  city?: string;
  state?: string;
  startDate?: string;
  endDate?: string;
  flexibleDates?: boolean;
  budgetMax?: number;
  budgetPeriod?: string;
  rigDetails?: string;
  rvDetails?: string;
  primaryRv?: {
    rigType?: string;
    rigLength?: string;
    hookupsPreference?: string;
    pullThroughPreference?: string;
    laundryNeed?: string;
    petsTraveling?: boolean;
  };
  employerName?: string;
  teamName?: string;
  teamLocation?: string;
  workersCount?: number;
  rigsCount?: number;
  spotsNeeded?: number;
  stayDurationType?: string;
  moreThanOneRv?: boolean;
  note?: string;

  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  bestContactMethod?: string;
  openToNearby?: boolean;
  notifyMatches?: boolean;
  finalNotes?: string;
  finalizedAt?: unknown;
  isFinalized?: boolean;

  priorityPreferences?: string[];
};

const PRIORITY_OPTIONS = [
  "Safe Area",
  "Full Hookups",
  "50A Power",
  "Pet Friendly",
  "Pull-Through",
  "Laundry Access",
  "Wi-Fi",
  "Near Jobsite",
  "Quiet Stay",
  "Flexible Dates",
] as const;

function formatDate(value?: string) {
  if (!value) return "Not provided";

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;

  return parsed.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatLocation(data: SpotRequestDoc | null) {
  if (!data) return "Not provided";

  const location = data.locationText?.trim() || data.city?.trim() || "";
  const state = data.state?.trim() || "";

  if (location && state) return `${location}, ${state}`;
  if (location) return location;
  if (state) return state;
  return "Not provided";
}

function formatBudget(data: SpotRequestDoc | null) {
  if (!data) return "Not provided";

  const amount =
    typeof data.budgetMax === "number" && !Number.isNaN(data.budgetMax)
      ? data.budgetMax
      : null;

  const period = data.budgetPeriod?.trim();

  if (amount === null && !period) return "Not provided";
  if (amount === null && period) return period;

  const formattedAmount = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(amount ?? 0);

  return period ? `${formattedAmount} / ${period}` : formattedAmount;
}

function formatRigLength(data: SpotRequestDoc | null) {
  const length = data?.primaryRv?.rigLength?.trim();
  return length ? `${length} ft.` : "Not provided";
}

function formatRigType(data: SpotRequestDoc | null) {
  return data?.primaryRv?.rigType?.trim() || "Not provided";
}

function formatHookups(data: SpotRequestDoc | null) {
  return data?.primaryRv?.hookupsPreference?.trim() || "Flexible";
}

function formatStayWindow(data: SpotRequestDoc | null) {
  if (!data?.startDate && !data?.endDate) return "Not provided";
  return `${formatDate(data?.startDate)} — ${formatDate(data?.endDate)}`;
}

type DetailsPageContentProps = {
  requestId: string;
};

export default function DetailsPageContent({ requestId }: DetailsPageContentProps) {
 
  const router = useRouter();

  const [requestData, setRequestData] = useState<SpotRequestDoc | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [bestContactMethod, setBestContactMethod] = useState("Email");
  const [openToNearby, setOpenToNearby] = useState(false);
  const [notifyMatches, setNotifyMatches] = useState(false);
  const [finalNotes, setFinalNotes] = useState("");
  const [priorityPreferences, setPriorityPreferences] = useState<string[]>([]);

  const [submitSaving, setSubmitSaving] = useState(false);
  const [submitMsg, setSubmitMsg] = useState("");
  const [submitMsgType, setSubmitMsgType] = useState<
    "success" | "error" | "neutral"
  >("neutral");

  const summaryItems = useMemo(
    () => [
      {
        label: "Request Type",
        value: requestData?.requestType || "Not provided",
      },
      {
        label: "Destination",
        value: formatLocation(requestData),
      },
      {
        label: "Stay Window",
        value: formatStayWindow(requestData),
      },
      {
        label: "Rig Type",
        value: formatRigType(requestData),
      },
      {
        label: "Rig Length",
        value: formatRigLength(requestData),
      },
      {
        label: "Hookups",
        value: formatHookups(requestData),
      },
      {
        label: "Budget",
        value: formatBudget(requestData),
      },
      {
        label: "Team Name",
        value: requestData?.teamName || "Not provided",
      },
    ],
    [requestData]
  );

  useEffect(() => {
    let isMounted = true;

    async function loadRequest() {
      if (!requestId) {
        if (isMounted) {
          setLoadError("No request ID was provided.");
          setLoading(false);
        }
        return;
      }

      try {
        setLoading(true);
        setLoadError("");

        const snap = await getDoc(doc(db, "spotRequests", requestId));

        if (!snap.exists()) {
          if (isMounted) {
            setLoadError("We couldn't find that request.");
            setLoading(false);
          }
          return;
        }

        const data = snap.data() as SpotRequestDoc;

        if (isMounted) {
          setRequestData(data);
          setFullName(data.contactName || "");
          setEmail(data.contactEmail || "");
          setPhone(data.contactPhone || "");
          setBestContactMethod(data.bestContactMethod || "Email");
          setOpenToNearby(Boolean(data.openToNearby));
          setNotifyMatches(Boolean(data.notifyMatches));
          setFinalNotes(data.finalNotes || "");
          setPriorityPreferences(
            Array.isArray(data.priorityPreferences) ? data.priorityPreferences : []
          );
          setLoading(false);
        }
      } catch (error) {
        console.error(error);
        if (isMounted) {
          setLoadError("There was a problem loading your request.");
          setLoading(false);
        }
      }
    }

    loadRequest();

    return () => {
      isMounted = false;
    };
  }, [requestId]);

  function togglePriority(option: string) {
    setPriorityPreferences((prev) =>
      prev.includes(option)
        ? prev.filter((item) => item !== option)
        : [...prev, option]
    );
  }

  async function handleFinalSubmit() {
    setSubmitMsg("");
    setSubmitMsgType("neutral");

    if (!requestId) {
      setSubmitMsg("Missing request ID.");
      setSubmitMsgType("error");
      return;
    }

    if (!fullName.trim()) {
      setSubmitMsg("Please enter your full name.");
      setSubmitMsgType("error");
      return;
    }

    if (!email.trim()) {
      setSubmitMsg("Please enter your email.");
      setSubmitMsgType("error");
      return;
    }

    setSubmitSaving(true);

    try {
      await updateDoc(doc(db, "spotRequests", requestId), {
        contactName: fullName.trim().slice(0, 120),
        contactEmail: email.trim().slice(0, 160),
        contactPhone: phone.trim().slice(0, 40),
        bestContactMethod,
        openToNearby,
        notifyMatches,
        finalNotes: finalNotes.trim().slice(0, 1000),
        priorityPreferences,
        isFinalized: true,
        finalizedAt: serverTimestamp(),
      });

      setRequestData((prev) =>
        prev
          ? {
              ...prev,
              contactName: fullName.trim().slice(0, 120),
              contactEmail: email.trim().slice(0, 160),
              contactPhone: phone.trim().slice(0, 40),
              bestContactMethod,
              openToNearby,
              notifyMatches,
              finalNotes: finalNotes.trim().slice(0, 1000),
              priorityPreferences,
              isFinalized: true,
            }
          : prev
      );

      setSubmitMsg("Final request submitted successfully.");
      setSubmitMsgType("success");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (error) {
      console.error(error);
      setSubmitMsg("Could not finalize request. Please try again.");
      setSubmitMsgType("error");
    } finally {
      setSubmitSaving(false);
    }
  }

  const rightRailStatus = requestData?.isFinalized
    ? "Finalized"
    : "Draft in progress";

  return (
    <main className={styles.page}>
      <div className={styles.bgGlowOne} />
      <div className={styles.bgGlowTwo} />

      <div className={styles.shell}>
        <header className={styles.topbar}>
          <div className={styles.topbarInner}>
            <Link href="/" className={styles.brand}>
              <img
                src="/rvnb-logo-icon.png"
                alt="RVNB"
                className={styles.brandIcon}
              />
              <span className={styles.brandText}>RVNB</span>
            </Link>

            <nav className={styles.nav}>
              <Link href="/listings" className={styles.navLink}>
                Listings
              </Link>
              <Link
                href="/request-spot"
                className={`${styles.navLink} ${styles.activeNav}`}
              >
                Request Spot
              </Link>
              <Link href="/transport" className={styles.navLink}>
                Transport
              </Link>
              <Link href="/insurance" className={styles.navLink}>
                Insurance
              </Link>
              <Link href="/community" className={styles.navLink}>
                Community
              </Link>
            </nav>

            <div className={styles.topActions}>
              <Link href="/search" className={styles.ghostButton}>
                Back to Search
              </Link>
              <Link href="/listings" className={styles.primaryButton}>
                Browse Listings
              </Link>
            </div>
          </div>
        </header>

        <section className={styles.hero}>
          <div className={styles.heroTopRow}>
            <span className={styles.heroBadge}>Step 2 of 2</span>
            <span className={styles.heroMetaPill}>Request Finalization</span>
            {requestId ? (
              <span className={styles.heroMetaPillMuted}>ID: {requestId}</span>
            ) : null}
          </div>

          <div className={styles.heroGrid}>
            <div className={styles.heroCopy}>
              <p className={styles.eyebrow}>Final Prep Stage</p>
              <h1 className={styles.heroTitle}>Complete Your RV Spot Request</h1>
              <p className={styles.heroText}>
                Refine your request so RVNB can help match you with the right stay,
                whether you&apos;re traveling personally, staying for work, or
                coordinating for a team. This step turns your draft into a more
                complete request profile for future matching and tracking.
              </p>

              <div className={styles.heroStats}>
                <div className={styles.heroStatCard}>
                  <span className={styles.heroStatLabel}>Request Type</span>
                  <strong className={styles.heroStatValue}>
                    {requestData?.requestType || "Not provided"}
                  </strong>
                </div>

                <div className={styles.heroStatCard}>
                  <span className={styles.heroStatLabel}>Destination</span>
                  <strong className={styles.heroStatValue}>
                    {formatLocation(requestData)}
                  </strong>
                </div>

                <div className={styles.heroStatCard}>
                  <span className={styles.heroStatLabel}>Stay Window</span>
                  <strong className={styles.heroStatValue}>
                    {formatStayWindow(requestData)}
                  </strong>
                </div>

                <div className={styles.heroStatCard}>
                  <span className={styles.heroStatLabel}>Budget</span>
                  <strong className={styles.heroStatValue}>
                    {formatBudget(requestData)}
                  </strong>
                </div>
              </div>
            </div>

            <aside className={styles.heroPanel}>
              <p className={styles.heroPanelEyebrow}>Bridge to what’s next</p>
              <h2 className={styles.heroPanelTitle}>
                Clearer details create a stronger request profile
              </h2>
              <p className={styles.heroPanelText}>
                Step 1 captured the request. Step 2 improves the way it can be
                matched, followed up on, and eventually surfaced inside a fuller
                RVNB request workspace.
              </p>

              <div className={styles.heroPanelList}>
                <div className={styles.heroPanelListItem}>Better host fit</div>
                <div className={styles.heroPanelListItem}>
                  Cleaner workflow handoff
                </div>
                <div className={styles.heroPanelListItem}>
                  Future request tracking
                </div>
              </div>
            </aside>
          </div>
        </section>

        {submitMsg ? (
          <section
            className={
              submitMsgType === "success"
                ? styles.messageSuccess
                : submitMsgType === "error"
                ? styles.messageError
                : styles.messageNeutral
            }
          >
            {submitMsg}
          </section>
        ) : null}

        <section className={styles.mainGrid}>
          <div className={styles.leftColumn}>
            <section className={styles.card}>
              <div className={styles.cardHeader}>
                <div>
                  <p className={styles.eyebrow}>Request Summary</p>
                  <h2 className={styles.cardTitle}>Review your request</h2>
                </div>
                <span className={styles.pill}>Final review stage</span>
              </div>

              {loading ? (
                <div className={styles.infoBox}>Loading request summary...</div>
              ) : loadError ? (
                <div className={styles.infoBox}>{loadError}</div>
              ) : (
                <>
                  <div className={styles.summaryGrid}>
                    {summaryItems.map((item) => (
                      <div key={item.label} className={styles.summaryItem}>
                        <span className={styles.summaryLabel}>{item.label}</span>
                        <span className={styles.summaryValue}>{item.value}</span>
                      </div>
                    ))}
                  </div>

                  {(requestData?.employerName ||
                    requestData?.teamLocation ||
                    typeof requestData?.workersCount === "number" ||
                    typeof requestData?.rigsCount === "number" ||
                    typeof requestData?.spotsNeeded === "number") && (
                    <div className={styles.detailStripGrid}>
                      {requestData?.employerName ? (
                        <div className={styles.detailStripCard}>
                          <span className={styles.detailStripLabel}>Employer</span>
                          <p className={styles.detailStripValue}>
                            {requestData.employerName}
                          </p>
                        </div>
                      ) : null}

                      {requestData?.teamLocation ? (
                        <div className={styles.detailStripCard}>
                          <span className={styles.detailStripLabel}>
                            Team Location
                          </span>
                          <p className={styles.detailStripValue}>
                            {requestData.teamLocation}
                          </p>
                        </div>
                      ) : null}

                      {typeof requestData?.workersCount === "number" ? (
                        <div className={styles.detailStripCard}>
                          <span className={styles.detailStripLabel}>Workers</span>
                          <p className={styles.detailStripValue}>
                            {requestData.workersCount}
                          </p>
                        </div>
                      ) : null}

                      {typeof requestData?.rigsCount === "number" ? (
                        <div className={styles.detailStripCard}>
                          <span className={styles.detailStripLabel}>Rigs</span>
                          <p className={styles.detailStripValue}>
                            {requestData.rigsCount}
                          </p>
                        </div>
                      ) : null}

                      {typeof requestData?.spotsNeeded === "number" ? (
                        <div className={styles.detailStripCard}>
                          <span className={styles.detailStripLabel}>
                            Spots Needed
                          </span>
                          <p className={styles.detailStripValue}>
                            {requestData.spotsNeeded}
                          </p>
                        </div>
                      ) : null}
                    </div>
                  )}

                  {(requestData?.rvDetails ||
                    requestData?.rigDetails ||
                    requestData?.note) && (
                    <div className={styles.longNotesStack}>
                      {requestData?.rvDetails ? (
                        <div className={styles.longNoteCard}>
                          <span className={styles.longNoteLabel}>
                            RV Details
                          </span>
                          <p className={styles.longNoteText}>
                            {requestData.rvDetails}
                          </p>
                        </div>
                      ) : null}

                      {requestData?.rigDetails ? (
                        <div className={styles.longNoteCard}>
                          <span className={styles.longNoteLabel}>
                            Rig Notes
                          </span>
                          <p className={styles.longNoteText}>
                            {requestData.rigDetails}
                          </p>
                        </div>
                      ) : null}

                      {requestData?.note ? (
                        <div className={styles.longNoteCard}>
                          <span className={styles.longNoteLabel}>
                            Draft Notes
                          </span>
                          <p className={styles.longNoteText}>
                            {requestData.note}
                          </p>
                        </div>
                      ) : null}
                    </div>
                  )}
                </>
              )}
            </section>

            <section className={styles.card}>
              <div className={styles.cardHeader}>
                <div>
                  <p className={styles.eyebrow}>Priority Preferences</p>
                  <h2 className={styles.cardTitle}>What matters most to you?</h2>
                </div>
              </div>

              <p className={styles.cardText}>
                These preferences help shape future matching quality, host fit, and
                how this request can eventually behave inside a richer RVNB request
                system.
              </p>

              <div className={styles.preferenceGrid}>
                {PRIORITY_OPTIONS.map((option) => {
                  const isActive = priorityPreferences.includes(option);

                  return (
                    <button
                      key={option}
                      type="button"
                      className={
                        isActive ? styles.choiceChipActive : styles.choiceChip
                      }
                      onClick={() => togglePriority(option)}
                    >
                      {option}
                    </button>
                  );
                })}
              </div>
            </section>

            <section className={styles.card}>
              <div className={styles.cardHeader}>
                <div>
                  <p className={styles.eyebrow}>Contact & Matching</p>
                  <h2 className={styles.cardTitle}>How should we follow up?</h2>
                </div>
              </div>

              <div className={styles.formGrid}>
                <div className={styles.field}>
                  <label className={styles.label}>Full Name</label>
                  <input
                    className={styles.input}
                    type="text"
                    placeholder="Your name"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                  />
                </div>

                <div className={styles.field}>
                  <label className={styles.label}>Email</label>
                  <input
                    className={styles.input}
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>

                <div className={styles.field}>
                  <label className={styles.label}>Phone Number</label>
                  <input
                    className={styles.input}
                    type="tel"
                    placeholder="(555) 555-5555"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                </div>

                <div className={styles.field}>
                  <label className={styles.label}>Best Contact Method</label>
                  <select
                    className={styles.input}
                    value={bestContactMethod}
                    onChange={(e) => setBestContactMethod(e.target.value)}
                  >
                    <option>Email</option>
                    <option>Phone</option>
                    <option>Text</option>
                  </select>
                </div>
              </div>

              <div className={styles.checkboxStack}>
                <label className={styles.checkboxRow}>
                  <input
                    type="checkbox"
                    checked={openToNearby}
                    onChange={(e) => setOpenToNearby(e.target.checked)}
                  />
                  <span>
                    I am open to comparable nearby locations if an exact match is
                    unavailable.
                  </span>
                </label>

                <label className={styles.checkboxRow}>
                  <input
                    type="checkbox"
                    checked={notifyMatches}
                    onChange={(e) => setNotifyMatches(e.target.checked)}
                  />
                  <span>
                    I want RVNB to notify me if a host responds or a match becomes
                    available.
                  </span>
                </label>
              </div>
            </section>

            <section className={styles.card}>
              <div className={styles.cardHeader}>
                <div>
                  <p className={styles.eyebrow}>Final Notes</p>
                  <h2 className={styles.cardTitle}>
                    Anything else we should know?
                  </h2>
                </div>
              </div>

              <p className={styles.cardText}>
                Add anything that helps RVNB better understand your ideal setup,
                travel needs, team logistics, access requirements, or match
                preferences.
              </p>

              <textarea
                className={styles.textarea}
                placeholder="Add any extra notes about your stay, work schedule, team size, preferences, access needs, or ideal setup."
                value={finalNotes}
                onChange={(e) => setFinalNotes(e.target.value)}
              />

              <div className={styles.cardFooter}>
                <button
                  type="button"
                  className={styles.secondaryButton}
                  onClick={() =>
                    router.push(
                      requestId
                        ? `/request-spot?requestId=${requestId}`
                        : "/request-spot"
                    )
                  }
                >
                  Back to Step 1
                </button>

                <button
                  type="button"
                  className={styles.submitButton}
                  onClick={handleFinalSubmit}
                  disabled={submitSaving || loading || !!loadError}
                >
                  {submitSaving ? "Submitting..." : "Submit Final Request"}
                </button>
              </div>
            </section>
          </div>

          <aside className={styles.rightColumn}>
            <section className={styles.sideCardStrong}>
              <p className={styles.eyebrow}>Workflow Status</p>
              <h3 className={styles.sideTitle}>You are at the final prep stage</h3>
              <p className={styles.sideText}>
                This page is the bridge between a request draft and a more complete
                request profile that can support future matches, follow-up, and
                account-based tracking.
              </p>

              <div className={styles.statusPanel}>
                <div className={styles.statusRow}>
                  <span className={styles.statusLabel}>Status</span>
                  <span className={styles.statusValue}>{rightRailStatus}</span>
                </div>
                <div className={styles.statusRow}>
                  <span className={styles.statusLabel}>Type</span>
                  <span className={styles.statusValue}>
                    {requestData?.requestType || "Not provided"}
                  </span>
                </div>
                <div className={styles.statusRow}>
                  <span className={styles.statusLabel}>Area</span>
                  <span className={styles.statusValue}>
                    {formatLocation(requestData)}
                  </span>
                </div>
              </div>
            </section>

            <section className={styles.sideCard}>
              <p className={styles.eyebrow}>Designed For</p>
              <div className={styles.sideList}>
                <div className={styles.sideListItem}>
                  <span className={styles.sideDot} />
                  Travelers who need a spot in areas with limited inventory
                </div>
                <div className={styles.sideListItem}>
                  <span className={styles.sideDot} />
                  Workers needing longer-term stays near job locations
                </div>
                <div className={styles.sideListItem}>
                  <span className={styles.sideDot} />
                  Employers coordinating housing for multiple RV travelers
                </div>
              </div>
            </section>

            <section className={styles.sideCard}>
              <p className={styles.eyebrow}>What this unlocks later</p>
              <div className={styles.miniPanel}>
                <div className={styles.miniRow}>
                  <span className={styles.miniLabel}>Request Hub</span>
                  <span className={styles.miniValue}>Account workspace</span>
                </div>
                <div className={styles.miniRow}>
                  <span className={styles.miniLabel}>Matching</span>
                  <span className={styles.miniValue}>Better fit signals</span>
                </div>
                <div className={styles.miniRow}>
                  <span className={styles.miniLabel}>Notifications</span>
                  <span className={styles.miniValue}>Host / match alerts</span>
                </div>
                <div className={styles.miniRow}>
                  <span className={styles.miniLabel}>Ecosystem</span>
                  <span className={styles.miniValue}>
                    Transport + insurance
                  </span>
                </div>
              </div>
            </section>

            <section className={styles.sideCard}>
              <p className={styles.eyebrow}>RVNB Direction</p>
              <h3 className={styles.sideTitle}>
                This is the beginning of request infrastructure
              </h3>
              <p className={styles.sideText}>
                The request flow is being shaped to support a bigger platform
                system: capture, refine, match, notify, and eventually manage
                requests inside a more powerful RVNB workspace.
              </p>
            </section>
          </aside>
        </section>
      </div>
    </main>
  );
}