"use client";

import { useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  formatDateTime,
  normalizeOwnerCommunityReport,
  normalizeOwnerReportedPost,
  normalizeOwnerReportedReply,
  normalizeOwnerReportedReview,
  normalizeOwnerReviewReport,
  normalizeOwnerUser,
  type OwnerCommunityReport,
  type OwnerReportedContent,
  type OwnerReviewReport,
  type OwnerUser,
} from "@/lib/owner-dashboard";
import { useOwnerSection } from "../use-owner-section";
import SectionShell from "./SectionShell";
import LoadMore from "./LoadMore";
import styles from "../owner.module.css";

type ReportDetailState = {
  key: string;
  loading: boolean;
  error: string;
  reporter: OwnerUser | null;
  content: OwnerReportedContent | null;
  contentFound: boolean;
};

function useReportDetail(
  key: string,
  load: () => Promise<{ reporter: OwnerUser | null; content: OwnerReportedContent | null; contentFound: boolean }>
) {
  const [state, setState] = useState<ReportDetailState>({
    key: "", loading: true, error: "", reporter: null, content: null, contentFound: false,
  });

  useEffect(() => {
    let active = true;
    load()
      .then((result) => {
        if (active) setState({ key, loading: false, error: "", ...result });
      })
      .catch((error: unknown) => {
        console.error("[RVNB] Owner report detail failed", error);
        if (active) setState({ key, loading: false, error: "Couldn't load report details.", reporter: null, content: null, contentFound: false });
      });
    return () => { active = false; };
    // load is stable per report id by construction below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return state.key === key ? state : { ...state, key, loading: true, error: "" };
}

async function loadUser(uid: string): Promise<OwnerUser | null> {
  if (!uid) return null;
  const snapshot = await getDoc(doc(db, "users", uid));
  return snapshot.exists() ? normalizeOwnerUser(snapshot.id, snapshot.data()) : null;
}

function CommunityReportDetail({ report }: { report: OwnerCommunityReport }) {
  const state = useReportDetail(report.id, async () => {
    const targetRef = report.targetType === "reply" && report.replyId
      ? doc(db, "communityPosts", report.postId, "replies", report.replyId)
      : doc(db, "communityPosts", report.postId);
    const [reporter, targetSnap] = await Promise.all([loadUser(report.reporterId), getDoc(targetRef)]);
    return {
      reporter,
      content: targetSnap.exists()
        ? (report.targetType === "reply" && report.replyId
          ? normalizeOwnerReportedReply(targetSnap.data())
          : normalizeOwnerReportedPost(targetSnap.data()))
        : null,
      contentFound: targetSnap.exists(),
    };
  });

  if (state.loading) return <div className={styles.detail} role="status">Loading details…</div>;
  if (state.error) return <div className={styles.detail} role="alert">{state.error}</div>;
  return (
    <div className={styles.detail}>
      <dl>
        <dt>Reporter</dt>
        <dd>{state.reporter ? `${state.reporter.displayName} · ${state.reporter.email}` : report.reporterId || "Unknown"}</dd>
        {report.details ? (
          <>
            <dt>Report details</dt>
            <dd>{report.details}</dd>
          </>
        ) : null}
        <dt>Reported {report.targetType}</dt>
        <dd>
          {state.contentFound && state.content ? (
            <>
              <strong>{state.content.title}</strong> — {state.content.author} · status {state.content.status}
              <br />
              {state.content.body || "No content body."}
            </>
          ) : (
            "The reported content could not be loaded (it may have been removed)."
          )}
        </dd>
      </dl>
    </div>
  );
}

function ReviewReportDetail({ report }: { report: OwnerReviewReport }) {
  const state = useReportDetail(report.id, async () => {
    const [reporter, reviewSnap] = await Promise.all([
      loadUser(report.reporterId),
      getDoc(doc(db, "reviews", report.reviewId)),
    ]);
    return {
      reporter,
      content: reviewSnap.exists() ? normalizeOwnerReportedReview(reviewSnap.data()) : null,
      contentFound: reviewSnap.exists(),
    };
  });

  if (state.loading) return <div className={styles.detail} role="status">Loading details…</div>;
  if (state.error) return <div className={styles.detail} role="alert">{state.error}</div>;
  return (
    <div className={styles.detail}>
      <dl>
        <dt>Reporter</dt>
        <dd>{state.reporter ? `${state.reporter.displayName} · ${state.reporter.email}` : report.reporterId || "Unknown"}</dd>
        {report.details ? (
          <>
            <dt>Report details</dt>
            <dd>{report.details}</dd>
          </>
        ) : null}
        <dt>Reported review</dt>
        <dd>
          {state.contentFound && state.content ? (
            <>
              <strong>{state.content.title}</strong> — {state.content.author} · status {state.content.status}
              <br />
              {state.content.body || "No comment."}
            </>
          ) : (
            "The reported review could not be loaded."
          )}
        </dd>
      </dl>
    </div>
  );
}

function CommunityReports({ uid }: { uid: string }) {
  const section = useOwnerSection(uid, "communityReports", normalizeOwnerCommunityReport);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <SectionShell
      title="Community reports"
      hint="Member-submitted moderation reports. Expand a report to see the reporter and the reported content. Reports are read-only here."
      total={section.total}
      shown={section.items.length}
      missingTimestamp={section.missingTimestamp}
      loading={section.loading}
      error={section.error}
      emptyText="No community reports. Nothing needs review."
      onRetry={section.retry}
      footer={<LoadMore loadingMore={section.loadingMore} endReached={section.endReached} onLoadMore={section.loadMore} />}
    >
      <ul className={styles.list}>
        {section.items.map((report) => {
          const expanded = expandedId === report.id;
          return (
            <li className={styles.row} key={report.id}>
              <button
                type="button"
                className={styles.rowToggle}
                onClick={() => setExpandedId(expanded ? null : report.id)}
                aria-expanded={expanded}
                aria-controls={`owner-community-report-${report.id}`}
              >
                <div className={styles.rowMain}>
                  <span className={styles.rowTitle}>{report.reason} — {report.targetType}</span>
                  <span className={`${styles.badge} ${report.status === "open" ? styles.badgeWarn : styles.badgeMuted}`}>
                    {report.status}
                  </span>
                </div>
                <div className={styles.rowMeta}>
                  Post {report.postId || "unknown"}{report.replyId ? ` · Reply ${report.replyId}` : ""} · {formatDateTime(report.createdAt)}
                </div>
              </button>
              {expanded && (
                <div id={`owner-community-report-${report.id}`}>
                  <CommunityReportDetail report={report} />
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </SectionShell>
  );
}

function ReviewReports({ uid }: { uid: string }) {
  const section = useOwnerSection(uid, "reviewReports", normalizeOwnerReviewReport);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <SectionShell
      title="Review reports"
      hint="Reports filed against published reviews. Expand to see the reporter and the review content. Reports are read-only here."
      total={section.total}
      shown={section.items.length}
      missingTimestamp={section.missingTimestamp}
      loading={section.loading}
      error={section.error}
      emptyText="No review reports. Nothing needs review."
      onRetry={section.retry}
      footer={<LoadMore loadingMore={section.loadingMore} endReached={section.endReached} onLoadMore={section.loadMore} />}
    >
      <ul className={styles.list}>
        {section.items.map((report) => {
          const expanded = expandedId === report.id;
          return (
            <li className={styles.row} key={report.id}>
              <button
                type="button"
                className={styles.rowToggle}
                onClick={() => setExpandedId(expanded ? null : report.id)}
                aria-expanded={expanded}
                aria-controls={`owner-review-report-${report.id}`}
              >
                <div className={styles.rowMain}>
                  <span className={styles.rowTitle}>{report.reason} — review {report.reviewId || "unknown"}</span>
                  <span className={`${styles.badge} ${report.status === "open" ? styles.badgeWarn : styles.badgeMuted}`}>
                    {report.status}
                  </span>
                </div>
                <div className={styles.rowMeta}>{formatDateTime(report.createdAt)}</div>
              </button>
              {expanded && (
                <div id={`owner-review-report-${report.id}`}>
                  <ReviewReportDetail report={report} />
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </SectionShell>
  );
}

export default function ModerationSection({ uid }: { uid: string }) {
  return (
    <>
      <CommunityReports uid={uid} />
      <ReviewReports uid={uid} />
    </>
  );
}
