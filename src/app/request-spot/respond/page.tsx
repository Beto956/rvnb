"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import styles from "./page.module.css";

type TimeFrameOption =
  | "ASAP"
  | "Within 2 Weeks"
  | "Within 30 Days"
  | "Not Sure Yet";

type StayLengthOption =
  | "Short-term"
  | "Long-term"
  | "Flexible"
  | "Not Sure Yet";

type AccessTypeOption =
  | "Gravel / Dirt"
  | "Concrete / Paved"
  | "Mixed Surface"
  | "Not Sure Yet";

type PowerOption =
  | "No Power"
  | "15A"
  | "30A"
  | "50A"
  | "Multiple Hookups"
  | "Not Sure Yet";

type HostingReadinessOption =
  | "Exploring potential"
  | "Partial setup available"
  | "Fully rig-ready spot";

function normalizeStateRegion(value: string) {
  const raw = value.trim();
  if (!raw) return "";
  if (raw.length <= 2) return raw.toUpperCase();
  return raw.slice(0, 40);
}

function normalizeEmail(value: string) {
  return value.trim().slice(0, 160);
}

function parseRvSpotsCount(value: string) {
  if (value === "5+") return 5;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export default function RespondToRequestPage() {
  const [hostingReadiness, setHostingReadiness] =
    useState<HostingReadinessOption>("Exploring potential");

  const [cityLocation, setCityLocation] = useState("");
  const [stateRegion, setStateRegion] = useState("");
  const [rvSpots, setRvSpots] = useState("1");
  const [spaceDescription, setSpaceDescription] = useState("");
  const [distanceToArea, setDistanceToArea] = useState("");
  const [timeFrame, setTimeFrame] = useState<TimeFrameOption>("Not Sure Yet");
  const [stayLength, setStayLength] = useState<StayLengthOption>("Not Sure Yet");
  const [accessType, setAccessType] = useState<AccessTypeOption>("Not Sure Yet");
  const [powerOption, setPowerOption] = useState<PowerOption>("No Power");

  const [hasWater, setHasWater] = useState(false);
  const [hasSewer, setHasSewer] = useState(false);
  const [hasWifi, setHasWifi] = useState(false);
  const [allowsPets, setAllowsPets] = useState(true);
  const [fencedArea, setFencedArea] = useState(false);
  const [extraNotes, setExtraNotes] = useState("");

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [openToCall, setOpenToCall] = useState(false);

  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [submitSaving, setSubmitSaving] = useState(false);
  const [submitMsg, setSubmitMsg] = useState("");

  const [submissionComplete, setSubmissionComplete] = useState(false);
  const [submittedOpportunityId, setSubmittedOpportunityId] = useState("");

  const notesCount = useMemo(() => extraNotes.length, [extraNotes]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitAttempted(true);
    setSubmitMsg("");

    const cleanCityLocation = cityLocation.trim().slice(0, 120);
    const cleanStateRegion = normalizeStateRegion(stateRegion);
    const cleanSpaceDescription = spaceDescription.trim().slice(0, 1200);
    const cleanDistanceToArea = distanceToArea.trim().slice(0, 160);
    const cleanExtraNotes = extraNotes.trim().slice(0, 1000);
    const cleanFullName = fullName.trim().slice(0, 120);
    const cleanEmail = normalizeEmail(email);
    const cleanPhone = phone.trim().slice(0, 40);

    if (!cleanCityLocation) {
      setSubmitMsg("Please enter a city or area.");
      return;
    }

    if (!cleanStateRegion) {
      setSubmitMsg("Please enter a state.");
      return;
    }

    if (!cleanSpaceDescription) {
      setSubmitMsg("Please describe the space you may be able to offer.");
      return;
    }

    if (!cleanFullName) {
      setSubmitMsg("Please enter your full name.");
      return;
    }

    if (!cleanEmail) {
      setSubmitMsg("Please enter your email.");
      return;
    }

    setSubmitSaving(true);

    try {
      const docRef = await addDoc(collection(db, "hostOpportunities"), {
        submissionType: "respond_to_request",
        sourceType: "host_opportunity",
        sourcePage: "request-spot/respond",
        status: "new",
        reviewStage: "submitted",

        hostingReadiness,

        cityLocation: cleanCityLocation,
        stateRegion: cleanStateRegion,
        matchCity: cleanCityLocation.toLowerCase(),
        matchState: cleanStateRegion.toUpperCase(),

        rvSpotsOffered: rvSpots,
        rvSpotsCount: parseRvSpotsCount(rvSpots),

        spaceDescription: cleanSpaceDescription,
        distanceToArea: cleanDistanceToArea,
        timeFrame,
        stayLength,
        accessType,

        powerOption,
        hasWater,
        hasSewer,
        hasWifi,
        allowsPets,
        fencedArea,

        extraNotes: cleanExtraNotes,

        fullName: cleanFullName,
        email: cleanEmail,
        phone: cleanPhone,
        openToCall,

        createdAt: serverTimestamp(),
      });

      setSubmittedOpportunityId(docRef.id);
      setSubmissionComplete(true);
      setSubmitMsg("");
      window.scrollTo({ top: 0, behavior: "smooth" });

      setHostingReadiness("Exploring potential");
      setCityLocation("");
      setStateRegion("");
      setRvSpots("1");
      setSpaceDescription("");
      setDistanceToArea("");
      setTimeFrame("Not Sure Yet");
      setStayLength("Not Sure Yet");
      setAccessType("Not Sure Yet");
      setPowerOption("No Power");
      setHasWater(false);
      setHasSewer(false);
      setHasWifi(false);
      setAllowsPets(true);
      setFencedArea(false);
      setExtraNotes("");
      setFullName("");
      setEmail("");
      setPhone("");
      setOpenToCall(false);
    } catch (error) {
      console.error(error);
      setSubmitMsg("Could not submit your hosting opportunity. Please try again.");
    } finally {
      setSubmitSaving(false);
    }
  }

  return (
    <main className={styles.page}>
      <div className={styles.pageOverlay} />

      <div className={styles.pageInner}>
        <div className={styles.shell}>
          <header className={styles.topBar}>
            <nav className={styles.ecosystemNav}>
              <Link href="/search" className={styles.topNavLink}>
                Search
              </Link>
              <Link href="/listings" className={styles.topNavLink}>
                Listings
              </Link>
              <Link href="/request-spot" className={styles.topNavLink}>
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
            </nav>

            <div className={styles.topActions}>
              <Link href="/request-spot/details" className={styles.topLink}>
                ← Back to Request
              </Link>
              <Link href="/listings" className={styles.topLink}>
                Browse Listings →
              </Link>
            </div>
          </header>

          <section className={styles.hero}>
            <div className={styles.heroPills}>
              <span className={styles.heroPill}>Request Spot</span>
              <span className={styles.heroPill}>Respond to a Request</span>
            </div>

            <h1 className={styles.title}>Offer Space for an RV Request</h1>

            <p className={styles.subtitle}>
              Whether you have open space, a partial setup, or a fully rig-ready
              RV spot, RVNB can help evaluate whether your property could respond
              to real local demand and opportunity. This intake helps us
              understand if — and how — your space could work as a host site.
            </p>
          </section>

          <section className={styles.formShell}>
            {submissionComplete ? (
              <section className={styles.section}>
                <div className={styles.sectionHeader}>
                  <h2 className={styles.sectionTitle}>Opportunity Submitted</h2>
                </div>

                <p className={styles.helperText}>
                  Your space has been sent to RVNB for review. We&apos;ll
                  evaluate your location, setup, and readiness to determine
                  whether it may support current or future RV requests in
                  limited-inventory areas.
                </p>

                <p className={styles.helperText}>
                  Stronger or more developed setups may also help inform future
                  hosting or listing opportunities.
                </p>

                {submittedOpportunityId ? (
                  <div className={styles.statusMessage}>
                    Submission ID: <strong>{submittedOpportunityId}</strong>
                  </div>
                ) : null}

                <div className={styles.submitWrap}>
                  <Link href="/request-spot" className={styles.topLink}>
                    Back to Requests
                  </Link>

                  <Link href="/listings" className={styles.topLink}>
                    Browse Listings
                  </Link>

                  <Link
                    href="/request-spot/respond"
                    className={styles.backLink}
                    onClick={() => {
                      setSubmissionComplete(false);
                      setSubmittedOpportunityId("");
                      setSubmitAttempted(false);
                      setSubmitMsg("");
                    }}
                  >
                    Submit Another Opportunity
                  </Link>
                </div>
              </section>
            ) : (
              <form onSubmit={handleSubmit} className={styles.section}>
                <section className={styles.section}>
                  <div className={styles.sectionHeader}>
                    <h2 className={styles.sectionTitle}>Hosting Readiness</h2>
                  </div>

                  <p className={styles.helperText}>
                    Tell us where your setup stands so RVNB can better understand
                    whether this is exploratory space, a partial setup, or a
                    stronger immediate hosting opportunity.
                  </p>

                  <div className={styles.field}>
                    <label className={styles.label}>
                      What kind of opportunity is this?
                    </label>
                    <select
                      className={styles.select}
                      value={hostingReadiness}
                      onChange={(e) =>
                        setHostingReadiness(
                          e.target.value as HostingReadinessOption
                        )
                      }
                    >
                      <option>Exploring potential</option>
                      <option>Partial setup available</option>
                      <option>Fully rig-ready spot</option>
                    </select>
                  </div>
                </section>

                <div className={styles.divider} />

                <section className={styles.section}>
                  <div className={styles.sectionHeader}>
                    <h2 className={styles.sectionTitle}>Location & Details</h2>
                  </div>

                  <div className={styles.gridThree}>
                    <div className={styles.field}>
                      <label className={styles.label}>City / Location</label>
                      <input
                        className={styles.input}
                        type="text"
                        placeholder="Pecos"
                        value={cityLocation}
                        onChange={(e) => setCityLocation(e.target.value)}
                      />
                    </div>

                    <div className={styles.field}>
                      <label className={styles.label}>State</label>
                      <input
                        className={styles.input}
                        type="text"
                        placeholder="TX"
                        value={stateRegion}
                        onChange={(e) => setStateRegion(e.target.value)}
                      />
                    </div>

                    <div className={styles.field}>
                      <label className={styles.label}>Number of RV Spots</label>
                      <select
                        className={styles.select}
                        value={rvSpots}
                        onChange={(e) => setRvSpots(e.target.value)}
                      >
                        <option value="1">1</option>
                        <option value="2">2</option>
                        <option value="3">3</option>
                        <option value="4">4</option>
                        <option value="5+">5+</option>
                      </select>
                    </div>
                  </div>

                  <div className={styles.field}>
                    <label className={styles.label}>
                      Description of Your Space
                    </label>
                    <textarea
                      className={styles.textarea}
                      placeholder="Describe your space. For example: gravel area, open land, fenced yard, extra acreage, side lot, near refinery or job site, easy access for RV entry, etc."
                      value={spaceDescription}
                      onChange={(e) => setSpaceDescription(e.target.value)}
                    />
                  </div>

                  <div className={styles.gridTwo}>
                    <div className={styles.field}>
                      <label className={styles.label}>
                        How close are you to the area of interest?
                      </label>
                      <input
                        className={styles.input}
                        type="text"
                        placeholder="For example: 5 minutes from the refinery"
                        value={distanceToArea}
                        onChange={(e) => setDistanceToArea(e.target.value)}
                      />
                    </div>

                    <div className={styles.field}>
                      <label className={styles.label}>Access Type</label>
                      <select
                        className={styles.select}
                        value={accessType}
                        onChange={(e) =>
                          setAccessType(e.target.value as AccessTypeOption)
                        }
                      >
                        <option>Gravel / Dirt</option>
                        <option>Concrete / Paved</option>
                        <option>Mixed Surface</option>
                        <option>Not Sure Yet</option>
                      </select>
                    </div>
                  </div>
                </section>

                <div className={styles.divider} />

                <section className={styles.section}>
                  <div className={styles.sectionHeader}>
                    <h2 className={styles.sectionTitle}>Availability</h2>
                  </div>

                  <div className={styles.gridTwo}>
                    <div className={styles.field}>
                      <label className={styles.label}>Time Frame</label>
                      <select
                        className={styles.select}
                        value={timeFrame}
                        onChange={(e) =>
                          setTimeFrame(e.target.value as TimeFrameOption)
                        }
                      >
                        <option>ASAP</option>
                        <option>Within 2 Weeks</option>
                        <option>Within 30 Days</option>
                        <option>Not Sure Yet</option>
                      </select>
                    </div>

                    <div className={styles.field}>
                      <label className={styles.label}>Length of Stay</label>
                      <select
                        className={styles.select}
                        value={stayLength}
                        onChange={(e) =>
                          setStayLength(e.target.value as StayLengthOption)
                        }
                      >
                        <option>Short-term</option>
                        <option>Long-term</option>
                        <option>Flexible</option>
                        <option>Not Sure Yet</option>
                      </select>
                    </div>
                  </div>
                </section>

                <div className={styles.divider} />

                <section className={styles.section}>
                  <div className={styles.sectionHeader}>
                    <h2 className={styles.sectionTitle}>Utilities & Extras</h2>
                  </div>

                  <p className={styles.helperText}>
                    Whether your setup is still developing or already closer to
                    host-ready, these details help RVNB evaluate how strong of a
                    fit your property may be. Already have hookups or a prepared
                    RV pad? That helps identify your space as a stronger
                    immediate hosting candidate.
                  </p>

                  <div className={styles.gridTwo}>
                    <label className={styles.checkRowCard}>
                      <input
                        type="checkbox"
                        checked={hasWater}
                        onChange={(e) => setHasWater(e.target.checked)}
                      />
                      <span>Water available</span>
                    </label>

                    <div className={styles.field}>
                      <label className={styles.label}>Electric / Power</label>
                      <select
                        className={styles.select}
                        value={powerOption}
                        onChange={(e) =>
                          setPowerOption(e.target.value as PowerOption)
                        }
                      >
                        <option>No Power</option>
                        <option>15A</option>
                        <option>30A</option>
                        <option>50A</option>
                        <option>Multiple Hookups</option>
                        <option>Not Sure Yet</option>
                      </select>
                    </div>

                    <label className={styles.checkRowCard}>
                      <input
                        type="checkbox"
                        checked={hasSewer}
                        onChange={(e) => setHasSewer(e.target.checked)}
                      />
                      <span>Sewer / dump access</span>
                    </label>

                    <label className={styles.checkRowCard}>
                      <input
                        type="checkbox"
                        checked={hasWifi}
                        onChange={(e) => setHasWifi(e.target.checked)}
                      />
                      <span>Wi-Fi available</span>
                    </label>

                    <label className={styles.checkRowCard}>
                      <input
                        type="checkbox"
                        checked={allowsPets}
                        onChange={(e) => setAllowsPets(e.target.checked)}
                      />
                      <span>Open to pets</span>
                    </label>

                    <label className={styles.checkRowCard}>
                      <input
                        type="checkbox"
                        checked={fencedArea}
                        onChange={(e) => setFencedArea(e.target.checked)}
                      />
                      <span>Fenced / enclosed area</span>
                    </label>
                  </div>

                  <div className={styles.field}>
                    <label className={styles.label}>Anything extra?</label>
                    <textarea
                      className={styles.textarea}
                      placeholder="Describe any additional features, limitations, benefits, or rules. For example: gated entry, quiet neighborhood, shaded area, industrial corridor access, temporary availability, room for trailers, etc."
                      value={extraNotes}
                      onChange={(e) => setExtraNotes(e.target.value)}
                      maxLength={1000}
                    />
                    <div className={styles.countRow}>{notesCount}/1000</div>
                  </div>
                </section>

                <div className={styles.divider} />

                <section className={styles.section}>
                  <div className={styles.sectionHeader}>
                    <h2 className={styles.sectionTitle}>Contact Info</h2>
                  </div>

                  <div className={styles.gridThree}>
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
                  </div>

                  <label className={styles.checkRow}>
                    <input
                      type="checkbox"
                      checked={openToCall}
                      onChange={(e) => setOpenToCall(e.target.checked)}
                    />
                    <span>
                      I am open to a follow-up call to discuss details and next
                      steps.
                    </span>
                  </label>
                </section>

                {submitAttempted && submitMsg ? (
                  <div className={styles.statusMessage}>{submitMsg}</div>
                ) : null}

                <div className={styles.submitWrap}>
                  <button
                    type="submit"
                    className={styles.submitButton}
                    disabled={submitSaving}
                    style={{ opacity: submitSaving ? 0.75 : 1 }}
                  >
                    {submitSaving ? "Submitting..." : "Submit to RVNB"}
                  </button>

                  <p className={styles.submitNote}>
                    This response helps RVNB understand whether your property
                    could become a potential match for requests in areas with
                    limited RV inventory.
                  </p>

                  <Link
                    href="/request-spot/details"
                    className={styles.backLink}
                  >
                    ← Back to Request Details
                  </Link>
                </div>
              </form>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}