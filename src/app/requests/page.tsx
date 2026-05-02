"use client";

import React, { CSSProperties, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  collection,
  getDocs,
  orderBy,
  query,
  Timestamp,
} from "firebase/firestore";
import { onAuthStateChanged, User } from "firebase/auth";
import { db, auth } from "@/lib/firebase";

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
    petsTraveling?: string;
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
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  bestContactMethod?: string;
  openToNearby?: boolean;
  notifyMatches?: boolean;
  finalNotes?: string;
  priorityPreferences?: string[];
  isFinalized?: boolean;
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

export default function RequestsDashboardPage() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [requests, setRequests] = useState<SpotRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterMode>("All");
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
    });

    return () => unsub();
  }, []);

  useEffect(() => {
    async function loadRequests() {
      try {
        const q = query(
          collection(db, "spotRequests"),
          orderBy("createdAt", "desc")
        );

        const snap = await getDocs(q);

        const data = snap.docs.map((doc) => ({
          id: doc.id,
          ...(doc.data() as Omit<SpotRequest, "id">),
        }));

        setRequests(data);
      } catch (error) {
        console.error("Failed to load spot requests:", error);
      } finally {
        setLoading(false);
      }
    }

    if (!authLoading && user) {
      loadRequests();
    }

    if (!authLoading && !user) {
      setLoading(false);
    }
  }, [authLoading, user]);

  const filteredRequests = useMemo(() => {
    return requests.filter((request) => {
      const haystack = [
        request.requestType,
        request.city,
        request.state,
        request.locationText,
        request.note,
        request.finalNotes,
        request.contactName,
        request.contactEmail,
        request.status,
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

  if (authLoading || loading) {
    return (
      <main style={pageShell}>
        <div style={loadingCard}>Loading RVNB requests...</div>
      </main>
    );
  }

  if (!user) {
    return (
      <main style={pageShell}>
        <section style={lockedCard}>
          <p style={eyebrow}>RVNB Request Dashboard</p>
          <h1 style={lockedTitle}>Sign in required</h1>
          <p style={mutedText}>
            Please log in before viewing submitted spot requests.
          </p>
          <Link href="/login" style={primaryButton}>
            Go to Login
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main style={pageShell}>
      <section style={heroCard}>
        <div>
          <p style={eyebrow}>RVNB Command Center</p>
          <h1 style={heroTitle}>Submitted Spot Requests</h1>
          <p style={heroSubtitle}>
            Review traveler, worker, and employer housing requests from one
            polished workspace.
          </p>
        </div>

        <div style={heroActions}>
          <Link href="/request-spot" style={secondaryButton}>
            New Request
          </Link>
          <Link href="/host/opportunities" style={primaryButton}>
            Host Opportunities
          </Link>
        </div>
      </section>

      <section style={statsGrid}>
        <StatCard label="Total Requests" value={requests.length} />
        <StatCard label="Finalized" value={finalizedCount} />
        <StatCard label="Draft / In Progress" value={draftCount} />
        <StatCard label="Team Housing" value={teamCount} />
      </section>

      <section style={toolbar}>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search city, state, contact, notes, request type..."
          style={searchInput}
        />

        <div style={filterWrap}>
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
              style={filter === item ? activeFilterButton : filterButton}
            >
              {item}
            </button>
          ))}
        </div>
      </section>

      <section style={requestGrid}>
        {filteredRequests.length === 0 ? (
          <div style={emptyCard}>
            <h2 style={emptyTitle}>No matching requests found</h2>
            <p style={mutedText}>
              Try adjusting the search box or selecting a different filter.
            </p>
          </div>
        ) : (
          filteredRequests.map((request) => {
            const expanded = expandedId === request.id;

            return (
              <article key={request.id} style={requestCard}>
                <div style={cardTopRow}>
                  <div>
                    <p style={requestType}>
                      {request.requestType || "Request"}
                    </p>
                    <h2 style={requestTitle}>
                      {request.city || "Unknown City"}
                      {request.state ? `, ${request.state}` : ""}
                    </h2>
                  </div>

                  <span
                    style={
                      request.isFinalized ? finalizedPill : draftPill
                    }
                  >
                    {request.isFinalized ? "Finalized" : "Draft"}
                  </span>
                </div>

                <div style={summaryGrid}>
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

                {(request.note || request.finalNotes) && (
                  <p style={notePreview}>
                    {request.finalNotes || request.note}
                  </p>
                )}

                {expanded && (
                  <div style={detailsPanel}>
                    <DetailSection title="Contact">
                      <Info label="Name" value={request.contactName || "Not provided"} />
                      <Info label="Email" value={request.contactEmail || "Not provided"} />
                      <Info label="Phone" value={request.contactPhone || "Not provided"} />
                      <Info label="Best Method" value={request.bestContactMethod || "Not provided"} />
                    </DetailSection>

                    <DetailSection title="RV Details">
                      <Info label="RV Summary" value={request.rvDetails || request.rigDetails || "Not provided"} />
                      <Info label="Pull Through" value={request.primaryRv?.pullThroughPreference || "Not listed"} />
                      <Info label="Laundry" value={request.primaryRv?.laundryNeed || "Not listed"} />
                      <Info label="Pets" value={request.primaryRv?.petsTraveling || "Not listed"} />
                    </DetailSection>

                    <DetailSection title="Team / Employer">
                      <Info label="Employer" value={request.employerName || "Not provided"} />
                      <Info label="Team" value={request.teamName || "Not provided"} />
                      <Info label="Team Location" value={request.teamLocation || "Not provided"} />
                      <Info label="Workers" value={String(request.workersCount || "Not provided")} />
                    </DetailSection>

                    <DetailSection title="Final Notes">
                      <p style={detailParagraph}>
                        {request.finalNotes || request.note || "No notes provided."}
                      </p>

                      {request.priorityPreferences?.length ? (
                        <div style={pillWrap}>
                          {request.priorityPreferences.map((pref) => (
                            <span key={pref} style={smallPill}>
                              {pref}
                            </span>
                          ))}
                        </div>
                      ) : null}
                    </DetailSection>
                  </div>
                )}

                <div style={cardActions}>
                  <button
                    style={ghostButton}
                    onClick={() => setExpandedId(expanded ? null : request.id)}
                  >
                    {expanded ? "Hide Details" : "View Details"}
                  </button>

                  <Link
                    href={`/request-spot/respond?requestId=${request.id}`}
                    style={primarySmallButton}
                  >
                    Match / Respond
                  </Link>
                </div>
              </article>
            );
          })
        )}
      </section>
    </main>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div style={statCard}>
      <p style={statLabel}>{label}</p>
      <h2 style={statValue}>{value}</h2>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div style={infoBlock}>
      <span style={infoLabel}>{label}</span>
      <strong style={infoValue}>{value}</strong>
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
    <div style={detailSection}>
      <h3 style={detailTitle}>{title}</h3>
      <div style={detailGrid}>{children}</div>
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

const pageShell: CSSProperties = {
  minHeight: "100vh",
  padding: "42px 24px",
  color: "#f8fafc",
  background:
    "radial-gradient(circle at top left, rgba(34,197,94,0.20), transparent 35%), linear-gradient(135deg, #050816 0%, #0f172a 45%, #111827 100%)",
};

const heroCard: CSSProperties = {
  maxWidth: 1180,
  margin: "0 auto 22px",
  padding: 28,
  borderRadius: 28,
  background: "rgba(255,255,255,0.08)",
  border: "1px solid rgba(255,255,255,0.14)",
  boxShadow: "0 24px 80px rgba(0,0,0,0.35)",
  backdropFilter: "blur(18px)",
  display: "flex",
  justifyContent: "space-between",
  gap: 20,
  alignItems: "center",
  flexWrap: "wrap",
};

const eyebrow: CSSProperties = {
  margin: 0,
  color: "#86efac",
  fontSize: 13,
  fontWeight: 900,
  letterSpacing: "0.14em",
  textTransform: "uppercase",
};

const heroTitle: CSSProperties = {
  margin: "8px 0",
  fontSize: "clamp(32px, 5vw, 58px)",
  lineHeight: 1,
};

const heroSubtitle: CSSProperties = {
  margin: 0,
  maxWidth: 720,
  color: "rgba(248,250,252,0.74)",
  fontSize: 16,
};

const heroActions: CSSProperties = {
  display: "flex",
  gap: 12,
  flexWrap: "wrap",
};

const primaryButton: CSSProperties = {
  padding: "13px 18px",
  borderRadius: 999,
  background: "#22c55e",
  color: "#052e16",
  textDecoration: "none",
  fontWeight: 900,
  border: "none",
};

const secondaryButton: CSSProperties = {
  padding: "13px 18px",
  borderRadius: 999,
  background: "rgba(255,255,255,0.10)",
  color: "#f8fafc",
  textDecoration: "none",
  fontWeight: 900,
  border: "1px solid rgba(255,255,255,0.16)",
};

const statsGrid: CSSProperties = {
  maxWidth: 1180,
  margin: "0 auto 22px",
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: 14,
};

const statCard: CSSProperties = {
  padding: 20,
  borderRadius: 22,
  background: "rgba(255,255,255,0.07)",
  border: "1px solid rgba(255,255,255,0.12)",
};

const statLabel: CSSProperties = {
  margin: 0,
  color: "rgba(248,250,252,0.68)",
  fontWeight: 800,
};

const statValue: CSSProperties = {
  margin: "8px 0 0",
  fontSize: 34,
};

const toolbar: CSSProperties = {
  maxWidth: 1180,
  margin: "0 auto 22px",
  padding: 18,
  borderRadius: 24,
  background: "rgba(255,255,255,0.06)",
  border: "1px solid rgba(255,255,255,0.12)",
};

const searchInput: CSSProperties = {
  width: "100%",
  padding: "15px 16px",
  borderRadius: 16,
  border: "1px solid rgba(255,255,255,0.14)",
  background: "rgba(15,23,42,0.80)",
  color: "#f8fafc",
  outline: "none",
  fontSize: 15,
  marginBottom: 14,
};

const filterWrap: CSSProperties = {
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
};

const filterButton: CSSProperties = {
  padding: "10px 13px",
  borderRadius: 999,
  border: "1px solid rgba(255,255,255,0.14)",
  background: "rgba(255,255,255,0.06)",
  color: "rgba(248,250,252,0.78)",
  cursor: "pointer",
  fontWeight: 800,
};

const activeFilterButton: CSSProperties = {
  ...filterButton,
  background: "#22c55e",
  color: "#052e16",
};

const requestGrid: CSSProperties = {
  maxWidth: 1180,
  margin: "0 auto",
  display: "grid",
  gap: 16,
};

const requestCard: CSSProperties = {
  padding: 22,
  borderRadius: 26,
  background: "rgba(255,255,255,0.075)",
  border: "1px solid rgba(255,255,255,0.13)",
  boxShadow: "0 18px 50px rgba(0,0,0,0.28)",
};

const cardTopRow: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 16,
  alignItems: "flex-start",
};

const requestType: CSSProperties = {
  margin: 0,
  color: "#86efac",
  fontWeight: 900,
  fontSize: 13,
};

const requestTitle: CSSProperties = {
  margin: "5px 0 0",
  fontSize: 26,
};

const finalizedPill: CSSProperties = {
  padding: "8px 12px",
  borderRadius: 999,
  background: "rgba(34,197,94,0.18)",
  color: "#86efac",
  fontWeight: 900,
  whiteSpace: "nowrap",
};

const draftPill: CSSProperties = {
  ...finalizedPill,
  background: "rgba(251,191,36,0.16)",
  color: "#fde68a",
};

const summaryGrid: CSSProperties = {
  marginTop: 18,
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(155px, 1fr))",
  gap: 12,
};

const infoBlock: CSSProperties = {
  padding: 12,
  borderRadius: 16,
  background: "rgba(15,23,42,0.50)",
  border: "1px solid rgba(255,255,255,0.09)",
};

const infoLabel: CSSProperties = {
  display: "block",
  color: "rgba(248,250,252,0.58)",
  fontSize: 12,
  fontWeight: 800,
  marginBottom: 5,
};

const infoValue: CSSProperties = {
  color: "#f8fafc",
  fontSize: 14,
  lineHeight: 1.35,
};

const notePreview: CSSProperties = {
  marginTop: 16,
  padding: 14,
  borderRadius: 18,
  background: "rgba(255,255,255,0.055)",
  color: "rgba(248,250,252,0.76)",
  lineHeight: 1.55,
};

const detailsPanel: CSSProperties = {
  marginTop: 16,
  padding: 16,
  borderRadius: 22,
  background: "rgba(2,6,23,0.42)",
  border: "1px solid rgba(255,255,255,0.10)",
  display: "grid",
  gap: 14,
};

const detailSection: CSSProperties = {
  display: "grid",
  gap: 10,
};

const detailTitle: CSSProperties = {
  margin: 0,
  fontSize: 16,
};

const detailGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: 10,
};

const detailParagraph: CSSProperties = {
  margin: 0,
  color: "rgba(248,250,252,0.76)",
  lineHeight: 1.6,
};

const pillWrap: CSSProperties = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
  marginTop: 10,
};

