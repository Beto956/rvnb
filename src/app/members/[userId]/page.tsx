"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  collection,
  doc,
  documentId,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import { summarizeRatings, type ReviewDirection } from "@/lib/reviews";
import AuthNav from "../../components/authnav";
import ReviewCard, { type ReviewCardItem } from "../../components/ReviewCard";
import ReviewSummary from "../../components/ReviewSummary";
import styles from "./memberProfile.module.css";
import { isValidUserIdParam, type MemberProfileDoc } from "../memberProfileTypes";

type ListingDoc = {
  id: string;
  title?: string;
  city?: string;
  state?: string;
  price?: number;
  pricePerNight?: number;
  pricingType?: string;
};

function formatPrice(listing: ListingDoc) {
  const amount = listing.price ?? listing.pricePerNight;
  if (typeof amount !== "number") return "Price not set";
  const type = (listing.pricingType || "Night").toLowerCase();
  if (type === "weekly") return `$${amount}/week`;
  if (type === "monthly") return `$${amount}/month`;
  return `$${amount}/night`;
}

function formatMemberSince(createdAt: unknown): string | null {
  if (
    createdAt &&
    typeof createdAt === "object" &&
    "toDate" in createdAt &&
    typeof (createdAt as { toDate: () => Date }).toDate === "function"
  ) {
    try {
      return `Member since ${(createdAt as { toDate: () => Date }).toDate().getFullYear()}`;
    } catch {
      return null;
    }
  }
  return null;
}

