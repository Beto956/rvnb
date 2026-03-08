"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  addDoc,
  collection,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

// ✅ ADD (auth) — minimal + additive, does NOT reconfigure Firebase
import { getAuth, onAuthStateChanged } from "firebase/auth";

// ✅ ADD: Host route protection (role gate)
import HostGuard from "../components/HostGuard";

// ✅ ADD: Manual pin picker (rural-friendly)
import HostLocationPicker from "../components/HostLocationPicker";

// ✅ ADD: Host analytics components
import HostDashboardKpis from "../components/HostDashboardKpis";
import HostBookingCalendar from "../components/HostBookingCalendar";
import HostOccupancyStats from "../components/HostOccupancyStats";
import HostRevenueSummary from "../components/HostRevenueSummary";

import type {
  HostAnalyticsBooking,
  HostAnalyticsListing,
} from "../components/hostDashboardUtils";

type Hookups = "Full" | "Partial" | "None";
type PricingType = "Night" | "Weekly" | "Monthly";

type ListingDoc = {
  title?: string;
  city?: string;
  state?: string;

  // ✅ ADD (owner field, additive)
  hostId?: string;

  // ✅ ADD (coords for map — additive)
  lat?: number;
  lng?: number;

  // ✅ ADD (optional geocode metadata — additive)
  geocodeAddress?: string;
  placeId?: string;

  price?: number;
  pricePerNight?: number; // ✅ legacy fallback
  pricingType?: PricingType;

  maxLengthFt?: number;
  hookups?: Hookups;

  // Listing detail page expects THESE as strings
  power?: string; // "None" | "30A" | "50A" | "30A/50A"
  water?: string; // "None" | "Yes"
  sewer?: string; // "None" | "Yes" | "Dump station"
  laundry?: string; // "None" | "Washer/Dryer" | "Wash & Fold" | "Both"

  // Optional text
  description?: string;

  // ✅ New (safe/additive) amenities
  wifi?: boolean;
  petsAllowed?: boolean;
  firePit?: boolean;
  picnicTable?: boolean;
  pullThrough?: boolean;
  trashPickup?: boolean;
  securityCameras?: boolean;

  gym?: boolean;
  bathrooms?: boolean;
  showers?: boolean;

  // ✅ New (safe/additive): nearby attractions / theme parks
  nearbyAttractions?: string;

  createdAt?: any;
};

type ListingUI = {
  id: string;
  title: string;
  city: string;
  state: string;

  // ✅ ADD (owner field, additive)
  hostId: string;

  // ✅ ADD (coords for map — additive)
  lat?: number;
  lng?: number;

  // ✅ ADD (optional geocode metadata — additive)
  geocodeAddress?: string;
  placeId?: string;

  price: number;
  pricingType: PricingType;
  maxLengthFt: number;
  hookups: Hookups;

  power: string;
  water: string;
  sewer: string;
  laundry: string;

  description: string;

  wifi: boolean;
  petsAllowed: boolean;
  firePit: boolean;
  picnicTable: boolean;
  pullThrough: boolean;
  trashPickup: boolean;
  securityCameras: boolean;

  gym: boolean;
  bathrooms: boolean;
  showers: boolean;

  nearbyAttractions: string;

  createdAt?: any;
};

type ListingFilter =
  | "All"
  | "Full hookups"
  | "Has showers"
  | "Has bathrooms"
  | "Has gym"
  | "Has wifi"
  | "Pets allowed"
  | "Under $50"
  | "Power 50A"
  | "Full sewer"
  | "Laundry available"
  | "Has nearby attractions";

type BookingType = "RV" | "LAND" | "RV_PROVIDED";

type BookingDoc = {
  listingId?: string;
  checkIn?: string;
  checkOut?: string;
  bookingType?: BookingType;
  nights?: number;
  estimatedTotal?: number;
  note?: string;
  status?: string; // requested | confirmed | cancelled
  createdAt?: any;
};

type BookingUI = {
  id: string;
  listingId: string;
  listingTitle: string;

  checkIn: string;
  checkOut: string;
  bookingType: BookingType;
  nights: number;
  estimatedTotal: number;
  note: string;
  status: "requested" | "confirmed" | "cancelled" | "other";
  createdAtLabel: string;
};

type BookingFilter = "All" | "Requested" | "Confirmed" | "Cancelled";

function safeDateLabel(yyyyMmDd: string) {
  if (!yyyyMmDd) return "";
  const parts = yyyyMmDd.split("-");
  if (parts.length !== 3) return yyyyMmDd;
  const [y, m, d] = parts;
  return `${m}/${d}/${y}`;
}

function safeTimestampLabel(ts: any) {
  try {
    if (!ts) return "";
    if (typeof ts.toDate === "function") {
      const d = ts.toDate() as Date;
      return d.toLocaleString();
    }
  } catch {}
  return "";
}

function sortByCreatedAtDesc(rows: ListingUI[]) {
  return [...rows].sort((a, b) => {
    const ta =
      typeof a.createdAt?.toDate === "function" ? a.createdAt.toDate().getTime() : 0;
    const tb =
      typeof b.createdAt?.toDate === "function" ? b.createdAt.toDate().getTime() : 0;
    return tb - ta;
  });
}

function toUI(id: string, d: ListingDoc): ListingUI {
  return {
    id,
    title: (d.title ?? "(Untitled Listing)").toString(),
    city: (d.city ?? "(City not set)").toString(),
    state: (d.state ?? "(State)").toString(),

    hostId: (d.hostId ?? "").toString(),

    lat: typeof d.lat === "number" ? d.lat : undefined,
    lng: typeof d.lng === "number" ? d.lng : undefined,

    geocodeAddress: (d.geocodeAddress ?? "").toString() || undefined,
    placeId: (d.placeId ?? "").toString() || undefined,

    price:
      typeof d.price === "number"
        ? d.price
        : typeof d.pricePerNight === "number"
        ? d.pricePerNight
        : 0,

    pricingType: (d.pricingType ?? "Night") as PricingType,

    maxLengthFt: typeof d.maxLengthFt === "number" ? d.maxLengthFt : 0,
    hookups: (d.hookups ?? "None") as Hookups,

    power: (d.power ?? "None").toString(),
    water: (d.water ?? "None").toString(),
    sewer: (d.sewer ?? "None").toString(),
    laundry: (d.laundry ?? "None").toString(),

    description: (d.description ?? "").toString(),

    wifi: Boolean(d.wifi),
    petsAllowed: Boolean(d.petsAllowed),
    firePit: Boolean(d.firePit),
    picnicTable: Boolean(d.picnicTable),
    pullThrough: Boolean(d.pullThrough),
    trashPickup: Boolean(d.trashPickup),
    securityCameras: Boolean(d.securityCameras),

    gym: Boolean(d.gym),
    bathrooms: Boolean(d.bathrooms),
    showers: Boolean(d.showers),

    nearbyAttractions: (d.nearbyAttractions ?? "").toString(),

    createdAt: d.createdAt,
  };
}

