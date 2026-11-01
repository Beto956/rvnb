"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useRef, useState } from "react";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import AuthNav from "../components/authnav";
import styles from "./page.module.css";

type FormState = "idle" | "submitting" | "success" | "error";
const INTEREST_STORAGE_KEY = "rvnb-transport-interest-draft";
const interestTypes = ["traveler", "host", "provider", "employer"] as const;
const methods = [
  ["Tow-away", "For travel trailers and fifth wheels, discuss a suitably rated tow vehicle, compatible hitch or coupling, and towing requirements with the provider."],
  ["Drive-away", "For an operable motorhome, discuss roadworthiness, driver suitability, keys, and the planned handoff directly with the provider."],
  ["Trailer or flatbed", "When appropriate for the RV and its condition, discuss loading, securement, access, and suitable carrying equipment with the provider."],
] as const;

function readInterestDraft() {
  const empty = { email: "", interestType: "traveler" };
  if (typeof window === "undefined") return empty;
  try {
    const raw = window.sessionStorage.getItem(INTEREST_STORAGE_KEY);
    if (!raw) return empty;
    const saved: unknown = JSON.parse(raw);
    if (!saved || typeof saved !== "object" || !("email" in saved) || typeof saved.email !== "string" ||
      !("interestType" in saved) || !interestTypes.some(type => type === saved.interestType)) {
      console.error("Invalid transport interest draft.");
      return empty;
    }
    return { email: saved.email, interestType: String(saved.interestType) };
  } catch (error) {
    console.error("Could not restore transport interest draft:", error);
    return empty;
  }
}

