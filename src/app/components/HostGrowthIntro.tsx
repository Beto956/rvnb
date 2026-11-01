import Link from "next/link";
import styles from "./hostGrowthIntro.module.css";

export default function HostGrowthIntro() {
  return <aside className={styles.card} aria-label="Host Growth Program">
    <p className={styles.eyebrow}>Host Growth · Pilot in development</p>
    <h2>Grow your hosting potential.</h2>
    <p>RVNB is exploring a small, self-funded pilot for practical property improvements. No funding is guaranteed. Interest submission is paused pending privacy notice approval.</p>
    <Link href="/host-growth">Explore Host Growth</Link>
  </aside>;
}
