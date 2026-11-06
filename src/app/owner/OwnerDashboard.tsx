"use client";

import Link from "next/link";
import Image from "next/image";
import { useAuth } from "@/lib/auth-context";
import OverviewSection from "./components/OverviewSection";
import ListingsSection from "./components/ListingsSection";
import RequestsSection from "./components/RequestsSection";
import OpportunitiesSection from "./components/OpportunitiesSection";
import BookingsSection from "./components/BookingsSection";
import TransportSection from "./components/TransportSection";
import ModerationSection from "./components/ModerationSection";
import QuickLinksSection from "./components/QuickLinksSection";
import styles from "./owner.module.css";

export default function OwnerDashboard() {
  const { user } = useAuth();

  // OwnerGuard guarantees a verified owner before this renders.
  if (!user) return null;

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <div className={styles.header}>
          <div>
            <p className={styles.eyebrow}>RVNB Owner</p>
            <h1 className={styles.title}>Owner Dashboard</h1>
            <p className={styles.subtitle}>
              Private, read-only oversight of RVNB activity. Signed in as {user.email ?? user.uid}.
            </p>
          </div>
          <div className={styles.headerLinks}>
            <Link href="/" className={styles.pillLink} aria-label="Return to RVNB home">
              <Image src="/rvnb-logo-icon.png" alt="" width={27} height={18} style={{ display: "block" }} />
              Explore RVNB
            </Link>
            <Link href="/account" className={styles.pillLink}>My Account</Link>
          </div>
        </div>

        <p className={styles.notice} role="note">
          Read-only first release: no editing, deleting, approving, or other administrative
          actions are available. Self-reported records are labeled as such; nothing here is
          a verified status unless the underlying record says so.
        </p>

        <OverviewSection uid={user.uid} />
        <ListingsSection uid={user.uid} />
        <RequestsSection uid={user.uid} />
        <OpportunitiesSection uid={user.uid} />
        <BookingsSection uid={user.uid} />
        <TransportSection uid={user.uid} />
        <ModerationSection uid={user.uid} />
        <QuickLinksSection />
      </div>
    </main>
  );
}
