import styles from "./PinnedGuideCard.module.css";

export default function PinnedGuideCard() {
  return (
    <li className={styles.item}>
      <div className={styles.card}>
        <div className={styles.pinRow}>
          <span className={styles.pinLabel}>Community guide · Not a member discussion</span>
        </div>
        <h3 className={styles.title}>Welcome to RVNB Community</h3>
        <p className={styles.excerpt}>
          A few quick tips to make the most of the community — be kind, share real experiences, and help
          keep RV travel open for everyone.
        </p>
      </div>
    </li>
  );
}
