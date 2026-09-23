"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import styles from "./page.module.css";

type FormState = "idle" | "submitting" | "success" | "error";

const serviceTypes = [
  ["Local moves", "Campsite delivery, repositioning, and nearby support."],
  ["Long-distance relocation", "Route coordination for RVs, trailers, and rigs."],
  ["Workforce housing", "Movement support for teams, crews, and job-site stays."],
  ["Independent hauling", "Flexible help from hotshot drivers and local haulers."],
] as const;

const INTEREST_STORAGE_KEY = "rvnb-transport-interest-draft";

function readInterestDraft() {
  if (typeof window === "undefined") return { email: "", interestType: "traveler" };
  try {
    const saved = window.sessionStorage.getItem(INTEREST_STORAGE_KEY);
    return saved
      ? { email: "", interestType: "traveler", ...(JSON.parse(saved) as { email?: string; interestType?: string }) }
      : { email: "", interestType: "traveler" };
  } catch {
    window.sessionStorage.removeItem(INTEREST_STORAGE_KEY);
    return { email: "", interestType: "traveler" };
  }
}

export default function TransportPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [interestEmail, setInterestEmail] = useState(() => readInterestDraft().email);
  const [interestType, setInterestType] = useState(() => readInterestDraft().interestType);
  const [interestState, setInterestState] = useState<FormState>("idle");
  const [interestMessage, setInterestMessage] = useState("");

  const effectiveInterestEmail = interestEmail || user?.email || "";

  async function submitInterest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const email = effectiveInterestEmail.trim().toLowerCase();
    if (!isValidEmail(email)) {
      setInterestState("error");
      setInterestMessage("Enter a valid email address.");
      return;
    }

    if (authLoading) return;
    if (!user) {
      sessionStorage.setItem(
        INTEREST_STORAGE_KEY,
        JSON.stringify({ email, interestType })
      );
      router.push(`/login?next=${encodeURIComponent("/transport#request")}`);
      return;
    }

    try {
      setInterestState("submitting");
      await addDoc(collection(db, "transportInterest"), {
        userId: user.uid,
        email,
        interestType,
        createdAt: serverTimestamp(),
        source: "ecosystem_page",
        page: "Transport Network",
      });
      sessionStorage.removeItem(INTEREST_STORAGE_KEY);
      setInterestState("success");
      setInterestMessage("You are on the transport early-access list.");
      setInterestEmail("");
      setInterestType("traveler");
    } catch {
      setInterestState("error");
      setInterestMessage("Could not submit right now. Please try again.");
    }
  }

  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <div className={styles.heroGlow} aria-hidden="true" />
        <div className={styles.heroInner}>
          <div className={styles.heroCopy}>
            <p className={styles.kicker}>RVNB TRANSPORT</p>
            <h1>Move your rig with people who understand the road.</h1>
            <p className={styles.heroLead}>
              A future-ready transport network for RV owners, hosts, employers,
              drivers, and transport businesses. Start with your path, then let
              RVNB help connect the right movement support.
            </p>
            <div className={styles.heroActions}>
              <Link className={styles.primaryButton} href="/transport/request">
                I need transport
              </Link>
              <Link className={styles.secondaryButton} href="/transport/provider">
                I am a transporter
              </Link>
            </div>
          </div>

          <div className={styles.routePanel} aria-label="Sample transport route">
            <div className={styles.routePanelHeader}>
              <span className={styles.liveIndicator} aria-hidden="true" />
              <span>Sample route preview</span>
            </div>
            <div className={styles.routeStops}>
              <div><span>Pickup</span><strong>Dallas, TX</strong></div>
              <div className={styles.routeTrack} aria-hidden="true"><span /></div>
              <div><span>Drop-off</span><strong>Phoenix, AZ</strong></div>
            </div>
            <div className={styles.routeMeta}>
              <span>5th wheel</span><span>Hotshot or weekend</span><span>Provider match</span>
            </div>
          </div>
        </div>
      </section>

      <section className={styles.audienceSection} aria-label="Transport paths">
        <Link className={styles.audienceCard} href="/transport/request">
          <span className={styles.iconBox} aria-hidden="true"><PinIcon /></span>
          <span><strong>I need transport</strong><small>Share the move, route, and timing you need covered.</small></span>
          <span className={styles.arrow} aria-hidden="true">→</span>
        </Link>
        <Link className={styles.audienceCard} href="/transport/provider">
          <span className={styles.iconBox} aria-hidden="true"><TruckIcon /></span>
          <span><strong>I am a transporter</strong><small>Introduce your service area and transport capabilities.</small></span>
          <span className={styles.arrow} aria-hidden="true">→</span>
        </Link>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionIntro}>
          <p className={styles.kicker}>HOW IT WORKS</p>
          <h2>From pickup details to a clearer route.</h2>
          <p>Transport is being built in layers: demand first, then matching, coordination, and trust.</p>
        </div>
        <div className={styles.steps}>
          <Step number="01" title="Share the move" text="Tell us where the rig is, where it is going, and when it needs to move." />
          <Step number="02" title="Find the right lane" text="Providers and drivers can discover opportunities that fit their routes." />
          <Step number="03" title="Coordinate with confidence" text="Align timing, equipment, service details, and the next handoff." />
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionIntro}>
          <p className={styles.kicker}>TRANSPORT SERVICE TYPES</p>
          <h2>Support for real RV movement.</h2>
        </div>
        <div className={styles.serviceGrid}>
          {serviceTypes.map(([title, text]) => <article className={styles.serviceCard} key={title}><span className={styles.serviceMark} aria-hidden="true" /><h3>{title}</h3><p>{text}</p></article>)}
        </div>
      </section>

      <section className={styles.requestSection} id="request">
        <div className={styles.requestCopy}>
          <p className={styles.kicker}>FOR RV OWNERS AND TRAVELERS</p>
          <h2>Be first to know when transport matching opens.</h2>
          <p>Join the early-access list for route visibility, provider availability, and future transport requests.</p>
        </div>
        <form className={styles.formCard} onSubmit={submitInterest}>
          <label htmlFor="transport-interest-email">Email address</label>
          <input id="transport-interest-email" type="email" value={effectiveInterestEmail} onChange={(event) => setInterestEmail(event.target.value)} placeholder="you@example.com" required />
          <label htmlFor="transport-interest-type">I am here as a</label>
          <select id="transport-interest-type" value={interestType} onChange={(event) => setInterestType(event.target.value)}>
            <option value="traveler">Traveler or RV owner</option>
            <option value="host">Host</option>
            <option value="provider">Transport provider</option>
            <option value="employer">Employer or team</option>
          </select>
          <button className={styles.primaryButton} type="submit" disabled={interestState === "submitting"}>{interestState === "submitting" ? "Joining..." : "Join early access"}</button>
          {interestMessage && <p className={styles.formMessage} role="status">{interestMessage}</p>}
        </form>
      </section>

      <section className={styles.providerSection} id="providers">
        <div className={styles.providerCopy}>
          <p className={styles.kicker}>FOR DRIVERS AND TRANSPORT BUSINESSES</p>
          <h2>Put your service area on the map.</h2>
          <p>
            Independent haulers, hotshot drivers, transport companies, and drive-away specialists can join the developing RVNB Transport Network to access route-aligned RV movement demand.
          </p>
          <ul>
            <li>Discover active route demand across preferred corridors</li>
            <li>Define your equipment classifications and towing capacities</li>
            <li>Participate in early-access transporter onboarding</li>
          </ul>
        </div>
        <div className={styles.providerCtaCard}>
          <div className={styles.providerCtaBadge}>Transporter Onboarding</div>
          <h3>Ready to provide RV transport?</h3>
          <p>
            Submit your equipment, operating corridors, and service capabilities on the dedicated transporter onboarding page.
          </p>
          <Link className={styles.primaryButton} href="/transport/provider">
            Open Transporter Onboarding →
          </Link>
        </div>
      </section>

      <section className={styles.trustSection}>
        <div><p className={styles.kicker}>TRUST AND SAFETY</p><h2>Movement should feel visible, not mysterious.</h2></div>
        <p>RVNB is building toward clearer provider details, service areas, documentation, and future ratings so every connection starts with better context.</p>
      </section>
    </main>
  );
}

function Step({ number, title, text }: { number: string; title: string; text: string }) {
  return <article className={styles.step}><span className={styles.stepNumber}>{number}</span><h3>{title}</h3><p>{text}</p></article>;
}

function isValidEmail(value: string) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value); }

function PinIcon() { return <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8"><path strokeLinecap="round" strokeLinejoin="round" d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z" /><circle cx="12" cy="10" r="2.2" /></svg>; }
function TruckIcon() { return <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8"><path strokeLinecap="round" strokeLinejoin="round" d="M3 6h11v10H3zM14 10h4l3 3v3h-7z" /><circle cx="7" cy="18" r="2" /><circle cx="18" cy="18" r="2" /></svg>; }
