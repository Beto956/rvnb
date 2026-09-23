"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import { normalizeBookingStatus } from "@/lib/booking-status";
import {
  categoriesForDirection,
  categoryLabel,
  directionLabel,
  reviewDocId,
  REVIEW_COMMENT_MAX_LENGTH,
  type ReviewDirection,
} from "@/lib/reviews";
import { classifyBooking } from "../../account/accountUtils";
import AuthNav from "../../components/authnav";
import StarRatingInput from "../../components/StarRatingInput";
import styles from "../../account/account.module.css";

type BookingDoc = {
  listingId?: string;
  guestId?: string;
  hostId?: string;
  checkIn?: string;
  checkOut?: string;
  status?: string;
};

type ListingDoc = {
  title?: string;
  city?: string;
  state?: string;
};

type Eligibility =
  | "loading"
  | "invalid-booking"
  | "unauthorized"
  | "not-completed"
  | "already-reviewed"
  | "eligible"
  | "error";

function isValidBookingIdParam(value: string | null): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function NewReviewPageInner() {
  const searchParams = useSearchParams();
  const bookingId = searchParams.get("bookingId");
  const { user, loading: authLoading } = useAuth();

  const [eligibility, setEligibility] = useState<Eligibility>("loading");
  const [booking, setBooking] = useState<BookingDoc | null>(null);
  const [listing, setListing] = useState<ListingDoc | null>(null);
  const [direction, setDirection] = useState<ReviewDirection | null>(null);
  const [revieweeId, setRevieweeId] = useState<string>("");

  const [rating, setRating] = useState(0);
  const [categoryRatings, setCategoryRatings] = useState<Record<string, number>>({});
  const [comment, setComment] = useState("");
  const [confirmPublic, setConfirmPublic] = useState(false);

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    async function run() {
      if (authLoading) return;

      if (!isValidBookingIdParam(bookingId)) {
        setEligibility("invalid-booking");
        return;
      }

      if (!user?.uid) {
        setEligibility("unauthorized");
        return;
      }

      try {
        const bookingSnap = await getDoc(doc(db, "bookings", bookingId));
        if (!bookingSnap.exists()) {
          setEligibility("invalid-booking");
          return;
        }

        const b = bookingSnap.data() as BookingDoc;
        setBooking(b);

        let nextDirection: ReviewDirection | null = null;
        let nextRevieweeId = "";

        if (b.guestId === user.uid) {
          nextDirection = "traveler_to_host";
          nextRevieweeId = b.hostId ?? "";
        } else if (b.hostId === user.uid) {
          nextDirection = "host_to_traveler";
          nextRevieweeId = b.guestId ?? "";
        } else {
          setEligibility("unauthorized");
          return;
        }

        if (!nextRevieweeId) {
          setEligibility("invalid-booking");
          return;
        }

        const completed =
          b.checkOut && classifyBooking(normalizeBookingStatus(b.status), b.checkOut) === "completed";

        if (!completed) {
          setEligibility("not-completed");
          return;
        }

        const existingReview = await getDoc(doc(db, "reviews", reviewDocId(bookingId, user.uid)));
        if (existingReview.exists()) {
          setEligibility("already-reviewed");
          return;
        }

        setDirection(nextDirection);
        setRevieweeId(nextRevieweeId);

        if (b.listingId) {
          try {
            const listingSnap = await getDoc(doc(db, "listings", b.listingId));
            if (listingSnap.exists()) setListing(listingSnap.data() as ListingDoc);
          } catch {
            // Listing context is a nice-to-have; eligibility doesn't depend on it.
          }
        }

        setEligibility("eligible");
      } catch (e) {
        console.error("[RVNB] Failed to load review eligibility", e);
        setEligibility("error");
      }
    }

    run();
  }, [bookingId, user?.uid, authLoading]);

  const categories = useMemo(() => (direction ? categoriesForDirection(direction) : []), [direction]);
  const allCategoriesRated = categories.every((c) => (categoryRatings[c] ?? 0) >= 1);
  const canSubmit = rating > 0 && allCategoriesRated && comment.trim().length > 0 && confirmPublic && !saving;

  async function handleSubmit() {
    if (!user?.uid || !direction || !booking?.listingId || !bookingId || !canSubmit) return;

    setSaving(true);
    setSaveError("");

    try {
      const id = reviewDocId(bookingId, user.uid);
      await setDoc(doc(db, "reviews", id), {
        bookingId,
        listingId: booking.listingId,
        reviewerId: user.uid,
        revieweeId,
        direction,
        rating,
        categoryRatings,
        comment: comment.trim().slice(0, REVIEW_COMMENT_MAX_LENGTH),
        status: "published",
        createdAt: serverTimestamp(),
      });
      setSaved(true);
    } catch (e) {
      console.error("[RVNB] Failed to submit review", e);
      setSaveError("Couldn't submit your review. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  if (eligibility === "loading") {
    return <StateCard title="Loading review form..." />;
  }

  if (eligibility === "invalid-booking") {
    return <StateCard title="This booking couldn't be found." backLink />;
  }

  if (eligibility === "unauthorized") {
    return <StateCard title="You're not authorized to review this stay." backLink />;
  }

  if (eligibility === "error") {
    return <StateCard title="Something went wrong loading this review." backLink />;
  }

  if (eligibility === "not-completed") {
    return <StateCard title="This stay isn't eligible for a review yet." subtitle="Reviews open up once a stay is approved and checkout has passed." backLink />;
  }

  if (eligibility === "already-reviewed") {
    return <StateCard title="You've already reviewed this stay." backLink />;
  }

  if (saved) {
    return (
      <StateCard
        title="Review submitted!"
        subtitle="Thanks for helping keep RVNB trustworthy."
        backLink
        backHref="/account"
        backLabel="Back to account"
      />
    );
  }

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <Link href="/" className={styles.brand} aria-label="RVNB Home">
            <img src="/rvnb-logo-icon.png" alt="RVNB" className={styles.brandIcon} width={180} height={72} />
          </Link>
          <nav className={styles.nav} aria-label="Primary">
            <AuthNav navLinkClassName={styles.navLink} navCtaClassName={styles.navCta} navLogoutClassName={styles.navLink} />
          </nav>
        </div>
      </header>

      <section className={styles.contentSection}>
        <div className={styles.container} style={{ maxWidth: 640 }}>
          <h1 className={styles.sectionTitle}>
            {direction ? directionLabel(direction) : "Write a review"}
          </h1>
          <p className={styles.sectionSub}>
            {listing?.title ? `Your stay at ${listing.title}` : "Your stay"}
            {listing?.city ? ` · ${[listing.city, listing.state].filter(Boolean).join(", ")}` : ""}
          </p>

          <form className={styles.editForm} style={{ marginTop: 24 }} onSubmit={(e) => e.preventDefault()}>
            {saveError && <div className={styles.placeholderText}>{saveError}</div>}

            <StarRatingInput label="Overall rating" name="overall-rating" value={rating} onChange={setRating} disabled={saving} />

            {categories.map((c) => (
              <StarRatingInput
                key={c}
                label={categoryLabel(c)}
                name={`category-${c}`}
                value={categoryRatings[c] ?? 0}
                onChange={(v) => setCategoryRatings((prev) => ({ ...prev, [c]: v }))}
                disabled={saving}
              />
            ))}

            <label>
              Your review ({comment.length}/{REVIEW_COMMENT_MAX_LENGTH})
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                maxLength={REVIEW_COMMENT_MAX_LENGTH}
                rows={5}
                disabled={saving}
                placeholder="Share honest, specific feedback about your stay."
              />
            </label>

            <label style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
              <input
                type="checkbox"
                checked={confirmPublic}
                onChange={(e) => setConfirmPublic(e.target.checked)}
                disabled={saving}
              />
              <span>
                I understand this review will be public and{" "}
                <strong>cannot be edited after it&apos;s posted</strong>.
              </span>
            </label>

            <div className={styles.actionRow}>
              <button type="button" className={styles.primaryBtn} disabled={!canSubmit} onClick={handleSubmit}>
                {saving ? "Submitting..." : "Submit review"}
              </button>
              <Link href="/account" className={styles.secondaryBtn}>
                Cancel
              </Link>
            </div>
          </form>
        </div>
      </section>
    </main>
  );
}

function StateCard({
  title,
  subtitle,
  backLink,
  backHref = "/account",
  backLabel = "Back to account",
}: {
  title: string;
  subtitle?: string;
  backLink?: boolean;
  backHref?: string;
  backLabel?: string;
}) {
  return (
    <main className={styles.page}>
      <section className={styles.contentSection}>
        <div className={styles.container}>
          <div className={styles.placeholderPanel}>
            <h2 className={styles.placeholderTitle}>{title}</h2>
            {subtitle && <p className={styles.placeholderText}>{subtitle}</p>}
            {backLink && (
              <Link href={backHref} className={styles.primaryBtn} style={{ marginTop: 14, display: "inline-flex" }}>
                {backLabel}
              </Link>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}

export default function NewReviewPage() {
  return (
    <Suspense fallback={<StateCard title="Loading review form..." />}>
      <NewReviewPageInner />
    </Suspense>
  );
}
