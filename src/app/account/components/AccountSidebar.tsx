"use client";

import Link from "next/link";
import styles from "../account.module.css";
import AccountPublicProfileCard from "./AccountPublicProfileCard";
import AccountReceivedReviewsCard, { AccountReceivedReview } from "./AccountReceivedReviewsCard";
import type { MemberProfileVisibility } from "../../members/memberProfileTypes";

export type AccountActivityItem = {
  id: string;
  text: string;
  dateLabel: string;
};

type Props = {
  uid: string;
  displayNameSet: boolean;
  locationSet: boolean;
  isHost: boolean;
  activity: AccountActivityItem[];
  publicProfileLoading: boolean;
  publicProfileExists: boolean;
  publicProfileVisibility: MemberProfileVisibility | null;
  reviewsLoading: boolean;
  reviewsError: string;
  reviewsAverage: number | null;
  reviewsCount: number;
  recentReviews: AccountReceivedReview[];
};

export default function AccountSidebar({
  uid,
  displayNameSet,
  locationSet,
  isHost,
  activity,
  publicProfileLoading,
  publicProfileExists,
  publicProfileVisibility,
  reviewsLoading,
  reviewsError,
  reviewsAverage,
  reviewsCount,
  recentReviews,
}: Props) {
  const items = [
    { key: "name", label: "Display name", done: displayNameSet },
    { key: "location", label: "City & state", done: locationSet },
  ];
  const completedCount = items.filter((i) => i.done).length;
  const pct = Math.round((completedCount / items.length) * 100);

  return (
    <div className={styles.sideCol}>
      <div className={styles.sideCard}>
        <h3 className={styles.sideCardTitle}>Profile completion</h3>
        <p className={styles.sideCardSub}>{pct}% complete</p>

        <div className={styles.completionBarTrack}>
          <div className={styles.completionBarFill} style={{ width: `${pct}%` }} />
        </div>

        {items.map((item) => (
          <div className={styles.completionItem} key={item.key}>
            <span className={`${styles.completionCheck} ${item.done ? styles.completionCheckDone : ""}`}>
              {item.done ? "✓" : ""}
            </span>
            <span>{item.label}</span>
            {!item.done && (
              <Link href="/account/edit" className={styles.completionLink}>
                Add
              </Link>
            )}
          </div>
        ))}

        <p className={styles.completionNote}>
          Profile photos aren&apos;t supported yet. Add a short bio from your public profile
          editor.
        </p>
      </div>

      <AccountPublicProfileCard
        uid={uid}
        loading={publicProfileLoading}
        exists={publicProfileExists}
        visibility={publicProfileVisibility}
      />

      <div className={styles.sideCard}>
        <h3 className={styles.sideCardTitle}>Quick links</h3>
        <div className={styles.quickLinkList}>
          {isHost && (
            <>
              <Link href="/host" className={styles.quickLinkItem}>
                🏠 Host Dashboard
              </Link>
              <Link href="/host/calendar" className={styles.quickLinkItem}>
                🗓️ Host Calendar
              </Link>
            </>
          )}
          <Link href="/search" className={styles.quickLinkItem}>
            🔎 Find a Stay
          </Link>
          <Link href="/community" className={styles.quickLinkItem}>
            💬 Community
          </Link>
          <Link href="/account/edit" className={styles.quickLinkItem}>
            ⚙️ Account Settings
          </Link>
        </div>
      </div>

      <AccountReceivedReviewsCard
        loading={reviewsLoading}
        error={reviewsError}
        average={reviewsAverage}
        count={reviewsCount}
        recent={recentReviews}
      />

      <div className={styles.sideCard}>
        <h3 className={styles.sideCardTitle}>Recent activity</h3>
        {activity.length === 0 ? (
          <p className={styles.smallEmpty}>No recent activity to show yet.</p>
        ) : (
          <div className={styles.activityList}>
            {activity.map((a) => (
              <div className={styles.activityItem} key={a.id}>
                <div className={styles.activityText}>{a.text}</div>
                <div className={styles.activityDate}>{a.dateLabel}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
