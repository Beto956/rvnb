import Link from "next/link";
import styles from "./ecosystemnav.module.css";

type EcosystemNavProps = {
  active?: "home" | "listings" | "request" | "transport" | "insurance" | "community";
};

const navItems = [
  { label: "RVNB Hub", href: "/", key: "home" },
  { label: "Listings", href: "/listings", key: "listings" },
  { label: "Request Spot", href: "/request-spot", key: "request" },
  { label: "Transport", href: "/transport", key: "transport" },
  { label: "Insurance", href: "/insurance", key: "insurance" },
  { label: "Community", href: "/community", key: "community" },
] as const;

export default function EcosystemNav({ active = "home" }: EcosystemNavProps) {
  return (
    <section className={styles.ecosystemWrap} aria-label="RVNB ecosystem navigation">
      <div className={styles.ecosystemInner}>
        <div className={styles.ecosystemHeader}>
          <p className={styles.eyebrow}>RVNB Ecosystem</p>
          <h2 className={styles.title}>Choose your path</h2>
        </div>

        <nav className={styles.ecosystemNav}>
          {navItems.map((item) => (
            <Link
              key={item.key}
              href={item.href}
              className={
                active === item.key ? styles.ecosystemLinkActive : styles.ecosystemLink
              }
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </section>
  );
}