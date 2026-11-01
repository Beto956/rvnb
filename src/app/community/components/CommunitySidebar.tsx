"use client";

import Link from "next/link";
import type { User } from "firebase/auth";
import { initialsFromName } from "@/lib/community";
import styles from "./CommunitySidebar.module.css";

type CommunitySidebarProps = {
  user: User | null;
  onSignIn: () => void;
};

export default function CommunitySidebar({ user, onSignIn }: CommunitySidebarProps) {
  return (
    <aside className={styles.sidebar} aria-label="Community sidebar">
      <ProfileCard user={user} onSignIn={onSignIn} />
      <QuickActionsCard signedIn={!!user} />
      <GuidelinesCard />
    </aside>
  );
}

function ProfileCard({ user, onSignIn }: { user: User | null; onSignIn: () => void }) {
  if (!user) {
    return (
      <section className={styles.card} aria-labelledby="profile-card-heading">
        <h3 id="profile-card-heading" className={styles.cardTitle}>Join the conversation</h3>
        <p className={styles.mutedText}>Sign in to post, reply, and report concerns.</p>
        <button type="button" className={styles.primaryButton} onClick={onSignIn}>
          Sign In
        </button>
      </section>
    );
  }

  const name = user.displayName || user.email || "RVNB Member";

  return (
    <section className={styles.card} aria-labelledby="profile-card-heading">
      <div className={styles.profileRow}>
        <span className={styles.profileAvatar} aria-hidden="true">
          {initialsFromName(name)}
        </span>
        <div className={styles.profileText}>
          <span id="profile-card-heading" className={styles.profileName}>{name}</span>
          <span className={styles.mutedText}>RVNB Member</span>
        </div>
      </div>
      <Link href="/account" className={styles.outlineButton}>
        My account
      </Link>
    </section>
  );
}

function QuickActionsCard({ signedIn }: { signedIn: boolean }) {
  const actions = [
    { label: "Create post", href: "/community/new" },
    { label: "Ask a question", href: "/community/new?category=general_discussion" },
    { label: "Share road update", href: "/community/new?category=routes_road_conditions" },
  ];

  return (
    <section className={styles.card} aria-labelledby="quick-actions-heading">
      <h3 id="quick-actions-heading" className={styles.cardTitle}>Quick actions</h3>
      <div className={styles.quickActions}>
        {actions.map((action) => (
            <Link key={action.label} href={signedIn ? action.href : `/login?next=${encodeURIComponent(action.href)}`} className={styles.quickAction}>
              {action.label}
            </Link>
        ))}
      </div>
    </section>
  );
}

function GuidelinesCard() {
  return (
    <section className={styles.card} aria-labelledby="guidelines-heading">
      <h3 id="guidelines-heading" className={styles.cardTitle}>Community guidelines</h3>
      <ul className={styles.guidelinesList}>
        <li>Be respectful and supportive.</li>
        <li>Share real experiences.</li>
        <li>No spam or self-promotion.</li>
        <li>Keep it helpful and on topic.</li>
        <li>Protect private information.</li>
        <li>For emergencies, contact emergency services.</li>
      </ul>
      <Link href="#standards-heading" className={styles.mutedLink}>
        Learn more
      </Link>
    </section>
  );
}
