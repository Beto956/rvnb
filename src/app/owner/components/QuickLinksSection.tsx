"use client";

import Link from "next/link";
import styles from "../owner.module.css";

const PUBLIC_LINKS = [
  { href: "/", label: "Homepage", note: "Public landing page" },
  { href: "/listings", label: "Listings", note: "Public listing browser" },
  { href: "/search", label: "Search", note: "Public search" },
  { href: "/unique-stays", label: "Unique Stays", note: "Public stays page" },
  { href: "/community", label: "Community", note: "Public discussions" },
  { href: "/requests", label: "Open Requests", note: "Host-facing public request board" },
  { href: "/transport", label: "Transport", note: "Public transport page" },
  { href: "/members", label: "Members", note: "Public member profiles" },
];

const WORKSPACE_LINKS = [
  { href: "/account", label: "My Account", note: "Your member account" },
  { href: "/account/requests", label: "My Requests", note: "Your private request workspace" },
  { href: "/host", label: "Host Dashboard", note: "Your host workspace" },
];

export default function QuickLinksSection() {
  return (
    <section className={styles.section} aria-labelledby="owner-section-quick-links">
      <div className={styles.sectionHeader}>
        <h2 className={styles.sectionTitle} id="owner-section-quick-links">Quick links</h2>
      </div>
      <p className={styles.sectionHint}>
        Public pages open in your current signed-in session — no impersonation and no automatic logout. Your own workspaces use your normal member/host access.
      </p>
      <div className={styles.linkGrid}>
        {PUBLIC_LINKS.map((link) => (
          <Link className={styles.linkCard} href={link.href} key={link.href}>
            {link.label}
            <span>{link.note}</span>
          </Link>
        ))}
      </div>
      <div className={styles.linkGrid} style={{ marginTop: 10 }}>
        {WORKSPACE_LINKS.map((link) => (
          <Link className={styles.linkCard} href={link.href} key={link.href}>
            {link.label}
            <span>{link.note}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