export default function MemberProfilePage() {
  const params = useParams();
  const rawUserId = Array.isArray(params.userId) ? params.userId[0] : params.userId;
  const { user, loading: authLoading } = useAuth();

  const [profileLoading, setProfileLoading] = useState(true);
  const [profile, setProfile] = useState<MemberProfileDoc | null>(null);
  const [unavailable, setUnavailable] = useState(false);

  const [listings, setListings] = useState<ListingDoc[]>([]);
  const [listingsLoading, setListingsLoading] = useState(true);
  const [listingsError, setListingsError] = useState("");

  const [reviews, setReviews] = useState<ReviewCardItem[]>([]);
  const [reviewsLoading, setReviewsLoading] = useState(true);
  const [reviewsError, setReviewsError] = useState("");
  const [reportedReviewIds, setReportedReviewIds] = useState<Set<string>>(new Set());

  const [copyStatus, setCopyStatus] = useState("");

  const userIdValid = isValidUserIdParam(rawUserId);
  const viewerIsOwner = Boolean(user?.uid && userIdValid && user.uid === rawUserId);

  useEffect(() => {
    async function loadProfile() {
      if (!userIdValid) {
        setUnavailable(true);
        setProfileLoading(false);
        return;
      }

      setProfileLoading(true);
      setUnavailable(false);

      try {
        const snap = await getDoc(doc(db, "memberProfiles", rawUserId as string));
        if (!snap.exists()) {
          setProfile(null);
        } else {
          setProfile(snap.data() as MemberProfileDoc);
        }
      } catch (e) {
        // Private or unauthorized reads land here too — use the same generic outcome so
        // visitors can't tell a private profile apart from a nonexistent one.
        console.error("[RVNB] member profile read failed", e);
        setProfile(null);
        setUnavailable(true);
      } finally {
        setProfileLoading(false);
      }
    }

    loadProfile();
  }, [rawUserId, userIdValid, user?.uid]);

  useEffect(() => {
    async function loadListings() {
      if (!userIdValid) {
        setListings([]);
        setListingsLoading(false);
        return;
      }

      setListingsLoading(true);
      setListingsError("");
      try {
        const snap = await getDocs(
          query(collection(db, "listings"), where("hostId", "==", rawUserId))
        );
        setListings(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<ListingDoc, "id">) })));
      } catch (e) {
        console.error("[RVNB] member profile listings query failed", e);
        setListingsError("Listings couldn't be loaded right now.");
        setListings([]);
      } finally {
        setListingsLoading(false);
      }
    }

    loadListings();
  }, [rawUserId, userIdValid]);

  const initial = (profile?.displayName || "R").charAt(0).toUpperCase();
  const memberSince = useMemo(() => formatMemberSince(profile?.createdAt), [profile?.createdAt]);
  const isHost = listings.length > 0;
  const isPublished = profile?.visibility === "public";
  const profileUrl = typeof window !== "undefined" ? window.location.href : `/members/${rawUserId}`;

  useEffect(() => {
    async function loadReviews() {
      if (!userIdValid || !rawUserId) {
        setReviews([]);
        setReviewsLoading(false);
        return;
      }

      if (!profile && !viewerIsOwner) {
        setReviews([]);
        setReviewsLoading(false);
        return;
      }

      setReviewsLoading(true);
      setReviewsError("");

      try {
        const reviewSnap = await getDocs(
          query(
            collection(db, "reviews"),
            where("revieweeId", "==", rawUserId),
            where("status", "==", "published"),
            orderBy("createdAt", "desc"),
            limit(20)
          )
        );

        const rows = reviewSnap.docs.map((d) => {
          const data = d.data() as {
            reviewerId?: string;
            rating?: number;
            direction?: ReviewDirection;
            comment?: string;
            createdAt?: unknown;
            listingId?: string;
          };
          return {
            id: d.id,
            reviewerId: data.reviewerId ?? "",
            rating: typeof data.rating === "number" ? data.rating : 0,
            direction: (data.direction === "host_to_traveler" ? "host_to_traveler" : "traveler_to_host") as ReviewDirection,
            comment: typeof data.comment === "string" ? data.comment : "",
            createdAt: data.createdAt,
            listingId: typeof data.listingId === "string" ? data.listingId : undefined,
          };
        });

        if (rows.length === 0) {
          setReviews([]);
          return;
        }

        const reviewerIds = Array.from(new Set(rows.map((r) => r.reviewerId).filter(Boolean)));
        const reviewerMap = new Map<string, { displayName: string; photoURL?: string | null }>();

        if (reviewerIds.length > 0) {
          const profileSnaps: Array<
            | [string, { displayName: string; photoURL?: string | null }]
            | null
          > = await Promise.all(
            reviewerIds.map(async (reviewerId) => {
              try {
                const reviewerProfileSnap = await getDoc(doc(db, "memberProfiles", reviewerId));
                if (!reviewerProfileSnap.exists()) return null;
                const data = reviewerProfileSnap.data() as Partial<MemberProfileDoc>;
                if (data.visibility !== "public") return null;
                return [reviewerId, { displayName: data.displayName ?? "RVNB member", photoURL: data.photoURL ?? null }] as [
                  string,
                  { displayName: string; photoURL?: string | null }
                ];
              } catch {
                return null;
              }
            })
          );

          for (const entry of profileSnaps) {
            if (!entry) continue;
            reviewerMap.set(entry[0], entry[1]);
          }
        }

        const listingIds = Array.from(new Set(rows.filter((r) => r.direction === "traveler_to_host" && r.listingId).map((r) => r.listingId as string)));
        const listingMap = new Map<string, string>();

        if (listingIds.length > 0) {
          for (const group of Array.from({ length: Math.ceil(listingIds.length / 10) }, (_, index) => listingIds.slice(index * 10, index * 10 + 10))) {
            try {
              const listingSnap = await getDocs(
                query(collection(db, "listings"), where(documentId(), "in", group))
              );
              listingSnap.docs.forEach((d) => {
                const listingData = d.data() as { title?: string };
                listingMap.set(d.id, (listingData.title ?? "Untitled Listing").toString());
              });
            } catch {
              // Keep the review list usable if a listing lookup is temporarily unavailable.
            }
          }
        }

        const nextReviews: ReviewCardItem[] = rows.map((row) => {
          const reviewer = reviewerMap.get(row.reviewerId) ?? null;
          const displayName = reviewer?.displayName ?? "RVNB member";
          const initials = displayName.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "").join("") || "R";
          const createdAtLabel = (() => {
            const value = row.createdAt;
            if (value && typeof value === "object" && "toDate" in value && typeof (value as { toDate: () => Date }).toDate === "function") {
              try {
                return (value as { toDate: () => Date }).toDate().toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                });
              } catch {
                return "Recent review";
              }
            }
            return "Recent review";
          })();

          return {
            id: row.id,
            reviewerId: row.reviewerId,
            reviewerName: displayName,
            reviewerInitials: initials,
            rating: row.rating,
            direction: row.direction,
            comment: row.comment,
            createdAtLabel,
            listingTitle: row.listingId ? listingMap.get(row.listingId) : undefined,
            verified: true,
          };
        });

        setReviews(nextReviews);
      } catch (e) {
        console.error("[RVNB] member profile reviews query failed", e);
        setReviews([]);
        setReviewsError("We couldn't load reviews right now.");
      } finally {
        setReviewsLoading(false);
      }
    }

    loadReviews();
  }, [rawUserId, userIdValid, profile, viewerIsOwner]);

  const reviewSummary = useMemo(() => summarizeRatings(reviews.map((review) => ({ rating: review.rating }))), [reviews]);

  async function handleReportReview(reviewId: string) {
    if (!user?.uid) {
      setCopyStatus("Please sign in to report a review.");
      return;
    }

    if (reportedReviewIds.has(reviewId)) {
      setCopyStatus("This review was already reported.");
      return;
    }

    try {
      await setDoc(doc(db, "reviewReports", `${reviewId}_${user.uid}`), {
        reviewId,
        reporterId: user.uid,
        reason: "spam",
        details: "Flagged from the public RVNB review view.",
        createdAt: serverTimestamp(),
        status: "open",
      });
      setReportedReviewIds((current) => new Set(current).add(reviewId));
      setCopyStatus("Review reported.");
    } catch (e) {
      console.error("[RVNB] review report failed", e);
      setCopyStatus("That review couldn't be reported right now.");
    }
  }

  async function shareProfile() {
    try {
      if (navigator.share) {
        await navigator.share({ title: `${profile?.displayName ?? "RVNB member"} on RVNB`, url: profileUrl });
        setCopyStatus("Shared!");
      } else {
        await navigator.clipboard.writeText(profileUrl);
        setCopyStatus("Link copied!");
      }
    } catch {
      setCopyStatus("Couldn't copy — copy it from the address bar instead.");
    }
    setTimeout(() => setCopyStatus(""), 2500);
  }

  const header = (
    <header className={styles.header}>
      <div className={styles.headerInner}>
        <Link href="/" className={styles.brand} aria-label="RVNB Home">
          <img src="/rvnb-logo-icon.png" alt="RVNB" className={styles.brandIcon} />
        </Link>
        <nav aria-label="Primary">
          <AuthNav navLinkClassName={styles.navLink} navCtaClassName={styles.navLink} navLogoutClassName={styles.navLink} />
        </nav>
      </div>
    </header>
  );

  if (authLoading || profileLoading) {
    return (
      <main className={styles.page}>
        {header}
        <div className={styles.unavailableWrap}>
          <div className={styles.unavailableCard}>
            <h1 className={styles.cardTitle}>Loading profile...</h1>
          </div>
        </div>
      </main>
    );
  }

  // Owner viewing their own not-yet-published profile gets a helpful preview state;
  // everyone else sees the same generic "unavailable" message (private vs missing is
  // intentionally indistinguishable to reduce account enumeration).
  if (unavailable || (!profile && !viewerIsOwner)) {
    return (
      <main className={styles.page}>
        {header}
        <div className={styles.unavailableWrap}>
          <div className={styles.unavailableCard}>
            <h1 className={styles.cardTitle}>Profile unavailable</h1>
            <p className={styles.cardSub}>
              This RVNB profile doesn&apos;t exist, or its owner has kept it private.
            </p>
            <Link href="/" className={styles.btnSecondary}>
              Back to RVNB
            </Link>
          </div>
        </div>
      </main>
    );
  }

  if (!profile && viewerIsOwner) {
    return (
      <main className={styles.page}>
        {header}
        <div className={styles.unavailableWrap}>
          <div className={styles.unavailableCard}>
            <h1 className={styles.cardTitle}>You haven&apos;t published a profile yet</h1>
            <p className={styles.cardSub}>
              Set up your public profile from your account to let other members see your
              display name, location, and active listings.
            </p>
            <Link href="/account/public-profile" className={styles.btnPrimary}>
              Set up public profile
            </Link>
          </div>
        </div>
      </main>
    );
  }

  if (!profile) return null;

  return (
    <main className={styles.page}>
      {header}

      <section className={styles.hero}>
        <div className={styles.heroBg} aria-hidden="true" />
        <div className={styles.heroOverlay} aria-hidden="true" />
        <img src="/rvnb-logo-icon.png" alt="" aria-hidden="true" className={styles.heroWatermark} />

        <div className={styles.heroContent}>
          {viewerIsOwner && !isPublished && (
            <div className={styles.previewBanner}>
              🔒 Private preview — only you can see this.
            </div>
          )}

          <div className={styles.profileRow}>
            <div className={styles.avatar}>{initial}</div>

            <div>
              <p className={styles.eyebrow}>Member Profile</p>
              <h1 className={styles.name}>{profile.displayName}</h1>

              <div className={styles.metaStack}>
                {(profile.city || profile.state) && (
                  <span className={styles.metaItem}>
                    📍 {[profile.city, profile.state].filter(Boolean).join(", ")}
                  </span>
                )}
                {memberSince && <span className={styles.metaItem}>{memberSince}</span>}
                {isHost && <span className={styles.roleBadge}>Host on RVNB</span>}
                <span className={styles.metaItem}>Traveler on RVNB</span>
              </div>

              <div className={styles.actionRow}>
                {isPublished && (
                  <button type="button" className={styles.btnPrimary} onClick={shareProfile}>
                    🔗 Share profile
                  </button>
                )}
                {viewerIsOwner && (
                  <Link href="/account/public-profile" className={styles.btnSecondary}>
                    Edit profile
                  </Link>
                )}
              </div>

              {copyStatus && (
                <p className={styles.metaItem} role="status" style={{ marginTop: 10 }}>
                  {copyStatus}
                </p>
              )}
            </div>
          </div>
        </div>
      </section>

      <div className={styles.container}>
        <div className={styles.contentGrid}>
          <div className={styles.mainCol}>
            {profile.bio && (
              <div className={styles.card}>
                <h2 className={styles.cardTitle}>About</h2>
                <p className={styles.bioText}>{profile.bio}</p>
              </div>
            )}

            <div className={styles.card}>
              <h2 className={styles.cardTitle}>Listings</h2>
              <p className={styles.cardSub}>Active RV spots hosted by this member.</p>

              {listingsLoading ? (
                <div className={styles.emptyState}>Loading listings...</div>
              ) : listingsError ? (
                <div className={styles.emptyState}>{listingsError}</div>
              ) : listings.length === 0 ? (
                <div className={styles.emptyState}>
                  This member hasn&apos;t published any listings yet.
                </div>
              ) : (
                <div className={styles.listingsGrid}>
                  {listings.map((l) => (
                    <article key={l.id} className={styles.listingCard}>
                      <div className={styles.listingMedia}>🚐 Photos coming soon</div>
                      <div className={styles.listingBody}>
                        <div className={styles.listingTitle}>{l.title || "Untitled Listing"}</div>
                        <div className={styles.listingMeta}>
                          {[l.city, l.state].filter(Boolean).join(", ") || "Location not set"}
                        </div>
                        <div className={styles.listingPrice}>{formatPrice(l)}</div>
                        <Link href={`/listings/${l.id}`} className={styles.listingLink}>
                          View listing →
                        </Link>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className={styles.sideCol}>
            <div className={styles.card}>
              <ReviewSummary
                title="Ratings & reviews"
                average={reviewSummary.average}
                count={reviewSummary.count}
                loading={reviewsLoading}
                error={reviewsError || undefined}
                emptyText="No verified-stay reviews yet."
              />

              {reviewsLoading ? (
                <div className={styles.emptyState} style={{ marginTop: 16 }}>Loading reviews...</div>
              ) : reviewsError ? (
                <div className={styles.emptyState} style={{ marginTop: 16 }}>{reviewsError}</div>
              ) : reviews.length === 0 ? (
                <div className={styles.emptyState} style={{ marginTop: 16 }}>
                  No verified-stay reviews yet.
                </div>
              ) : (
                <div style={{ display: "grid", gap: 14, marginTop: 16 }}>
                  {reviews.map((review) => (
                    <ReviewCard
                      key={review.id}
                      review={review}
                      alreadyReported={reportedReviewIds.has(review.id)}
                      onReport={handleReportReview}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
