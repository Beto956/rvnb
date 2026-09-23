"use client";

import Link from "next/link";
import type { User } from "firebase/auth";
import { DEMO_MEETUP, DEMO_TOP_CONTRIBUTORS, DEMO_TRENDING_TOPICS } from "../mockData";
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
      <QuickActionsCard signedIn={!!user} onSignIn={onSignIn} />
      <TrendingCard />
      <MeetupCard />
      <ContributorsCard />
      <GuidelinesCard />
    </aside>
  );
}

function ProfileCard({ user, onSignIn }: { user: User | null; onSignIn: () => void }) {
  if (!user) {
    return (
      <section className={styles.card} aria-labelledby="profile-card-heading">
        <h3 id="profile-card-heading" className={styles.cardTitle}>Join the conversation</h3>
        <p className={styles.mutedText}>Sign in to post, reply, and save discussions.</p>
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
        Edit profile
      </Link>
    </section>
  );
}

function QuickActionsCard({ signedIn, onSignIn }: { signedIn: boolean; onSignIn: () => void }) {
  const actions = [
    { label: "Create post", href: "/community/new" },
    { label: "Ask a question", href: "/community/new?category=general_discussion" },
    { label: "Share road update", href: "/community/new?category=routes_road_conditions" },
  ];

  return (
    <section className={styles.card} aria-labelledby="quick-actions-heading">
      <h3 id="quick-actions-heading" className={styles.cardTitle}>Quick actions</h3>
      <div className={styles.quickActions}>
        {actions.map((action) =>
          signedIn ? (
            <Link key={action.label} href={action.href} className={styles.quickAction}>
              {action.label}
            </Link>
          ) : (
            <button
              key={action.label}
              type="button"
              className={styles.quickAction}
              onClick={onSignIn}
            >
              {action.label}
            </button>
          )
        )}
      </div>
    </section>
  );
}

function DemoBadge() {
  return <span className={styles.demoBadge}>Demo</span>;
}

function TrendingCard() {
  return (
    <section className={styles.card} aria-labelledby="trending-heading">
      <div className={styles.cardHeaderRow}>
        <h3 id="trending-heading" className={styles.cardTitle}>Trending now</h3>
        <DemoBadge />
      </div>
      <ol className={styles.trendingList}>
        {DEMO_TRENDING_TOPICS.map((topic, index) => (
          <li key={topic.id} className={styles.trendingItem}>
            <span className={styles.trendingRank}>{index + 1}</span>
            <span className={styles.trendingLabel}>{topic.label}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

function MeetupCard() {
  return (
    <section className={styles.card} aria-labelledby="meetup-heading">
      <div className={styles.cardHeaderRow}>
        <h3 id="meetup-heading" className={styles.cardTitle}>Upcoming meetup</h3>
        <DemoBadge />
      </div>
      <p className={styles.meetupTitle}>{DEMO_MEETUP.title}</p>
      <p className={styles.mutedText}>{DEMO_MEETUP.dateLabel} · {DEMO_MEETUP.location}</p>
      <p className={styles.mutedText}>{DEMO_MEETUP.goingCount} going</p>
    </section>
  );
}

function ContributorsCard() {
  return (
    <section className={styles.card} aria-labelledby="contributors-heading">
      <div className={styles.cardHeaderRow}>
        <h3 id="contributors-heading" className={styles.cardTitle}>Top contributors</h3>
        <DemoBadge />
      </div>
      <ul className={styles.contributorList}>
        {DEMO_TOP_CONTRIBUTORS.map((contributor) => (
          <li key={contributor.id} className={styles.contributorItem}>
            <span className={styles.avatar} aria-hidden="true">
              {initialsFromName(contributor.name)}
            </span>
            <div className={styles.contributorText}>
              <span className={styles.contributorName}>{contributor.name}</span>
              <span className={styles.mutedText}>{contributor.helpfulVotes.toLocaleString()} helpful votes</span>
            </div>
          </li>
        ))}
      </ul>
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
      </ul>
      <Link href="#standards-heading" className={styles.mutedLink}>
        Learn more
      </Link>
    </section>
  );
}
