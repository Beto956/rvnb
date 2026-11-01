import Link from "next/link";
import styles from "./hostGrowthIntro.module.css";
export default function UniqueStaysIntro() {
  return <aside className={styles.card} aria-label="Unique Stays">
    <p className={styles.eyebrow}>Explore Unique Stays</p>
    <h2>Your getaway. Already here.</h2>
    <p>Explore host-provided RVs, mobile homes, and cabins—no RV of your own needed.</p>
    <Link href="/unique-stays">Discover Unique Stays</Link>
  </aside>;
}
