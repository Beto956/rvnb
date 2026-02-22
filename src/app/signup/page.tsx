"use client";

import Link from "next/link";
import { useState } from "react";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { auth, db } from "../../lib/firebase";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { useRouter } from "next/navigation";
import styles from "./signup.module.css";

type Role = "host" | "guest";

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>("guest");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  const handleSignup = async () => {
    setMsg("");
    if (!email || !password) return setMsg("Enter email + password.");

    setSaving(true);
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password);

      await setDoc(doc(db, "users", cred.user.uid), {
        email: cred.user.email,
        role,
        createdAt: serverTimestamp(),
      });

      router.push(role === "host" ? "/host" : "/listings");
    } catch (e: any) {
      console.error(e);
      setMsg(e?.message ?? "Signup failed.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className={styles.page}>
      {/* Background */}
      <div className={styles.bg} />
      <div className={styles.bgOverlay} />

      {/* Header */}
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <Link href="/" className={styles.brand}>
            <img
              src="/rvnb-logo-icon.png"
              alt="RVNB"
              className={styles.brandIcon}
            />
          </Link>

          <nav className={styles.nav}>
            <Link href="/login" className={styles.navLink}>
              Login
            </Link>
            <Link href="/signup" className={styles.navCta}>
              Sign Up
            </Link>
          </nav>
        </div>
      </header>

      {/* Two Column Shell */}
      <div className={styles.shell}>
        {/* LEFT PANEL — REFINED HYBRID COPY */}
        <div className={styles.left}>
          <div className={styles.kicker}>
            Nationwide RV stays • Built for real RV life
          </div>

          <h1 className={styles.title}>Create your RVNB account</h1>

          <p className={styles.sub}>
            Start booking trusted RV spots — or turn your land into income.
          </p>

          <div className={styles.points}>
            <div className={styles.point}>
              <span className={styles.pointDot} />
              Fast, secure setup in under a minute
            </div>

            <div className={styles.point}>
              <span className={styles.pointDot} />
              Choose Guest or Host — expand anytime
            </div>

            <div className={styles.point}>
              <span className={styles.pointDot} />
              Built for real RV life, not generic rentals
            </div>
          </div>
        </div>

        {/* RIGHT PANEL — SIGNUP CARD */}
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <h2 className={styles.cardTitle}>Create account</h2>
            <p className={styles.cardSub}>
              Choose your role — you can expand later.
            </p>
          </div>

          <div className={styles.form}>
            <div className={styles.field}>
              <label className={styles.label}>Email</label>
              <input
                className={styles.input}
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div className={styles.field}>
              <label className={styles.label}>Password</label>
              <input
                className={styles.input}
                type="password"
                placeholder="Minimum 6 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            <div className={styles.roleWrap}>
              <div className={styles.roleLabel}>I am a:</div>
              <div className={styles.roleRow}>
                <button
                  type="button"
                  onClick={() => setRole("guest")}
                  className={`${styles.roleBtn} ${
                    role === "guest" ? styles.roleBtnActive : ""
                  }`}
                >
                  🙋 Guest
                </button>

                <button
                  type="button"
                  onClick={() => setRole("host")}
                  className={`${styles.roleBtn} ${
                    role === "host" ? styles.roleBtnActive : ""
                  }`}
                >
                  🏕️ Host
                </button>
              </div>
            </div>

            <button
              onClick={handleSignup}
              disabled={saving}
              className={styles.submit}
            >
              {saving ? "Creating..." : "Sign up"}
            </button>

            {msg && <div className={styles.msg}>{msg}</div>}

            <div className={styles.footerRow}>
              <div className={styles.footerText}>
                Already have an account?
              </div>
              <Link href="/login" className={styles.footerLink}>
                Log in
              </Link>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}