// ✅ ADD: type for geocode response (additive)
type GeocodeResult =
  | {
      ok: true;
      address?: string;
      formattedAddress?: string;
      lat: number;
      lng: number;
      placeId?: string;
    }
  | {
      ok: false;
      status?: string;
      error_message?: string;
      address?: string;
    };

// ✅ ADD: call server route to geocode (no key exposed, additive)
async function geocodeCityState(
  city: string,
  state: string
): Promise<GeocodeResult | null> {
  try {
    const res = await fetch("/api/geocode", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ city, state }),
    });

    const data = (await res.json()) as any;
    if (!data) return null;

    if (data.ok === true && typeof data.lat === "number" && typeof data.lng === "number") {
      return {
        ok: true,
        address: data.address,
        formattedAddress: data.formattedAddress,
        lat: data.lat,
        lng: data.lng,
        placeId: data.placeId,
      };
    }

    if (data.ok === false) {
      return {
        ok: false,
        status: data.status,
        error_message: data.error_message,
        address: data.address,
      };
    }

    return null;
  } catch {
    return null;
  }
}

export default function HostPage() {
  const [userUid, setUserUid] = useState<string>("");

  // form fields
  const [title, setTitle] = useState("");
  const [city, setCity] = useState("");
  const [stateCode, setStateCode] = useState("");

  const [price, setPrice] = useState<number>(35);
  const [pricingType, setPricingType] = useState<PricingType>("Night");
  const [isPriceFocused, setIsPriceFocused] = useState(false);

  const [maxLengthFt, setMaxLengthFt] = useState<number>(35);
  const [hookups, setHookups] = useState<Hookups>("Full");

  const [description, setDescription] = useState("");
  const [nearbyAttractions, setNearbyAttractions] = useState("");

  // amenities (existing)
  const [power30, setPower30] = useState(false);
  const [power50, setPower50] = useState(true);
  const [water, setWater] = useState(false);
  const [sewer, setSewer] = useState(false);
  const [dump, setDump] = useState(false);

  const [laundry, setLaundry] = useState(false);
  const [washFold, setWashFold] = useState(false);

  // ✅ new amenities
  const [wifi, setWifi] = useState(false);
  const [petsAllowed, setPetsAllowed] = useState(false);
  const [firePit, setFirePit] = useState(false);
  const [picnicTable, setPicnicTable] = useState(false);
  const [pullThrough, setPullThrough] = useState(false);
  const [trashPickup, setTrashPickup] = useState(false);
  const [securityCameras, setSecurityCameras] = useState(false);

  const [gym, setGym] = useState(false);
  const [bathrooms, setBathrooms] = useState(false);
  const [showers, setShowers] = useState(false);

  // ✅ ADD: manual pin override (rural-friendly)
  const [manualLocationEnabled, setManualLocationEnabled] = useState(false);
  const [manualLat, setManualLat] = useState<number | null>(null);
  const [manualLng, setManualLng] = useState<number | null>(null);

  // firestore listings
  const [listings, setListings] = useState<ListingUI[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string>("");

  // search + filter UI state
  const [searchText, setSearchText] = useState("");
  const [listingFilter, setListingFilter] = useState<ListingFilter>("All");

  // bookings state
  const [bookings, setBookings] = useState<BookingUI[]>([]);
  const [bookingsLoading, setBookingsLoading] = useState(false);
  const [bookingFilter, setBookingFilter] = useState<BookingFilter>("All");
  const [bookingStatus, setBookingStatus] = useState("");
  const [updatingBookingId, setUpdatingBookingId] = useState<string>("");

  const showDollar = isPriceFocused || price > 0;

  const powerValue = useMemo(() => {
    if (power30 && power50) return "30A/50A";
    if (power30) return "30A";
    if (power50) return "50A";
    return "None";
  }, [power30, power50]);

  const waterValue = useMemo(() => (water ? "Yes" : "None"), [water]);

  const sewerValue = useMemo(() => {
    if (sewer) return "Yes";
    if (dump) return "Dump station";
    return "None";
  }, [sewer, dump]);

  const laundryValue = useMemo(() => {
    if (laundry && washFold) return "Both";
    if (laundry) return "Washer/Dryer";
    if (washFold) return "Wash & Fold";
    return "None";
  }, [laundry, washFold]);

  async function loadListingsAndBookings() {
    setLoading(true);
    setBookingStatus("");
    setStatus("");

    if (!userUid) {
      setListings([]);
      setBookings([]);
      setLoading(false);
      return;
    }

    try {
      const q1 = query(
        collection(db, "listings"),
        where("hostId", "==", userUid),
        orderBy("createdAt", "desc")
      );

      const snap = await getDocs(q1);
      const rows = snap.docs.map((d) => toUI(d.id, d.data() as ListingDoc));
      setListings(rows);

      await loadBookingsForListings(rows);
    } catch (e: any) {
      console.error(e);

      try {
        const q2 = query(collection(db, "listings"), where("hostId", "==", userUid));
        const snap2 = await getDocs(q2);
        const rows2Raw = snap2.docs.map((d) => toUI(d.id, d.data() as ListingDoc));
        const rows2 = sortByCreatedAtDesc(rows2Raw);

        setListings(rows2);
        await loadBookingsForListings(rows2);

        setStatus(
          "⚠️ Listings loaded (ownership filtered). If you saw an index warning in console, create it later."
        );
      } catch (e2) {
        console.error(e2);
        setStatus("❌ Could not load your listings.");
        setListings([]);
        setBookings([]);
      }
    } finally {
      setLoading(false);
    }
  }

  async function loadBookingsForListings(listingRows: ListingUI[]) {
    setBookingsLoading(true);
    try {
      const ids = listingRows.map((l) => l.id);
      if (ids.length === 0) {
        setBookings([]);
        return;
      }

      const chunks: string[][] = [];
      for (let i = 0; i < ids.length; i += 10) chunks.push(ids.slice(i, i + 10));

      const listingTitleById = new Map<string, string>();
      listingRows.forEach((l) => listingTitleById.set(l.id, l.title));

      const all: BookingUI[] = [];

      for (const chunk of chunks) {
        const q = query(
          collection(db, "bookings"),
          where("listingId", "in", chunk),
          orderBy("createdAt", "desc")
        );

        const snap = await getDocs(q);

        snap.docs.forEach((d) => {
          const b = d.data() as BookingDoc;

          const listingId = (b.listingId ?? "").toString();
          const statusRaw = (b.status ?? "").toString().toLowerCase();

          const statusNorm: BookingUI["status"] =
            statusRaw === "requested"
              ? "requested"
              : statusRaw === "confirmed"
              ? "confirmed"
              : statusRaw === "cancelled" || statusRaw === "canceled"
              ? "cancelled"
              : "other";

          all.push({
            id: d.id,
            listingId,
            listingTitle: listingTitleById.get(listingId) ?? "(Unknown listing)",

            checkIn: (b.checkIn ?? "").toString(),
            checkOut: (b.checkOut ?? "").toString(),
            bookingType: (b.bookingType ?? "RV") as BookingType,
            nights: typeof b.nights === "number" ? b.nights : 0,
            estimatedTotal: typeof b.estimatedTotal === "number" ? b.estimatedTotal : 0,
            note: (b.note ?? "").toString(),
            status: statusNorm,
            createdAtLabel: safeTimestampLabel(b.createdAt) || "",
          });
        });
      }

      setBookings(all);
    } catch (e: any) {
      console.error(e);
      setBookingStatus("⚠️ Could not load bookings yet (may need an index).");
      setBookings([]);
    } finally {
      setBookingsLoading(false);
    }
  }

  useEffect(() => {
    const auth = getAuth();
    const unsub = onAuthStateChanged(auth, (u) => {
      setUserUid(u?.uid ? u.uid : "");
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    loadListingsAndBookings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userUid]);

  const filteredListings = useMemo(() => {
    const qText = searchText.trim().toLowerCase();

    const matchesSearch = (l: ListingUI) => {
      if (!qText) return true;
      const hay = `${l.title} ${l.city} ${l.state}`.toLowerCase();
      return hay.includes(qText);
    };

    const matchesFilter = (l: ListingUI) => {
      switch (listingFilter) {
        case "All":
          return true;
        case "Full hookups":
          return l.hookups === "Full";
        case "Has showers":
          return l.showers === true;
        case "Has bathrooms":
          return l.bathrooms === true;
        case "Has gym":
          return l.gym === true;
        case "Has wifi":
          return l.wifi === true;
        case "Pets allowed":
          return l.petsAllowed === true;
        case "Under $50":
          return l.price > 0 && l.price < 50;
        case "Power 50A":
          return l.power.includes("50A");
        case "Full sewer":
          return l.sewer === "Yes";
        case "Laundry available":
          return l.laundry !== "None";
        case "Has nearby attractions":
          return (l.nearbyAttractions ?? "").trim().length > 0;
        default:
          return true;
      }
    };

    return listings.filter((l) => matchesSearch(l) && matchesFilter(l));
  }, [listings, searchText, listingFilter]);

  const filteredCountLabel = useMemo(() => {
    const total = listings.length;
    const shown = filteredListings.length;
    if (total === shown) return `${total} listing${total === 1 ? "" : "s"}`;
    return `${shown} of ${total} listing${total === 1 ? "" : "s"}`;
  }, [listings.length, filteredListings.length]);

  function clearSearchAndFilter() {
    setSearchText("");
    setListingFilter("All");
  }

  const filteredBookings = useMemo(() => {
    if (bookingFilter === "All") return bookings;
    if (bookingFilter === "Requested") {
      return bookings.filter((b) => b.status === "requested");
    }
    if (bookingFilter === "Confirmed") {
      return bookings.filter((b) => b.status === "confirmed");
    }
    if (bookingFilter === "Cancelled") {
      return bookings.filter((b) => b.status === "cancelled");
    }
    return bookings;
  }, [bookings, bookingFilter]);

  const bookingCounts = useMemo(() => {
    const requested = bookings.filter((b) => b.status === "requested").length;
    const confirmed = bookings.filter((b) => b.status === "confirmed").length;
    const cancelled = bookings.filter((b) => b.status === "cancelled").length;
    return { requested, confirmed, cancelled, total: bookings.length };
  }, [bookings]);

  // ✅ ADD: analytics adapters
  const analyticsListings = useMemo<HostAnalyticsListing[]>(() => {
    return listings.map((l) => ({
      id: l.id,
      title: l.title,
    }));
  }, [listings]);

  const analyticsBookings = useMemo<HostAnalyticsBooking[]>(() => {
    return bookings.map((b) => ({
      id: b.id,
      listingId: b.listingId,
      listingTitle: b.listingTitle,
      checkIn: b.checkIn,
      checkOut: b.checkOut,
      nights: b.nights,
      estimatedTotal: b.estimatedTotal,
      status: b.status,
    }));
  }, [bookings]);

  function validate(): string | null {
    const t = title.trim();
    const c = city.trim();
    const s = stateCode.trim().toUpperCase();

    if (!t) return "Please enter a listing title.";
    if (!c) return "Please enter a city.";
    if (s.length !== 2) return "State must be 2 letters (example: TX).";
    if (!Number.isFinite(price) || price < 0) return "Price must be 0 or more.";
    if (!Number.isFinite(maxLengthFt) || maxLengthFt < 0) {
      return "Max length must be 0 or more.";
    }

    // ✅ ADD: if manual override enabled, require pin
    if (manualLocationEnabled && (manualLat === null || manualLng === null)) {
      return "Manual location is enabled — please drop a pin on the map (or turn manual location off).";
    }

    return null;
  }

  function resetAmenities() {
    setPower30(false);
    setPower50(true);
    setWater(false);
    setSewer(false);
    setDump(false);

    setLaundry(false);
    setWashFold(false);

    setWifi(false);
    setPetsAllowed(false);
    setFirePit(false);
    setPicnicTable(false);
    setPullThrough(false);
    setTrashPickup(false);
    setSecurityCameras(false);

    setGym(false);
    setBathrooms(false);
    setShowers(false);
  }

  function resetManualPin() {
    setManualLat(null);
    setManualLng(null);
    setManualLocationEnabled(false);
  }

  async function handleCreate() {
    setStatus("");
    const err = validate();
    if (err) {
      setStatus(`⚠️ ${err}`);
      return;
    }

    if (!userUid) {
      setStatus("⚠️ You must be logged in to create a listing.");
      return;
    }

    const c = city.trim();
    const s = stateCode.trim().toUpperCase();

    setSaving(true);
    try {
      // ✅ Auto-geocode unless manual pin is enabled
      let geo: GeocodeResult | null = null;
      if (!manualLocationEnabled && c && s) {
        geo = await geocodeCityState(c, s);
      }

      const basePayload: any = {
        hostId: userUid,

        title: title.trim(),
        city: c,
        state: s,

        price: Number(price) || 0,
        pricingType,

        maxLengthFt: Number(maxLengthFt) || 0,
        hookups,

        power: powerValue,
        water: waterValue,
        sewer: sewerValue,
        laundry: laundryValue,

        description: description.trim(),
        nearbyAttractions: nearbyAttractions.trim(),

        wifi,
        petsAllowed,
        firePit,
        picnicTable,
        pullThrough,
        trashPickup,
        securityCameras,
        gym,
        bathrooms,
        showers,

        createdAt: serverTimestamp(),
      };

      // ✅ Manual pin override wins
      if (manualLocationEnabled && manualLat !== null && manualLng !== null) {
        basePayload.lat = manualLat;
        basePayload.lng = manualLng;
        basePayload.geocodeAddress = "MANUAL_PIN";
        basePayload.placeId = "";
      } else if (geo && geo.ok === true) {
        basePayload.lat = geo.lat;
        basePayload.lng = geo.lng;
        basePayload.placeId = geo.placeId ?? "";
        basePayload.geocodeAddress = (
          geo.formattedAddress ??
          geo.address ??
          ""
        ).toString();
      }

      await addDoc(collection(db, "listings"), basePayload);

      if (manualLocationEnabled && manualLat !== null && manualLng !== null) {
        setStatus("✅ Listing created! (Manual pin saved for map)");
      } else if (geo && geo.ok === true) {
        setStatus("✅ Listing created! (Coords saved for map)");
      } else {
        setStatus("✅ Listing created! (No coords yet — city/state may be too broad)");
      }

      setTitle("");
      setCity("");
      setStateCode("");
      setDescription("");
      setNearbyAttractions("");
      resetAmenities();
      resetManualPin();

      await loadListingsAndBookings();
    } catch (e) {
      console.error(e);
      setStatus("❌ Could not create listing.");
    } finally {
      setSaving(false);
    }
  }

  async function setBookingStatusValue(
    bookingId: string,
    nextStatus: "confirmed" | "cancelled"
  ) {
    setBookingStatus("");
    setUpdatingBookingId(bookingId);
    try {
      await updateDoc(doc(db, "bookings", bookingId), {
        status: nextStatus,
      });

      setBookings((prev) =>
        prev.map((b) =>
          b.id === bookingId
            ? { ...b, status: nextStatus === "confirmed" ? "confirmed" : "cancelled" }
            : b
        )
      );

      setBookingStatus(
        nextStatus === "confirmed" ? "✅ Booking approved." : "✅ Booking rejected."
      );
    } catch (e) {
      console.error(e);
      setBookingStatus("❌ Could not update booking status.");
    } finally {
      setUpdatingBookingId("");
    }
  }

  return (
    <HostGuard>
      <main style={wrap}>
        <div style={hero}>
          <div>
            <h1 style={heroTitle}>Host Dashboard</h1>
            <p style={heroSub}>
              Create listings and manage your spots. This is now connected to Firestore
              (real data).
            </p>
          </div>

          <Link href="/listings" style={ghostBtn}>
            View public listings →
          </Link>
        </div>

        {/* ✅ ADD: Host business command center analytics */}
        <div style={analyticsWrap}>
          <HostDashboardKpis
            listings={analyticsListings}
            bookings={analyticsBookings}
          />

          <div style={analyticsGrid}>
            <HostBookingCalendar bookings={analyticsBookings} />

            <div style={analyticsSideCol}>
              <HostOccupancyStats
                listings={analyticsListings}
                bookings={analyticsBookings}
              />

              <HostRevenueSummary
                listings={analyticsListings}
                bookings={analyticsBookings}
              />
            </div>
          </div>
        </div>

        <div style={grid}>
          {/* LEFT: CREATE */}
          <section style={card}>
            <div style={sectionHeader}>
              <div>
                <h2 style={sectionTitle}>Create Listing</h2>
                <p style={sectionSub}>These fields match what your listing pages read.</p>
              </div>
            </div>

            {status && <div style={statusBox}>{status}</div>}

            <div style={fieldBlock}>
              <label style={label}>Listing title</label>
              <input
                style={input}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Example: Bet RV Park"
              />
            </div>

            <div style={row2}>
              <div style={fieldBlock}>
                <label style={label}>City</label>
                <input
                  style={input}
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="Mission"
                />
              </div>

              <div style={fieldBlock}>
                <label style={label}>State</label>
                <input
                  style={input}
                  value={stateCode}
                  onChange={(e) => setStateCode(e.target.value.toUpperCase().trim())}
                  placeholder="TX"
                  maxLength={2}
                />
              </div>
            </div>

            {/* ✅ ADD: Manual pin toggle */}
            <div style={{ ...mutedBox, marginTop: 14 }}>
              <label
                style={{ display: "flex", gap: 10, alignItems: "center", cursor: "pointer" }}
              >
                <input
                  type="checkbox"
                  checked={manualLocationEnabled}
                  onChange={(e) => {
                    const on = e.target.checked;
                    setManualLocationEnabled(on);
                    if (!on) {
                      setManualLat(null);
                      setManualLng(null);
                    }
                  }}
                />
                <div>
                  <div style={{ fontWeight: 900 }}>
                    Set exact location manually (recommended for rural)
                  </div>
                  <div style={{ opacity: 0.8, fontSize: 12, marginTop: 2 }}>
                    If enabled, you’ll drop a pin and we’ll save its lat/lng (overrides
                    auto-geocode).
                  </div>
                </div>
              </label>

              {manualLocationEnabled && (
                <div style={{ marginTop: 12 }}>
                  <HostLocationPicker
                    height={320}
                    initialValue={
                      manualLat !== null && manualLng !== null
                        ? { lat: manualLat, lng: manualLng }
                        : null
                    }
                    onChange={(v) => {
                      setManualLat(v?.lat ?? null);
                      setManualLng(v?.lng ?? null);
                    }}
                  />
                </div>
              )}
            </div>

            {/* PRICE */}
            <div style={fieldBlock}>
              <label style={label}>Price</label>
              <div style={priceRow}>
                <div style={priceInputWrapper}>
                  {showDollar && <span style={priceSymbol}>$</span>}
                  <input
                    style={{
                      ...priceInput,
                      paddingLeft: showDollar ? 22 : 12,
                    }}
                    type="number"
                    min={0}
                    value={price}
                    onChange={(e) => setPrice(Math.max(0, Number(e.target.value)))}
                    onFocus={() => setIsPriceFocused(true)}
                    onBlur={() => setIsPriceFocused(false)}
                    placeholder="0"
                  />
                </div>

                <select
                  style={select}
                  value={pricingType}
                  onChange={(e) => setPricingType(e.target.value as PricingType)}
                >
                  <option style={optionStyle} value="Night">
                    Night
                  </option>
                  <option style={optionStyle} value="Weekly">
                    Weekly
                  </option>
                  <option style={optionStyle} value="Monthly">
                    Monthly
                  </option>
                </select>
              </div>
            </div>

            {/* MAX LENGTH */}
            <div style={fieldBlock}>
              <label style={label}>Max RV length allowed</label>
              <div style={unitRow}>
                <input
                  style={unitInput}
                  type="number"
                  min={0}
                  max={50}
                  value={maxLengthFt}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    if (Number.isNaN(val)) return;
                    setMaxLengthFt(Math.min(50, Math.max(0, val)));
                  }}
                />
                <span style={unitSuffix}>ft</span>
              </div>
              <small style={tinyHelp}>
                Enter the longest RV that can fit (max 50 ft).
              </small>
            </div>

            {/* HOOKUPS */}
            <div style={fieldBlock}>
              <label style={label}>Hookups</label>
              <select
                style={selectFull}
                value={hookups}
                onChange={(e) => setHookups(e.target.value as Hookups)}
              >
                <option style={optionStyle} value="Full">
                  Full Hookups
                </option>
                <option style={optionStyle} value="Partial">
                  Partial Hookups
                </option>
                <option style={optionStyle} value="None">
                  No Hookups
                </option>
              </select>
            </div>

            {/* DESCRIPTION */}
            <div style={fieldBlock}>
              <label style={label}>Spot description (optional)</label>
              <textarea
                style={textarea}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Example: Level gravel pad, quiet at night, easy pull-through, close to highway..."
                maxLength={800}
              />
              <div style={counterRow}>
                <span style={tinyHelp}>Shows on the listing page later.</span>
                <span style={tinyHelp}>{description.length}/800</span>
              </div>
            </div>

            {/* NEARBY ATTRACTIONS */}
            <div style={fieldBlock}>
              <label style={label}>Nearby attractions / theme parks (optional)</label>
              <textarea
                style={textarea}
                value={nearbyAttractions}
                onChange={(e) => setNearbyAttractions(e.target.value)}
                placeholder="Example: Six Flags (15 min), Water park (10 min), State park trails (5 min)..."
                maxLength={500}
              />
              <div style={counterRow}>
                <span style={tinyHelp}>
                  Helps guests see what’s around your location.
                </span>
                <span style={tinyHelp}>{nearbyAttractions.length}/500</span>
              </div>
            </div>

            {/* AMENITIES */}
            <div style={divider} />

            <div style={amenityWrap}>
              <AmenitySection title="RV Infrastructure">
                <Checkbox label="🔌 30 Amp Power" checked={power30} onChange={setPower30} />
                <Checkbox label="🔌 50 Amp Power" checked={power50} onChange={setPower50} />
                <Checkbox label="💧 Water Hookup" checked={water} onChange={setWater} />
                <Checkbox label="🚽 Full Sewer Hookup" checked={sewer} onChange={setSewer} />
                <Checkbox label="♻️ Dump Station Onsite" checked={dump} onChange={setDump} />
              </AmenitySection>

              <AmenitySection title="Laundry">
                <Checkbox
                  label="🧺 Washer/Dryer Onsite"
                  checked={laundry}
                  onChange={setLaundry}
                />
                <Checkbox
                  label="🧼 Wash & Fold Service"
                  checked={washFold}
                  onChange={setWashFold}
                />
              </AmenitySection>

              <AmenitySection title="Facilities">
                <Checkbox label="🏋️ Gym Onsite" checked={gym} onChange={setGym} />
                <Checkbox
                  label="🚻 Bathrooms Onsite"
                  checked={bathrooms}
                  onChange={setBathrooms}
                />
                <Checkbox
                  label="🚿 Showers Onsite"
                  checked={showers}
                  onChange={setShowers}
                />
              </AmenitySection>

              <AmenitySection title="Convenience">
                <Checkbox label="📶 Wi-Fi" checked={wifi} onChange={setWifi} />
                <Checkbox
                  label="🗑️ Trash Pickup"
                  checked={trashPickup}
                  onChange={setTrashPickup}
                />
                <Checkbox
                  label="📹 Security Cameras"
                  checked={securityCameras}
                  onChange={setSecurityCameras}
                />
              </AmenitySection>

              <AmenitySection title="Recreation / Site Features">
                <Checkbox
                  label="🐶 Pets Allowed"
                  checked={petsAllowed}
                  onChange={setPetsAllowed}
                />
                <Checkbox label="🔥 Fire Pit" checked={firePit} onChange={setFirePit} />
                <Checkbox
                  label="🧺 Picnic Table"
                  checked={picnicTable}
                  onChange={setPicnicTable}
                />
                <Checkbox
                  label="🚚 Pull-Through Site"
                  checked={pullThrough}
                  onChange={setPullThrough}
                />
              </AmenitySection>
            </div>

            <button
              style={{ ...btn, opacity: saving ? 0.7 : 1 }}
              onClick={handleCreate}
              disabled={saving}
            >
              {saving ? "Creating..." : "Create Listing"}
            </button>

            <div style={tinyHelp}>
              Saved legacy-compatible fields: <b>power</b>, <b>water</b>, <b>sewer</b>,{" "}
              <b>laundry</b>. New amenities are additive & safe.
            </div>
          </section>

          {/* RIGHT COLUMN: BOOKINGS + LISTINGS */}
          <div style={{ display: "grid", gap: 18 }}>
            {/* BOOKINGS */}
            <section style={card}>
              <div style={sectionHeader}>
                <div style={{ flex: 1 }}>
                  <h2 style={sectionTitle}>Booking Requests</h2>
                  <p style={sectionSub}>
                    Requested: <b>{bookingCounts.requested}</b> • Confirmed:{" "}
                    <b>{bookingCounts.confirmed}</b> • Cancelled:{" "}
                    <b>{bookingCounts.cancelled}</b>
                  </p>

                  <div style={toolbar}>
                    <select
                      style={filterSelect}
                      value={bookingFilter}
                      onChange={(e) => setBookingFilter(e.target.value as BookingFilter)}
                    >
                      <option style={optionStyle} value="All">
                        All
                      </option>
                      <option style={optionStyle} value="Requested">
                        Requested
                      </option>
                      <option style={optionStyle} value="Confirmed">
                        Confirmed
                      </option>
                      <option style={optionStyle} value="Cancelled">
                        Cancelled
                      </option>
                    </select>

                    <button
                      style={smallBtn}
                      onClick={() => loadBookingsForListings(listings)}
                      disabled={bookingsLoading || listings.length === 0}
                    >
                      {bookingsLoading ? "Refreshing..." : "Refresh bookings"}
                    </button>
                  </div>

                  {bookingStatus && <div style={mutedBox}>{bookingStatus}</div>}
                </div>
              </div>

              {bookingsLoading ? (
                <div style={mutedBox}>Loading bookings…</div>
              ) : filteredBookings.length === 0 ? (
                <div style={mutedBox}>
                  <div style={{ fontWeight: 900, marginBottom: 6 }}>No bookings yet</div>
                  <div style={{ opacity: 0.85, lineHeight: 1.4 }}>
                    When guests request bookings, they will appear here for approval.
                  </div>
                </div>
              ) : (
                <div style={{ display: "grid", gap: 12, marginTop: 12 }}>
                  {filteredBookings.map((b) => (
                    <div key={b.id} style={bookingCard}>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          gap: 12,
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: 950, fontSize: 16 }}>{b.listingTitle}</div>
                          <div style={{ opacity: 0.8, marginTop: 4 }}>
                            {safeDateLabel(b.checkIn)} → {safeDateLabel(b.checkOut)} • {b.nights}{" "}
                            night
                            {b.nights === 1 ? "" : "s"} • <b>${b.estimatedTotal}</b>
                          </div>
                        </div>

                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span
                            style={{
                              ...statusPill,
                              background:
                                b.status === "requested"
                                  ? "rgba(255,255,255,0.10)"
                                  : b.status === "confirmed"
                                  ? "rgba(0,255,160,0.12)"
                                  : b.status === "cancelled"
                                  ? "rgba(255,80,80,0.12)"
                                  : "rgba(255,255,255,0.08)",
                              borderColor:
                                b.status === "confirmed"
                                  ? "rgba(0,255,160,0.22)"
                                  : b.status === "cancelled"
                                  ? "rgba(255,80,80,0.22)"
                                  : "rgba(255,255,255,0.14)",
                            }}
                          >
                            {b.status}
                          </span>
                        </div>
                      </div>

                      <div style={bookingMetaRow}>
                        <span style={pill}>Type: {b.bookingType}</span>
                        {b.createdAtLabel && (
                          <span style={pill}>Created: {b.createdAtLabel}</span>
                        )}
                        <span style={pill}>Booking ID: {b.id}</span>
                      </div>

                      {b.note?.trim() && (
                        <div style={descBox}>
                          <div style={{ fontWeight: 800, marginBottom: 6 }}>Guest note</div>
                          <div style={{ opacity: 0.9, lineHeight: 1.4 }}>{b.note}</div>
                        </div>
                      )}

                      <div style={{ display: "flex", gap: 10, marginTop: 12, flexWrap: "wrap" }}>
                        {b.status === "requested" ? (
                          <>
                            <button
                              style={{
                                ...actionBtn,
                                background: "rgba(0,255,160,0.16)",
                                borderColor: "rgba(0,255,160,0.24)",
                              }}
                              onClick={() => setBookingStatusValue(b.id, "confirmed")}
                              disabled={updatingBookingId === b.id}
                            >
                              {updatingBookingId === b.id ? "Updating..." : "✅ Approve"}
                            </button>

                            <button
                              style={{
                                ...actionBtn,
                                background: "rgba(255,80,80,0.14)",
                                borderColor: "rgba(255,80,80,0.22)",
                              }}
                              onClick={() => setBookingStatusValue(b.id, "cancelled")}
                              disabled={updatingBookingId === b.id}
                            >
                              {updatingBookingId === b.id ? "Updating..." : "❌ Reject"}
                            </button>
                          </>
                        ) : (
                          <div style={{ opacity: 0.75, fontSize: 12 }}>
                            This booking is {b.status}. (No further action needed.)
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* YOUR LISTINGS */}
            <section style={card}>
              <div style={sectionHeader}>
                <div style={{ flex: 1 }}>
                  <h2 style={sectionTitle}>Your Listings</h2>
                  <div style={rightMetaRow}>
                    <p style={sectionSub} title={filteredCountLabel}>
                      {filteredCountLabel}
                    </p>
                    <span style={dot}>•</span>
                    <p style={sectionSub}>What’s currently in Firestore.</p>
                  </div>

                  <div style={toolbar}>
                    <input
                      style={searchInput}
                      value={searchText}
                      onChange={(e) => setSearchText(e.target.value)}
                      placeholder="Search title, city, state…"
                    />

                    <select
                      style={filterSelect}
                      value={listingFilter}
                      onChange={(e) => setListingFilter(e.target.value as ListingFilter)}
                    >
                      <option style={optionStyle} value="All">
                        All
                      </option>
                      <option style={optionStyle} value="Full hookups">
                        Full hookups
                      </option>
                      <option style={optionStyle} value="Has showers">
                        Has showers
                      </option>
                      <option style={optionStyle} value="Has bathrooms">
                        Has bathrooms
                      </option>
                      <option style={optionStyle} value="Has gym">
                        Has gym
                      </option>
                      <option style={optionStyle} value="Has wifi">
                        Has Wi-Fi
                      </option>
                      <option style={optionStyle} value="Pets allowed">
                        Pets allowed
                      </option>
                      <option style={optionStyle} value="Under $50">
                        Under $50
                      </option>
                      <option style={optionStyle} value="Power 50A">
                        Power 50A
                      </option>
                      <option style={optionStyle} value="Full sewer">
                        Full sewer
                      </option>
                      <option style={optionStyle} value="Laundry available">
                        Laundry available
                      </option>
                      <option style={optionStyle} value="Has nearby attractions">
                        Has nearby attractions
                      </option>
                    </select>

                    <button
                      style={clearBtn}
                      onClick={clearSearchAndFilter}
                      disabled={!searchText && listingFilter === "All"}
                      title="Clear search and filter"
                    >
                      Clear
                    </button>
                  </div>
                </div>

                <button style={smallBtn} onClick={loadListingsAndBookings} disabled={loading}>
                  {loading ? "Refreshing..." : "Refresh"}
                </button>
              </div>

              {loading ? (
                <div style={mutedBox}>Loading listings…</div>
              ) : filteredListings.length === 0 ? (
                <div style={mutedBox}>
                  <div style={{ fontWeight: 900, marginBottom: 6 }}>No results</div>
                  <div style={{ opacity: 0.85, lineHeight: 1.4 }}>
                    Try clearing your search/filter, or create a new listing on the left.
                  </div>
                  <button
                    style={{ ...smallBtn, marginTop: 12 }}
                    onClick={clearSearchAndFilter}
                  >
                    Clear filters
                  </button>
                </div>
              ) : (
                <div style={{ display: "grid", gap: 12, marginTop: 12 }}>
                  {filteredListings.map((l) => (
                    <div key={l.id} style={listingCard}>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          gap: 12,
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: 900, fontSize: 18 }}>{l.title}</div>
                          <div style={{ opacity: 0.8 }}>
                            {l.city}, {l.state}
                          </div>

                          <div style={{ marginTop: 6, opacity: 0.75, fontSize: 12 }}>
                            {typeof l.lat === "number" && typeof l.lng === "number"
                              ? "📍 Coords saved"
                              : "📍 No coords yet"}
                          </div>
                        </div>

                        <div style={pillPrice}>
                          ${l.price} /{" "}
                          {l.pricingType === "Night"
                            ? "night"
                            : l.pricingType === "Weekly"
                            ? "week"
                            : "month"}
                        </div>
                      </div>

                      <div style={pillRow}>
                        <span style={pill}>Hookups: {l.hookups}</span>
                        <span style={pill}>Max: {l.maxLengthFt} ft</span>
                        <span style={pill}>Power: {l.power}</span>
                        <span style={pill}>Water: {l.water}</span>
                        <span style={pill}>Sewer: {l.sewer}</span>
                        <span style={pill}>Laundry: {l.laundry}</span>

                        {l.gym && <span style={pill}>Gym</span>}
                        {l.bathrooms && <span style={pill}>Bathrooms</span>}
                        {l.showers && <span style={pill}>Showers</span>}
                        {l.wifi && <span style={pill}>Wi-Fi</span>}
                        {l.petsAllowed && <span style={pill}>Pets</span>}
                        {l.firePit && <span style={pill}>Fire Pit</span>}
                        {l.pullThrough && <span style={pill}>Pull-Through</span>}
                      </div>

                      {l.description && (
                        <div style={descBox}>
                          <div style={{ fontWeight: 800, marginBottom: 6 }}>Description</div>
                          <div style={{ opacity: 0.9, lineHeight: 1.4 }}>{l.description}</div>
                        </div>
                      )}

                      {l.nearbyAttractions && (
                        <div style={descBox}>
                          <div style={{ fontWeight: 800, marginBottom: 6 }}>
                            Nearby Attractions
                          </div>
                          <div style={{ opacity: 0.9, lineHeight: 1.4 }}>
                            {l.nearbyAttractions}
                          </div>
                        </div>
                      )}

                      <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
                        <Link href={`/listings/${l.id}`} style={primaryLinkBtn}>
                          View listing →
                        </Link>
                        <span style={tinyHelp}>ID: {l.id}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        </div>
      </main>
    </HostGuard>
  );
}

/* -------- CHECKBOX COMPONENT -------- */
function Checkbox({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label style={checkRow}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>{label}</span>
    </label>
  );
}

/* -------- AMENITY SECTION -------- */
function AmenitySection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div style={amenityCard}>
      <div style={amenityTitle}>{title}</div>
      <div style={amenityGrid}>{children}</div>
    </div>
  );
}

/* -------- STYLES -------- */
const wrap: React.CSSProperties = {
  minHeight: "100vh",
  padding: 24,
  background: "#0b0f19",
  color: "white",
};

const hero: React.CSSProperties = {
  display: "flex",
  alignItems: "flex-end",
  justifyContent: "space-between",
  gap: 16,
  maxWidth: 1200,
  margin: "0 auto",
  paddingBottom: 16,
};

const heroTitle: React.CSSProperties = { fontSize: 44, fontWeight: 950, margin: 0 };
const heroSub: React.CSSProperties = {
  marginTop: 10,
  opacity: 0.8,
  maxWidth: 720,
  lineHeight: 1.5,
};

const analyticsWrap: React.CSSProperties = {
  maxWidth: 1200,
  margin: "0 auto 18px",
};

const analyticsGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1.2fr 0.8fr",
  gap: 18,
  marginTop: 18,
};

const analyticsSideCol: React.CSSProperties = {
  display: "grid",
  gap: 18,
};

const grid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1.1fr 0.9fr",
  gap: 18,
  maxWidth: 1200,
  margin: "18px auto 0",
};

const card: React.CSSProperties = {
  padding: 20,
  borderRadius: 18,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(255,255,255,0.05)",
};

const sectionHeader: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 12,
};

const sectionTitle: React.CSSProperties = { margin: 0, fontSize: 20, fontWeight: 900 };
const sectionSub: React.CSSProperties = { marginTop: 6, opacity: 0.75 };

const mutedBox: React.CSSProperties = {
  marginTop: 14,
  padding: 14,
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.10)",
  background: "rgba(0,0,0,0.18)",
  opacity: 0.95,
};

const rightMetaRow: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  marginTop: 6,
  flexWrap: "wrap",
};

const dot: React.CSSProperties = { opacity: 0.45 };

const toolbar: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 180px auto",
  gap: 10,
  marginTop: 12,
};

