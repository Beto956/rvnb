"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import { normalizeBookingStatus } from "@/lib/booking-status";
import { approveBooking, declineBooking } from "@/lib/booking-approval";

import HostGuard from "../components/HostGuard";
import HostDashboardHeader from "../components/HostDashboardHeader";
import HostStatsRow from "../components/HostStatsRow";
import HostBookingCalendar from "../components/HostBookingCalendar";
import HostListingsPanel, { HostListingCardData } from "../components/HostListingsPanel";
import HostBookingRequestsPanel, {
  HostBookingRequestData,
} from "../components/HostBookingRequestsPanel";
import HostPrioritiesPanel, { HostPriority } from "../components/HostPrioritiesPanel";
import HostOpportunityCard from "../components/HostOpportunityCard";
import HostOccupancyStats from "../components/HostOccupancyStats";
import HostRevenueSummary from "../components/HostRevenueSummary";

import styles from "../components/hostDashboard.module.css";

import type { HostAnalyticsBooking, HostAnalyticsListing } from "../components/hostDashboardUtils";

type Hookups = "Full" | "Partial" | "None";
type PricingType = "Night" | "Weekly" | "Monthly";

type ListingDoc = {
  title?: string;
  city?: string;
  state?: string;
  hostId?: string;
  lat?: number;
  lng?: number;
  price?: number;
  pricePerNight?: number;
  pricingType?: PricingType;
  hookups?: Hookups;
  createdAt?: unknown;
};

type ListingRow = {
  id: string;
  title: string;
  city: string;
  state: string;
  hostId: string;
  hasCoords: boolean;
  price: number;
  pricingType: PricingType;
  createdAt?: unknown;
};

type BookingType = "RV" | "LAND" | "RV_PROVIDED";

type BookingDoc = {
  listingId?: string;
  checkIn?: string;
  checkOut?: string;
  bookingType?: BookingType;
  nights?: number;
  estimatedTotal?: number;
  note?: string;
  status?: string;
  name?: string;
  createdAt?: unknown;
};

type BookingRow = {
  id: string;
  listingId: string;
  listingTitle: string;
  guestLabel: string;
  checkIn: string;
  checkOut: string;
  nights: number;
  estimatedTotal: number;
  note: string;
  status: "pending" | "approved" | "declined" | "cancelled" | "other";
};

function toListingRow(id: string, d: ListingDoc): ListingRow {
  return {
    id,
    title: (d.title ?? "(Untitled Listing)").toString(),
    city: (d.city ?? "(City not set)").toString(),
    state: (d.state ?? "(State)").toString(),
    hostId: (d.hostId ?? "").toString(),
    hasCoords: typeof d.lat === "number" && typeof d.lng === "number",
    price:
      typeof d.price === "number"
        ? d.price
        : typeof d.pricePerNight === "number"
        ? d.pricePerNight
        : 0,
    pricingType: (d.pricingType ?? "Night") as PricingType,
    createdAt: d.createdAt,
  };
}

function safeDateLabel(yyyyMmDd: string) {
  if (!yyyyMmDd) return "";
  const parts = yyyyMmDd.split("-");
  if (parts.length !== 3) return yyyyMmDd;
  const [y, m, d] = parts;
  return `${m}/${d}/${y}`;
}

