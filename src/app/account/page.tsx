"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  collection,
  getDocs,
  query,
  where,
} from "firebase/firestore";
import styles from "./account.module.css";
import AuthNav from "../components/authnav";
import { useAuth } from "@/lib/auth-context";
import { db } from "@/lib/firebase";

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
};

type BookingDoc = {
  id: string;
  hostId?: string;
  userId?: string;
  renterId?: string;
  guestId?: string;
  travelerId?: string;
  uid?: string;
  listingId?: string;
  listingTitle?: string;
  title?: string;
  city?: string;
  state?: string;
  startDate?: string;
  endDate?: string;
  checkIn?: string;
  checkOut?: string;
  status?: string;
};

type UserDoc = {
  displayName?: string;
  city?: string;
  state?: string;
  createdAt?: unknown;
};

function formatMemberSince(createdAt: unknown) {
  try {
    if (
      createdAt &&
      typeof createdAt === "object" &&
      "toDate" in createdAt &&
      typeof (createdAt as { toDate: () => Date }).toDate === "function"
    ) {
      const date = (createdAt as { toDate: () => Date }).toDate();
      return `Member since ${date.getFullYear()}`;
    }
  } catch {
    // fall through to default
  }

  return "Member since 2026";
}

function getTripOwnerId(booking: BookingDoc) {
  return (
    booking.userId ||
    booking.renterId ||
    booking.guestId ||
    booking.travelerId ||
    booking.uid ||
    ""
  );
}

function formatPrice(listing: ListingDoc) {
  const amount = listing.price ?? listing.pricePerNight;

  if (typeof amount !== "number") return "Price not set";

  const pricingType = (listing.pricingType || "Night").toLowerCase();

  if (pricingType === "weekly") return `$${amount}/week`;
  if (pricingType === "monthly") return `$${amount}/month`;

  return `$${amount}/night`;
}

function formatTripDates(booking: BookingDoc) {
  const start = booking.startDate || booking.checkIn;
  const end = booking.endDate || booking.checkOut;

  if (start && end) return `${start}–${end}`;
  if (start) return start;
  return "Dates pending";
}

function formatTripBadge(status?: string) {
  if (!status) return "Booked Stay";

  const normalized = status.toLowerCase();

  if (normalized.includes("cancel")) return "Cancelled";
  if (normalized.includes("complete")) return "Completed";
  if (normalized.includes("upcoming")) return "Upcoming";
  if (normalized.includes("confirm")) return "Confirmed";

  return "Booked Stay";
}