const searchInput: React.CSSProperties = {
  width: "100%",
  padding: 12,
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.15)",
  background: "rgba(255,255,255,0.08)",
  color: "white",
};

const filterSelect: React.CSSProperties = {
  width: "100%",
  padding: 12,
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.15)",
  background: "rgba(255,255,255,0.08)",
  color: "white",
};

const clearBtn: React.CSSProperties = {
  padding: "12px 14px",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.15)",
  background: "rgba(255,255,255,0.08)",
  color: "white",
  fontWeight: 900,
  cursor: "pointer",
  whiteSpace: "nowrap",
};

const statusBox: React.CSSProperties = {
  marginTop: 12,
  padding: 12,
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(255,255,255,0.06)",
  fontWeight: 800,
};

const fieldBlock: React.CSSProperties = { marginTop: 14 };

const row2: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 140px",
  gap: 12,
};

const input: React.CSSProperties = {
  width: "100%",
  padding: 12,
  marginTop: 8,
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.15)",
  background: "rgba(255,255,255,0.08)",
  color: "white",
};

const textarea: React.CSSProperties = {
  width: "100%",
  padding: 12,
  marginTop: 8,
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.15)",
  background: "rgba(255,255,255,0.08)",
  color: "white",
  minHeight: 90,
  resize: "vertical",
};

