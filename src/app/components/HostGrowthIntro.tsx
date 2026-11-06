import Link from "next/link";
import styles from "./hostGrowthIntro.module.css";

export default function HostGrowthIntro() {
  return <aside className={styles.card} aria-label="Host Growth Program">
    <p className={styles.eyebrow}>HOST GROWTH · PILOT IN DEVELOPMENT</p>
    <h2>Growth Potential</h2>
    <p>Turn your property&apos;s potential into hosting opportunities. Qualifying locations and properties may be considered for practical improvements, including Wi-Fi coverage, entrance signage, listing photography, and approved site preparation.</p>
    <h3 className={styles.supporting}>Earn with RVNB. Build toward more.</h3>
    <p>Have land, an RV space, or a unique stay to share? Introduce your property to travelers and take the next step toward growing your hosting business.</p>
    <p className={styles.statusNote}>RVNB is exploring improvement awards, repayable funding, and combined support. These options are still in development; eligibility and terms are not finalized, funding and earnings are not guaranteed, and interest registration is currently paused.</p>
    <Link href="/host-growth">Explore Host Growth →</Link>
  </aside>;
}
