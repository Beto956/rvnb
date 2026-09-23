"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import styles from "./hostDashboard.module.css";
import { useAuth } from "@/lib/auth-context";

type Props = {
  hostName: string;
};

export default function HostDashboardHeader({ hostName }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const { logout } = useAuth();

  async function handleLogout() {
    try {
      await logout();
      router.push("/");
      router.refresh();
    } catch (error) {
      console.error("Logout failed:", error);
    }
  }

  return (
    <>
      <header className={styles.headerBar}>
        <div className={styles.headerInner}>
          <div className={styles.brandGroup}>
            <Link href="/" className={styles.brand} aria-label="Return to RVNB home">
              <img src="/rvnb-logo-icon.png" alt="RVNB" className={styles.brandIcon} />
              <span className={styles.brandTagline}>Explore RVNB</span>
            </Link>

            <Link
              href="/host"
              className={`${styles.hostCenterLink} ${
                pathname === "/host" ? styles.hostCenterLinkActive : ""
              }`}
              aria-current={pathname === "/host" ? "page" : undefined}
            >
              Host Center
            </Link>
          </div>

          <nav className={styles.nav} aria-label="Host account">
            <Link
              href="/host/calendar"
              className={`${styles.navLink} ${
                pathname === "/host/calendar" ? styles.navLinkActive : ""
              }`}
            >
              Calendar
            </Link>

            <Link
              href="/account"
              className={`${styles.navLink} ${
                pathname === "/account" ? styles.navLinkActive : ""
              }`}
            >
              My Account
            </Link>

            <button type="button" className={styles.navLink} onClick={handleLogout}>
              Logout
            </button>
          </nav>
        </div>
      </header>

      <div className={styles.heroSection}>
        <div className={styles.heroBg} aria-hidden="true" />
        <div className={styles.heroOverlay} aria-hidden="true" />
        <img
          src="/rvnb-logo-icon.png"
          alt=""
          aria-hidden="true"
          className={styles.heroWatermark}
        />

        <div className={styles.heroInner}>
          <div className={styles.welcomeCard}>
            <div>
              <p className={styles.welcomeEyebrow}>Host Dashboard</p>
              <h1 className={styles.welcomeTitle}>Good day, {hostName}</h1>
              <p className={styles.welcomeSub}>
                Here&apos;s what&apos;s happening with your properties. Manage listings,
                review booking requests, and keep your calendar up to date.
              </p>
            </div>

            <div className={styles.welcomeActions}>
              <Link href="/host/calendar" className={styles.btnSecondary}>
                View calendar
              </Link>
              <Link href="/host/listings/new" className={styles.btnPrimary}>
                + Add new listing
              </Link>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
