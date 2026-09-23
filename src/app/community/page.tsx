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

function excerptOf(body: string): string {
  const clean = body.replace(/\s+/g, " ").trim();
  return clean.length > 220 ? `${clean.slice(0, 217)}...` : clean;
}

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
    setStatus("loading");
    setErrorMessage("");
    setPosts([]);
    setLastDoc(null);
    setHasMore(true);

    const direction: OrderByDirection = sortOrder === "newest" ? "desc" : "asc";

    loadPosts(category, direction, null)
      .then(({ rows, lastVisible, count }) => {
        if (cancelled) return;
        setPosts(rows);
        setLastDoc(lastVisible);
        setHasMore(count === PAGE_SIZE);
        setStatus("ready");
      })
      .catch((err) => {
        if (cancelled) return;
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
    };
  }, [category, sortOrder, loadPosts]);

  async function handleLoadMore() {
    if (!lastDoc || loadingMore) return;
    setLoadingMore(true);
    try {
      const direction: OrderByDirection = sortOrder === "newest" ? "desc" : "asc";
      const { rows, lastVisible, count } = await loadPosts(category, direction, lastDoc);
      setPosts((prev) => [...prev, ...rows]);
      setLastDoc(lastVisible);
      setHasMore(count === PAGE_SIZE);
    } catch (err) {
      console.error("Community feed load-more error:", err);
      setErrorMessage("Could not load more discussions right now.");
    } finally {
      setLoadingMore(false);
    }
  }

  const visiblePosts = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return posts;
    return posts.filter(
      (p) => p.title.toLowerCase().includes(term) || excerptOf(p.body).toLowerCase().includes(term)
    );
  }, [posts, searchTerm]);

  function scrollToBoard() {
    boardRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function handleStartDiscussion() {
    router.push("/community/new");
  }

  function handleSignIn() {
    router.push(`/login?next=${encodeURIComponent("/community")}`);
  }

  function selectCategory(id: string) {
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
            <div className={styles.heroSearchRow}>
              <label className={styles.heroSearchField}>
                <span className={styles.srOnly}>Search the community</span>
                <input
                  type="search"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search the community"
                  onFocus={scrollToBoard}
                />
              </label>
              {user ? (
                <button type="button" className={styles.primaryButton} onClick={handleStartDiscussion}>
                  Start a discussion →
                </button>
              ) : (
                <button type="button" className={styles.primaryButton} onClick={handleSignIn}>
                  Sign in to post →
                </button>
              )}
            </div>
          </div>
        </header>

        <div className={styles.layout}>
          <div className={styles.mainCol}>
            {/* BOARD CONTROLS */}
            <section ref={boardRef} className={styles.boardSection} aria-labelledby="board-heading">
              <div className={styles.boardHeader}>
                <h2 id="board-heading">Recent discussions</h2>
                <label className={styles.sortField}>
                  <span className={styles.srOnly}>Sort discussions</span>
                  <select
                    value={sortOrder}
                    onChange={(e) => setSortOrder(e.target.value as SortOrder)}
                  >
                    <option value="newest">Latest activity</option>
                    <option value="oldest">Oldest first</option>
                  </select>
                </label>
              </div>

              <div className={styles.chipRow} role="group" aria-label="Filter by category">
                <button
                  type="button"
                  className={`${styles.chip} ${category === "all" ? styles.chipActive : ""}`}
                  onClick={() => selectCategory("all")}
                >
                  All
                </button>
                {COMMUNITY_CATEGORIES.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    className={`${styles.chip} ${category === c.id ? styles.chipActive : ""}`}
                    onClick={() => selectCategory(c.id)}
                  >
                    {c.label}
                  </button>
                ))}
              </div>

              <label className={styles.searchField}>
                <span className={styles.srOnly}>Search loaded discussions</span>
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
                  loaded above — not the entire board.
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
                </div>
              )}

              {status === "permission-error" && (
                <div className={styles.feedState} role="alert">
                  You don&apos;t have permission to view discussions right now. Try signing in, or reload
                  the page.
                </div>
              )}

              {status === "ready" && visiblePosts.length === 0 && posts.length === 0 && (
                <div className={styles.emptyState}>
                  <h3>No discussions here yet.</h3>
                  <p>Be the first to start a conversation in this category.</p>
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

              {status === "ready" && visiblePosts.length === 0 && posts.length > 0 && (
                <div className={styles.emptyState}>
                  <h3>No matches found.</h3>
                  <p>Try a different search term, or clear the search to see all loaded discussions.</p>
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

              {status === "ready" && hasMore && !searchTerm.trim() && (
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

            {/* TOPIC CATEGORIES */}
            <section className={styles.section} aria-labelledby="categories-heading">
              <div className={styles.sectionIntro}>
                <p className={styles.kicker}>EXPLORE BY TOPIC</p>
                <h2 id="categories-heading">Find the knowledge you need.</h2>
              </div>
              <div className={styles.categoryGrid}>
                {COMMUNITY_CATEGORIES.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    className={`${styles.categoryCard} ${category === c.id ? styles.categoryCardActive : ""}`}
                    onClick={() => selectCategory(c.id)}
                  >
                    <h3>{c.label}</h3>
                  </button>
                ))}
              </div>
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