export default function TransportPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [draft] = useState(readInterestDraft);
  const [interestEmail, setInterestEmail] = useState<string | null>(draft.email || null);
  const [interestType, setInterestType] = useState(draft.interestType);
  const [interestState, setInterestState] = useState<FormState>("idle");
  const [interestMessage, setInterestMessage] = useState("");
  const submitLock = useRef(false);
  const effectiveInterestEmail = interestEmail ?? user?.email ?? "";

  async function submitInterest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitLock.current || interestState === "success") return;
    const email = effectiveInterestEmail.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 120) {
      setInterestState("error");
      setInterestMessage("Enter a valid email address of no more than 120 characters.");
      return;
    }
    if (authLoading) {
      setInterestState("error");
      setInterestMessage("Your sign-in status is still loading. Please try again shortly.");
      return;
    }
    if (!user) {
      try {
        sessionStorage.setItem(INTEREST_STORAGE_KEY, JSON.stringify({ email, interestType }));
        router.push(`/login?next=${encodeURIComponent("/transport#request")}`);
      } catch (error) {
        console.error("Could not save transport interest draft:", error);
        setInterestState("error");
        setInterestMessage("Your browser could not save this draft for sign-in. Allow session storage, then try again.");
      }
      return;
    }
    submitLock.current = true;
    setInterestState("submitting");
    setInterestMessage("");
    try {
      await addDoc(collection(db, "transportInterest"), {
        userId: user.uid, email, interestType, createdAt: serverTimestamp(),
        source: "ecosystem_page", page: "Transport Network",
      });
      try { sessionStorage.removeItem(INTEREST_STORAGE_KEY); }
      catch (error) { console.error("Could not clear submitted transport interest draft:", error); }
      setInterestState("success");
      setInterestMessage("Thanks—your interest is recorded to help guide future planning. It is not a move request or provider registration.");
    } catch (error) {
      console.error("Transport interest submission failed:", error);
      submitLock.current = false;
      setInterestState("error");
      setInterestMessage("Could not register your interest. Your entries are still here; please try again.");
    }
  }

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <Link href="/" className={styles.brand} aria-label="RVNB Home">
            <Image src="/rvnb-logo-icon.png" alt="RVNB" width={320} height={213} />
          </Link>
          <nav className={styles.nav} aria-label="Primary">
            <Link className={styles.navLink} href="/listings">Listings</Link>
            <Link className={styles.navLink} href="/transport" aria-current="page">Transport</Link>
            <Link className={styles.navLink} href="/community">Community</Link>
            <AuthNav navLinkClassName={styles.navLink} navCtaClassName={styles.navLink} navLogoutClassName={styles.navLink} />
          </nav>
        </div>
      </header>
      <section className={styles.hero} aria-labelledby="transport-title">
        <div className={styles.heroInner}>
          <div className={styles.heroCopy}>
            <p className={styles.kicker}>RVNB TRANSPORT</p>
            <h1 id="transport-title">Your next move starts with the details.</h1>
            <p className={styles.heroLead}>Planning a move for an RV, trailer, or hosting setup? Share a transport request or introduce your transport capabilities to RVNB&apos;s developing network.</p>
            <p className={styles.status} role="note">
              Early access: requests and registrations are open. Matching, quotes, bookings, scheduling, messaging, tracking, payments, and transport reviews are not available.
            </p>
            <div className={styles.heroActions}>
              <Link className={styles.primaryButton} href="/transport/request">I need transport <span aria-hidden="true">→</span></Link>
              <Link className={styles.secondaryButton} href="/transport/provider">I am a transporter <span aria-hidden="true">→</span></Link>
            </div>
          </div>
          <aside className={styles.processPanel} aria-label="Transport intake process">
            <p className={styles.kicker}>HOW EARLY ACCESS WORKS</p>
            <h2>Share your plans. Help shape the network.</h2>
            <ol>
              <li><strong>Tell us what you need</strong><span>Share your RV, general route, timing, and access needs.</span></li>
              <li><strong>Help us understand demand</strong><span>Your request or registration helps guide future planning.</span></li>
              <li><strong>Plan any move directly</strong><span>If service becomes available, confirm scope and terms with a provider.</span></li>
            </ol>
          </aside>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="available-heading">
        <div className={styles.sectionIntro}>
          <p className={styles.kicker}>WHAT YOU CAN DO NOW</p>
          <h2 id="available-heading">Start planning your move</h2>
          <p>Tell us about a move, share general interest, or introduce your transport services. Sign in to send information privately for future network planning.</p>
        </div>
        <div className={styles.steps}>
          <Step number="01" title="Request a move" text="Share your RV, general pickup and destination, preferred dates, and access needs. Your contact details stay private." />
          <Step number="02" title="Join as a provider" text="Tell us what services, equipment, and areas you work in. Licensing and insurance details are self-reported, not verified." />
          <Step number="03" title="Register interest" text="Not ready to move? Let us know whether you are a traveler, host, provider, or employer so we can understand future needs." />
        </div>
      </section>

      <section className={styles.section} aria-labelledby="methods-heading">
        <div className={styles.sectionIntro}>
          <p className={styles.kicker}>WAYS AN RV MAY MOVE</p>
          <h2 id="methods-heading">Ways to transport your RV</h2>
          <p>Choose the closest option in the request form, or ask for help deciding. The right method depends on your RV, route, condition, and provider&apos;s equipment.</p>
        </div>
        <div className={styles.serviceGrid}>
          {methods.map(([title, text]) => <article className={styles.serviceCard} key={title}><h3>{title}</h3><p>{text}</p></article>)}
        </div>
        <div className={styles.moveReasons}>
          <h3>Where these methods may be useful</h3>
          <p><strong>Local delivery, pickup, and repositioning:</strong> campsite, storage, dealership, or nearby property moves.</p>
          <p><strong>Longer-distance relocation:</strong> seasonal travel, a change of base, or a move between regions.</p>
          <p><strong>Hosting and workforce setups:</strong> relocating a unit for guest stays, crews, or job-site housing. These are reasons for moving, not separate transport methods.</p>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="prepare-heading">
        <div className={styles.sectionIntro}>
          <p className={styles.kicker}>BEFORE THE HANDOFF</p>
          <h2 id="prepare-heading">Prepare for a smoother handoff</h2>
        </div>
        <div className={styles.preparation}>
          <article className={styles.serviceCard}>
            <h3>Share what you know</h3>
            <ul>
              <li>Give general pickup and destination areas, preferred dates, and any flexibility. Do not enter exact street addresses.</li>
              <li>Include RV type and approximate length in feet. Weight in pounds is optional. Do not guess; check available manufacturer information when you can.</li>
              <li>Note access limits, equipment or coupling questions, and special setup needs for a future provider to discuss with you.</li>
            </ul>
          </article>
          <article className={styles.serviceCard}>
            <h3>Prepare and confirm</h3>
            <ul>
              <li>Secure loose items and discuss utilities, slides, and awnings before handoff.</li>
              <li>Agree on keys, access, condition photos or notes, pickup, and delivery.</li>
              <li>Confirm the equipment, service scope, insurance coverage, and applicable requirements directly with the provider.</li>
              <li>Transport cost may depend on route, size, condition, method, timing, and access.</li>
            </ul>
          </article>
        </div>
      </section>

      <section className={styles.requestSection} id="request" aria-labelledby="interest-heading">
        <div className={styles.requestCopy}>
          <p className={styles.kicker}>STAY IN THE LOOP</p>
          <h2 id="interest-heading">Interested, but not planning a move yet?</h2>
          <p>Not ready to request a move or join as a provider? Let us know how you hope to use the network. Your response helps us plan future transport services.</p>
          <p>Sign in to register. Your contact details are private. Interest does not create a move request or provider registration, and we cannot promise a response time.</p>
        </div>
        {interestState === "success" ? (
          <div className={styles.formCard} role="status"><h3>Interest registered.</h3><p>{interestMessage}</p><Link href="/account" className={styles.secondaryButton}>My account</Link></div>
        ) : (
          <form className={styles.formCard} onSubmit={submitInterest} aria-busy={interestState === "submitting"}>
            <label htmlFor="transport-interest-email">Email address</label>
            <input id="transport-interest-email" type="email" autoComplete="email" maxLength={120} value={effectiveInterestEmail} onChange={event => setInterestEmail(event.target.value)} placeholder="you@example.com" required disabled={interestState === "submitting"} aria-describedby={interestState === "error" ? "interest-message" : undefined} aria-invalid={interestState === "error" || undefined} />
            <label htmlFor="transport-interest-type">I am here as a</label>
            <select id="transport-interest-type" value={interestType} onChange={event => setInterestType(event.target.value)} disabled={interestState === "submitting"}>
              <option value="traveler">Traveler or RV owner</option><option value="host">Host</option><option value="provider">Transport provider</option><option value="employer">Employer or team</option>
            </select>
            <button className={styles.primaryButton} type="submit" disabled={interestState === "submitting" || authLoading}>{interestState === "submitting" ? "Registering..." : authLoading ? "Checking sign-in..." : user ? "Register interest" : "Sign in to register interest"}</button>
            {interestMessage && <p id="interest-message" className={styles.formMessage} role="alert">{interestMessage}</p>}
          </form>
        )}
      </section>

      <section className={styles.providerSection} id="providers" aria-labelledby="provider-heading">
        <div className={styles.providerCopy}>
          <p className={styles.kicker}>FOR DRIVERS AND TRANSPORT BUSINESSES</p>
          <h2 id="provider-heading">Introduce your capabilities.</h2>
          <p>Independent haulers, transport companies, and drive-away specialists can share their services, equipment, and operating areas. We use registrations to understand provider interest as the network develops.</p>
          <p>Licensing, insurance, and experience are self-reported and have not been verified. Registering does not create a public profile or guarantee work.</p>
        </div>
        <div className={styles.providerCtaCard}>
          <p className={styles.kicker}>PROVIDER INTEREST</p>
          <h3>Have equipment and services to share?</h3>
          <p>Share your experience, services, equipment, and preferred operating areas. Sign in to send your details privately for future planning.</p>
          <Link className={styles.primaryButton} href="/transport/provider">Register as a transport provider <span aria-hidden="true">→</span></Link>
        </div>
      </section>
      <footer className={styles.footer}><Link href="/">RVNB Home</Link><p>Transport intake only. Any future service requires separate confirmation with a provider.</p></footer>
    </main>
  );
}

function Step({ number, title, text }: { number: string; title: string; text: string }) {
  return <article className={styles.step}><span className={styles.stepNumber}>{number}</span><h3>{title}</h3><p>{text}</p></article>;
}
