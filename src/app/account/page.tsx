"use client";

import { useEffect, useMemo, useState } from "react";
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
  where,
} from "firebase/firestore";
import styles from "./account.module.css";
import AuthNav from "../components/authnav";
import AccountHeader from "./components/AccountHeader";
import AccountStatsRow from "./components/AccountStatsRow";
import AccountListingsPanel, { AccountListing } from "./components/AccountListingsPanel";
import AccountTripsPanel, { AccountTrip } from "./components/AccountTripsPanel";
import AccountReviewsToWritePanel, { HostedReviewOpportunity } from "./components/AccountReviewsToWritePanel";
import AccountSidebar, { AccountActivityItem } from "./components/AccountSidebar";
import { AccountReceivedReview } from "./components/AccountReceivedReviewsCard";
import { useAuth } from "@/lib/auth-context";
import { db } from "@/lib/firebase";
import { normalizeBookingStatus } from "@/lib/booking-status";
import { summarizeRatings, type ReviewDirection } from "@/lib/reviews";
import { classifyBooking, chunk, formatYmdLabel, nightsBetween } from "./accountUtils";
import type { MemberProfileVisibility } from "../members/memberProfileTypes";

type ListingDoc = {
  id: string;
  title?: string;
  city?: string;
  state?: string;
  price?: number;
  pricePerNight?: number;
  pricingType?: string;
  description?: string;
  hostId?: string;
  createdAt?: unknown;
};

type BookingDoc = {
  id: string;
  hostId?: string;
  guestId?: string;
  listingId?: string;
  listingTitle?: string;
  city?: string;
  state?: string;
  checkIn?: string;
  checkOut?: string;
  status?: string;
  name?: string;
  createdAt?: unknown;
  approvedAt?: unknown;
};

type UserDoc = {
  displayName?: string;
  city?: string;
  state?: string;
  createdAt?: unknown;
};

function timestampMillis(value: unknown): number {
  if (
    value &&
    typeof value === "object" &&
    "toDate" in value &&
    typeof (value as { toDate: () => Date }).toDate === "function"
  ) {
    try {
      return (value as { toDate: () => Date }).toDate().getTime();
    } catch {
      return 0;
    }
  }
  return 0;
}

function formatMemberSince(createdAt: unknown) {
  const ms = timestampMillis(createdAt);
  if (!ms) return "Member since 2026";
  return `Member since ${new Date(ms).getFullYear()}`;
}

function formatPrice(listing: ListingDoc) {
  const amount = listing.price ?? listing.pricePerNight;
  if (typeof amount !== "number") return "Price not set";

  const pricingType = (listing.pricingType || "Night").toLowerCase();
  if (pricingType === "weekly") return `$${amount}/week`;
  if (pricingType === "monthly") return `$${amount}/month`;
  return `$${amount}/night`;
}

async function fetchListingsByIds(ids: string[]): Promise<Map<string, ListingDoc>> {
  const map = new Map<string, ListingDoc>();
  const uniqueIds = Array.from(new Set(ids)).filter(Boolean);
  if (uniqueIds.length === 0) return map;

  for (const group of chunk(uniqueIds, 10)) {
    try {
      const snap = await getDocs(
        query(collection(db, "listings"), where(documentId(), "in", group))
      );
      snap.docs.forEach((d) => {
        map.set(d.id, { id: d.id, ...(d.data() as Omit<ListingDoc, "id">) });
      });
    } catch (e) {
      console.error("[RVNB] batched listing lookup failed", e);
    }
  }

  return map;
}

