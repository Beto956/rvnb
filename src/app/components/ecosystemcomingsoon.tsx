"use client";

import { useMemo, useState } from "react";
import { db } from "@/lib/firebase";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";

type InterestOption = {
  value: string;
  label: string;
};

type Props = {
  badge?: string; // e.g. "Coming Soon"
  title: string;  // e.g. "Transport Network"
  subtitle: string;
  bullets?: string[];
  interestCollection: string; // MUST be one of: transportInterest, insuranceInterest, communityInterest
  providerCollection: string; // simple provider leads collection
  interestOptions?: InterestOption[];
};

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

export default function EcosystemComingSoon(props: Props) {
  const {
    badge = "Coming Soon",
    title,
    subtitle,
    bullets = [],
    interestCollection,
    providerCollection,
    interestOptions,
  } = props;

  const options = useMemo<InterestOption[]>(
    () =>
      interestOptions ?? [
        { value: "traveler", label: "Traveler (I want this feature)" },
        { value: "host", label: "Host (I want to offer this)" },
        { value: "provider", label: "Provider (I want to partner)" },
        { value: "investor", label: "Investor / Business inquiry" },
        { value: "other", label: "Other" },
      ],
    [interestOptions]
  );

  // Interest capture state
  const [email, setEmail] = useState("");
  const [interestType, setInterestType] = useState(options[0]?.value ?? "traveler");
  const [interestStatus, setInterestStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [interestMessage, setInterestMessage] = useState("");

  // Provider submission state
  const [pName, setPName] = useState("");
  const [pEmail, setPEmail] = useState("");
  const [pCompany, setPCompany] = useState("");
  const [pServiceArea, setPServiceArea] = useState("");
  const [pNotes, setPNotes] = useState("");
  const [providerStatus, setProviderStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [providerMessage, setProviderMessage] = useState("");

  async function submitInterest(e: React.FormEvent) {
    e.preventDefault();
    setInterestMessage("");

    const cleanedEmail = email.trim().toLowerCase();
    if (!isValidEmail(cleanedEmail)) {
      setInterestStatus("error");
      setInterestMessage("Please enter a valid email address.");
      return;
    }

    try {
      setInterestStatus("loading");
      await addDoc(collection(db, interestCollection), {
        email: cleanedEmail,
        interestType,
        createdAt: serverTimestamp(),
        source: "ecosystem_page",
        page: title,
      });
      setInterestStatus("success");
      setInterestMessage("Thanks — you’re on the early access list.");
      setEmail("");
      setInterestType(options[0]?.value ?? "traveler");
    } catch (err) {
      setInterestStatus("error");
      setInterestMessage("Something went wrong. Please try again.");
    }
  }

  async function submitProvider(e: React.FormEvent) {
    e.preventDefault();
    setProviderMessage("");

    const cleanedProviderEmail = pEmail.trim().toLowerCase();
    if (!pName.trim()) {
      setProviderStatus("error");
      setProviderMessage("Please enter your name.");
      return;
    }
    if (!isValidEmail(cleanedProviderEmail)) {
      setProviderStatus("error");
      setProviderMessage("Please enter a valid email address.");
      return;
    }

    try {
      setProviderStatus("loading");
      await addDoc(collection(db, providerCollection), {
        name: pName.trim(),
        email: cleanedProviderEmail,
        company: pCompany.trim() || null,
        serviceArea: pServiceArea.trim() || null,
        notes: pNotes.trim() || null,
        createdAt: serverTimestamp(),
        source: "ecosystem_page",
        page: title,
      });
      setProviderStatus("success");
      setProviderMessage("Submitted — we’ll reach out when partner onboarding opens.");
      setPName("");
      setPEmail("");
      setPCompany("");
      setPServiceArea("");
      setPNotes("");
    } catch (err) {
      setProviderStatus("error");
      setProviderMessage("Something went wrong. Please try again.");
    }
  }

  return (
    <div style={{ maxWidth: 980, margin: "0 auto", padding: "48px 16px 80px" }}>
      {/* HERO */}
      <div
        style={{
          borderRadius: 16,
          padding: "28px 22px",
          background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(255,255,255,0.08)",
          boxShadow: "0 10px 30px rgba(0,0,0,0.35)",
        }}
      >
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "6px 10px",
            borderRadius: 999,
            background: "rgba(255,255,255,0.06)",
            border: "1px solid rgba(255,255,255,0.10)",
            fontSize: 12,
            letterSpacing: 0.3,
            opacity: 0.95,
          }}
        >
          <span style={{ width: 8, height: 8, borderRadius: 999, background: "rgba(255,255,255,0.75)" }} />
          {badge}
        </div>

        <h1 style={{ margin: "14px 0 6px", fontSize: 38, lineHeight: 1.1 }}>
          {title}
        </h1>
        <p style={{ margin: 0, opacity: 0.85, fontSize: 16, maxWidth: 760 }}>
          {subtitle}
        </p>

        {bullets.length > 0 && (
          <ul style={{ margin: "16px 0 0", paddingLeft: 18, opacity: 0.9 }}>
            {bullets.map((b) => (
              <li key={b} style={{ margin: "6px 0" }}>
                {b}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* GRID */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr",
          gap: 16,
          marginTop: 18,
        }}
      >
        {/* Interest Capture */}
        <div
          style={{
            borderRadius: 16,
            padding: 18,
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.08)",
          }}
        >
          <h2 style={{ margin: 0, fontSize: 18 }}>Get early access updates</h2>
          <p style={{ margin: "8px 0 14px", opacity: 0.8, fontSize: 14 }}>
            Join the waitlist so we can prioritize what matters most.
          </p>

          <form onSubmit={submitInterest} style={{ display: "grid", gap: 10 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 10 }}>
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email address"
                type="email"
                style={{
                  height: 44,
                  borderRadius: 10,
                  padding: "0 12px",
                  background: "rgba(0,0,0,0.25)",
                  border: "1px solid rgba(255,255,255,0.10)",
                  color: "white",
                  outline: "none",
                }}
              />

              <select
                value={interestType}
                onChange={(e) => setInterestType(e.target.value)}
                style={{
                  height: 44,
                  borderRadius: 10,
                  padding: "0 12px",
                  background: "rgba(0,0,0,0.25)",
                  border: "1px solid rgba(255,255,255,0.10)",
                  color: "white",
                  outline: "none",
                }}
              >
                {options.map((o) => (
                  <option key={o.value} value={o.value} style={{ color: "black" }}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="submit"
              disabled={interestStatus === "loading"}
              style={{
                height: 44,
                borderRadius: 10,
                border: "1px solid rgba(255,255,255,0.14)",
                background: "rgba(255,255,255,0.10)",
                color: "white",
                cursor: interestStatus === "loading" ? "not-allowed" : "pointer",
                fontWeight: 600,
              }}
            >
              {interestStatus === "loading" ? "Submitting..." : "Join waitlist"}
            </button>

            {interestMessage && (
              <p style={{ margin: 0, fontSize: 13, opacity: 0.9 }}>
                {interestMessage}
              </p>
            )}
          </form>
        </div>

        {/* Provider Submission */}
        <div
          style={{
            borderRadius: 16,
            padding: 18,
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.08)",
          }}
        >
          <h2 style={{ margin: 0, fontSize: 18 }}>Provider submission (lightweight)</h2>
          <p style={{ margin: "8px 0 14px", opacity: 0.8, fontSize: 14 }}>
            If you want to partner with RVNB, submit basic info. No onboarding yet — this is demand capture only.
          </p>

          <form onSubmit={submitProvider} style={{ display: "grid", gap: 10 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 10 }}>
              <input
                value={pName}
                onChange={(e) => setPName(e.target.value)}
                placeholder="Your name"
                style={{
                  height: 44,
                  borderRadius: 10,
                  padding: "0 12px",
                  background: "rgba(0,0,0,0.25)",
                  border: "1px solid rgba(255,255,255,0.10)",
                  color: "white",
                  outline: "none",
                }}
              />

              <input
                value={pEmail}
                onChange={(e) => setPEmail(e.target.value)}
                placeholder="Email address"
                type="email"
                style={{
                  height: 44,
                  borderRadius: 10,
                  padding: "0 12px",
                  background: "rgba(0,0,0,0.25)",
                  border: "1px solid rgba(255,255,255,0.10)",
                  color: "white",
                  outline: "none",
                }}
              />

              <input
                value={pCompany}
                onChange={(e) => setPCompany(e.target.value)}
                placeholder="Company (optional)"
                style={{
                  height: 44,
                  borderRadius: 10,
                  padding: "0 12px",
                  background: "rgba(0,0,0,0.25)",
                  border: "1px solid rgba(255,255,255,0.10)",
                  color: "white",
                  outline: "none",
                }}
              />

              <input
                value={pServiceArea}
                onChange={(e) => setPServiceArea(e.target.value)}
                placeholder="Service area (optional) — e.g. Texas / Nationwide"
                style={{
                  height: 44,
                  borderRadius: 10,
                  padding: "0 12px",
                  background: "rgba(0,0,0,0.25)",
                  border: "1px solid rgba(255,255,255,0.10)",
                  color: "white",
                  outline: "none",
                }}
              />

              <textarea
                value={pNotes}
                onChange={(e) => setPNotes(e.target.value)}
                placeholder="Notes (optional) — what do you offer?"
                rows={4}
                style={{
                  borderRadius: 10,
                  padding: "10px 12px",
                  background: "rgba(0,0,0,0.25)",
                  border: "1px solid rgba(255,255,255,0.10)",
                  color: "white",
                  outline: "none",
                  resize: "vertical",
                }}
              />
            </div>

            <button
              type="submit"
              disabled={providerStatus === "loading"}
              style={{
                height: 44,
                borderRadius: 10,
                border: "1px solid rgba(255,255,255,0.14)",
                background: "rgba(255,255,255,0.10)",
                color: "white",
                cursor: providerStatus === "loading" ? "not-allowed" : "pointer",
                fontWeight: 600,
              }}
            >
              {providerStatus === "loading" ? "Submitting..." : "Submit provider info"}
            </button>

            {providerMessage && (
              <p style={{ margin: 0, fontSize: 13, opacity: 0.9 }}>
                {providerMessage}
              </p>
            )}
          </form>
        </div>
      </div>

      {/* Footer note */}
      <p style={{ marginTop: 18, opacity: 0.65, fontSize: 13 }}>
        RVNB is building these features in layers — demand first, then infrastructure.
      </p>
    </div>
  );
}
