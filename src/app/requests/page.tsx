"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  collection,
  getDocs,
  query,
  Timestamp,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import HostGuard from "../components/HostGuard";
import { isFinalizedOpenRequest } from "@/lib/request-spot-contract";
import styles from "./page.module.css";

type SpotRequest = {
  id: string;
  requestType?: string;
  city?: string;
  state?: string;
  locationText?: string;
  startDate?: string;
  endDate?: string;
  flexibleDates?: boolean;
  budgetMax?: string | number;
  budgetPeriod?: string;
  rigDetails?: string;
  rvDetails?: string;
  primaryRv?: {
    rigType?: string;
    rigLength?: string | number;
    hookupsPreference?: string;
    pullThroughPreference?: string;
    laundryNeed?: string;
    petsTraveling?: string | boolean;
  };
  employerName?: string;
  teamName?: string;
  teamLocation?: string;
  workersCount?: string | number;
  rigsCount?: string | number;
  spotsNeeded?: string | number;
  stayDurationType?: string;
  note?: string;
  status?: string;
  publicVersion?: number;
  isFinalized?: boolean;
  requesterId?: string;
  createdAt?: Timestamp;
  finalizedAt?: Timestamp;
};

type FilterMode =
  | "All"
  | "Finalized"
  | "Draft"
  | "Open"
  | "Personal Travel"
  | "Work Stay"
  | "Employer / Team Housing";

