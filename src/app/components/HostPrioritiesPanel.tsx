"use client";

import Link from "next/link";
import styles from "./hostDashboard.module.css";

export type HostPriority = {
  key: string;
  title: string;
  text: string;
  href: string;
  linkLabel: string;
};

type Props = {
  priorities: HostPriority[];
};

export default function HostPrioritiesPanel({ priorities }: Props) {
  return (
    <section className={styles.panel} aria-labelledby="host-priorities-title">
      <div className={styles.panelHeader}>
        <div>
          <h2 id="host-priorities-title" className={styles.panelTitle}>
            Today&apos;s priorities
          </h2>
          <p className={styles.panelSub}>Set up your listings for success.</p>
        </div>
      </div>

      {priorities.length === 0 ? (
        <div className={styles.stateBox}>
          <div className={styles.stateTitle}>You&apos;re all caught up</div>
          <div className={styles.stateText}>
            No outstanding priorities right now — nice work.
          </div>
        </div>
      ) : (
        <div className={styles.priorityList}>
          {priorities.map((p) => (
            <Link
              href={p.href}
              key={p.key}
              className={styles.priorityItem}
              style={{ textDecoration: "none", color: "inherit" }}
            >
              <span className={styles.priorityCheck} aria-hidden="true" />
              <span>
                <div className={styles.priorityTitle}>{p.title}</div>
                <div className={styles.priorityText}>{p.text}</div>
              </span>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
