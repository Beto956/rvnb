"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

// ✅ use your existing firebase auth export (already tied to initialized app)
import { auth } from "@/lib/firebase";
import { signInWithEmailAndPassword, sendPasswordResetEmail } from "firebase/auth";

export default function LoginPage() {
  const router = useRouter();
  const sp = useSearchParams();

  // ✅ Background image (file is in /public)
  const BG_URL = "/rvnb-login-bg.png";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);

  const [message, setMessage] = useState<string>("");
  const [error, setError] = useState<string>("");

  const [mounted, setMounted] = useState(false);

  // Optional: allow redirect back to where user came from (?next=/host)
  const nextPath = (() => {
    const n = sp?.get("next");
    if (!n) return "/listings";
    if (!n.startsWith("/")) return "/listings";
    if (n.startsWith("//")) return "/listings";
    return n;
  })();

  useEffect(() => {
    setMounted(true);
  }, []);

  async function onLogin() {
    setError("");
    setMessage("");

    const e = email.trim();
    if (!e || !password) {
      setError("⚠️ Please enter your email and password.");
      return;
    }

    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, e, password);
      setMessage("✅ Logged in! Redirecting…");
      router.push(nextPath);
    } catch (err: any) {
      console.error(err);
      const code = String(err?.code || "");
      if (code.includes("auth/invalid-credential") || code.includes("auth/wrong-password")) {
        setError("❌ Incorrect email or password.");
      } else if (code.includes("auth/user-not-found")) {
        setError("❌ No account found with that email.");
      } else if (code.includes("auth/too-many-requests")) {
        setError("❌ Too many attempts. Try again in a bit.");
      } else {
        setError("❌ Login failed. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  }

  async function onForgot() {
    setError("");
    setMessage("");

    const e = email.trim();
    if (!e) {
      setError("⚠️ Enter your email first, then click Forgot.");
      return;
    }

    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, e);
      setMessage("📩 Password reset email sent. Check your inbox (and spam).");
    } catch (err: any) {
      console.error(err);
      const code = String(err?.code || "");
      if (code.includes("auth/user-not-found")) {
        setError("❌ No account found with that email.");
      } else {
        setError("❌ Could not send reset email. Try again.");
      }
    } finally {
      setLoading(false);
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") onLogin();
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        position: "relative",
        overflow: "hidden",
        background: "#0b0f19",
        color: "white",
      }}
    >
      {/* Background image */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: `url(${BG_URL})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          filter: "saturate(1.05) contrast(1.05)",
          opacity: 0.22,
          transform: "scale(1.03)",
        }}
      />

      {/* Atmospheric overlays */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(1000px 600px at 50% 20%, rgba(95,155,255,0.18), rgba(11,15,25,0) 60%), radial-gradient(700px 500px at 10% 90%, rgba(255,180,90,0.10), rgba(11,15,25,0) 55%), linear-gradient(180deg, rgba(11,15,25,0.25), rgba(11,15,25,0.92))",
        }}
      />

      {/* Single centered card container */}
      <div
        style={{
          position: "relative",
          zIndex: 2,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
        }}
      >
        <section
          style={{
            ...card,
            width: "100%",
            maxWidth: 560,
            opacity: mounted ? 1 : 0,
            transform: mounted ? "translateY(0px)" : "translateY(8px)",
            transition: "opacity 420ms ease, transform 420ms ease",
          }}
        >
          {/* Header row */}
          <div style={topRow}>
            <div style={brandRow}>
              <div style={brandBadge}>RVNB</div>
              <div>
                <div style={{ fontWeight: 950, fontSize: 18, lineHeight: 1.1 }}>Welcome back</div>
                <div style={{ opacity: 0.78, fontSize: 12, marginTop: 4 }}>
                  Recreational Vehicle Nationwide Booking
                </div>
              </div>
            </div>

            <Link href="/" style={homeBtn}>
              ← Home
            </Link>
          </div>

          <div style={{ marginTop: 14 }}>
            <h1 style={{ margin: 0, fontSize: 42, fontWeight: 980, letterSpacing: -0.8 }}>Log in</h1>
            <p style={{ marginTop: 10, opacity: 0.78, lineHeight: 1.5 }}>
              Continue your RVNB journey — manage listings, requests, and bookings.
            </p>
          </div>

          {(error || message) && (
            <div
              style={{
                ...statusBox,
                borderColor: error ? "rgba(255,80,80,0.30)" : "rgba(120,255,170,0.22)",
                background: error ? "rgba(255,80,80,0.07)" : "rgba(120,255,170,0.06)",
              }}
            >
              {error || message}
            </div>
          )}

          <div style={{ marginTop: 18 }}>
            <label style={label}>Email</label>
            <input
              style={input}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              inputMode="email"
              autoComplete="email"
              onKeyDown={onKeyDown}
            />
          </div>

          <div style={{ marginTop: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <label style={label}>Password</label>
              <button type="button" onClick={onForgot} disabled={loading} style={linkBtn}>
                Forgot?
              </button>
            </div>

            <div style={pwRow}>
              <input
                style={{ ...input, marginTop: 8, paddingRight: 92 }}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                type={showPw ? "text" : "password"}
                autoComplete="current-password"
                onKeyDown={onKeyDown}
              />
              <button type="button" onClick={() => setShowPw((v) => !v)} style={pwToggle}>
                {showPw ? "Hide" : "Show"}
              </button>
            </div>
          </div>

          <button onClick={onLogin} disabled={loading} style={{ ...primaryBtn, opacity: loading ? 0.75 : 1 }}>
            {loading ? "Working…" : "Log in"}
          </button>

          <div style={trustRow}>
            <span style={trustPill}>🔒 Secure login</span>
            <span style={trustPill}>⚡ Powered by Firebase</span>
            <span style={trustPill}>🧭 Built for RV life</span>
          </div>

          <div style={bottomRow}>
            <button type="button" style={secondaryBtn} onClick={() => router.push("/listings")} disabled={loading}>
              Continue browsing →
            </button>

            <div style={{ opacity: 0.86 }}>
              New here?{" "}
              <Link href="/signup" style={signupLink}>
                Create account
              </Link>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

/** ---------------- Styles ---------------- */

const card: React.CSSProperties = {
  borderRadius: 22,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "linear-gradient(180deg, rgba(255,255,255,0.085), rgba(255,255,255,0.045))",
  boxShadow: "0 28px 80px rgba(0,0,0,0.58), inset 0 1px 0 rgba(255,255,255,0.12)",
  padding: 22,
  backdropFilter: "blur(12px)",
};

const topRow: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
};

const brandRow: React.CSSProperties = { display: "flex", gap: 12, alignItems: "center" };

const brandBadge: React.CSSProperties = {
  width: 42,
  height: 42,
  borderRadius: 14,
  display: "grid",
  placeItems: "center",
  fontWeight: 950,
  letterSpacing: 0.6,
  border: "1px solid rgba(255,255,255,0.16)",
  background: "linear-gradient(180deg, rgba(255,255,255,0.12), rgba(255,255,255,0.05))",
  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.15)",
};

const homeBtn: React.CSSProperties = {
  display: "inline-block",
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.15)",
  background: "rgba(255,255,255,0.06)",
  color: "white",
  fontWeight: 900,
  textDecoration: "none",
  whiteSpace: "nowrap",
};

const label: React.CSSProperties = { fontWeight: 900, opacity: 0.95 };

const input: React.CSSProperties = {
  width: "100%",
  padding: 12,
  marginTop: 8,
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.14)",
  background: "rgba(255,255,255,0.07)",
  color: "white",
  outline: "none",
};

const pwRow: React.CSSProperties = { position: "relative" };

const pwToggle: React.CSSProperties = {
  position: "absolute",
  right: 10,
  top: 18,
  height: 34,
  padding: "0 12px",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.16)",
  background: "rgba(255,255,255,0.08)",
  color: "white",
  fontWeight: 900,
  cursor: "pointer",
};

const primaryBtn: React.CSSProperties = {
  marginTop: 18,
  width: "100%",
  padding: 14,
  borderRadius: 14,
  border: "1px solid rgba(255,255,255,0.18)",
  background: "rgba(255,255,255,0.16)",
  color: "white",
  fontWeight: 950,
  cursor: "pointer",
  boxShadow: "0 14px 40px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.15)",
};

const statusBox: React.CSSProperties = {
  marginTop: 14,
  padding: 12,
  borderRadius: 14,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(255,255,255,0.06)",
  fontWeight: 850,
  lineHeight: 1.4,
};

const linkBtn: React.CSSProperties = {
  background: "transparent",
  border: "none",
  color: "rgba(255,255,255,0.85)",
  fontWeight: 900,
  cursor: "pointer",
  padding: 0,
  textDecoration: "underline",
  textUnderlineOffset: 3,
};

const trustRow: React.CSSProperties = { marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" };

const trustPill: React.CSSProperties = {
  padding: "6px 10px",
  borderRadius: 999,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(0,0,0,0.20)",
  fontSize: 12,
  fontWeight: 900,
};

const bottomRow: React.CSSProperties = {
  marginTop: 16,
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
  flexWrap: "wrap",
};

const secondaryBtn: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.15)",
  background: "rgba(255,255,255,0.08)",
  color: "white",
  fontWeight: 900,
  cursor: "pointer",
};

const signupLink: React.CSSProperties = {
  color: "white",
  fontWeight: 950,
  textDecoration: "underline",
  textUnderlineOffset: 3,
};
