"use client";

import { formatDateTime, normalizeOwnerOpportunity } from "@/lib/owner-dashboard";
import { useOwnerSection } from "../use-owner-section";
import SectionShell from "./SectionShell";
import LoadMore from "./LoadMore";
import styles from "../owner.module.css";

export default function OpportunitiesSection({ uid }: { uid: string }) {
  const section = useOwnerSection(uid, "hostOpportunities", normalizeOwnerOpportunity);

  return (
    <SectionShell
      title="Host responses & applications"
      hint="Responses are linked to a traveler request. Applications are self-reported host submissions — they are not verified and are not tied to a request."
      total={section.total}
      shown={section.items.length}
      missingTimestamp={section.missingTimestamp}
      loading={section.loading}
      error={section.error}
      emptyText="No host responses or applications stored yet."
      onRetry={section.retry}
      footer={<LoadMore loadingMore={section.loadingMore} endReached={section.endReached} onLoadMore={section.loadMore} />}
    >
      <ul className={styles.list}>
        {section.items.map((item) => (
          <li className={styles.row} key={item.id}>
            <div className={styles.rowMain}>
              <span className={styles.rowTitle}>{item.name || "Host"} — {item.location}</span>
              {item.kind === "response" ? (
                <span className={styles.badge}>Response to request {item.requestId}</span>
              ) : (
                <span className={`${styles.badge} ${styles.badgeWarn}`}>Host application · self-reported</span>
              )}
            </div>
            <div className={styles.rowMeta}>
              {[item.summary, `Host ${item.hostId || "unknown"}`]
                .filter(Boolean)
                .join(" · ")} · {formatDateTime(item.createdAt)}
            </div>
          </li>
        ))}
      </ul>
    </SectionShell>
  );
}
