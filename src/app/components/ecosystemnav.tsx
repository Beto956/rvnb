import Link from "next/link";
import styles from "./ecosystemnav.module.css";

const navItems = [
  { label: "Listings", description: "Find RV stays that fit your journey.", href: "/listings", icon: "pin" },
  { label: "Transport", description: "Explore help moving RVs and equipment.", href: "/transport", icon: "road" },
  { label: "Insurance", description: "Discover coverage built around RV travel.", href: "/insurance", icon: "shield" },
  { label: "Community", description: "Connect with travelers, hosts, and the road.", href: "/community", icon: "community" },
] as const;

export default function EcosystemNav() {
  return (
    <section className={styles.ecosystemWrap} aria-labelledby="rvnb-hub-title">
      <div className={styles.ecosystemInner}>
        <div className={styles.ecosystemHeader}>
          <p className={styles.eyebrow}>EXPLORE RVNB</p>
          <h2 id="rvnb-hub-title" className={styles.title}>The RVNB Hub</h2>
          <p className={styles.subtitle}>
            Everything you need for the road ahead—stays, transportation, protection, and community.
          </p>
        </div>

        <nav className={styles.ecosystemNav}>
          {navItems.map((item) => (
            <Link key={item.href} href={item.href} className={styles.ecosystemCard}>
              <span className={styles.cardMarker} aria-hidden="true">
                <HubIcon icon={item.icon} />
              </span>
              <span className={styles.cardContent}>
                <span className={styles.cardTitle}>{item.label}</span>
                <span className={styles.cardDescription}>{item.description}</span>
              </span>
              <span className={styles.cardArrow} aria-hidden="true">→</span>
            </Link>
          ))}
        </nav>
      </div>
    </section>
  );
}

function HubIcon({ icon }: { icon: (typeof navItems)[number]["icon"] }) {
  const commonProps = {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    className: styles.cardIcon,
    "aria-hidden": true,
  };

  if (icon === "pin") {
    return (
      <svg {...commonProps}>
        <path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z" />
        <circle cx="12" cy="10" r="2.25" />
      </svg>
    );
  }

  if (icon === "road") {
    return (
      <svg {...commonProps}>
        <path d="m8 3-3 18" />
        <path d="m16 3 3 18" />
        <path d="M12 4v3" />
        <path d="M12 10.5v3" />
        <path d="M12 17v3" />
      </svg>
    );
  }

  if (icon === "shield") {
    return (
      <svg {...commonProps}>
        <path d="M12 3 19 6v5c0 4.5-3 8.2-7 10-4-1.8-7-5.5-7-10V6l7-3Z" />
        <path d="m9 12 2 2 4-4" />
      </svg>
    );
  }

  return (
    <svg {...commonProps}>
      <circle cx="9" cy="8" r="3" />
      <circle cx="17" cy="9" r="2.5" />
      <path d="M3.5 20a5.5 5.5 0 0 1 11 0" />
      <path d="M14 16.5a4.5 4.5 0 0 1 6.5 3.5" />
    </svg>
  );
}