const counterRow: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  marginTop: 8,
};

const label: React.CSSProperties = { fontWeight: 800 };
const tinyHelp: React.CSSProperties = { opacity: 0.7, fontSize: 12 };

const priceRow: React.CSSProperties = { display: "flex", gap: 12, marginTop: 8 };
const priceInputWrapper: React.CSSProperties = { position: "relative", flex: 1 };

const priceSymbol: React.CSSProperties = {
  position: "absolute",
  left: 12,
  top: "50%",
  transform: "translateY(-50%)",
  fontWeight: 900,
  opacity: 0.85,
};

const priceInput: React.CSSProperties = {
  width: "100%",
  padding: "12px 12px",
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.15)",
  background: "rgba(255,255,255,0.08)",
  color: "white",
};

const select: React.CSSProperties = {
  padding: 12,
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.15)",
  background: "rgba(255,255,255,0.08)",
  color: "white",
  minWidth: 150,
};

const selectFull: React.CSSProperties = {
  width: "100%",
  padding: 12,
  marginTop: 8,
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.15)",
  background: "rgba(255,255,255,0.08)",
  color: "white",
};

const optionStyle: React.CSSProperties = {
  backgroundColor: "#0b0f19",
  color: "white",
};

const unitRow: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  marginTop: 8,
};