const smallPill: CSSProperties = {
  padding: "7px 10px",
  borderRadius: 999,
  background: "rgba(34,197,94,0.14)",
  color: "#bbf7d0",
  fontWeight: 800,
  fontSize: 12,
};

const cardActions: CSSProperties = {
  marginTop: 18,
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
};

const ghostButton: CSSProperties = {
  padding: "11px 14px",
  borderRadius: 999,
  border: "1px solid rgba(255,255,255,0.16)",
  background: "rgba(255,255,255,0.07)",
  color: "#f8fafc",
  fontWeight: 900,
  cursor: "pointer",
};

const primarySmallButton: CSSProperties = {
  ...primaryButton,
  padding: "11px 14px",
  fontSize: 14,
};

const emptyCard: CSSProperties = {
  padding: 30,
  borderRadius: 24,
  background: "rgba(255,255,255,0.07)",
  border: "1px solid rgba(255,255,255,0.12)",
  textAlign: "center",
};

const emptyTitle: CSSProperties = {
  margin: "0 0 8px",
};

const mutedText: CSSProperties = {
  color: "rgba(248,250,252,0.72)",
  lineHeight: 1.6,
};

const loadingCard: CSSProperties = {
  maxWidth: 720,
  margin: "80px auto",
  padding: 30,
  borderRadius: 24,
  background: "rgba(255,255,255,0.08)",
  border: "1px solid rgba(255,255,255,0.14)",
  textAlign: "center",
  fontWeight: 900,
};

const lockedCard: CSSProperties = {
  maxWidth: 680,
  margin: "90px auto",
  padding: 34,
  borderRadius: 28,
  background: "rgba(255,255,255,0.08)",
  border: "1px solid rgba(255,255,255,0.14)",
  textAlign: "center",
};

const lockedTitle: CSSProperties = {
  margin: "8px 0",
  fontSize: 42,
};