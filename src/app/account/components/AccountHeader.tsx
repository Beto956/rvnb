"use client";

import Link from "next/link";
import styles from "../account.module.css";
import AuthNav from "../../components/authnav";

type Props = {
  displayName: string;
  loading: boolean;
  initial: string;
  isHost: boolean;
  locationLine: string;
  memberSince: string;
  emailVerified: boolean;
};

export default function AccountHeader({
  displayName,
  loading,
  initial,
  isHost,
  locationLine,
  memberSince,
  emailVerified,
}: Props) {
  return (
    <>
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

      <section className={styles.bannerSection}>
        <div className={styles.bannerImage} aria-hidden="true" />
        <div className={styles.bannerOverlay} aria-hidden="true" />
        <img src="/rvnb-logo-icon.png" alt="" aria-hidden="true" className={styles.bannerWatermark} />

        <div className={styles.bannerContent}>
          <div className={styles.profileCard}>
            <div className={styles.avatarWrap}>
              <div className={styles.avatar}>{initial}</div>
            </div>

            <div className={styles.identityBlock}>
              <p className={styles.eyebrow}>My Account</p>

              <h1 className={styles.name}>{loading ? "Loading profile..." : displayName}</h1>

              <p className={styles.roleLine}>{isHost ? "Host & Traveler" : "Traveler"}</p>

              <div className={styles.metaStack}>
                <span className={styles.metaItem}>{locationLine}</span>
                <span className={styles.metaItem}>{memberSince}</span>
                <span className={styles.roleBadge}>
                  {isHost ? "Host account active" : "Traveler account"}
                </span>
                {emailVerified && <span className={styles.emailVerifiedBadge}>✔ Email verified</span>}
              </div>

              <div className={styles.actionRow}>
                <Link href="/account/edit" className={styles.primaryBtn}>
                  Edit Profile
                </Link>

                {isHost && (
                  <Link href="/host" className={styles.secondaryBtn}>
                    Host Dashboard
                  </Link>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
