"use client";

import { useState } from "react";
import Link from "next/link";
import { doc, serverTimestamp, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import styles from "../account.module.css";
import type { MemberProfileVisibility } from "../../members/memberProfileTypes";

type Props = {
  uid: string;
  loading: boolean;
  exists: boolean;
  visibility: MemberProfileVisibility | null;
};

export default function AccountPublicProfileCard({ uid, loading, exists, visibility }: Props) {
  const [busy, setBusy] = useState(false);
  const [localVisibility, setLocalVisibility] = useState(visibility);
  const [copyStatus, setCopyStatus] = useState("");

  const currentVisibility = localVisibility ?? visibility;
  const profileUrl = typeof window !== "undefined" ? `${window.location.origin}/members/${uid}` : `/members/${uid}`;

  async function toggleVisibility() {
    if (!exists || busy) return;
    setBusy(true);
    try {
      const next: MemberProfileVisibility = currentVisibility === "public" ? "private" : "public";
      await updateDoc(doc(db, "memberProfiles", uid), {
        visibility: next,
        updatedAt: serverTimestamp(),
      });
      setLocalVisibility(next);
    } catch (e) {
      console.error("[RVNB] Failed to update public-profile visibility", e);
    } finally {
      setBusy(false);
    }
  }

  async function copyLink() {
    try {
      if (navigator.share) {
        await navigator.share({ title: "My RVNB profile", url: profileUrl });
        setCopyStatus("Shared!");
      } else {
        await navigator.clipboard.writeText(profileUrl);
        setCopyStatus("Link copied!");
      }
    } catch {
      setCopyStatus("Couldn't copy — copy it from the address bar instead.");
    }
    setTimeout(() => setCopyStatus(""), 2500);
  }

  return (
    <div className={styles.sideCard}>
      <h3 className={styles.sideCardTitle}>Public profile</h3>

      {loading ? (
        <p className={styles.sideCardSub}>Checking your public profile...</p>
      ) : !exists ? (
        <>
          <p className={styles.sideCardSub}>Not published yet.</p>
          <p className={styles.completionNote}>
            Create a public profile to let other RVNB members see your display name, location,
            a short bio, and your active listings. Your trips, bookings, and account settings
            always stay private.
          </p>
          <Link href="/account/public-profile" className={styles.quickLinkItem} style={{ marginTop: 10 }}>
            ✨ Set up public profile
          </Link>
        </>
      ) : (
        <>
          <p className={styles.sideCardSub} aria-live="polite">
            {currentVisibility === "public" ? "Published" : "Private"}
          </p>

          <div className={styles.quickLinkList}>
            <Link href={`/members/${uid}`} className={styles.quickLinkItem}>
              👁️ Preview public profile
            </Link>
            <Link href="/account/public-profile" className={styles.quickLinkItem}>
              ✏️ Edit public profile
            </Link>
            <button
              type="button"
              className={styles.quickLinkItem}
              onClick={toggleVisibility}
              disabled={busy}
              style={{ border: "none", cursor: busy ? "not-allowed" : "pointer", textAlign: "left" }}
            >
              {busy
                ? "Updating..."
                : currentVisibility === "public"
                ? "🔒 Make private"
                : "🌐 Publish profile"}
            </button>

            {currentVisibility === "public" && (
              <button
                type="button"
                className={styles.quickLinkItem}
                onClick={copyLink}
                style={{ border: "none", cursor: "pointer", textAlign: "left" }}
              >
                🔗 Copy profile link
              </button>
            )}
          </div>

          {copyStatus && (
            <p className={styles.completionNote} role="status">
              {copyStatus}
            </p>
          )}
        </>
      )}
    </div>
  );
}