const unitSuffix: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.15)",
  background: "rgba(255,255,255,0.06)",
  fontWeight: 900,
};

const unitInput: React.CSSProperties = {
  flex: 1,
  padding: 12,
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.15)",
  background: "rgba(255,255,255,0.08)",
  color: "white",
};

const divider: React.CSSProperties = {
  height: 1,
  background: "rgba(255,255,255,0.10)",
  marginTop: 18,
};

const btn: React.CSSProperties = {
  marginTop: 18,
  padding: 14,
  width: "100%",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.15)",
  background: "rgba(255,255,255,0.12)",
  color: "white",
  fontWeight: 950,
  cursor: "pointer",
};

const checkRow: React.CSSProperties = {
  display: "flex",
  gap: 10,
  marginTop: 10,
  alignItems: "center",
};

const listingCard: React.CSSProperties = {
  padding: 16,
  borderRadius: 14,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(0,0,0,0.22)",
};

const bookingCard: React.CSSProperties = {
  padding: 16,
  borderRadius: 14,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(0,0,0,0.22)",
};

const bookingMetaRow: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 8,
  marginTop: 12,
};

const statusPill: React.CSSProperties = {
  padding: "6px 10px",
  borderRadius: 999,
  border: "1px solid rgba(255,255,255,0.14)",
  background: "rgba(255,255,255,0.08)",
  fontSize: 12,
  fontWeight: 900,
  textTransform: "capitalize",
};

