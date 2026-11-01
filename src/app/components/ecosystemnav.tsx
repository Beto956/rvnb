import Link from "next/link";
import styles from "./ecosystemnav.module.css";

const stayItems = [
  { label: "Bring your RV", description: "Explore RV spaces and other stays. Check each listing for rig fit and amenities.", href: "/listings", icon: "rv", cta: "Browse all stays", style: "rvStay" },
  { label: "Unique Stays", description: "Stay in a host-provided RV, mobile home, or cabin.", href: "/unique-stays", icon: "cabin", cta: "Explore unique stays", style: "uniqueStay" },
] as const;

const resourceItems = [
  { label: "Transport", description: "Explore transport requests and provider interest.", href: "/transport", icon: "road", cta: "Explore transport" },
  { label: "Insurance", description: "RV coverage guidance and early-access interest.", href: "/insurance", icon: "shield", cta: "Explore coverage" },
  { label: "Community", description: "Share experiences and learn from travelers and hosts.", href: "/community", icon: "community", cta: "Join the conversation" },
] as const;

export default function EcosystemNav() {
  return (
    <section className={styles.ecosystemWrap} aria-labelledby="rvnb-hub-title">
      <div className={styles.ecosystemInner}>
        <div className={styles.ecosystemHeader}>
          <p className={styles.eyebrow}>EXPLORE RVNB</p>
          <h2 id="rvnb-hub-title" className={styles.title}>Find your stay. Explore what&apos;s next.</h2>
          <p className={styles.subtitle}>
            RV spaces, unique stays, and resources for life on the road.
          </p>
        </div>

        <nav className={styles.ecosystemNav} aria-label="RVNB Hub">
          <div className={styles.stayGrid}>
            {stayItems.map((item) => (
              <Link key={item.href} href={item.href} className={`${styles.ecosystemCard} ${styles.stayCard} ${styles[item.style]}`}>
                <span className={styles.cardMarker} aria-hidden="true"><HubIcon icon={item.icon} /></span>
                <span className={styles.cardContent}>
                  <span className={styles.cardTitle}>{item.label}</span>
                  <span className={styles.cardDescription}>{item.description}</span>
                  <span className={styles.cardCta}>{item.cta} <span aria-hidden="true">→</span></span>
                </span>
              </Link>
            ))}
          </div>
          <div className={styles.resourceGrid}>
            {resourceItems.map((item) => (
              <Link key={item.href} href={item.href} className={`${styles.ecosystemCard} ${styles.resourceCard}`}>
                <span className={styles.cardMarker} aria-hidden="true">
                  <HubIcon icon={item.icon} />
                </span>
                <span className={styles.cardContent}>
                  <span className={styles.cardTitle}>{item.label}</span>
                  <span className={styles.cardDescription}>{item.description}</span>
                  <span className={styles.cardCta}>{item.cta} <span aria-hidden="true">→</span></span>
                </span>
              </Link>
            ))}
          </div>
        </nav>
      </div>
    </section>
  );
}

function HubIcon({ icon }: { icon: (typeof stayItems)[number]["icon"] | (typeof resourceItems)[number]["icon"] }) {
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

  if (icon === "rv") {
    return (
      <svg {...commonProps}>
        <path d="M3 17V6h13l5 6v5h-3M7 17h7M3 10h13V6M6 6v4M11 6v4M16 10h3" />
        <circle cx="5" cy="17" r="2" /><circle cx="16" cy="17" r="2" />
      </svg>
    );
  }

  if (icon === "cabin") {
    return (
      <svg {...commonProps}>
        <path d="m3 11 9-8 9 8M5 10v11h14V10M9 21v-7h6v7M8 11h8M10 8h4" />
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