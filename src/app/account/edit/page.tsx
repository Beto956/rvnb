"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import styles from "../account.module.css";
import AuthNav from "@/app/components/authnav";

export default function EditProfilePage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const [displayName, setDisplayName] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [pageLoading, setPageLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function loadUser() {
      if (!user?.uid) {
        setPageLoading(false);
        return;
      }

      try {
        const ref = doc(db, "users", user.uid);
        const snap = await getDoc(ref);

        if (snap.exists()) {
          const data = snap.data();

          setDisplayName(data.displayName || "");
          setCity(data.city || "");
          setState(data.state || "");
        }
      } catch (error) {
        console.error("Failed to load profile for editing:", error);
      } finally {
        setPageLoading(false);
      }
    }

    loadUser();
  }, [user?.uid]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();

    if (!user?.uid) return;

    setSaving(true);

    try {
      const ref = doc(db, "users", user.uid);

      await updateDoc(ref, {
        displayName: displayName.trim(),
        city: city.trim(),
        state: state.trim(),
      });

      router.push("/account");
      router.refresh();
    } catch (err) {
      console.error("Profile update failed", err);
    } finally {
      setSaving(false);
    }
  }

  if (!loading && !user) {
    return (
      <main className={styles.page}>
        <header className={styles.header}>
          <div className={styles.headerInner}>
            <Link href="/" className={styles.brand} aria-label="RVNB Home">
              <img
                src="/rvnb-logo-icon.png"
                alt="RVNB"
                className={styles.brandIcon}
                width={180}
                height={72}
              />
            </Link>

            <nav className={styles.nav} aria-label="Primary">
              <AuthNav
                navLinkClassName={styles.navLink}
                navCtaClassName={styles.navCta}
                navLogoutClassName={styles.navLink}
              />
            </nav>
          </div>
        </header>

        <section className={styles.contentSection}>
          <div className={styles.container}>
            <div className={styles.placeholderPanel}>
              <div className={styles.placeholderIcon}>🔐</div>
              <h2 className={styles.placeholderTitle}>Please sign in</h2>
              <p className={styles.placeholderText}>
                You need to be logged in to edit your profile.
              </p>
            </div>
          </div>
        </section>
      </main>
    );
  }

  if (loading || pageLoading) {
    return (
      <main className={styles.page}>
        <header className={styles.header}>
          <div className={styles.headerInner}>
            <Link href="/" className={styles.brand} aria-label="RVNB Home">
              <img
                src="/rvnb-logo-icon.png"
                alt="RVNB"
                className={styles.brandIcon}
                width={180}
                height={72}
              />
            </Link>

            <nav className={styles.nav} aria-label="Primary">
              <AuthNav
                navLinkClassName={styles.navLink}
                navCtaClassName={styles.navCta}
                navLogoutClassName={styles.navLink}
              />
            </nav>
          </div>
        </header>

        <section className={styles.contentSection}>
          <div className={styles.container}>
            <div className={styles.placeholderPanel}>
              <div className={styles.placeholderIcon}>⏳</div>
              <h2 className={styles.placeholderTitle}>Loading profile...</h2>
              <p className={styles.placeholderText}>
                Preparing your account details.
              </p>
            </div>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <Link href="/" className={styles.brand} aria-label="RVNB Home">
            <img
              src="/rvnb-logo-icon.png"
              alt="RVNB"
              className={styles.brandIcon}
              width={180}
              height={72}
            />
          </Link>

          <nav className={styles.nav} aria-label="Primary">
            <AuthNav
              navLinkClassName={styles.navLink}
              navCtaClassName={styles.navCta}
              navLogoutClassName={styles.navLink}
            />
          </nav>
        </div>
      </header>

      <section className={styles.editHeroSection}>
        <div className={styles.editHeroInner}>
          <Link href="/account" className={styles.backLink}>
            ← Back to Account
          </Link>

          <div className={styles.editHeroCard}>
            <p className={styles.eyebrow}>Account Settings</p>
            <h1 className={styles.nameSmall}>Edit Profile</h1>
            <p className={styles.editSubtitle}>
              Update the details that appear on your RVNB account page.
            </p>

            <form onSubmit={handleSave} className={styles.editForm}>
              <label className={styles.formLabel}>
                Display Name
                <input
                  className={styles.formInput}
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Enter your display name"
                />
              </label>

              <label className={styles.formLabel}>
                City
                <input
                  className={styles.formInput}
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="Enter your city"
                />
              </label>

              <label className={styles.formLabel}>
                State
                <input
                  className={styles.formInput}
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                  placeholder="Enter your state"
                />
              </label>

              <div className={styles.editActions}>
                <button type="submit" className={styles.primaryBtn} disabled={saving}>
                  {saving ? "Saving..." : "Save Profile"}
                </button>

                <Link href="/account" className={styles.secondaryBtn}>
                  Cancel
                </Link>
              </div>
            </form>
          </div>
        </div>
      </section>
    </main>
  );
}