import styles from "./PinnedGuideCard.module.css";

export default function PinnedGuideCard() {
  return (
    <li className={styles.item}>
      <div className={styles.card}>
        <div className={styles.pinRow}>
          <span className={styles.pinIcon} aria-hidden="true">📌</span>
          <span className={styles.pinLabel}>Pinned · Community Guide</span>
        </div>
        <div className={styles.header}>
          <span className={styles.avatar} aria-hidden="true">RV</span>
          <div className={styles.headerText}>
            <span className={styles.author}>RVNB Team ✓</span>
            <span className={styles.subline}>2 weeks ago</span>
          </div>
        </div>
        <h3 className={styles.title}>Welcome to RVNB Community 👋</h3>
        <p className={styles.excerpt}>
          A few quick tips to make the most of the community — be kind, share real experiences, and help
          keep RV travel open for everyone.
        </p>
      </div>
    </li>
  );
}
