"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  DocumentData,
  OrderByDirection,
  QueryConstraint,
  QueryDocumentSnapshot,
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  startAfter,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import { COMMUNITY_CATEGORIES } from "@/lib/community";
import CommunityHeader from "./components/CommunityHeader";
import CommunitySidebar from "./components/CommunitySidebar";
import DiscussionCard, { type DiscussionCardData } from "./components/DiscussionCard";
import PinnedGuideCard from "./components/PinnedGuideCard";
import styles from "./page.module.css";

const PAGE_SIZE = 18;

type FeedStatus = "loading" | "ready" | "error" | "permission-error";

type SortOrder = "newest" | "oldest";

export default function CommunityPage() {
  const router = useRouter();
  const { user } = useAuth();
  const boardRef = useRef<HTMLDivElement | null>(null);

  const [category, setCategory] = useState<string>("all");
  const [sortOrder, setSortOrder] = useState<SortOrder>("newest");
  const [searchTerm, setSearchTerm] = useState("");
  const [posts, setPosts] = useState<DiscussionCardData[]>([]);
  const [status, setStatus] = useState<FeedStatus>("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [lastDoc, setLastDoc] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [retry, setRetry] = useState(0);
  const [moreError, setMoreError] = useState("");
  const revision = useRef(0);
  const moreLock = useRef<number | null>(null);

  const loadPosts = useCallback(
    async (
      targetCategory: string,
      direction: OrderByDirection,
      cursor: QueryDocumentSnapshot<DocumentData> | null
    ) => {
      const constraints: QueryConstraint[] = [where("status", "==", "active")];
      if (targetCategory !== "all") {
        constraints.push(where("category", "==", targetCategory));
      }
      constraints.push(orderBy("createdAt", direction));
      if (cursor) constraints.push(startAfter(cursor));
      constraints.push(limit(PAGE_SIZE));

      const snap = await getDocs(query(collection(db, "communityPosts"), ...constraints));
      const rows: DiscussionCardData[] = snap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          authorId: data.authorId,
          authorDisplayName: data.authorDisplayName ?? null,
          title: data.title,
          body: data.body,
          category: data.category,
          region: data.region ?? null,
          rigType: data.rigType ?? null,
          createdAt: data.createdAt,
          updatedAt: data.updatedAt,
        };
      });
      return { rows, lastVisible: snap.docs[snap.docs.length - 1] ?? null, count: snap.docs.length };
    },
    []
  );

  useEffect(() => {
    let cancelled = false;
    const current = ++revision.current;
    setStatus("loading");
    setErrorMessage("");
    setPosts([]);
    setLastDoc(null);
    setHasMore(true);
    setLoadingMore(false);
    setMoreError("");
    moreLock.current = null;

    const direction: OrderByDirection = sortOrder === "newest" ? "desc" : "asc";

    loadPosts(category, direction, null)
      .then(({ rows, lastVisible, count }) => {
        if (cancelled || current !== revision.current) return;
        setPosts(rows);
        setLastDoc(lastVisible);
        setHasMore(count === PAGE_SIZE);
        setStatus("ready");
      })
      .catch((err) => {
        if (cancelled || current !== revision.current) return;
        console.error("Community feed load error:", err);
        if (err && typeof err === "object" && "code" in err && err.code === "permission-denied") {
          setStatus("permission-error");
        } else {
          setErrorMessage("Could not load discussions right now. Please try again.");
          setStatus("error");
        }
      });

    return () => {
      cancelled = true;
      revision.current = current + 1;
    };
  }, [category, sortOrder, loadPosts, retry]);

  async function handleLoadMore() {
    if (!lastDoc || loadingMore || moreLock.current !== null) return;
    const current = revision.current;
    moreLock.current = current;
    setLoadingMore(true);
    setMoreError("");
    try {
      const direction: OrderByDirection = sortOrder === "newest" ? "desc" : "asc";
      const { rows, lastVisible, count } = await loadPosts(category, direction, lastDoc);
      if (current !== revision.current) return;
      setPosts((prev) => [...prev, ...rows]);
      setLastDoc(lastVisible);
      setHasMore(count === PAGE_SIZE);
    } catch (err) {
      console.error("Community feed load-more error:", err);
      if (current === revision.current) setMoreError("Could not load more discussions. Your loaded discussions are still available. Try loading more again.");
    } finally {
      if (current === revision.current) {
        moreLock.current = null;
        setLoadingMore(false);
      }
    }
  }

  const visiblePosts = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return posts;
    return posts.filter(
      (p) => p.title.toLowerCase().includes(term) || p.body.toLowerCase().includes(term)
    );
  }, [posts, searchTerm]);

  function scrollToBoard() {
    boardRef.current?.scrollIntoView({ block: "start" });
  }

  function handleStartDiscussion() {
    router.push("/community/new");
  }

  function handleSignIn() {
    router.push(`/login?next=${encodeURIComponent("/community")}`);
  }

  function selectCategory(id: string) {
    if (id !== category) revision.current++;
    setCategory(id);
    scrollToBoard();
  }

  return (
    <main className={styles.page}>
      <CommunityHeader />

      <div className={styles.shell}>
        {/* HERO */}
        <header className={styles.hero}>
          <div className={styles.heroGlow} aria-hidden="true" />
          <div className={styles.heroInner}>
            <div className={styles.badge}>
              <span className={styles.badgeDot} aria-hidden="true" />
              <span>RVNB COMMUNITY</span>
            </div>
            <h1>The road is better when knowledge travels.</h1>
            <p className={styles.heroLead}>
              Connect with RV travelers and hosts, explore practical road knowledge, and help others make
              better decisions wherever the journey leads.
            </p>
            <div className={styles.heroActions}>
              {user ? (
                <button type="button" className={styles.primaryButton} onClick={handleStartDiscussion}>
                  Start a discussion →
                </button>
              ) : (
                <button type="button" className={styles.primaryButton} onClick={handleSignIn}>
                  Sign in to participate →
                </button>
              )}
            </div>
          </div>
        </header>

        <div className={styles.layout}>
          <div className={styles.mainCol}>
            {/* BOARD CONTROLS */}
            <section ref={boardRef} className={styles.boardSection} aria-labelledby="board-heading" aria-busy={status === "loading" || loadingMore}>
              <div className={styles.boardHeader}>
                <h2 id="board-heading">Recent discussions</h2>
                <label className={styles.sortField}>
                  <span className={styles.srOnly}>Sort discussions</span>
                  <select
                    value={sortOrder}
                    onChange={(e) => { revision.current++; setSortOrder(e.target.value as SortOrder); }}
                  >
                    <option value="newest">Newest first</option>
                    <option value="oldest">Oldest first</option>
                  </select>
                </label>
              </div>

              <details className={styles.topicPicker}>
              <summary>Browse topics <span>{category === "all" ? "All discussions" : COMMUNITY_CATEGORIES.find(c => c.id === category)?.label}</span></summary>
              <div className={styles.chipRow} role="group" aria-label="Filter by category">
                <button
                  type="button"
                  className={`${styles.chip} ${category === "all" ? styles.chipActive : ""}`}
                  aria-pressed={category === "all"}
                  onClick={() => selectCategory("all")}
                >
                  All
                </button>
                {COMMUNITY_CATEGORIES.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    className={`${styles.chip} ${category === c.id ? styles.chipActive : ""}`}
                    aria-pressed={category === c.id}
                    onClick={() => selectCategory(c.id)}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
              </details>

              <label className={styles.searchField}>
                <span>Search loaded discussions</span>
                <input
                  type="search"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search titles and text in loaded discussions..."
                />
              </label>

              {searchTerm.trim() && (
                <p className={styles.searchNote}>
                  Searching only the {posts.length} discussion{posts.length === 1 ? "" : "s"} currently
                  loaded — not the entire board.
                </p>
              )}

              {/* FEED STATES */}
              {status === "loading" && (
                <div className={styles.feedState} aria-live="polite">
                  Loading discussions...
                </div>
              )}

              {status === "error" && (
                <div className={styles.feedState} role="alert">
                  {errorMessage}
                  <button type="button" className={styles.secondaryButton} onClick={() => setRetry(value => value + 1)}>Retry discussions</button>
                </div>
              )}

              {status === "permission-error" && (
                <div className={styles.feedState} role="alert">
                  You don&apos;t have permission to view discussions right now. Try signing in, or reload
                  the page.
                  <button type="button" className={styles.secondaryButton} onClick={() => setRetry(value => value + 1)}>Retry discussions</button>
                  {!user && <button type="button" className={styles.secondaryButton} onClick={handleSignIn}>Sign in</button>}
                </div>
              )}

              {status === "ready" && visiblePosts.length === 0 && posts.length === 0 && category === "all" && !searchTerm.trim() && (
                <div className={styles.emptyState}>
                  <h3>No discussions yet.</h3>
                  <p>There are no discussions to show. Share a question or experience to start the conversation.</p>
                  {user ? (
                    <button type="button" className={styles.primaryButton} onClick={handleStartDiscussion}>
                      Start a Discussion
                    </button>
                  ) : (
                    <button type="button" className={styles.secondaryButton} onClick={handleSignIn}>
                      Sign In to Participate
                    </button>
                  )}
                </div>
              )}

              {status === "ready" && visiblePosts.length === 0 && (posts.length > 0 || category !== "all" || !!searchTerm.trim()) && (
                <div className={styles.emptyState}>
                  <h3>No matches for these filters.</h3>
                  <p>Try another topic or search term. Search covers loaded discussions only.</p>
                  <button type="button" className={styles.secondaryButton} onClick={() => { setSearchTerm(""); selectCategory("all"); }}>Clear filters</button>
                  <button type="button" className={styles.primaryButton} onClick={user ? handleStartDiscussion : handleSignIn}>{user ? "Start a discussion" : "Sign in to participate"}</button>
                </div>
              )}

              {status === "ready" && visiblePosts.length > 0 && (
                <ul className={styles.feedList}>
                  {category === "all" && !searchTerm.trim() && <PinnedGuideCard />}
                  {visiblePosts.map((post) => (
                    <DiscussionCard key={post.id} post={post} currentUserId={user?.uid ?? null} />
                  ))}
                </ul>
              )}

              {moreError && <p role="alert" className={styles.searchNote}>{moreError}</p>}
              {status === "ready" && hasMore && (
                <div className={styles.loadMoreRow}>
                  <button
                    type="button"
                    className={styles.secondaryButton}
                    onClick={handleLoadMore}
                    disabled={loadingMore}
                  >
                    {loadingMore ? "Loading..." : "Load more discussions"}
                  </button>
                </div>
              )}
            </section>

            {/* TRUST AND STANDARDS */}
            <section className={styles.standardsSection} aria-labelledby="standards-heading">
              <div className={styles.sectionIntro}>
                <p className={styles.kicker}>TRUST AND COMMUNITY STANDARDS</p>
                <h2 id="standards-heading">Kept simple, kept respectful.</h2>
              </div>
              <ul className={styles.standardsList}>
                <li>Respect other members and their experiences.</li>
                <li>Protect private information — never post someone else&apos;s exact location or contact details.</li>
                <li>Date road, weather, access, and safety observations.</li>
                <li>Distinguish personal experience from professional advice.</li>
                <li>No dangerous instructions, scams, spam, harassment, or unsolicited advertising.</li>
                <li>Community is not an emergency-alert service — use emergency services for emergencies.</li>
              </ul>
              <p className={styles.standardsNote}>
                Display names shown here come from a member&apos;s own RVNB profile. A name does not imply a
                verified badge, host status, or professional credential.
              </p>
            </section>
          </div>

          <CommunitySidebar user={user} onSignIn={handleSignIn} />
        </div>
      </div>

      <footer className={styles.pageFooter}>
        <div className={styles.footerInner}>
          <Link href="/" className={styles.footerBrand}>RVNB</Link>
          <p>A better road ahead, together.</p>
        </div>
      </footer>
    </main>
  );
}
