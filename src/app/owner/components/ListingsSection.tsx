"use client";

import Link from "next/link";
import { normalizeOwnerListing } from "@/lib/owner-dashboard";
import { formatDateTime } from "@/lib/owner-dashboard";
import { useOwnerSection } from "../use-owner-section";
import SectionShell from "./SectionShell";
import LoadMore from "./LoadMore";
import styles from "../owner.module.css";

export default function ListingsSection({ uid }: { uid: string }) {
  const section = useOwnerSection(uid, "listings", normalizeOwnerListing);

  return (
    <SectionShell
      title="Listings"
      hint="All stored listings, newest first. Titles open the public listing page in a new tab."
      total={section.total}
      shown={section.items.length}
      missingTimestamp={section.missingTimestamp}
      loading={section.loading}
      error={section.error}
      emptyText="No listings stored yet."
      onRetry={section.retry}
      footer={<LoadMore loadingMore={section.loadingMore} endReached={section.endReached} onLoadMore={section.loadMore} />}
    >
      <ul className={styles.list}>
        {section.items.map((listing) => (
          <li className={styles.row} key={listing.id}>
            <div className={styles.rowMain}>
              <span className={styles.rowTitle}>
                <Link href={`/listings/${listing.id}`} target="_blank" rel="noopener noreferrer">
                  {listing.title}
                </Link>
              </span>
              <span className={styles.badge}>{listing.typeLabel}</span>
            </div>
            <div className={styles.rowMeta}>
              {listing.location} · {listing.priceLabel} · Host {listing.hostId || "unknown"} · Created {formatDateTime(listing.createdAt)}
            </div>
          </li>
        ))}
      </ul>
    </SectionShell>
  );
}
