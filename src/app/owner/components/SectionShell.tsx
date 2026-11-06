"use client";

import styles from "../owner.module.css";

type SectionShellProps = {
  title: string;
  hint?: string;
  total: number | null;
  shown: number;
  missingTimestamp?: number;
  loading: boolean;
  error: string;
  emptyText: string;
  onRetry: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
};

export default function SectionShell({
  title,
  hint,
  total,
  shown,
  missingTimestamp = 0,
  loading,
  error,
  emptyText,
  onRetry,
  children,
  footer,
}: SectionShellProps) {
  const headingId = `owner-section-${title.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}`;
  return (
    <section className={styles.section} aria-labelledby={headingId}>
      <div className={styles.sectionHeader}>
        <h2 className={styles.sectionTitle} id={headingId}>
          {title}
        </h2>
        {!loading && !error && total !== null && (
          <span className={styles.countLabel}>
            {missingTimestamp > 0
              ? `Showing ${shown} of ${total - missingTimestamp} timestamped ${total - missingTimestamp === 1 ? "record" : "records"}`
              : `Showing ${shown} of ${total} ${total === 1 ? "record" : "records"}`}
            {missingTimestamp > 0 && (
              <> · {missingTimestamp} older {missingTimestamp === 1 ? "record" : "records"} without a timestamp not listed</>
            )}
          </span>
        )}
      </div>
      {hint && <p className={styles.sectionHint}>{hint}</p>}
      {loading ? (
        <div className={styles.state} role="status">Loading…</div>
      ) : error ? (
        <div className={styles.errorBox} role="alert">
          <span>{error}</span>
          <button type="button" className={styles.button} onClick={onRetry}>Retry</button>
        </div>
      ) : total === 0 ? (
        <div className={styles.state}>{emptyText}</div>
      ) : (
        <>
          {children}
          {footer}
        </>
      )}
    </section>
  );
}
