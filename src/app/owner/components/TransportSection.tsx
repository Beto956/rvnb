"use client";

import {
  formatDateTime,
  normalizeOwnerTransportInterest,
  normalizeOwnerTransportProvider,
  normalizeOwnerTransportRequest,
} from "@/lib/owner-dashboard";
import { useOwnerSection } from "../use-owner-section";
import SectionShell from "./SectionShell";
import LoadMore from "./LoadMore";
import styles from "../owner.module.css";

function TransportRequests({ uid }: { uid: string }) {
  const section = useOwnerSection(uid, "transportRequests", normalizeOwnerTransportRequest);
  return (
    <SectionShell
      title="Transport requests"
      hint="Customer transport requests with contact details. Contact information is private to this dashboard."
      total={section.total}
      shown={section.items.length}
      missingTimestamp={section.missingTimestamp}
      loading={section.loading}
      error={section.error}
      emptyText="No transport requests stored yet."
      onRetry={section.retry}
      footer={<LoadMore loadingMore={section.loadingMore} endReached={section.endReached} onLoadMore={section.loadMore} />}
    >
      <ul className={styles.list}>
        {section.items.map((request) => (
          <li className={styles.row} key={request.id}>
            <div className={styles.rowMain}>
              <span className={styles.rowTitle}>{request.route}</span>
              <span className={styles.badge}>{request.status}</span>
            </div>
            <div className={styles.rowMeta}>
              {[request.rvSummary, request.method, request.pickupDate ? `Pickup ${request.pickupDate}` : ""]
                .filter(Boolean)
                .join(" · ")}
            </div>
            <div className={styles.rowMeta}>
              Contact {request.contactName} · {request.contactEmail} · Requester {request.requesterId || "unknown"} · {formatDateTime(request.createdAt)}
            </div>
          </li>
        ))}
      </ul>
    </SectionShell>
  );
}

function TransportProviders({ uid }: { uid: string }) {
  const section = useOwnerSection(uid, "transportProviders", normalizeOwnerTransportProvider);
  return (
    <SectionShell
      title="Transport provider registrations"
      hint="Self-reported provider registrations. Details, insurance, and experience are provider-supplied and not verified."
      total={section.total}
      shown={section.items.length}
      missingTimestamp={section.missingTimestamp}
      loading={section.loading}
      error={section.error}
      emptyText="No provider registrations stored yet."
      onRetry={section.retry}
      footer={<LoadMore loadingMore={section.loadingMore} endReached={section.endReached} onLoadMore={section.loadMore} />}
    >
      <ul className={styles.list}>
        {section.items.map((provider) => (
          <li className={styles.row} key={provider.id}>
            <div className={styles.rowMain}>
              <span className={styles.rowTitle}>{provider.name}{provider.company ? ` · ${provider.company}` : ""}</span>
              <span className={`${styles.badge} ${styles.badgeWarn}`}>Self-reported</span>
            </div>
            <div className={styles.rowMeta}>
              {[provider.typeLabel, provider.scopeLabel, provider.serviceArea && `Area: ${provider.serviceArea}`]
                .filter(Boolean)
                .join(" · ") || "Details not provided"}
            </div>
            <div className={styles.rowMeta}>
              {provider.services.length > 0 ? `Services: ${provider.services.join(", ")} · ` : ""}
              Contact {provider.email} · {provider.phone} · {formatDateTime(provider.createdAt)}
            </div>
          </li>
        ))}
      </ul>
    </SectionShell>
  );
}

function TransportInterest({ uid }: { uid: string }) {
  const section = useOwnerSection(uid, "transportInterest", normalizeOwnerTransportInterest);
  return (
    <SectionShell
      title="Transport general interest"
      hint="Early-access interest submissions from the transport pages."
      total={section.total}
      shown={section.items.length}
      missingTimestamp={section.missingTimestamp}
      loading={section.loading}
      error={section.error}
      emptyText="No transport interest submissions stored yet."
      onRetry={section.retry}
      footer={<LoadMore loadingMore={section.loadingMore} endReached={section.endReached} onLoadMore={section.loadMore} />}
    >
      <ul className={styles.list}>
        {section.items.map((interest) => (
          <li className={styles.row} key={interest.id}>
            <div className={styles.rowMain}>
              <span className={styles.rowTitle}>{interest.email}</span>
              <span className={`${styles.badge} ${styles.badgeMuted}`}>{interest.interestType}</span>
            </div>
            <div className={styles.rowMeta}>
              {interest.page ? `From ${interest.page} · ` : ""}{formatDateTime(interest.createdAt)}
            </div>
          </li>
        ))}
      </ul>
    </SectionShell>
  );
}

export default function TransportSection({ uid }: { uid: string }) {
  return (
    <>
      <TransportRequests uid={uid} />
      <TransportProviders uid={uid} />
      <TransportInterest uid={uid} />
    </>
  );
}