export default function AccountPage() {
  const { user, loading } = useAuth();

  const [profileLoading, setProfileLoading] = useState(true);
  const [userDoc, setUserDoc] = useState<UserDoc | null>(null);

  const [myListings, setMyListings] = useState<ListingDoc[]>([]);
  const [listingsLoading, setListingsLoading] = useState(true);
  const [listingsError, setListingsError] = useState("");

  const [publicProfileLoading, setPublicProfileLoading] = useState(true);
  const [publicProfileExists, setPublicProfileExists] = useState(false);
  const [publicProfileVisibility, setPublicProfileVisibility] = useState<MemberProfileVisibility | null>(null);

  const [myTripsRaw, setMyTripsRaw] = useState<BookingDoc[]>([]);
  const [hostedBookingsRaw, setHostedBookingsRaw] = useState<BookingDoc[]>([]);
  const [tripListingsById, setTripListingsById] = useState<Map<string, ListingDoc>>(new Map());
  const [tripsLoading, setTripsLoading] = useState(true);
  const [tripsError, setTripsError] = useState("");

  const [reviewsWrittenIds, setReviewsWrittenIds] = useState<Set<string>>(new Set());
  const [receivedReviewsRaw, setReceivedReviewsRaw] = useState<
    { id: string; reviewerId: string; reviewerName: string; rating: number; comment: string; direction: ReviewDirection; createdAt: unknown }[]
  >([]);
  const [reviewsLoading, setReviewsLoading] = useState(true);
  const [reviewsError, setReviewsError] = useState("");

  useEffect(() => {
    async function loadProfile() {
      if (!user?.uid) {
        setUserDoc(null);
        setProfileLoading(false);
        return;
      }

      setProfileLoading(true);
      try {
        const snap = await getDoc(doc(db, "users", user.uid));
        setUserDoc(snap.exists() ? (snap.data() as UserDoc) : null);
      } catch (e) {
        console.error("[RVNB] account profile load failed", e);
        setUserDoc(null);
      } finally {
        setProfileLoading(false);
      }
    }

    loadProfile();
  }, [user?.uid]);

  useEffect(() => {
    async function loadPublicProfile() {
      if (!user?.uid) {
        setPublicProfileExists(false);
        setPublicProfileVisibility(null);
        setPublicProfileLoading(false);
        return;
      }

      setPublicProfileLoading(true);
      try {
        const snap = await getDoc(doc(db, "memberProfiles", user.uid));
        if (snap.exists()) {
          const data = snap.data() as { visibility?: MemberProfileVisibility };
          setPublicProfileExists(true);
          setPublicProfileVisibility(data.visibility === "public" ? "public" : "private");
        } else {
          setPublicProfileExists(false);
          setPublicProfileVisibility(null);
        }
      } catch (e) {
        console.error("[RVNB] public profile status load failed", e);
        setPublicProfileExists(false);
        setPublicProfileVisibility(null);
      } finally {
        setPublicProfileLoading(false);
      }
    }

    loadPublicProfile();
  }, [user?.uid]);

  useEffect(() => {
    async function loadListings() {
      if (!user?.uid) {
        setMyListings([]);
        setListingsLoading(false);
        return;
      }

      setListingsLoading(true);
      setListingsError("");
      try {
        const snap = await getDocs(query(collection(db, "listings"), where("hostId", "==", user.uid)));
        setMyListings(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<ListingDoc, "id">) })));
      } catch (e) {
        const code = (e as { code?: string })?.code ?? "unknown";
        console.error(`[RVNB] account listings query failed (code: ${code})`, e);
        setListingsError("We couldn't load your listings right now. Please try refreshing.");
        setMyListings([]);
      } finally {
        setListingsLoading(false);
      }
    }

    loadListings();
  }, [user?.uid]);

  useEffect(() => {
    async function loadTrips() {
      if (!user?.uid) {
        setMyTripsRaw([]);
        setHostedBookingsRaw([]);
        setTripListingsById(new Map());
        setTripsLoading(false);
        return;
      }

      setTripsLoading(true);
      setTripsError("");

      try {
        const [tripsSnap, hostedSnap] = await Promise.all([
          getDocs(query(collection(db, "bookings"), where("guestId", "==", user.uid))),
          getDocs(query(collection(db, "bookings"), where("hostId", "==", user.uid))),
        ]);

        const trips = tripsSnap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<BookingDoc, "id">) }));
        const hosted = hostedSnap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<BookingDoc, "id">) }));

        setMyTripsRaw(trips);
        setHostedBookingsRaw(hosted);

        // Batch-fetch listing snapshots for trips missing a title/city/state (avoids one
        // read per booking).
        const idsNeedingLookup = trips
          .filter((t) => !t.listingTitle || !t.city)
          .map((t) => t.listingId)
          .filter((id): id is string => !!id);

        const lookup = await fetchListingsByIds(idsNeedingLookup);
        setTripListingsById(lookup);
      } catch (e) {
        const code = (e as { code?: string })?.code ?? "unknown";
        console.error(`[RVNB] account bookings query failed (code: ${code})`, e);
        setTripsError("We couldn't load your trips right now. Please try refreshing.");
        setMyTripsRaw([]);
        setHostedBookingsRaw([]);
      } finally {
        setTripsLoading(false);
      }
    }

    loadTrips();
  }, [user?.uid]);

  useEffect(() => {
    async function loadReviews() {
      if (!user?.uid) {
        setReviewsWrittenIds(new Set());
        setReceivedReviewsRaw([]);
        setReviewsLoading(false);
        return;
      }

      setReviewsLoading(true);
      setReviewsError("");

      try {
        const [writtenSnap, receivedSnap] = await Promise.all([
          getDocs(
            query(
              collection(db, "reviews"),
              where("reviewerId", "==", user.uid),
              where("status", "==", "published")
            )
          ),
          getDocs(
            query(
              collection(db, "reviews"),
              where("revieweeId", "==", user.uid),
              where("status", "==", "published"),
              orderBy("createdAt", "desc"),
              limit(20)
            )
          ),
        ]);

        setReviewsWrittenIds(
          new Set(writtenSnap.docs.map((d) => (d.data() as { bookingId?: string }).bookingId).filter(Boolean) as string[])
        );

        const receivedReviews = receivedSnap.docs.map((d) => {
          const data = d.data() as {
            reviewerId?: string;
            rating?: number;
            comment?: string;
            direction?: ReviewDirection;
            createdAt?: unknown;
          };
          return {
            id: d.id,
            reviewerId: typeof data.reviewerId === "string" ? data.reviewerId : "",
            rating: typeof data.rating === "number" ? data.rating : 0,
            comment: (data.comment ?? "").toString(),
            direction: (data.direction === "host_to_traveler" ? "host_to_traveler" : "traveler_to_host") as ReviewDirection,
            createdAt: data.createdAt,
            reviewerName: "RVNB member",
          };
        });

        const reviewerNames = new Map<string, string>();
        const reviewerIds = Array.from(new Set(receivedReviews.map((review) => review.reviewerId).filter(Boolean)));
        await Promise.all(reviewerIds.map(async (reviewerId) => {
          try {
            const profileSnap = await getDoc(doc(db, "memberProfiles", reviewerId));
            if (!profileSnap.exists()) return;
            const profile = profileSnap.data() as { displayName?: string; visibility?: string };
            if (profile.visibility === "public" && profile.displayName?.trim()) {
              reviewerNames.set(reviewerId, profile.displayName.trim());
            }
          } catch {
            // Private or unavailable reviewer profiles use the safe generic label.
          }
        }));

        setReceivedReviewsRaw(receivedReviews.map((review) => ({
          ...review,
          reviewerName: reviewerNames.get(review.reviewerId) ?? "RVNB member",
        })));
      } catch (e) {
        const code = (e as { code?: string })?.code ?? "unknown";
        console.error(`[RVNB] account reviews query failed (code: ${code})`, e);
        setReviewsError("We couldn't load your reviews right now.");
        setReviewsWrittenIds(new Set());
        setReceivedReviewsRaw([]);
      } finally {
        setReviewsLoading(false);
      }
    }

    loadReviews();
  }, [user?.uid]);

  const displayName = useMemo(() => {
    return (
      userDoc?.displayName?.trim() ||
      user?.displayName?.trim() ||
      user?.email?.split("@")[0] ||
      "RVNB Member"
    );
  }, [userDoc?.displayName, user?.displayName, user?.email]);

  const initial = displayName.charAt(0).toUpperCase();

  const locationLine = useMemo(() => {
    const city = userDoc?.city?.trim();
    const state = userDoc?.state?.trim();
    if (city && state) return `📍 ${city}, ${state}`;
    if (state) return `📍 ${state}`;
    return "📍 Location will appear here";
  }, [userDoc?.city, userDoc?.state]);

  const memberSince = useMemo(() => formatMemberSince(userDoc?.createdAt), [userDoc?.createdAt]);
  const isHost = myListings.length > 0;

  // Legacy-safe conversion: one malformed record is skipped, never crashes the page and
  // never gets silently attributed to the wrong user (the Firestore query already scoped
  // results to this user's guestId/hostId).
  const trips = useMemo<AccountTrip[]>(() => {
    const out: AccountTrip[] = [];
    for (const b of myTripsRaw) {
      try {
        if (!b.listingId || !b.checkIn || !b.checkOut) continue;
        const snapshot = tripListingsById.get(b.listingId);
        const title = b.listingTitle || snapshot?.title || "(Listing unavailable)";
        const city = b.city || snapshot?.city;
        const state = b.state || snapshot?.state;
        const destination = [city, state].filter(Boolean).join(", ") || "Destination pending";

        out.push({
          id: b.id,
          listingId: b.listingId,
          listingTitle: title,
          destination,
          checkInLabel: formatYmdLabel(b.checkIn),
          checkOutLabel: formatYmdLabel(b.checkOut),
          nights: nightsBetween(b.checkIn, b.checkOut),
          classification: classifyBooking(normalizeBookingStatus(b.status), b.checkOut),
          reviewed: reviewsWrittenIds.has(b.id),
        });
      } catch (e) {
        console.error("[RVNB] Skipping malformed trip record", b.id, e);
      }
    }
    return out;
  }, [myTripsRaw, tripListingsById, reviewsWrittenIds]);

  const tripsTakenCount = useMemo(
    () => trips.filter((t) => t.classification === "completed").length,
    [trips]
  );

  const bookingsHostedCount = useMemo(() => {
    let count = 0;
    for (const b of hostedBookingsRaw) {
      try {
        if (!b.checkOut) continue;
        if (classifyBooking(normalizeBookingStatus(b.status), b.checkOut) === "completed") count += 1;
      } catch {
        // Skip malformed hosted booking without affecting the rest of the count.
      }
    }
    return count;
  }, [hostedBookingsRaw]);

  const hostedReviewOpportunities = useMemo<HostedReviewOpportunity[]>(() => {
    const out: HostedReviewOpportunity[] = [];
    for (const b of hostedBookingsRaw) {
      try {
        if (!b.listingId || !b.checkIn || !b.checkOut) continue;
        if (reviewsWrittenIds.has(b.id)) continue;
        if (classifyBooking(normalizeBookingStatus(b.status), b.checkOut) !== "completed") continue;

        const snapshot = tripListingsById.get(b.listingId);
        const title = b.listingTitle || snapshot?.title || "(Listing unavailable)";
        const guestLabel = (b.name ?? "").toString().trim() || "Guest request";

        out.push({
          bookingId: b.id,
          listingTitle: title,
          guestLabel,
          checkOutLabel: formatYmdLabel(b.checkOut),
        });
      } catch (e) {
        console.error("[RVNB] Skipping malformed hosted review opportunity", b.id, e);
      }
    }
    return out;
  }, [hostedBookingsRaw, tripListingsById, reviewsWrittenIds]);

  const reviewsSummary = useMemo(() => summarizeRatings(receivedReviewsRaw), [receivedReviewsRaw]);

  const recentReceivedReviews = useMemo<AccountReceivedReview[]>(
    () =>
      receivedReviewsRaw.slice(0, 5).map((r) => ({
        id: r.id,
        rating: r.rating,
        comment: r.comment,
        direction: r.direction,
        reviewerName: r.reviewerName,
        verified: true,
        dateLabel: (() => {
          const ms = timestampMillis(r.createdAt);
          return ms ? new Date(ms).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "";
        })(),
      })),
    [receivedReviewsRaw]
  );

  const accountListings = useMemo<AccountListing[]>(
    () =>
      myListings.map((l) => ({
        id: l.id,
        title: l.title || "Untitled Listing",
        city: l.city || "",
        state: l.state || "",
        priceLabel: formatPrice(l),
        description: l.description?.trim() || "",
      })),
    [myListings]
  );

  const recentActivity = useMemo<AccountActivityItem[]>(() => {
    const events: { id: string; text: string; ms: number }[] = [];

    myListings.forEach((l) => {
      const ms = timestampMillis(l.createdAt);
      if (ms) events.push({ id: `listing-${l.id}`, text: `Listing created: ${l.title || "Untitled"}`, ms });
    });

    myTripsRaw.forEach((b) => {
      const createdMs = timestampMillis(b.createdAt);
      if (createdMs) {
        events.push({ id: `trip-req-${b.id}`, text: "Booking requested", ms: createdMs });
      }
      const approvedMs = timestampMillis(b.approvedAt);
      if (approvedMs) {
        events.push({ id: `trip-appr-${b.id}`, text: "Booking approved", ms: approvedMs });
      }
    });

    hostedBookingsRaw.forEach((b) => {
      const approvedMs = timestampMillis(b.approvedAt);
      if (approvedMs) {
        events.push({ id: `hosted-appr-${b.id}`, text: "You approved a booking request", ms: approvedMs });
      }
    });

    return events
      .sort((a, b) => b.ms - a.ms)
      .slice(0, 5)
      .map((e) => ({ id: e.id, text: e.text, dateLabel: new Date(e.ms).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) }));
  }, [myListings, myTripsRaw, hostedBookingsRaw]);

  if (!loading && !user) {
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
          <div className={styles.container}>
            <div className={styles.placeholderPanel}>
              <div className={styles.placeholderIcon}>🔐</div>
              <h2 className={styles.placeholderTitle}>Please sign in</h2>
              <p className={styles.placeholderText}>You need to be logged in to view your account page.</p>
            </div>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <AccountHeader
        displayName={displayName}
        loading={loading || profileLoading}
        initial={initial}
        isHost={isHost}
        locationLine={locationLine}
        memberSince={memberSince}
        emailVerified={Boolean(user?.emailVerified)}
      />

      <section className={styles.contentSection}>
        <div className={styles.container}>
          <AccountStatsRow
            loading={listingsLoading || tripsLoading}
            listingsCount={myListings.length}
            tripsTakenCount={tripsTakenCount}
            bookingsHostedCount={bookingsHostedCount}
            reviewsLoading={reviewsLoading}
            reviewsError={reviewsError}
            reviewsAverage={reviewsSummary.average}
            reviewsCount={reviewsSummary.count}
          />

          <div className={styles.layoutGrid}>
            <div className={styles.mainCol}>
              <AccountListingsPanel loading={listingsLoading} error={listingsError} listings={accountListings} />
              <AccountTripsPanel loading={tripsLoading} error={tripsError} trips={trips} />
              <AccountReviewsToWritePanel loading={tripsLoading} opportunities={hostedReviewOpportunities} />
            </div>

            <AccountSidebar
              uid={user?.uid ?? ""}
              displayNameSet={Boolean(userDoc?.displayName?.trim())}
              locationSet={Boolean(userDoc?.city?.trim() && userDoc?.state?.trim())}
              isHost={isHost}
              activity={recentActivity}
              publicProfileLoading={publicProfileLoading}
              publicProfileExists={publicProfileExists}
              publicProfileVisibility={publicProfileVisibility}
              reviewsLoading={reviewsLoading}
              reviewsError={reviewsError}
              reviewsAverage={reviewsSummary.average}
              reviewsCount={reviewsSummary.count}
              recentReviews={recentReceivedReviews}
            />
          </div>
        </div>
      </section>
    </main>
  );
}
