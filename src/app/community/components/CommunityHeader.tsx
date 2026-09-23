import Link from "next/link";
import AuthNav from "@/app/components/authnav";
import styles from "./CommunityHeader.module.css";

const NAV_LINKS = [
  { label: "Listings", href: "/listings" },
  { label: "Transport", href: "/transport" },
  { label: "Insurance", href: "/insurance" },
  { label: "Community", href: "/community" },
] as const;

export default function CommunityHeader() {
  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <Link href="/" className={styles.brand} aria-label="RVNB Home">
          <span className={styles.brandMark} aria-hidden="true">▲</span>
          <span>RVNB</span>
        </Link>

        <nav className={styles.nav} aria-label="Primary">
          {NAV_LINKS.map((link) => {
            const isActive = link.href === "/community";
            return (
              <Link
                key={link.href}
                href={link.href}
                className={isActive ? styles.navLinkActive : styles.navLink}
                aria-current={isActive ? "page" : undefined}
              >
                {link.label}
              </Link>
            );
          })}

          <AuthNav
            navLinkClassName={styles.navLink}
            navCtaClassName={styles.navCta}
            navLogoutClassName={styles.navLink}
          />
        </nav>
      </div>
    </header>
  );
}