const actionBtn: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.15)",
  background: "rgba(255,255,255,0.10)",
  color: "white",
  fontWeight: 900,
  cursor: "pointer",
};

const pillRow: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 8,
  marginTop: 12,
};

const pill: React.CSSProperties = {
  padding: "6px 10px",
  borderRadius: 999,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(255,255,255,0.06)",
  fontSize: 12,
  fontWeight: 800,
  opacity: 0.95,
};

const pillPrice: React.CSSProperties = {
  padding: "8px 12px",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(255,255,255,0.06)",
  fontWeight: 950,
  whiteSpace: "nowrap",
};

const descBox: React.CSSProperties = {
  marginTop: 12,
  padding: 12,
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.10)",
  background: "rgba(255,255,255,0.05)",
};

const primaryLinkBtn: React.CSSProperties = {
  display: "inline-block",
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.15)",
  background: "rgba(255,255,255,0.12)",
  color: "white",
  fontWeight: 900,
  textDecoration: "none",
};

const ghostBtn: React.CSSProperties = {
  display: "inline-block",
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.15)",
  background: "rgba(255,255,255,0.06)",
  color: "white",
  fontWeight: 900,
  textDecoration: "none",
  whiteSpace: "nowrap",
};

const smallBtn: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.15)",
  background: "rgba(255,255,255,0.08)",
  color: "white",
  fontWeight: 900,
  cursor: "pointer",
};

const amenityWrap: React.CSSProperties = {
  marginTop: 18,
  display: "grid",
  gap: 12,
};

const amenityCard: React.CSSProperties = {
  padding: 12,
  borderRadius: 14,
  border: "1px solid rgba(255,255,255,0.10)",
  background: "rgba(0,0,0,0.18)",
};

const amenityTitle: React.CSSProperties = {
  fontWeight: 950,
  marginBottom: 8,
  opacity: 0.95,
};

const amenityGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 8,
};