export default function HostPage() {
  const { user } = useAuth();
  const userUid = user?.uid ?? "";

  const [hostName, setHostName] = useState<string>("Host");

  const [listings, setListings] = useState<ListingRow[]>([]);
  const [listingsLoading, setListingsLoading] = useState(true);
  const [listingsError, setListingsError] = useState("");

  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [bookingsLoading, setBookingsLoading] = useState(false);
  const [bookingsError, setBookingsError] = useState("");
  const [bookingStatus, setBookingStatus] = useState("");
  const [updatingBookingId, setUpdatingBookingId] = useState("");

  // Load host display name (safe, read-only, falls back gracefully).
  useEffect(() => {
    let active = true;

    async function loadDisplayName() {
      if (!userUid) {
        setHostName("Host");
        return;
      }

      try {
        const snap = await getDoc(doc(db, "users", userUid));
        const data = snap.exists() ? (snap.data() as { displayName?: string }) : undefined;
        const name =
          data?.displayName?.trim() ||
          user?.displayName?.trim() ||
          user?.email?.split("@")[0] ||
          "Host";
        if (active) setHostName(name);
      } catch {
        if (active) setHostName(user?.displayName?.trim() || "Host");
      }
    }

    loadDisplayName();
    return () => {
      active = false;
    };
  }, [userUid, user?.displayName, user?.email]);

  function toBookingRow(
    doc: { id: string; data: () => BookingDoc },
    listingTitleById: Map<string, string>
  ): BookingRow | null {
    try {
      const b = doc.data();
      const listingId = (b.listingId ?? "").toString();
      const normalized = normalizeBookingStatus(b.status);

      const status: BookingRow["status"] =
        normalized === "pending"
          ? "pending"
          : normalized === "approved"
          ? "approved"
          : normalized === "declined"
          ? "declined"
          : normalized === "cancelled"
          ? "cancelled"
          : "other";

      return {
        id: doc.id,
        listingId,
        listingTitle: listingTitleById.get(listingId) ?? "(Unknown listing)",
        guestLabel: (b.name ?? "").toString().trim() || "Guest request",
        checkIn: (b.checkIn ?? "").toString(),
        checkOut: (b.checkOut ?? "").toString(),
        nights: typeof b.nights === "number" ? b.nights : 0,
        estimatedTotal: typeof b.estimatedTotal === "number" ? b.estimatedTotal : 0,
        note: (b.note ?? "").toString(),
        status,
      };
    } catch (e) {
      // One malformed legacy record should never discard the rest of the list.
      console.error("[RVNB] Skipping malformed booking doc", doc.id, e);
      return null;
    }
  }

  function createdAtMillis(data: BookingDoc): number {
    const raw = data.createdAt as { toDate?: () => Date } | undefined;
    return typeof raw?.toDate === "function" ? raw.toDate().getTime() : 0;
  }

  async function loadBookingsForListings(listingRows: ListingRow[]) {
    setBookingsLoading(true);
    setBookingsError("");

    const listingTitleById = new Map<string, string>();
    listingRows.forEach((l) => listingTitleById.set(l.id, l.title));

    try {
      const q = query(
        collection(db, "bookings"),
        where("hostId", "==", userUid),
        orderBy("createdAt", "desc")
      );
      const snap = await getDocs(q);
      const rows = snap.docs
        .map((d) => toBookingRow(d, listingTitleById))
        .filter((row): row is BookingRow => row !== null);

      setBookings(rows);
    } catch (e) {
      const code = (e as { code?: string })?.code ?? "unknown";
      console.error(`[RVNB] bookings query failed (code: ${code})`, e);

      // The indexed query needs a composite index (hostId + createdAt). If that index
      // isn't available yet, fall back to an index-free equality query and sort client-side
      // rather than showing a false failure — mirrors the existing listings-load fallback.
      try {
        const q2 = query(collection(db, "bookings"), where("hostId", "==", userUid));
        const snap2 = await getDocs(q2);
        const sortedDocs = [...snap2.docs].sort(
          (a, b) => createdAtMillis(b.data() as BookingDoc) - createdAtMillis(a.data() as BookingDoc)
        );
        const rows2 = sortedDocs
          .map((d) => toBookingRow(d, listingTitleById))
          .filter((row): row is BookingRow => row !== null);

        setBookings(rows2);
      } catch (e2) {
        const code2 = (e2 as { code?: string })?.code ?? "unknown";
        console.error(`[RVNB] bookings fallback query also failed (code: ${code2})`, e2);
        setBookingsError(
          "We couldn't load your booking requests. This may be a temporary Firestore issue — try refreshing."
        );
        setBookings([]);
      }
    } finally {
      setBookingsLoading(false);
    }
  }

  async function loadListingsAndBookings() {
    setListingsLoading(true);
    setListingsError("");
    setBookingStatus("");

    if (!userUid) {
      setListings([]);
      setBookings([]);
      setListingsLoading(false);
      return;
    }

    try {
      const q1 = query(
        collection(db, "listings"),
        where("hostId", "==", userUid),
        orderBy("createdAt", "desc")
      );
      const snap = await getDocs(q1);
      const rows = snap.docs.map((d) => toListingRow(d.id, d.data() as ListingDoc));
      setListings(rows);
      await loadBookingsForListings(rows);
    } catch (e) {
      const code = (e as { code?: string })?.code ?? "unknown";
      console.error(`[RVNB] listings query failed (code: ${code})`, e);

      try {
        const q2 = query(collection(db, "listings"), where("hostId", "==", userUid));
        const snap2 = await getDocs(q2);
        const rows2 = snap2.docs
          .map((d) => toListingRow(d.id, d.data() as ListingDoc))
          .sort((a, b) => {
            const ta =
              typeof (a.createdAt as { toDate?: () => Date })?.toDate === "function"
                ? (a.createdAt as { toDate: () => Date }).toDate().getTime()
                : 0;
            const tb =
              typeof (b.createdAt as { toDate?: () => Date })?.toDate === "function"
                ? (b.createdAt as { toDate: () => Date }).toDate().getTime()
                : 0;
            return tb - ta;
          });

        setListings(rows2);
        await loadBookingsForListings(rows2);
      } catch (e2) {
        const code2 = (e2 as { code?: string })?.code ?? "unknown";
        console.error(`[RVNB] listings fallback query also failed (code: ${code2})`, e2);
        setListingsError(
          "We couldn't load your listings. This may be a Firestore permission or connectivity issue — try refreshing."
        );
        setListings([]);
        setBookings([]);
      }
    } finally {
      setListingsLoading(false);
    }
  }

  useEffect(() => {
    loadListingsAndBookings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userUid]);

  async function setBookingStatusValue(bookingId: string, nextStatus: "approved" | "declined") {
    setBookingStatus("");
    setUpdatingBookingId(bookingId);
    try {
      const result =
        nextStatus === "approved" ? await approveBooking(bookingId) : await declineBooking(bookingId);

      if (!result.ok) {
        setBookingStatus(`❌ ${result.message}`);
        return;
      }

      setBookings((prev) =>
        prev.map((b) => (b.id === bookingId ? { ...b, status: nextStatus } : b))
      );
    } finally {
      setUpdatingBookingId("");
    }
  }

  const pendingBookings = useMemo(
    () => bookings.filter((b) => b.status === "pending"),
    [bookings]
  );

  const analyticsListings = useMemo<HostAnalyticsListing[]>(
    () => listings.map((l) => ({ id: l.id, title: l.title })),
    [listings]
  );

  const analyticsBookings = useMemo<HostAnalyticsBooking[]>(
    () =>
      bookings.map((b) => ({
        id: b.id,
        listingId: b.listingId,
        listingTitle: b.listingTitle,
        checkIn: b.checkIn,
        checkOut: b.checkOut,
        nights: b.nights,
        estimatedTotal: b.estimatedTotal,
        status: b.status,
        guestLabel: b.guestLabel,
      })),
    [bookings]
  );

  const listingCards = useMemo<HostListingCardData[]>(() => {
    return listings.map((l) => {
      const listingBookings = bookings.filter((b) => b.listingId === l.id);
      const upcomingBookingCount = listingBookings.filter(
        (b) => b.status === "pending" || b.status === "approved"
      ).length;
      const pendingBookingCount = listingBookings.filter((b) => b.status === "pending").length;

      return {
        id: l.id,
        title: l.title,
        city: l.city,
        state: l.state,
        price: l.price,
        pricingType: l.pricingType,
        hasCoords: l.hasCoords,
        upcomingBookingCount,
        pendingBookingCount,
      };
    });
  }, [listings, bookings]);

  const bookingCards = useMemo<HostBookingRequestData[]>(() => {
    return bookings.map((b) => ({
      id: b.id,
      listingTitle: b.listingTitle,
      guestLabel: b.guestLabel,
      checkInLabel: safeDateLabel(b.checkIn),
      checkOutLabel: safeDateLabel(b.checkOut),
      nights: b.nights,
      estimatedTotal: b.estimatedTotal,
      status: b.status,
      note: b.note,
    }));
  }, [bookings]);

  const priorities = useMemo<HostPriority[]>(() => {
    const items: HostPriority[] = [];

    if (!listingsLoading && listings.length === 0) {
      items.push({
        key: "no-listings",
        title: "Create your first listing",
        text: "Your dashboard is ready — add a listing to start receiving requests.",
        href: "/host/listings/new",
        linkLabel: "Add listing",
      });
    }

    if (pendingBookings.length > 0) {
      items.push({
        key: "pending-requests",
        title: "Review pending booking requests",
        text: `${pendingBookings.length} request${
          pendingBookings.length === 1 ? "" : "s"
        } waiting for your approval or decline.`,
        href: "#booking-requests",
        linkLabel: "Review",
      });
    }

    const listingsMissingCoords = listings.filter((l) => !l.hasCoords);
    if (listingsMissingCoords.length > 0) {
      items.push({
        key: "missing-coords",
        title: "Confirm listing locations",
        text: `${listingsMissingCoords.length} listing${
          listingsMissingCoords.length === 1 ? "" : "s"
        } don't have map coordinates saved yet.`,
        href: "/host/listings/new",
        linkLabel: "Fix location",
      });
    }

    if (!listingsLoading && listings.length > 0) {
      items.push({
        key: "keep-calendar-updated",
        title: "Keep your calendar up to date",
        text: "Block unavailable dates and add day notes so guests see accurate availability.",
        href: "/host/calendar",
        linkLabel: "Open calendar",
      });
    }

    return items;
  }, [listings, listingsLoading, pendingBookings.length]);

  return (
    <HostGuard>
      <div className={styles.page}>
        <HostDashboardHeader hostName={hostName} />

        <div className={styles.container}>
          <HostStatsRow
            listings={analyticsListings}
            bookings={analyticsBookings}
            pendingCount={pendingBookings.length}
          />

          <div className={styles.dashboardGrid}>
            <div className={styles.mainCol}>
              <HostBookingCalendar
                listings={analyticsListings}
                bookings={analyticsBookings}
                hostId={userUid}
                listingsLoading={listingsLoading}
                listingsError={listingsError}
                bookingsLoading={bookingsLoading}
                bookingsError={bookingsError}
              />

              <HostListingsPanel
                listings={listingCards}
                loading={listingsLoading}
                error={listingsError}
              />

              <div id="booking-requests">
                <HostBookingRequestsPanel
                  bookings={bookingCards}
                  loading={bookingsLoading}
                  error={bookingsError}
                  updatingId={updatingBookingId}
                  onApprove={(id) => setBookingStatusValue(id, "approved")}
                  onDecline={(id) => setBookingStatusValue(id, "declined")}
                />
                {bookingStatus && <div className={styles.errorBox}>{bookingStatus}</div>}
              </div>
            </div>

            <div className={styles.sideCol}>
              <HostPrioritiesPanel priorities={priorities} />
              <HostOpportunityCard />
              <HostOccupancyStats listings={analyticsListings} bookings={analyticsBookings} />
              <HostRevenueSummary listings={analyticsListings} bookings={analyticsBookings} />
            </div>
          </div>
        </div>
      </div>
    </HostGuard>
  );
}
