"use client";

import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useCallback, useEffect, useMemo, useState } from "react";
import {
  DocumentData,
  QueryConstraint,
  QueryDocumentSnapshot,
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  startAfter,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import {
  COMMUNITY_CATEGORIES,
  REPORT_REASONS,
  categoryLabel,
  formatCommunityDate,
  safeAuthorName,
  wasEdited,
  type ReportReason,
} from "@/lib/community";
import styles from "./page.module.css";

const REPLY_PAGE_SIZE = 50;
const TITLE_MIN = 8;
const TITLE_MAX = 140;
const BODY_MIN = 20;
const BODY_MAX = 4000;
const REPLY_BODY_MIN = 2;
const REPLY_BODY_MAX = 2000;

type PostRecord = {
  id: string;
  authorId: string;
  authorDisplayName: string | null;
  title: string;
  body: string;
  category: string;
  region: string | null;
  rigType: string | null;
  status: string;
  createdAt: unknown;
  updatedAt: unknown;
};

type ReplyRecord = {
  id: string;
  authorId: string;
  authorDisplayName: string | null;
  body: string;
  status: string;
  createdAt: unknown;
  updatedAt: unknown;
};

type ReportTarget = { targetType: "post" | "reply"; replyId?: string } | null;

function renderMultiline(text: string) {
  return text.split("\n").map((line, i) => (
    <span key={i}>
      {line}
      {i < text.split("\n").length - 1 && <br />}
    </span>
  ));
}

export default function CommunityPostDetailPage() {
  return (
    <Suspense fallback={<main className={styles.page}><div className={styles.shell}>Loading...</div></main>}>
      <CommunityPostDetail />
    </Suspense>
  );
}

function CommunityPostDetail() {
  const params = useParams<{ id: string }>();
  const postId = params.id;
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();

  const [post, setPost] = useState<PostRecord | null>(null);
  const [postStatus, setPostStatus] = useState<"loading" | "ready" | "not-found" | "error">("loading");

  const [replies, setReplies] = useState<ReplyRecord[]>([]);
  const [repliesStatus, setRepliesStatus] = useState<"loading" | "ready" | "error">("loading");
  const [replyCursor, setReplyCursor] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [hasMoreReplies, setHasMoreReplies] = useState(false);
  const [loadingMoreReplies, setLoadingMoreReplies] = useState(false);

  const [replyBody, setReplyBody] = useState("");
  const [replySubmitting, setReplySubmitting] = useState(false);
  const [replyError, setReplyError] = useState("");

  const [editingPost, setEditingPost] = useState(false);
  const [editForm, setEditForm] = useState({ title: "", category: "", body: "", region: "", rigType: "" });
  const [postActionError, setPostActionError] = useState("");
  const [postActionBusy, setPostActionBusy] = useState(false);

  const [editingReplyId, setEditingReplyId] = useState<string | null>(null);
  const [editReplyBody, setEditReplyBody] = useState("");
  const [replyActionBusy, setReplyActionBusy] = useState(false);

  const [reportTarget, setReportTarget] = useState<ReportTarget>(null);
  const [reportReason, setReportReason] = useState<ReportReason>("spam");
  const [reportDetails, setReportDetails] = useState("");
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [reportedIds, setReportedIds] = useState<Set<string>>(new Set());

  const loadPost = useCallback(async () => {
    setPostStatus("loading");
    try {
      const snap = await getDoc(doc(db, "communityPosts", postId));
      if (!snap.exists()) {
        setPostStatus("not-found");
        return;
      }
      const data = snap.data();
      setPost({
        id: snap.id,
        authorId: data.authorId,
        authorDisplayName: data.authorDisplayName ?? null,
        title: data.title,
        body: data.body,
        category: data.category,
        region: data.region ?? null,
        rigType: data.rigType ?? null,
        status: data.status,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
      });
      setPostStatus("ready");
    } catch (err) {
      console.error("Community post load error:", err);
      setPostStatus("error");
    }
  }, [postId]);

  const loadReplies = useCallback(async (cursor: QueryDocumentSnapshot<DocumentData> | null) => {
    const constraints: QueryConstraint[] = [
      where("status", "==", "active"),
      orderBy("createdAt", "asc"),
    ];
    if (cursor) constraints.push(startAfter(cursor));
    constraints.push(limit(REPLY_PAGE_SIZE));

    const snap = await getDocs(query(collection(db, "communityPosts", postId, "replies"), ...constraints));
    const rows: ReplyRecord[] = snap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        authorId: data.authorId,
        authorDisplayName: data.authorDisplayName ?? null,
        body: data.body,
        status: data.status,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
      };
    });
    return { rows, lastVisible: snap.docs[snap.docs.length - 1] ?? null, count: snap.docs.length };
  }, [postId]);

  useEffect(() => {
    loadPost();
  }, [loadPost]);

  useEffect(() => {
    let cancelled = false;
    setRepliesStatus("loading");
    loadReplies(null)
      .then(({ rows, lastVisible, count }) => {
        if (cancelled) return;
        setReplies(rows);
        setReplyCursor(lastVisible);
        setHasMoreReplies(count === REPLY_PAGE_SIZE);
        setRepliesStatus("ready");
      })
      .catch((err) => {
        if (cancelled) return;
        console.error("Community replies load error:", err);
        setRepliesStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [loadReplies]);

  async function handleLoadMoreReplies() {
    if (!replyCursor || loadingMoreReplies) return;
    setLoadingMoreReplies(true);
    try {
      const { rows, lastVisible, count } = await loadReplies(replyCursor);
      setReplies((prev) => [...prev, ...rows]);
      setReplyCursor(lastVisible);
      setHasMoreReplies(count === REPLY_PAGE_SIZE);
    } finally {
      setLoadingMoreReplies(false);
    }
  }

  const isOwner = useMemo(() => !!(user && post && user.uid === post.authorId), [user, post]);

  // Deep link support: feed overflow menu can send ?edit=1 or ?report=1
  useEffect(() => {
    if (postStatus !== "ready" || !post) return;
    if (searchParams.get("edit") === "1" && isOwner && post.status === "active") {
      beginEditPost();
      router.replace(`/community/posts/${postId}`, { scroll: false });
    } else if (searchParams.get("report") === "1" && user && !isOwner) {
      openReport({ targetType: "post" });
      router.replace(`/community/posts/${postId}`, { scroll: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [postStatus, post, isOwner]);

  function beginEditPost() {
    if (!post) return;
    setEditForm({
      title: post.title,
      category: post.category,
      body: post.body,
      region: post.region ?? "",
      rigType: post.rigType ?? "",
    });
    setPostActionError("");
    setEditingPost(true);
  }

  async function handleSaveEditPost(event: FormEvent) {
    event.preventDefault();
    if (!post) return;

    const title = editForm.title.trim();
    const body = editForm.body.trim();
    const region = editForm.region.trim();
    const rigType = editForm.rigType.trim();

    if (title.length < TITLE_MIN || title.length > TITLE_MAX) {
      setPostActionError(`Title must be between ${TITLE_MIN} and ${TITLE_MAX} characters.`);
      return;
    }
    if (body.length < BODY_MIN || body.length > BODY_MAX) {
      setPostActionError(`Body must be between ${BODY_MIN} and ${BODY_MAX} characters.`);
      return;
    }

    setPostActionBusy(true);
    setPostActionError("");
    try {
      await updateDoc(doc(db, "communityPosts", post.id), {
        title,
        body,
        category: editForm.category,
        region: region || null,
        rigType: rigType || null,
        updatedAt: serverTimestamp(),
      });
      setEditingPost(false);
      await loadPost();
    } catch (err) {
      console.error("Community post edit error:", err);
      setPostActionError("Could not save changes right now. Please try again.");
    } finally {
      setPostActionBusy(false);
    }
  }

  async function handleDeletePost() {
    if (!post) return;
    if (!window.confirm("Remove this discussion? This cannot be undone.")) return;
    setPostActionBusy(true);
    setPostActionError("");
    try {
      await updateDoc(doc(db, "communityPosts", post.id), {
        status: "removed",
        updatedAt: serverTimestamp(),
      });
      await loadPost();
    } catch (err) {
      console.error("Community post delete error:", err);
      setPostActionError("Could not remove this discussion right now. Please try again.");
    } finally {
      setPostActionBusy(false);
    }
  }

  async function handleSubmitReply(event: FormEvent) {
    event.preventDefault();
    setReplyError("");

    const body = replyBody.trim();
    if (body.length < REPLY_BODY_MIN || body.length > REPLY_BODY_MAX) {
      setReplyError(`Reply must be between ${REPLY_BODY_MIN} and ${REPLY_BODY_MAX} characters.`);
      return;
    }
    if (!user || !post) return;

    setReplySubmitting(true);
    try {
      const userSnap = await getDoc(doc(db, "users", user.uid));
      const rawName = userSnap.exists() ? (userSnap.data().displayName as string | undefined) : undefined;
      const authorDisplayName = rawName && rawName.trim().length > 0 ? rawName : null;

      const now = serverTimestamp();
      await addDoc(collection(db, "communityPosts", post.id, "replies"), {
        authorId: user.uid,
        authorDisplayName,
        body,
        status: "active",
        createdAt: now,
        updatedAt: now,
      });

      setReplyBody("");
      const { rows, lastVisible, count } = await loadReplies(null);
      setReplies(rows);
      setReplyCursor(lastVisible);
      setHasMoreReplies(count === REPLY_PAGE_SIZE);
    } catch (err) {
      console.error("Community reply submission error:", err);
      setReplyError("Could not post your reply right now. Please try again.");
    } finally {
      setReplySubmitting(false);
    }
  }

  function beginEditReply(reply: ReplyRecord) {
    setEditingReplyId(reply.id);
    setEditReplyBody(reply.body);
  }

  async function handleSaveEditReply(replyId: string) {
    const body = editReplyBody.trim();
    if (body.length < REPLY_BODY_MIN || body.length > REPLY_BODY_MAX) {
      return;
    }
    setReplyActionBusy(true);
    try {
      await updateDoc(doc(db, "communityPosts", postId, "replies", replyId), {
        body,
        updatedAt: serverTimestamp(),
      });
      setReplies((prev) => prev.map((r) => (r.id === replyId ? { ...r, body, updatedAt: new Date() } : r)));
      setEditingReplyId(null);
    } catch (err) {
      console.error("Community reply edit error:", err);
    } finally {
      setReplyActionBusy(false);
    }
  }

  async function handleDeleteReply(replyId: string) {
    if (!window.confirm("Remove this reply? This cannot be undone.")) return;
    setReplyActionBusy(true);
    try {
      await updateDoc(doc(db, "communityPosts", postId, "replies", replyId), {
        status: "removed",
        updatedAt: serverTimestamp(),
      });
      setReplies((prev) => prev.filter((r) => r.id !== replyId));
    } catch (err) {
      console.error("Community reply delete error:", err);
    } finally {
      setReplyActionBusy(false);
    }
  }

  function openReport(target: ReportTarget) {
    setReportTarget(target);
    setReportReason("spam");
    setReportDetails("");
  }

  async function handleSubmitReport(event: FormEvent) {
    event.preventDefault();
    if (!user || !reportTarget || reportSubmitting) return;

    setReportSubmitting(true);
    try {
      await addDoc(collection(db, "communityReports"), {
        reporterId: user.uid,
        targetType: reportTarget.targetType,
        postId,
        replyId: reportTarget.replyId ?? null,
        reason: reportReason,
        details: reportDetails.trim() || null,
        createdAt: serverTimestamp(),
        status: "open",
      });
      const key = reportTarget.targetType === "post" ? `post:${postId}` : `reply:${reportTarget.replyId}`;
      setReportedIds((prev) => new Set(prev).add(key));
      setReportTarget(null);
    } catch (err) {
      console.error("Community report submission error:", err);
    } finally {
      setReportSubmitting(false);
    }
  }

  if (postStatus === "loading") {
    return (
      <main className={styles.page}>
        <div className={styles.shell}>
          <div className={styles.feedState}>Loading discussion...</div>
        </div>
      </main>
    );
  }

  if (postStatus === "not-found" || postStatus === "error") {
    return (
      <main className={styles.page}>
        <div className={styles.shell}>
          <nav className={styles.topNav}>
            <Link href="/community" className={styles.backLink}>← Back to Community</Link>
          </nav>
          <div className={styles.feedState} role="alert">
            {postStatus === "not-found"
              ? "This discussion could not be found, or it is no longer available."
              : "Could not load this discussion right now. Please try again."}
          </div>
        </div>
      </main>
    );
  }

  if (!post) return null;

  const postRemoved = post.status !== "active";
  const postReportKey = `post:${post.id}`;

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <nav className={styles.topNav}>
          <Link href="/community" className={styles.backLink}>← Back to Community</Link>
        </nav>

        {postRemoved && !isOwner ? (
          <div className={styles.feedState} role="alert">
            This discussion has been removed.
          </div>
        ) : (
          <>
            <article className={styles.postDetail}>
              {postRemoved && (
                <p className={styles.removedNote}>This discussion has been removed and is only visible to you.</p>
              )}

              {editingPost ? (
                <form className={styles.editForm} onSubmit={handleSaveEditPost}>
                  <label className={styles.field}>
                    <span>Title</span>
                    <input
                      type="text"
                      value={editForm.title}
                      onChange={(e) => setEditForm((f) => ({ ...f, title: e.target.value }))}
                      maxLength={TITLE_MAX}
                    />
                  </label>
                  <label className={styles.field}>
                    <span>Category</span>
                    <select
                      value={editForm.category}
                      onChange={(e) => setEditForm((f) => ({ ...f, category: e.target.value }))}
                    >
                      {COMMUNITY_CATEGORIES.map((c) => (
                        <option key={c.id} value={c.id}>{c.label}</option>
                      ))}
                    </select>
                  </label>
                  <label className={styles.field}>
                    <span>Broad region (optional)</span>
                    <input
                      type="text"
                      value={editForm.region}
                      onChange={(e) => setEditForm((f) => ({ ...f, region: e.target.value }))}
                      maxLength={100}
                    />
                  </label>
                  <label className={styles.field}>
                    <span>RV or rig type (optional)</span>
                    <input
                      type="text"
                      value={editForm.rigType}
                      onChange={(e) => setEditForm((f) => ({ ...f, rigType: e.target.value }))}
                      maxLength={60}
                    />
                  </label>
                  <label className={styles.field}>
                    <span>Body</span>
                    <textarea
                      value={editForm.body}
                      onChange={(e) => setEditForm((f) => ({ ...f, body: e.target.value }))}
                      rows={8}
                      maxLength={BODY_MAX}
                    />
                  </label>
                  {postActionError && <p className={styles.errorMessage} role="alert">{postActionError}</p>}
                  <div className={styles.editActions}>
                    <button type="submit" className={styles.primaryButton} disabled={postActionBusy}>
                      {postActionBusy ? "Saving..." : "Save changes"}
                    </button>
                    <button
                      type="button"
                      className={styles.secondaryButton}
                      onClick={() => setEditingPost(false)}
                      disabled={postActionBusy}
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
                <>
                  <div className={styles.postDetailHeader}>
                    <span className={styles.postCategory}>{categoryLabel(post.category)}</span>
                    <span className={styles.postDate}>
                      {formatCommunityDate(post.createdAt)}
                      {wasEdited(post.createdAt, post.updatedAt) ? " · Edited" : ""}
                    </span>
                  </div>
                  <h1 className={styles.postDetailTitle}>{post.title}</h1>
                  <div className={styles.postMeta}>
                    <span>{safeAuthorName(post.authorDisplayName)}</span>
                    {post.region && <span>{post.region}</span>}
                    {post.rigType && <span>{post.rigType}</span>}
                  </div>
                  <p className={styles.postDetailBody}>{renderMultiline(post.body)}</p>

                  <div className={styles.postActionsRow}>
                    {isOwner && !postRemoved && (
                      <>
                        <button type="button" className={styles.linkButton} onClick={beginEditPost}>
                          Edit
                        </button>
                        <button
                          type="button"
                          className={styles.linkButton}
                          onClick={handleDeletePost}
                          disabled={postActionBusy}
                        >
                          Delete
                        </button>
                      </>
                    )}
                    {user && !isOwner && (
                      <button
                        type="button"
                        className={styles.linkButton}
                        onClick={() => openReport({ targetType: "post" })}
                        disabled={reportedIds.has(postReportKey)}
                      >
                        {reportedIds.has(postReportKey) ? "Reported" : "Report"}
                      </button>
                    )}
                  </div>
                  {postActionError && <p className={styles.errorMessage} role="alert">{postActionError}</p>}
                </>
              )}
            </article>

            {/* REPLIES */}
            <section className={styles.repliesSection} aria-labelledby="replies-heading">
              <h2 id="replies-heading">Replies</h2>

              {repliesStatus === "loading" && <div className={styles.feedState}>Loading replies...</div>}
              {repliesStatus === "error" && (
                <div className={styles.feedState} role="alert">Could not load replies right now.</div>
              )}
              {repliesStatus === "ready" && replies.length === 0 && (
                <p className={styles.noReplies}>No replies yet. Be the first to respond.</p>
              )}

              {repliesStatus === "ready" && replies.length > 0 && (
                <ul className={styles.replyList}>
                  {replies.map((reply) => {
                    const replyReportKey = `reply:${reply.id}`;
                    const isReplyOwner = !!(user && user.uid === reply.authorId);
                    return (
                      <li key={reply.id} className={styles.replyCard}>
                        {editingReplyId === reply.id ? (
                          <div className={styles.editForm}>
                            <textarea
                              value={editReplyBody}
                              onChange={(e) => setEditReplyBody(e.target.value)}
                              rows={4}
                              maxLength={REPLY_BODY_MAX}
                            />
                            <div className={styles.editActions}>
                              <button
                                type="button"
                                className={styles.primaryButton}
                                onClick={() => handleSaveEditReply(reply.id)}
                                disabled={replyActionBusy}
                              >
                                Save
                              </button>
                              <button
                                type="button"
                                className={styles.secondaryButton}
                                onClick={() => setEditingReplyId(null)}
                                disabled={replyActionBusy}
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className={styles.replyHeader}>
                              <span className={styles.replyAuthor}>{safeAuthorName(reply.authorDisplayName)}</span>
                              <span className={styles.postDate}>
                                {formatCommunityDate(reply.createdAt)}
                                {wasEdited(reply.createdAt, reply.updatedAt) ? " · Edited" : ""}
                              </span>
                            </div>
                            <p className={styles.replyBody}>{renderMultiline(reply.body)}</p>
                            <div className={styles.postActionsRow}>
                              {isReplyOwner && (
                                <>
                                  <button type="button" className={styles.linkButton} onClick={() => beginEditReply(reply)}>
                                    Edit
                                  </button>
                                  <button
                                    type="button"
                                    className={styles.linkButton}
                                    onClick={() => handleDeleteReply(reply.id)}
                                    disabled={replyActionBusy}
                                  >
                                    Delete
                                  </button>
                                </>
                              )}
                              {user && !isReplyOwner && (
                                <button
                                  type="button"
                                  className={styles.linkButton}
                                  onClick={() => openReport({ targetType: "reply", replyId: reply.id })}
                                  disabled={reportedIds.has(replyReportKey)}
                                >
                                  {reportedIds.has(replyReportKey) ? "Reported" : "Report"}
                                </button>
                              )}
                            </div>
                          </>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}

              {hasMoreReplies && (
                <div className={styles.loadMoreRow}>
                  <button
                    type="button"
                    className={styles.secondaryButton}
                    onClick={handleLoadMoreReplies}
                    disabled={loadingMoreReplies}
                  >
                    {loadingMoreReplies ? "Loading..." : "Load more replies"}
                  </button>
                </div>
              )}

              {/* REPLY FORM */}
              {!postRemoved && (
                user ? (
                  <form className={styles.replyForm} onSubmit={handleSubmitReply}>
                    <label className={styles.field}>
                      <span>Add a reply</span>
                      <textarea
                        value={replyBody}
                        onChange={(e) => setReplyBody(e.target.value)}
                        rows={4}
                        maxLength={REPLY_BODY_MAX}
                        placeholder="Share your experience or answer..."
                      />
                    </label>
                    {replyError && <p className={styles.errorMessage} role="alert">{replyError}</p>}
                    <div className={styles.formActions}>
                      <button type="submit" className={styles.primaryButton} disabled={replySubmitting}>
                        {replySubmitting ? "Posting..." : "Post Reply"}
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className={styles.signInPrompt}>
                    <p>Sign in to reply to this discussion.</p>
                    <button
                      type="button"
                      className={styles.secondaryButton}
                      onClick={() => router.push(`/login?next=${encodeURIComponent(`/community/posts/${postId}`)}`)}
                    >
                      Sign In to Participate
                    </button>
                  </div>
                )
              )}
            </section>
          </>
        )}
      </div>

      {/* REPORT MODAL */}
      {reportTarget && (
        <div className={styles.modalOverlay} role="dialog" aria-modal="true" aria-labelledby="report-heading">
          <form className={styles.modalCard} onSubmit={handleSubmitReport}>
            <h2 id="report-heading">Report this {reportTarget.targetType === "post" ? "discussion" : "reply"}</h2>
            <p className={styles.modalNote}>
              Your report is submitted privately for review. It does not publicly identify you, and it does not
              automatically label this content as unsafe.
            </p>
            <label className={styles.field}>
              <span>Reason</span>
              <select value={reportReason} onChange={(e) => setReportReason(e.target.value as ReportReason)}>
                {REPORT_REASONS.map((r) => (
                  <option key={r.id} value={r.id}>{r.label}</option>
                ))}
              </select>
            </label>
            <label className={styles.field}>
              <span>Additional details (optional)</span>
              <textarea
                value={reportDetails}
                onChange={(e) => setReportDetails(e.target.value)}
                rows={3}
                maxLength={500}
              />
            </label>
            <div className={styles.editActions}>
              <button type="submit" className={styles.primaryButton} disabled={reportSubmitting}>
                {reportSubmitting ? "Submitting..." : "Submit report"}
              </button>
              <button
                type="button"
                className={styles.secondaryButton}
                onClick={() => setReportTarget(null)}
                disabled={reportSubmitting}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}
    </main>
  );
}