export default function AccountPage() {
  const { user, loading } = useAuth();

  const [loadingData, setLoadingData] = useState(true);
  const [userDoc, setUserDoc] = useState<UserDoc | null>(null);
  const [myListings, setMyListings] = useState<ListingDoc[]>([]);
  const [myTrips, setMyTrips] = useState<BookingDoc[]>([]);
  const [hostedBookings, setHostedBookings] = useState<BookingDoc[]>([]);

  useEffect(() => {
    async function loadAccountData() {
      if (!user?.uid) {
        setUserDoc(null);
        setMyListings([]);
        setMyTrips([]);
        setHostedBookings([]);
        setLoadingData(false);
        return;
      }

      setLoadingData(true);

      try {
        // Load user document
        const usersSnap = await getDocs(
          query(collection(db, "users"), where("__name__", "==", user.uid))
        );

        if (!usersSnap.empty) {
          setUserDoc(usersSnap.docs[0].data() as UserDoc);
        } else {
          setUserDoc(null);
        }

        // Load listings owned by this user
        const listingsSnap = await getDocs(
          query(collection(db, "listings"), where("hostId", "==", user.uid))
        );

        const listings = listingsSnap.docs.map((doc) => ({
          id: doc.id,
          ...(doc.data() as Omit<ListingDoc, "id">),
        }));

        setMyListings(listings);

        // Load hosted bookings
        const hostedBookingsSnap = await getDocs(
          query(collection(db, "bookings"), where("hostId", "==", user.uid))
        );

        const hosted = hostedBookingsSnap.docs.map((doc) => ({
          id: doc.id,
          ...(doc.data() as Omit<BookingDoc, "id">),
        }));

        setHostedBookings(hosted);

        // Defensive traveler-side booking lookup
        const allBookingsSnap = await getDocs(collection(db, "bookings"));

        const allBookings = allBookingsSnap.docs.map((doc) => ({
          id: doc.id,
          ...(doc.data() as Omit<BookingDoc, "id">),
        }));

        const trips = allBookings.filter(
          (booking) => getTripOwnerId(booking) === user.uid
        );

        setMyTrips(trips);
      } catch (error) {
        console.error("Failed to load account data:", error);
        setUserDoc(null);
        setMyListings([]);
        setMyTrips([]);
        setHostedBookings([]);
      } finally {
        setLoadingData(false);
      }
    }

    loadAccountData();
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

  const memberSince = useMemo(() => {
    return formatMemberSince(userDoc?.createdAt);
  }, [userDoc?.createdAt]);

  const hasListings = myListings.length > 0;

  if (!loading && !user) {
    return (
      <main className={styles.page}>
        <header className={styles.header}>
          <div className={styles.headerInner}>
            <Link href="/" className={styles.brand} aria-label="RVNB Home">
              <img
                src="/rvnb-logo-icon.png"
                alt="RVNB"
                className={styles.brandIcon}
                width={180}
                height={72}
              />
            </Link>

            <nav className={styles.nav} aria-label="Primary">
              <AuthNav
                navLinkClassName={styles.navLink}
                navCtaClassName={styles.navCta}
                navLogoutClassName={styles.navLink}
              />
            </nav>
          </div>
        </header>

        <section className={styles.contentSection}>
          <div className={styles.container}>
            <div className={styles.placeholderPanel}>
              <div className={styles.placeholderIcon}>🔐</div>
              <h2 className={styles.placeholderTitle}>Please sign in</h2>
              <p className={styles.placeholderText}>
                You need to be logged in to view your account page.
              </p>
            </div>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className={styles.page}>
      {/* Top Navigation */}
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <Link href="/" className={styles.brand} aria-label="RVNB Home">
            <img
              src="/rvnb-logo-icon.png"
              alt="RVNB"
              className={styles.brandIcon}
              width={180}
              height={72}
            />
          </Link>

          <nav className={styles.nav} aria-label="Primary">
            <AuthNav
              navLinkClassName={styles.navLink}
              navCtaClassName={styles.navCta}
              navLogoutClassName={styles.navLink}
            />
          </nav>
        </div>
      </header>

      {/* Banner / Hero Header */}
      <section className={styles.bannerSection}>
        <div className={styles.bannerImage} aria-hidden="true" />
        <div className={styles.bannerOverlay} aria-hidden="true" />

        <div className={styles.bannerContent}>
          <div className={styles.profileCard}>
            <div className={styles.avatarWrap}>
              <div className={styles.avatar}>{initial}</div>
              {hasListings ? (
                <div
                  className={styles.verifiedDot}
                  aria-label="Verified host badge"
                  title="Verified host"
                />
              ) : null}
            </div>

            <div className={styles.identityBlock}>
              <p className={styles.eyebrow}>My Account</p>

              <h1 className={styles.name}>
                {loading || loadingData ? "Loading profile..." : displayName}
              </h1>

              <p className={styles.roleLine}>
                {hasListings ? "Host & Traveler" : "Traveler"}
              </p>

              <div className={styles.metaStack}>
                <span className={styles.metaItem}>{locationLine}</span>
                <span className={styles.metaItem}>{memberSince}</span>
                {hasListings ? (
                  <span className={styles.badge}>✔ Verified Host</span>
                ) : null}
              </div>

              <div className={styles.actionRow}>
                <Link href="/account/edit" className={styles.primaryBtn}>
                  Edit Profile
                </Link>

                <Link href="/host" className={styles.secondaryBtn}>
                  Host Dashboard
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Main Content */}
      <section className={styles.contentSection}>
        <div className={styles.container}>
          {/* Stats Row */}
          <div className={styles.statsGrid}>
            <div className={styles.statCard}>
              <div className={styles.statTop}>
                <span className={styles.statIcon}>🅿</span>
                <span className={styles.statValue}>
                  {loadingData ? "--" : myListings.length}
                </span>
              </div>
              <div className={styles.statLabel}>Listings</div>
              <div className={styles.statSub}>Your hosted RV spots</div>
            </div>

            <div className={styles.statCard}>
              <div className={styles.statTop}>
                <span className={styles.statIcon}>🧭</span>
                <span className={styles.statValue}>
                  {loadingData ? "--" : myTrips.length}
                </span>
              </div>
              <div className={styles.statLabel}>Trips Taken</div>
              <div className={styles.statSub}>Bookings you’ve made</div>
            </div>

            <div className={styles.statCard}>
              <div className={styles.statTop}>
                <span className={styles.statIcon}>🏕</span>
                <span className={styles.statValue}>
                  {loadingData ? "--" : hostedBookings.length}
                </span>
              </div>
              <div className={styles.statLabel}>Bookings Hosted</div>
              <div className={styles.statSub}>Traveler stays at your spots</div>
            </div>

            <div className={styles.statCard}>
              <div className={styles.statTop}>
                <span className={styles.statIcon}>⭐</span>
                <span className={styles.statValue}>--</span>
              </div>
              <div className={styles.statLabel}>Rating</div>
              <div className={styles.statSub}>Not yet available</div>
            </div>
          </div>

          {/* My Listings */}
          <section className={styles.sectionBlock} aria-label="My listings">
            <div className={styles.sectionHeader}>
              <div>
                <h2 className={styles.sectionTitle}>My Listings</h2>
                <p className={styles.sectionSub}>
                  A preview of the RV spaces connected to your profile.
                </p>
              </div>

              <Link href="/host" className={styles.sectionLink}>
                Manage Listings
              </Link>
            </div>

            {loadingData ? (
              <div className={styles.placeholderPanel}>
                <div className={styles.placeholderIcon}>⏳</div>
                <h3 className={styles.placeholderTitle}>Loading listings...</h3>
                <p className={styles.placeholderText}>
                  Pulling your hosted RV spots from Firestore.
                </p>
              </div>
            ) : myListings.length === 0 ? (
              <div className={styles.placeholderPanel}>
                <div className={styles.placeholderIcon}>🏕</div>
                <h3 className={styles.placeholderTitle}>No listings yet</h3>
                <p className={styles.placeholderText}>
                  When you create hosted RV spots, they’ll appear here.
                </p>
              </div>
            ) : (
              <div className={styles.cardGrid}>
                {myListings.slice(0, 3).map((listing) => (
                  <article key={listing.id} className={styles.itemCard}>
                    <div className={styles.itemImage} />
                    <div className={styles.itemBody}>
                      <div className={styles.itemTopRow}>
                        <h3 className={styles.itemTitle}>
                          {listing.title || "Untitled Listing"}
                        </h3>
                        <span className={styles.itemPrice}>
                          {formatPrice(listing)}
                        </span>
                      </div>
                      <p className={styles.itemMeta}>
                        {[listing.city, listing.state].filter(Boolean).join(", ") ||
                          "Location not set"}
                      </p>
                      <p className={styles.itemText}>
                        {listing.description?.trim() ||
                          "This hosted RV space is connected to your profile and ready to be managed from your dashboard."}
                      </p>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>

          {/* My Trips */}
          <section className={styles.sectionBlock} aria-label="My trips">
            <div className={styles.sectionHeader}>
              <div>
                <h2 className={styles.sectionTitle}>My Trips</h2>
                <p className={styles.sectionSub}>
                  Your travel-side booking activity appears here.
                </p>
              </div>

              <Link href="/search" className={styles.sectionLink}>
                Find More Spots
              </Link>
            </div>

            {loadingData ? (
              <div className={styles.placeholderPanel}>
                <div className={styles.placeholderIcon}>⏳</div>
                <h3 className={styles.placeholderTitle}>Loading trips...</h3>
                <p className={styles.placeholderText}>
                  Pulling your traveler bookings from Firestore.
                </p>
              </div>
            ) : myTrips.length === 0 ? (
              <div className={styles.placeholderPanel}>
                <div className={styles.placeholderIcon}>🧭</div>
                <h3 className={styles.placeholderTitle}>No trips yet</h3>
                <p className={styles.placeholderText}>
                  When you book a stay through RVNB, it will appear here.
                </p>
              </div>
            ) : (
              <div className={styles.tripGrid}>
                {myTrips.slice(0, 2).map((trip) => (
                  <article key={trip.id} className={styles.tripCard}>
                    <div className={styles.tripImage} />
                    <div className={styles.tripBody}>
                      <div className={styles.tripTopRow}>
                        <h3 className={styles.itemTitle}>
                          {trip.listingTitle || trip.title || "Booked Stay"}
                        </h3>
                        <span className={styles.tripBadge}>
                          {formatTripBadge(trip.status)}
                        </span>
                      </div>
                      <p className={styles.itemMeta}>
                        {[trip.city, trip.state].filter(Boolean).join(", ") ||
                          "Location pending"}
                      </p>
                      <p className={styles.itemText}>{formatTripDates(trip)}</p>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>

          {/* Ratings Placeholder */}
          <section className={styles.sectionBlock} aria-label="Ratings and reviews">
            <div className={styles.sectionHeader}>
              <div>
                <h2 className={styles.sectionTitle}>Ratings &amp; Reviews</h2>
                <p className={styles.sectionSub}>
                  Trust and community feedback will live here as RVNB grows.
                </p>
              </div>
            </div>

            <div className={styles.placeholderPanel}>
              <div className={styles.placeholderIcon}>⭐</div>
              <h3 className={styles.placeholderTitle}>RVNB reviews are coming soon.</h3>
              <p className={styles.placeholderText}>
                This is where travelers and hosts will be able to rate their
                experience and build trust across the platform.
              </p>
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}
