"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import AuthNav from "../../components/authnav";
import styles from "../account.module.css";
import { MEMBER_PROFILE_LIMITS, type MemberProfileVisibility } from "../../members/memberProfileTypes";

type UserDoc = {
  displayName?: string;
  city?: string;
  state?: string;
};

export default function PublicProfileEditorPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const [pageLoading, setPageLoading] = useState(true);
  const [existed, setExisted] = useState(false);

  const [displayName, setDisplayName] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [bio, setBio] = useState("");
  const [visibility, setVisibility] = useState<MemberProfileVisibility>("private");

  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    async function load() {
      if (!user?.uid) {
        setPageLoading(false);
        return;
      }

      try {
        const [userSnap, profileSnap] = await Promise.all([
          getDoc(doc(db, "users", user.uid)),
          getDoc(doc(db, "memberProfiles", user.uid)),
        ]);

        const userData = userSnap.exists() ? (userSnap.data() as UserDoc) : {};

        if (profileSnap.exists()) {
          const data = profileSnap.data() as {
            displayName?: string;
            city?: string;
            state?: string;
            bio?: string;
            visibility?: MemberProfileVisibility;
          };
          setExisted(true);
          setDisplayName(data.displayName ?? userData.displayName ?? "");
          setCity(data.city ?? userData.city ?? "");
          setState(data.state ?? userData.state ?? "");
          setBio(data.bio ?? "");
          setVisibility(data.visibility === "public" ? "public" : "private");
        } else {
          // Safe unsaved defaults drawn from the private account — nothing is written yet.
          setDisplayName(userData.displayName ?? user.displayName ?? "");
          setCity(userData.city ?? "");
          setState(userData.state ?? "");
        }
      } catch (e) {
        console.error("[RVNB] Failed to load public profile editor", e);
      } finally {
        setPageLoading(false);
      }
    }

    load();
  }, [user?.uid, user?.displayName]);

  async function handleSave(nextVisibility: MemberProfileVisibility) {
    if (!user?.uid || saving) return;

    const trimmedName = displayName.trim();
    if (!trimmedName) {
      setErrorMsg("Display name can't be empty.");
      return;
    }

    setSaving(true);
    setErrorMsg("");
    setStatus("");

    try {
      const ref = doc(db, "memberProfiles", user.uid);
      const existingSnap = await getDoc(ref);

      const payload: Record<string, unknown> = {
        userId: user.uid,
        displayName: trimmedName.slice(0, MEMBER_PROFILE_LIMITS.displayName),
        city: city.trim().slice(0, MEMBER_PROFILE_LIMITS.city) || null,
        state: state.trim().slice(0, MEMBER_PROFILE_LIMITS.state) || null,
        bio: bio.trim().slice(0, MEMBER_PROFILE_LIMITS.bio) || null,
        visibility: nextVisibility,
        updatedAt: serverTimestamp(),
      };

      if (!existingSnap.exists()) {
        payload.createdAt = serverTimestamp();
      }

      await setDoc(ref, payload, { merge: true });

      setExisted(true);
      setVisibility(nextVisibility);
      setStatus(nextVisibility === "public" ? "Published!" : "Saved as private.");
    } catch (e) {
      console.error("[RVNB] Failed to save public profile", e);
      setErrorMsg("Couldn't save your public profile. Please try again.");
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
              <img src="/rvnb-logo-icon.png" alt="RVNB" className={styles.brandIcon} width={180} height={72} />
            </Link>
            <nav className={styles.nav} aria-label="Primary">
              <AuthNav navLinkClassName={styles.navLink} navCtaClassName={styles.navCta} navLogoutClassName={styles.navLink} />
            </nav>
          </div>
        </header>
        <section className={styles.contentSection}>
          <div className={styles.container}>
            <div className={styles.placeholderPanel}>
              <div className={styles.placeholderIcon}>🔐</div>
              <h2 className={styles.placeholderTitle}>Please sign in</h2>
              <p className={styles.placeholderText}>You need to be logged in to edit your public profile.</p>
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
            <img src="/rvnb-logo-icon.png" alt="RVNB" className={styles.brandIcon} width={180} height={72} />
          </Link>
          <nav className={styles.nav} aria-label="Primary">
            <AuthNav navLinkClassName={styles.navLink} navCtaClassName={styles.navCta} navLogoutClassName={styles.navLink} />
          </nav>
        </div>
      </header>

      <section className={styles.contentSection}>
        <div className={styles.container} style={{ maxWidth: 640 }}>
          <h1 className={styles.sectionTitle}>Public profile</h1>
          <p className={styles.sectionSub}>
            These fields become visible to other RVNB members and visitors at{" "}
            <strong>/members/{user?.uid}</strong>. Your trips, bookings, email, and account
            settings are never included.
          </p>

          {pageLoading ? (
            <div className={styles.placeholderPanel} style={{ marginTop: 24 }}>
              <div className={styles.placeholderIcon}>⏳</div>
              <h3 className={styles.placeholderTitle}>Loading your public profile...</h3>
            </div>
          ) : (
            <form className={styles.editForm} style={{ marginTop: 24 }} onSubmit={(e) => e.preventDefault()}>
              {errorMsg && <div className={styles.placeholderText}>{errorMsg}</div>}
              {status && (
                <div className={styles.placeholderText} role="status">
                  {status}
                </div>
              )}

              <label>
                Display name
                <input
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  maxLength={MEMBER_PROFILE_LIMITS.displayName}
                  required
                />
              </label>

              <label>
                City
                <input value={city} onChange={(e) => setCity(e.target.value)} maxLength={MEMBER_PROFILE_LIMITS.city} />
              </label>

              <label>
                State
                <input value={state} onChange={(e) => setState(e.target.value)} maxLength={MEMBER_PROFILE_LIMITS.state} />
              </label>

              <label>
                Short bio ({bio.length}/{MEMBER_PROFILE_LIMITS.bio})
                <textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  maxLength={MEMBER_PROFILE_LIMITS.bio}
                  rows={4}
                  placeholder="A short, honest bio for other RVNB members to see."
                />
              </label>

              <p className={styles.placeholderText}>
                Profile photos aren&apos;t supported yet — your public profile uses your
                initials for now. {existed ? `Currently ${visibility === "public" ? "published" : "private"}.` : "Not published yet."}
              </p>

              <div className={styles.actionRow}>
                <button
                  type="button"
                  className={styles.primaryBtn}
                  disabled={saving}
                  onClick={() => handleSave("public")}
                >
                  {saving ? "Saving..." : "Publish profile"}
                </button>
                <button
                  type="button"
                  className={styles.secondaryBtn}
                  disabled={saving}
                  onClick={() => handleSave("private")}
                >
                  {saving ? "Saving..." : "Save as private"}
                </button>
                <button type="button" className={styles.secondaryBtn} onClick={() => router.push("/account")}>
                  Back to account
                </button>
              </div>
            </form>
          )}
        </div>
      </section>
    </main>
  );
}
