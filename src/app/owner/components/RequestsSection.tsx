"use client";

import { useEffect, useState } from "react";
import { collection, doc, getDoc, getDocs, limit, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  formatDateTime,
  normalizeOwnerOpportunity,
  normalizeOwnerRequest,
  normalizeOwnerRequestPrivate,
  type OwnerOpportunity,
  type OwnerRequest,
  type OwnerRequestPrivate,
} from "@/lib/owner-dashboard";
import { useOwnerSection } from "../use-owner-section";
import SectionShell from "./SectionShell";
import LoadMore from "./LoadMore";
import styles from "../owner.module.css";

type DetailState = {
  key: string;
  loading: boolean;
  error: string;
  contact: OwnerRequestPrivate | null;
  contactFound: boolean;
  responses: OwnerOpportunity[];
};

function RequestDetail({ requestId }: { requestId: string }) {
  const [state, setState] = useState<DetailState>({
    key: "", loading: true, error: "", contact: null, contactFound: false, responses: [],
  });

  useEffect(() => {
    let active = true;
    Promise.all([
      getDoc(doc(db, "spotRequestPrivate", requestId)),
      getDocs(query(collection(db, "hostOpportunities"), where("requestId", "==", requestId), limit(20))),
    ])
      .then(([privateSnap, responsesSnap]) => {
        if (!active) return;
        setState({
          key: requestId,
          loading: false,
          error: "",
          contact: privateSnap.exists() ? normalizeOwnerRequestPrivate(privateSnap.data()) : null,
          contactFound: privateSnap.exists(),
          responses: responsesSnap.docs
            .map((item) => normalizeOwnerOpportunity(item.id, item.data()))
            .sort((a, b) => b.createdAt - a.createdAt),
        });
      })
      .catch((error: unknown) => {
        console.error("[RVNB] Owner request detail failed", error);
        if (active) {
          setState({ key: requestId, loading: false, error: "Couldn't load request details.", contact: null, contactFound: false, responses: [] });
        }
      });
    return () => { active = false; };
  }, [requestId]);

  if (state.key !== requestId || state.loading) {
    return <div className={styles.detail} role="status">Loading details…</div>;
  }
  if (state.error) {
    return <div className={styles.detail} role="alert">{state.error}</div>;
  }
  return (
    <div className={styles.detail}>
      <dl>
        <dt>Requester contact</dt>
        <dd>
          {state.contactFound && state.contact
            ? `${state.contact.contactName} · ${state.contact.contactEmail}`
            : "No private contact record stored for this request."}
        </dd>
        {state.contact?.finalNotes ? (
          <>
            <dt>Requester notes</dt>
            <dd>{state.contact.finalNotes}</dd>
          </>
        ) : null}
      </dl>
      <strong>Host responses ({state.responses.length}{state.responses.length === 20 ? "+" : ""})</strong>
      {state.responses.length === 0 ? (
        <p className={styles.rowMeta}>No host responses linked to this request.</p>
      ) : (
        <ul className={styles.subList}>
          {state.responses.map((response) => (
            <li key={response.id}>
              {response.name || "Host"} · {response.location}
              {response.summary ? ` · ${response.summary}` : ""} · {formatDateTime(response.createdAt)}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function statusBadge(status: OwnerRequest["status"]) {
  if (status === "draft") return <span className={`${styles.badge} ${styles.badgeMuted}`}>Draft — not visible to hosts</span>;
  if (status === "open") return <span className={styles.badge}>Open</span>;
  if (status === "closed") return <span className={`${styles.badge} ${styles.badgeMuted}`}>Closed</span>;
  return <span className={`${styles.badge} ${styles.badgeWarn}`}>Status unknown</span>;
}

export default function RequestsSection({ uid }: { uid: string }) {
  const section = useOwnerSection(uid, "spotRequests", normalizeOwnerRequest);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <SectionShell
      title="Traveler requests"
      hint="All traveler spot requests, including drafts. Drafts are private to the requester and are never shown to hosts. Expand a request for requester contact details and linked host responses."
      total={section.total}
      shown={section.items.length}
      missingTimestamp={section.missingTimestamp}
      loading={section.loading}
      error={section.error}
      emptyText="No traveler requests stored yet."
      onRetry={section.retry}
      footer={<LoadMore loadingMore={section.loadingMore} endReached={section.endReached} onLoadMore={section.loadMore} />}
    >
      <ul className={styles.list}>
        {section.items.map((request) => {
          const expanded = expandedId === request.id;
          return (
            <li className={styles.row} key={request.id}>
              <button
                type="button"
                className={styles.rowToggle}
                onClick={() => setExpandedId(expanded ? null : request.id)}
                aria-expanded={expanded}
                aria-controls={`owner-request-detail-${request.id}`}
              >
                <div className={styles.rowMain}>
                  <span className={styles.rowTitle}>{request.title} — {request.location}</span>
                  {statusBadge(request.status)}
                </div>
                <div className={styles.rowMeta}>
                  {request.dates} · {request.rigSummary} · Requester {request.requesterId || "unknown"} · Created {formatDateTime(request.createdAt)}
                </div>
              </button>
              {expanded && (
                <div id={`owner-request-detail-${request.id}`}>
                  <RequestDetail requestId={request.id} />
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </SectionShell>
  );
}