function RequestsDashboardContent() {
  const [requests, setRequests] = useState<SpotRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterMode>("All");
  const [search, setSearch] = useState("");
  const [selectedRequest, setSelectedRequest] = useState<SpotRequest | null>(
    null
  );

  useEffect(() => {
    async function loadRequests() {
      try {
        const openSnap = await getDocs(
          query(
            collection(db, "spotRequestPublic"),
            where("publicVersion", "==", 2),
            where("status", "==", "open"),
            where("isFinalized", "==", true)
          )
        );

        const data = openSnap.docs
          .map((doc) => ({
            id: doc.id,
            ...(doc.data() as Omit<SpotRequest, "id">),
          }))
          .filter((request, index, all) => {
            if (all.findIndex((item) => item.id === request.id) !== index) return false;
            return isFinalizedOpenRequest(request);
          })
          .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));

        setRequests(data);
      } catch (error) {
        console.error("Failed to load spot requests:", error);
      } finally {
        setLoading(false);
      }
    }

    loadRequests();
  }, []);

  const filteredRequests = useMemo(() => {
    return requests.filter((request) => {
      const haystack = [
        request.requestType,
        request.city,
        request.state,
        request.locationText,
        request.note,
        request.teamName,
        request.employerName,
        request.primaryRv?.rigType,
        request.primaryRv?.hookupsPreference,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const matchesSearch = haystack.includes(search.toLowerCase());

      const matchesFilter =
        filter === "All" ||
        (filter === "Finalized" && request.isFinalized) ||
        (filter === "Draft" && !request.isFinalized) ||
        (filter === "Open" && request.status?.toLowerCase() === "open") ||
        request.requestType === filter;

      return matchesSearch && matchesFilter;
    });
  }, [requests, search, filter]);

  const finalizedCount = requests.filter((r) => r.isFinalized).length;
  const draftCount = requests.filter((r) => !r.isFinalized).length;
  const teamCount = requests.filter(
    (r) => r.requestType === "Employer / Team Housing"
  ).length;

  if (loading) {
    return (
      <main className={styles.page}>
        <div className={styles.pageOverlay} />
        <div className={styles.pageInner}>
          <section className={styles.centerCard}>Loading RVNB requests...</section>
        </div>
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <div className={styles.pageOverlay} />

      <div className={styles.pageInner}>
        <section className={styles.shell}>
          <div className={styles.topBar}>
            <nav className={styles.ecosystemNav}>
              <Link href="/" className={styles.topNavLink}>
                Home
              </Link>
              <Link href="/request-spot" className={styles.topNavLink}>
                Request Spot
              </Link>
              <Link href="/requests" className={styles.topNavLinkActive}>
                Requests
              </Link>
              <Link href="/host/opportunities" className={styles.topNavLink}>
                Opportunities
              </Link>
            </nav>

            <div className={styles.topActions}>
              <Link href="/request-spot" className={styles.topLink}>
                New Request
              </Link>
              <Link href="/host/opportunities" className={styles.topLinkPrimary}>
                Host Opportunities
              </Link>
            </div>
          </div>

          <header className={styles.hero}>
            <p className={styles.eyebrow}>RVNB Command Center</p>
            <h1 className={styles.title}>Submitted Spot Requests</h1>
            <p className={styles.subtitle}>
              Review traveler, worker, and employer housing requests from one
              premium RVNB workspace built for matching, follow-up, and future
              opportunity management.
            </p>
          </header>

          <section className={styles.statsGrid}>
            <StatCard label="Total Requests" value={requests.length} />
            <StatCard label="Finalized" value={finalizedCount} />
            <StatCard label="Draft / In Progress" value={draftCount} />
            <StatCard label="Team Housing" value={teamCount} />
          </section>

          <section className={styles.toolbar}>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search city, state, contact, notes, request type..."
              className={styles.searchInput}
            />

            <div className={styles.filterWrap}>
              {[
                "All",
                "Finalized",
                "Draft",
                "Open",
                "Personal Travel",
                "Work Stay",
                "Employer / Team Housing",
              ].map((item) => (
                <button
                  key={item}
                  onClick={() => setFilter(item as FilterMode)}
                  className={
                    filter === item
                      ? styles.filterButtonActive
                      : styles.filterButton
                  }
                >
                  {item}
                </button>
              ))}
            </div>
          </section>

          <section className={styles.requestGrid}>
            {filteredRequests.length === 0 ? (
              <div className={styles.emptyCard}>
                <h2>No matching requests found</h2>
                <p className={styles.mutedText}>
                  Try adjusting the search box or selecting a different filter.
                </p>
              </div>
            ) : (
              filteredRequests.map((request) => (
                <article key={request.id} className={styles.requestCard}>
                  <div className={styles.cardTopRow}>
                    <div>
                      <p className={styles.requestType}>
                        {request.requestType || "Request"}
                      </p>
                      <h2 className={styles.requestTitle}>
                        {request.city || request.locationText || "Unknown City"}
                        {request.state ? `, ${request.state}` : ""}
                      </h2>
                    </div>

                    <span className={styles.finalizedPill}>
                      {request.isFinalized ? "Finalized" : "Open"}
                    </span>
                  </div>

                  <div className={styles.summaryGrid}>
                    <Info label="Stay Window" value={formatStay(request)} />
                    <Info label="Budget" value={formatBudget(request)} />
                    <Info
                      label="Rig"
                      value={`${request.primaryRv?.rigType || "RV"}${
                        request.primaryRv?.rigLength
                          ? ` · ${request.primaryRv.rigLength} ft`
                          : ""
                      }`}
                    />
                    <Info
                      label="Hookups"
                      value={request.primaryRv?.hookupsPreference || "Not listed"}
                    />
                    <Info
                      label="Spots Needed"
                      value={String(request.spotsNeeded || request.rigsCount || 1)}
                    />
                    <Info
                      label="Created"
                      value={formatTimestamp(request.createdAt)}
                    />
                  </div>

                  {request.note && (
                    <p className={styles.notePreview}>
                      {request.note}
                    </p>
                  )}

                  <div className={styles.cardActions}>
                    <button
                      className={styles.ghostButton}
                      onClick={() => setSelectedRequest(request)}
                    >
                      View Details
                    </button>

                    <Link
                      href={`/request-spot/respond?requestId=${request.id}`}
                      className={styles.primarySmallButton}
                    >
                      Match / Respond
                    </Link>
                  </div>
                </article>
              ))
            )}
          </section>
        </section>
      </div>

      {selectedRequest && (
        <aside
          className={styles.slideOverlay}
          onClick={() => setSelectedRequest(null)}
        >
          <section
            className={styles.slidePanel}
            onClick={(event) => event.stopPropagation()}
          >
            <div className={styles.slideHeader}>
              <div>
                <p className={styles.eyebrow}>Request Details</p>
                <h2 className={styles.slideTitle}>
                  {selectedRequest.city ||
                    selectedRequest.locationText ||
                    "Unknown City"}
                  {selectedRequest.state ? `, ${selectedRequest.state}` : ""}
                </h2>
                <p className={styles.slideSubtitle}>
                  {selectedRequest.requestType || "Request"}
                </p>
              </div>

              <button
                className={styles.closeButton}
                onClick={() => setSelectedRequest(null)}
                aria-label="Close request details"
              >
                ×
              </button>
            </div>

            <div className={styles.slideMetaRow}>
              <span
                className={styles.finalizedPill}
              >
                {selectedRequest.isFinalized ? "Finalized" : "Open"}
              </span>

              <span className={styles.sideMiniPill}>
                {formatStay(selectedRequest)}
              </span>

              <span className={styles.sideMiniPill}>
                {formatBudget(selectedRequest)}
              </span>
            </div>

            <div className={styles.slideContent}>
              <DetailSection title="RV Details">
                <Info
                  label="RV Summary"
                  value={
                    selectedRequest.rvDetails ||
                    selectedRequest.rigDetails ||
                    "Not provided"
                  }
                />
                <Info
                  label="Rig Type"
                  value={selectedRequest.primaryRv?.rigType || "Not listed"}
                />
                <Info
                  label="Rig Length"
                  value={
                    selectedRequest.primaryRv?.rigLength
                      ? `${selectedRequest.primaryRv.rigLength} ft`
                      : "Not listed"
                  }
                />
                <Info
                  label="Hookups"
                  value={
                    selectedRequest.primaryRv?.hookupsPreference || "Not listed"
                  }
                />
                <Info
                  label="Pull Through"
                  value={
                    selectedRequest.primaryRv?.pullThroughPreference ||
                    "Not listed"
                  }
                />
                <Info
                  label="Laundry"
                  value={selectedRequest.primaryRv?.laundryNeed || "Not listed"}
                />
                <Info
                  label="Pets"
                  value={String(
                    selectedRequest.primaryRv?.petsTraveling || "Not listed"
                  )}
                />
              </DetailSection>

              <DetailSection title="Team / Employer">
                <Info
                  label="Employer"
                  value={selectedRequest.employerName || "Not provided"}
                />
                <Info
                  label="Team"
                  value={selectedRequest.teamName || "Not provided"}
                />
                <Info
                  label="Team Location"
                  value={selectedRequest.teamLocation || "Not provided"}
                />
                <Info
                  label="Workers"
                  value={String(selectedRequest.workersCount || "Not provided")}
                />
                <Info
                  label="Rigs"
                  value={String(selectedRequest.rigsCount || "Not provided")}
                />
                <Info
                  label="Spots Needed"
                  value={String(selectedRequest.spotsNeeded || 1)}
                />
              </DetailSection>

              <DetailSection title="Additional Information">
                <p className={styles.detailParagraph}>
                  {selectedRequest.note || "No request notes provided."}
                </p>

              </DetailSection>
            </div>

            <div className={styles.slideActions}>
              <button
                className={styles.ghostButton}
                onClick={() => setSelectedRequest(null)}
              >
                Close
              </button>

              <Link
                href={`/request-spot/respond?requestId=${selectedRequest.id}`}
                className={styles.primarySmallButton}
              >
                Match / Respond
              </Link>
            </div>
          </section>
        </aside>
      )}
    </main>
  );
}

export default function RequestsDashboardPage() {
  return (
    <HostGuard redirectTo="/login?next=/requests">
      <RequestsDashboardContent />
    </HostGuard>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className={styles.statCard}>
      <p>{label}</p>
      <h2>{value}</h2>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.infoBlock}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function DetailSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className={styles.detailSection}>
      <h3>{title}</h3>
      <div className={styles.detailGrid}>{children}</div>
    </div>
  );
}

function formatStay(request: SpotRequest) {
  if (!request.startDate && !request.endDate) return "Flexible / Not listed";

  const start = request.startDate || "Flexible";
  const end = request.endDate || "Flexible";

  return `${start} → ${end}${request.flexibleDates ? " · Flexible" : ""}`;
}

function formatBudget(request: SpotRequest) {
  if (!request.budgetMax) return "Not listed";
  return `$${request.budgetMax} / ${request.budgetPeriod || "period"}`;
}

function formatTimestamp(timestamp?: Timestamp) {
  if (!timestamp?.toDate) return "Not listed";

  return timestamp.toDate().toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}