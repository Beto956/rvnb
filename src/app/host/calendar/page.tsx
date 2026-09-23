"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import type { MutableRefObject } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  collection,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import { approveBooking, declineBooking } from "@/lib/booking-approval";
import { normalizeBookingStatus } from "@/lib/booking-status";
import {
  MAX_RANGE_DAYS,
  clampRangeEnd,
  enumerateDatesInclusive,
  normalizeDateRange,
} from "../../components/hostDashboardUtils";
import AuthNav from "../../components/authnav";
import HostGuard from "../../components/HostGuard";
import navStyles from "../../components/hostDashboard.module.css";
import styles from "./hostCalendar.module.css";

type Hookups = "Full" | "Partial" | "None";

type Listing = {
  id: string;
  hostId: string;
  title: string;
  city: string;
  state: string;
  price?: number;
  pricePerNight?: number;
  pricingType?: string;
  hookups: Hookups;
  maxLengthFt: number;
};

type BookingStatus = "pending" | "approved" | "declined" | "cancelled" | "completed" | "unknown";
type StayType = "rv" | "land";

type Booking = {
  id: string;
  listingId: string;
  checkIn: string; // YYYY-MM-DD
  checkOut: string; // YYYY-MM-DD
  status: BookingStatus;
  name?: string;
  email?: string;
  stayType?: StayType;
};

type DaySignal = "none" | "high" | "maintenance" | "private" | "flex";

type DayMeta = {
  listingId: string;
  hostId: string;
  date: string; // YYYY-MM-DD
  blocked?: boolean;
  blockReason?: string;
  signal?: DaySignal;
  note?: string;
};

function pad(n: number) {
  return String(n).padStart(2, "0");
}
function toISODate(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function parseISODate(s: string) {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}
function isValidDateParam(value: string | null | undefined): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  return toISODate(parseISODate(value)) === value;
}
function isValidListingIdParam(value: string | null | undefined): value is string {
  return typeof value === "string" && value.trim().length > 0;
}
function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
function endOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}
function addMonths(d: Date, n: number) {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}
function sameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}
function clampMidnight(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** checkIn included, checkOut excluded */
function bookingCoversDay(b: Booking, day: Date) {
  const normalizedStatus = normalizeBookingStatus(b.status);
  if (normalizedStatus !== "pending" && normalizedStatus !== "approved") return false;

  const inD = clampMidnight(parseISODate(b.checkIn));
  const outD = clampMidnight(parseISODate(b.checkOut));
  const x = clampMidnight(day);
  return x >= inD && x < outD;
}

function dayChipClass(status: BookingStatus): string {
  if (status === "approved") return styles.dayChipApproved;
  if (status === "pending") return styles.dayChipPending;
  return "";
}

function bookingBadgeStyle(status: BookingStatus): { background: string; color: string; border: string } {
  if (status === "approved") {
    return { background: "rgba(59,130,246,0.22)", color: "#bfdbfe", border: "1px solid rgba(96,165,250,0.4)" };
  }
  if (status === "pending") {
    return { background: "rgba(250,204,21,0.16)", color: "#fde68a", border: "1px solid rgba(250,204,21,0.35)" };
  }
  return { background: "rgba(255,255,255,0.08)", color: "#e5e7eb", border: "1px solid rgba(255,255,255,0.16)" };
}

function getListingPriceLabel(listing: Listing) {
  const priceValue = typeof listing.price === "number" ? listing.price : listing.pricePerNight;

  if (typeof priceValue !== "number" || !Number.isFinite(priceValue)) {
    return { priceText: "Price unavailable", period: "" };
  }

  const normalizedType = String(listing.pricingType ?? "Night").trim().toLowerCase();
  if (normalizedType === "weekly") return { priceText: `$${priceValue}`, period: "/week" };
  if (normalizedType === "monthly") return { priceText: `$${priceValue}`, period: "/month" };
  return { priceText: `$${priceValue}`, period: "/night" };
}

function prettyDate(d: Date) {
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function dayMetaId(listingId: string, dateISO: string) {
  return `${listingId}__${dateISO}`;
}

function signalLabel(s: DaySignal) {
  switch (s) {
    case "high":
      return "High Demand";
    case "maintenance":
      return "Maintenance";
    case "private":
      return "Private Use";
    case "flex":
      return "Flexible";
    default:
      return "None";
  }
}

function stayIcon(stayType?: StayType) {
  return (stayType ?? "rv") === "rv" ? "🚐" : "🏕️";
}

function createdAtOrCheckInMillis(checkIn: string): number {
  const d = parseISODate(checkIn);
  return Number.isNaN(d.getTime()) ? 0 : d.getTime();
}

function HostCalendarContent({
  initialDateISO,
  initialListingId,
  initialStartISO,
  initialEndISO,
}: {
  initialDateISO: string | null;
  initialListingId: string | null;
  initialStartISO: string | null;
  initialEndISO: string | null;
}) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [listings, setListings] = useState<Listing[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [error, setError] = useState("");
  const [dataWarning, setDataWarning] = useState("");

  const [activeListingId, setActiveListingId] = useState<string | null>(null);

  const [monthCursor, setMonthCursor] = useState(() => startOfMonth(new Date()));
  const appliedInitialMonthRef = useRef(false);
  const appliedInitialListingRef = useRef(false);
  const appliedInitialInspectorRef = useRef(false);
  const appliedInitialRangeRef = useRef(false);

  // Day Meta (blocked/signal/note)
  const [dayMetaMap, setDayMetaMap] = useState<Record<string, DayMeta>>({});

  // Drawer state
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selected, setSelected] = useState<{ listingId: string; dayISO: string } | null>(null);

  const [actionLoading, setActionLoading] = useState<string>("");
  const [metaSaving, setMetaSaving] = useState(false);

  // Drawer local edits
  const [editBlocked, setEditBlocked] = useState(false);
  const [editReason, setEditReason] = useState("");
  const [editSignal, setEditSignal] = useState<DaySignal>("none");
  const [editNote, setEditNote] = useState("");

  // Date-range selection mode
  const [rangeMode, setRangeMode] = useState(false);
  const [rangeStart, setRangeStart] = useState<string | null>(null);
  const [rangeEnd, setRangeEnd] = useState<string | null>(null);
  const [rangeHoverDate, setRangeHoverDate] = useState<string | null>(null);
  const [rangeMessage, setRangeMessage] = useState("");
  const [bulkNote, setBulkNote] = useState("");
  const [bulkSignal, setBulkSignal] = useState<DaySignal>("none");
  const [bulkSaving, setBulkSaving] = useState(false);
  const [bulkStatus, setBulkStatus] = useState("");

  const selectedDayButtonRef = useRef<HTMLButtonElement | null>(null);
  const rangeToggleRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeDrawer();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Navigate to the requested month once (validated YYYY-MM-DD; ignored otherwise).
  useEffect(() => {
    if (appliedInitialMonthRef.current) return;
    if (!isValidDateParam(initialDateISO)) return;
    appliedInitialMonthRef.current = true;
    setMonthCursor(startOfMonth(parseISODate(initialDateISO)));
  }, [initialDateISO]);

  const monthStart = useMemo(() => startOfMonth(monthCursor), [monthCursor]);
  const monthEnd = useMemo(() => endOfMonth(monthCursor), [monthCursor]);

  function toListingRow(id: string, data: Omit<Listing, "id">): Listing {
    return { id, ...data };
  }

  // Load listings + bookings once
  useEffect(() => {
    const run = async () => {
      setLoading(true);
      setError("");
      setDataWarning("");

      if (!user?.uid) {
        setListings([]);
        setBookings([]);
        setLoading(false);
        return;
      }

      try {
        const listingsSnap = await getDocs(
          query(collection(db, "listings"), where("hostId", "==", user.uid))
        );
        const listingsData: Listing[] = listingsSnap.docs.map((d) =>
          toListingRow(d.id, d.data() as Omit<Listing, "id">)
        );
        setListings(listingsData);

        await loadBookings();
      } catch (e: unknown) {
        const code = (e as { code?: string })?.code ?? "unknown";
        console.error(`[RVNB] calendar listings query failed (code: ${code})`, e);
        setError("Calendar information could not be loaded right now. Please try refreshing.");
        setListings([]);
        setBookings([]);
      } finally {
        setLoading(false);
      }
    };

    async function loadBookings() {
      if (!user?.uid) return;

      try {
        const bookingsSnap = await getDocs(
          query(
            collection(db, "bookings"),
            where("hostId", "==", user.uid),
            orderBy("checkIn", "asc")
          )
        );
        setBookings(toBookings(bookingsSnap.docs));
      } catch (e: unknown) {
        const code = (e as { code?: string })?.code ?? "unknown";
        console.error(`[RVNB] calendar bookings query failed (code: ${code})`, e);

        // The indexed query needs a composite index (hostId + checkIn). Fall back to an
        // index-free equality query and sort client-side instead of showing a raw Firebase
        // error/URL, or worse, silently reporting stale/false availability.
        try {
          const fallbackSnap = await getDocs(
            query(collection(db, "bookings"), where("hostId", "==", user.uid))
          );
          setBookings(toBookings(fallbackSnap.docs));
          setDataWarning(
            "Calendar data needs additional configuration. Booking order may be approximate until it's completed."
          );
        } catch (e2: unknown) {
          const code2 = (e2 as { code?: string })?.code ?? "unknown";
          console.error(`[RVNB] calendar bookings fallback query also failed (code: ${code2})`, e2);
          setError("Calendar information could not be loaded right now. Please try refreshing.");
          setBookings([]);
        }
      }
    }

    function toBookings(
      docs: { id: string; data: () => Record<string, unknown> }[]
    ): Booking[] {
      const all: Booking[] = docs.map((d) => {
        const data = d.data() as Partial<Omit<Booking, "id" | "status">> & { status?: unknown };
        return {
          id: d.id,
          ...(data as Omit<Booking, "id">),
          status: normalizeBookingStatus(typeof data.status === "string" ? data.status : undefined),
          stayType: (data.stayType as StayType) ?? undefined,
        };
      });
      all.sort((a, b) => createdAtOrCheckInMillis(a.checkIn) - createdAtOrCheckInMillis(b.checkIn));
      return all;
    }

    run();
  }, [user?.uid]);

  // Pick the active listing once listings are ready: an owned ?listingId= wins, otherwise
  // the first listing. Runs once so manual tab switches afterward are never overridden.
  useEffect(() => {
    if (appliedInitialListingRef.current) return;
    if (loading) return;
    if (listings.length === 0) return;

    appliedInitialListingRef.current = true;

    const requested =
      isValidListingIdParam(initialListingId) && listings.some((l) => l.id === initialListingId)
        ? initialListingId
        : null;

    setActiveListingId(requested ?? listings[0].id);
  }, [loading, listings, initialListingId]);

  // Auto-open the Day Inspector only when unambiguous: an explicitly owned listingId was
  // requested, or the host only has one listing anyway. Skipped when a range was requested.
  useEffect(() => {
    if (appliedInitialInspectorRef.current) return;
    if (loading) return;
    if (!activeListingId) return;
    if (isValidDateParam(initialStartISO) && isValidDateParam(initialEndISO)) return;
    if (!isValidDateParam(initialDateISO)) return;

    const requestedOwnedListingId =
      isValidListingIdParam(initialListingId) && listings.some((l) => l.id === initialListingId)
        ? initialListingId
        : null;

    if (!requestedOwnedListingId && listings.length !== 1) return;

    appliedInitialInspectorRef.current = true;
    openDayInspector(parseISODate(initialDateISO));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, activeListingId, initialDateISO, initialListingId, initialStartISO, initialEndISO, listings]);

  // Auto-select a range when ?listingId=&start=&end= are all valid and the listingId is owned.
  useEffect(() => {
    if (appliedInitialRangeRef.current) return;
    if (loading) return;
    if (!activeListingId) return;
    if (!isValidDateParam(initialStartISO) || !isValidDateParam(initialEndISO)) return;

    const requestedOwnedListingId =
      isValidListingIdParam(initialListingId) && listings.some((l) => l.id === initialListingId)
        ? initialListingId
        : null;

    if (!requestedOwnedListingId) return;

    appliedInitialRangeRef.current = true;
    const { start, end } = normalizeDateRange(initialStartISO, initialEndISO);
    const clamped = clampRangeEnd(start, end);
    setRangeMode(true);
    setRangeStart(start);
    setRangeEnd(clamped.end);
    if (clamped.clamped) setRangeMessage(`Range limited to ${MAX_RANGE_DAYS} days.`);
  }, [loading, activeListingId, initialStartISO, initialEndISO, initialListingId, listings]);

  async function fetchDayMetaRange(startISO: string, endISO: string): Promise<Record<string, DayMeta>> {
    const next: Record<string, DayMeta> = {};
    if (listings.length === 0) return next;

    await Promise.all(
      listings.map(async (listing) => {
        const qy = query(
          collection(db, "dayMeta"),
          where("listingId", "==", listing.id),
          where("hostId", "==", listing.hostId),
          where("date", ">=", startISO),
          where("date", "<=", endISO),
          orderBy("date", "asc")
        );
        const snap = await getDocs(qy);
        snap.docs.forEach((d) => {
          const data = d.data() as DayMeta;
          next[dayMetaId(data.listingId, data.date)] = data;
        });
      })
    );

    return next;
  }

  // Load dayMeta for the visible month (refresh when month changes)
  useEffect(() => {
    const run = async () => {
      try {
        if (listings.length === 0) return;
        const startISO = toISODate(monthStart);
        const endISO = toISODate(monthEnd);
        const next = await fetchDayMetaRange(startISO, endISO);
        setDayMetaMap((prev) => ({ ...prev, ...next }));
      } catch (e: unknown) {
        const code = (e as { code?: string })?.code ?? "unknown";
        console.error(`[RVNB] calendar dayMeta query failed (code: ${code})`, e);
      }
    };

    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listings, monthStart, monthEnd]);

  // On-demand fetch once a range is committed, in case it extends beyond the visible month.
  useEffect(() => {
    if (!rangeStart || !rangeEnd) return;

    const run = async () => {
      try {
        const next = await fetchDayMetaRange(rangeStart, rangeEnd);
        setDayMetaMap((prev) => ({ ...prev, ...next }));
      } catch (e: unknown) {
        const code = (e as { code?: string })?.code ?? "unknown";
        console.error(`[RVNB] range dayMeta query failed (code: ${code})`, e);
      }
    };

    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rangeStart, rangeEnd]);

  const bookingsByListing = useMemo(() => {
    const map = new Map<string, Booking[]>();
    for (const b of bookings) {
      if (!map.has(b.listingId)) map.set(b.listingId, []);
      map.get(b.listingId)!.push(b);
    }
    return map;
  }, [bookings]);

  const listingById = useMemo(() => {
    const map = new Map<string, Listing>();
    listings.forEach((l) => map.set(l.id, l));
    return map;
  }, [listings]);

  const activeListing = activeListingId ? listingById.get(activeListingId) ?? null : null;

  const days = useMemo(() => {
    const start = new Date(monthStart);
    start.setDate(start.getDate() - start.getDay());
    const end = new Date(monthEnd);
    end.setDate(end.getDate() + (6 - end.getDay()));

    const out: Date[] = [];
    const cur = new Date(start);
    while (cur <= end) {
      out.push(new Date(cur));
      cur.setDate(cur.getDate() + 1);
    }
    return out;
  }, [monthStart, monthEnd]);

  const today = useMemo(() => clampMidnight(new Date()), []);

  function selectListing(id: string) {
    setActiveListingId(id);
    setDrawerOpen(false);
    clearRangeSelection();
  }

  function openDayInspector(day: Date) {
    if (!activeListingId) return;

    const dayISO = toISODate(day);
    setSelected({ listingId: activeListingId, dayISO });
    setDrawerOpen(true);

    const key = dayMetaId(activeListingId, dayISO);
    const meta = dayMetaMap[key];

    setEditBlocked(!!meta?.blocked);
    setEditReason(meta?.blockReason || "");
    setEditSignal((meta?.signal as DaySignal) || "none");
    setEditNote(meta?.note || "");
  }

  function closeDrawer() {
    setDrawerOpen(false);
    selectedDayButtonRef.current?.focus();
  }

  // ---------- Range-selection mode ----------

  function toggleRangeMode() {
    setRangeMode((prev) => {
      const next = !prev;
      if (!next) {
        setRangeStart(null);
        setRangeEnd(null);
        setRangeHoverDate(null);
        setRangeMessage("");
        setBulkStatus("");
      } else {
        setDrawerOpen(false);
      }
      return next;
    });
  }

  function clearRangeSelection() {
    setRangeStart(null);
    setRangeEnd(null);
    setRangeHoverDate(null);
    setRangeMessage("");
    setBulkStatus("");
    setBulkNote("");
    setBulkSignal("none");
  }

  function handleRangeDayClick(day: Date) {
    const dayISO = toISODate(day);

    if (!rangeStart || rangeEnd) {
      setRangeStart(dayISO);
      setRangeEnd(null);
      setRangeHoverDate(null);
      setRangeMessage("");
      setBulkStatus("");
      return;
    }

    const { start, end } = normalizeDateRange(rangeStart, dayISO);
    const clamped = clampRangeEnd(start, end);
    setRangeStart(start);
    setRangeEnd(clamped.end);
    setRangeHoverDate(null);
    setRangeMessage(clamped.clamped ? `Range limited to ${MAX_RANGE_DAYS} days.` : "");
  }

  function handleDayActivate(day: Date) {
    if (rangeMode) {
      handleRangeDayClick(day);
    } else {
      openDayInspector(day);
    }
  }

  // Escape cancels the in-progress or completed range selection while range mode is on.
  useEffect(() => {
    if (!rangeMode) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && (rangeStart || rangeEnd)) {
        clearRangeSelection();
        rangeToggleRef.current?.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [rangeMode, rangeStart, rangeEnd]);

  const rangeDates = useMemo(() => {
    if (!rangeStart || !rangeEnd) return [];
    return enumerateDatesInclusive(rangeStart, rangeEnd);
  }, [rangeStart, rangeEnd]);

  const tentativeRangeDates = useMemo(() => {
    if (!rangeStart || rangeEnd || !rangeHoverDate) return [];
    return enumerateDatesInclusive(rangeStart, rangeHoverDate);
  }, [rangeStart, rangeEnd, rangeHoverDate]);

  const rangeConflicts = useMemo(() => {
    if (!activeListingId || rangeDates.length === 0) {
      return { approved: [] as string[], pending: [] as string[], blocked: [] as string[] };
    }

    const items = bookingsByListing.get(activeListingId) || [];
    const approved: string[] = [];
    const pending: string[] = [];
    const blocked: string[] = [];

    rangeDates.forEach((dISO) => {
      const day = clampMidnight(parseISODate(dISO));
      const hits = items.filter((b) => bookingCoversDay(b, day));
      if (hits.some((b) => b.status === "approved")) approved.push(dISO);
      if (hits.some((b) => b.status === "pending")) pending.push(dISO);
      if (dayMetaMap[dayMetaId(activeListingId, dISO)]?.blocked) blocked.push(dISO);
    });

    return { approved, pending, blocked };
  }, [activeListingId, rangeDates, bookingsByListing, dayMetaMap]);

  async function runBulkDayMetaWrite(
    dates: string[],
    patch: Partial<Pick<DayMeta, "blocked" | "blockReason" | "signal" | "note">>,
    successMessage: string
  ) {
    if (!activeListingId || !activeListing || dates.length === 0) return;
    // Ownership guard: never write against a listing the authenticated host doesn't own.
    if (activeListing.hostId !== user?.uid) {
      setBulkStatus("You don't have permission to manage this listing.");
      return;
    }

    setBulkSaving(true);
    setBulkStatus("");

    try {
      const batch = writeBatch(db);

      dates.forEach((dISO) => {
        const id = dayMetaId(activeListingId, dISO);
        const existing = dayMetaMap[id];
        const payload: DayMeta = {
          listingId: activeListingId,
          hostId: activeListing.hostId,
          date: dISO,
          blocked: patch.blocked ?? existing?.blocked ?? false,
          blockReason: patch.blockReason ?? existing?.blockReason ?? "",
          signal: patch.signal ?? (existing?.signal as DaySignal) ?? "none",
          note: patch.note ?? existing?.note ?? "",
        };
        batch.set(doc(db, "dayMeta", id), { ...payload, updatedAt: serverTimestamp() }, { merge: true });
      });

      await batch.commit();

      const refreshed = await fetchDayMetaRange(dates[0], dates[dates.length - 1]);
      setDayMetaMap((prev) => ({ ...prev, ...refreshed }));
      setBulkStatus(successMessage);
    } catch (e: unknown) {
      const code = (e as { code?: string })?.code ?? "unknown";
      console.error(`[RVNB] bulk dayMeta write failed (code: ${code})`, e);
      setBulkStatus("Couldn't save changes for the selected dates. Nothing was changed — please try again.");
    } finally {
      setBulkSaving(false);
    }
  }

  function handleBulkBlock(onlyAvailable: boolean) {
    if (rangeConflicts.approved.length > 0 && !onlyAvailable) return;

    const targetDates = onlyAvailable
      ? rangeDates.filter((d) => !rangeConflicts.approved.includes(d))
      : rangeDates;

    if (onlyAvailable && rangeConflicts.approved.length > 0) {
      const proceed = window.confirm(
        `This will skip ${rangeConflicts.approved.length} date(s) with an approved booking: ${rangeConflicts.approved
          .join(", ")}. Block the remaining ${targetDates.length} date(s)?`
      );
      if (!proceed) return;
    } else {
      const proceed = window.confirm(`Block ${targetDates.length} selected date(s)?`);
      if (!proceed) return;
    }

    runBulkDayMetaWrite(targetDates, { blocked: true }, `Blocked ${targetDates.length} date(s).`);
  }

  function handleBulkUnblock() {
    const proceed = window.confirm(`Unblock ${rangeDates.length} selected date(s)?`);
    if (!proceed) return;
    runBulkDayMetaWrite(
      rangeDates,
      { blocked: false, blockReason: "" },
      `Unblocked ${rangeDates.length} date(s).`
    );
  }

  function handleBulkNote() {
    const proceed = window.confirm(
      `Apply this note to all ${rangeDates.length} selected date(s)? This replaces any existing note on each date.`
    );
    if (!proceed) return;
    runBulkDayMetaWrite(rangeDates, { note: bulkNote.trim() }, `Note applied to ${rangeDates.length} date(s).`);
  }

  function handleBulkSignal(clear: boolean) {
    const signalToApply: DaySignal = clear ? "none" : bulkSignal;
    const proceed = window.confirm(
      clear
        ? `Clear the signal on ${rangeDates.length} selected date(s)?`
        : `Apply "${signalLabel(signalToApply)}" to ${rangeDates.length} selected date(s)?`
    );
    if (!proceed) return;
    runBulkDayMetaWrite(
      rangeDates,
      { signal: signalToApply },
      clear ? `Signal cleared on ${rangeDates.length} date(s).` : `Signal applied to ${rangeDates.length} date(s).`
    );
  }

  const inspectorData = useMemo(() => {
    if (!selected) return null;

    const l = listingById.get(selected.listingId);
    const day = clampMidnight(parseISODate(selected.dayISO));
    const items = bookingsByListing.get(selected.listingId) || [];
    const hits = items
      .filter((b) => bookingCoversDay(b, day))
      .sort((a, b) => a.checkIn.localeCompare(b.checkIn));

    const key = dayMetaId(selected.listingId, selected.dayISO);
    const meta = dayMetaMap[key];

    return { listing: l, day, hits, meta };
  }, [selected, listingById, bookingsByListing, dayMetaMap]);

  async function setBookingStatus(bookingId: string, status: BookingStatus) {
    try {
      setActionLoading(bookingId);
      const result =
        status === "approved" ? await approveBooking(bookingId) : await declineBooking(bookingId);

      if (!result.ok) {
        alert(result.message);
        return;
      }

      setBookings((prev) => prev.map((b) => (b.id === bookingId ? { ...b, status } : b)));
    } finally {
      setActionLoading("");
    }
  }

  async function saveDayMeta() {
    if (!selected) return;
    try {
      setMetaSaving(true);

      const payload: DayMeta = {
        listingId: selected.listingId,
        hostId: listingById.get(selected.listingId)?.hostId || "",
        date: selected.dayISO,
        blocked: editBlocked,
        blockReason: editBlocked ? editReason.trim() : "",
        signal: editSignal,
        note: editNote.trim(),
      };

      const id = dayMetaId(selected.listingId, selected.dayISO);

      await setDoc(doc(db, "dayMeta", id), { ...payload, updatedAt: serverTimestamp() }, { merge: true });

      setDayMetaMap((prev) => ({ ...prev, [id]: payload }));
    } catch (e: unknown) {
      const code = (e as { code?: string })?.code ?? "unknown";
      console.error(`[RVNB] dayMeta save failed (code: ${code})`, e);
      alert("Couldn't save day settings. Please try again.");
    } finally {
      setMetaSaving(false);
    }
  }

  const monthLabel = monthStart.toLocaleString(undefined, { month: "long", year: "numeric" });

  return (
    <div className={navStyles.page}>
      <header className={navStyles.headerBar}>
        <div className={navStyles.headerInner}>
          <div className={navStyles.brandGroup}>
            <Link href="/" className={navStyles.brand} aria-label="Return to RVNB home">
              <img src="/rvnb-logo-icon.png" alt="RVNB" className={navStyles.brandIcon} />
              <span className={navStyles.brandTagline}>Explore RVNB</span>
            </Link>
            <Link href="/host" className={navStyles.hostCenterLink}>
              Host Center
            </Link>
          </div>

          <nav className={navStyles.nav} aria-label="Host account">
            <span className={`${navStyles.navLink} ${navStyles.navLinkActive}`} aria-current="page">
              Calendar
            </span>
            <AuthNav navLinkClassName={navStyles.navLink} navCtaClassName={navStyles.navCta} navLogoutClassName={navStyles.navLink} />
          </nav>
        </div>
      </header>

      <div className={styles.container}>
        <div className={styles.pageHeader}>
          <div className={styles.pageHeaderBg} aria-hidden="true" />
          <img src="/rvnb-logo-icon.png" alt="" aria-hidden="true" className={styles.pageHeaderWatermark} />

          <div className={styles.pageHeaderContent}>
            <p className={styles.eyebrow}>Host Center</p>
            <h1 className={styles.pageTitle}>Availability Calendar</h1>
            <p className={styles.pageSub}>
              Manage blocked dates, host notes, and demand signals for each of your listings.
            </p>
          </div>

          <div className={styles.headerActions}>
            <Link href="/host" className={styles.btnPrimary}>
              ← Back to dashboard
            </Link>
            <Link href="/listings" className={styles.btnSecondary}>
              View public listings
            </Link>
          </div>
        </div>

        {error && <div className={styles.errorBanner}>{error}</div>}
        {!error && dataWarning && <div className={styles.warningBanner}>{dataWarning}</div>}

        {loading ? (
          <div className={styles.emptyState}>
            <div className={styles.emptyStateTitle}>Loading your calendar…</div>
          </div>
        ) : listings.length === 0 ? (
          <div className={styles.emptyState}>
            <div className={styles.emptyStateTitle}>You don&apos;t have any listings yet</div>
            <div className={styles.emptyStateText}>
              Create a listing to start managing its availability calendar.
            </div>
          </div>
        ) : (
          <>
            <div className={styles.selectorWrap}>
              <div className={styles.tabsRow} role="tablist" aria-label="Select a listing">
                {listings.map((l) => (
                  <button
                    key={l.id}
                    type="button"
                    role="tab"
                    aria-selected={l.id === activeListingId}
                    className={`${styles.tab} ${l.id === activeListingId ? styles.tabActive : ""}`}
                    onClick={() => selectListing(l.id)}
                  >
                    <span className={styles.tabTitle}>{l.title}</span>
                    <span className={styles.tabMeta}>
                      {l.city}, {l.state}
                    </span>
                  </button>
                ))}
              </div>

              <div className={styles.dropdownWrap}>
                <select
                  className={styles.dropdown}
                  value={activeListingId ?? ""}
                  onChange={(e) => selectListing(e.target.value)}
                  aria-label="Select a listing"
                >
                  {listings.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.title} — {l.city}, {l.state}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {activeListing && (
              <ListingCalendar
                listing={activeListing}
                bookings={bookingsByListing.get(activeListing.id) || []}
                dayMetaMap={dayMetaMap}
                days={days}
                monthStart={monthStart}
                monthLabel={monthLabel}
                today={today}
                selectedDayISO={selected?.listingId === activeListing.id ? selected.dayISO : null}
                onPrevMonth={() => setMonthCursor(addMonths(monthCursor, -1))}
                onToday={() => setMonthCursor(startOfMonth(new Date()))}
                onNextMonth={() => setMonthCursor(addMonths(monthCursor, 1))}
                onOpenDay={handleDayActivate}
                dayButtonRef={selectedDayButtonRef}
                rangeMode={rangeMode}
                rangeToggleRef={rangeToggleRef}
                onToggleRangeMode={toggleRangeMode}
                rangeStart={rangeStart}
                rangeEnd={rangeEnd}
                rangeMessage={rangeMessage}
                tentativeRangeDates={tentativeRangeDates}
                onRangeHover={(dISO) => {
                  if (rangeStart && !rangeEnd) setRangeHoverDate(dISO);
                }}
              />
            )}

            {rangeMode && rangeStart && rangeEnd && activeListing && (
              <section className={styles.rangePanel} aria-labelledby="range-panel-heading">
                <div className={styles.rangePanelHeader}>
                  <div>
                    <p className={styles.rangePanelEyebrow}>Range management</p>
                    <h2 id="range-panel-heading" className={styles.rangePanelTitle}>
                      {activeListing.title} · {rangeStart} → {rangeEnd}
                    </h2>
                    <p className={styles.rangePanelSub}>
                      {rangeDates.length} day{rangeDates.length === 1 ? "" : "s"} selected. Start
                      and end dates are treated as inclusive.
                    </p>
                  </div>
                  <button type="button" className={styles.drawerClose} onClick={clearRangeSelection} aria-label="Clear range selection">
                    ✕
                  </button>
                </div>

                <div className={styles.rangeChipRow}>
                  {rangeConflicts.approved.length > 0 && (
                    <span className={styles.rangeChipConflict}>
                      {rangeConflicts.approved.length} approved-booking conflict
                      {rangeConflicts.approved.length === 1 ? "" : "s"}
                    </span>
                  )}
                  {rangeConflicts.pending.length > 0 && (
                    <span className={styles.rangeChipPending}>
                      {rangeConflicts.pending.length} pending request{rangeConflicts.pending.length === 1 ? "" : "s"} (warning only)
                    </span>
                  )}
                  {rangeConflicts.blocked.length > 0 && (
                    <span className={styles.rangeChipBlocked}>
                      {rangeConflicts.blocked.length} already blocked
                    </span>
                  )}
                  {rangeConflicts.approved.length === 0 &&
                    rangeConflicts.pending.length === 0 &&
                    rangeConflicts.blocked.length === 0 && (
                      <span className={styles.rangeChipAvailable}>No conflicts in this range</span>
                    )}
                </div>

                {bulkStatus && <div className={styles.rangeStatus}>{bulkStatus}</div>}

                <div className={styles.rangeActionGroup}>
                  <div className={styles.fieldLabel}>Block or unblock</div>
                  <div className={styles.rangeButtonRow}>
                    <button
                      type="button"
                      className={styles.btnStrong}
                      disabled={bulkSaving || rangeConflicts.approved.length > 0}
                      onClick={() => handleBulkBlock(false)}
                      title={
                        rangeConflicts.approved.length > 0
                          ? "Resolve approved-booking conflicts first, or apply to available dates only"
                          : undefined
                      }
                    >
                      {bulkSaving ? "Saving..." : "Block selected dates"}
                    </button>
                    {rangeConflicts.approved.length > 0 && (
                      <button
                        type="button"
                        className={styles.btnGhost}
                        disabled={bulkSaving}
                        onClick={() => handleBulkBlock(true)}
                      >
                        Apply only to available dates
                      </button>
                    )}
                    <button type="button" className={styles.navBtn} disabled={bulkSaving} onClick={handleBulkUnblock}>
                      Unblock selected dates
                    </button>
                  </div>
                </div>

                <div className={styles.rangeActionGroup}>
                  <div className={styles.fieldLabel}>Note (replaces existing note on each date)</div>
                  <textarea
                    value={bulkNote}
                    onChange={(e) => setBulkNote(e.target.value)}
                    placeholder="Gate code, arrival notes, reminders, etc."
                    rows={3}
                    className={styles.inputField}
                    style={{ resize: "vertical" }}
                  />
                  <div className={styles.rangeButtonRow}>
                    <button type="button" className={styles.btnStrong} disabled={bulkSaving} onClick={handleBulkNote}>
                      Apply note to all selected dates
                    </button>
                  </div>
                </div>

                <div className={styles.rangeActionGroup}>
                  <div className={styles.fieldLabel}>Signal</div>
                  <select
                    value={bulkSignal}
                    onChange={(e) => setBulkSignal(e.target.value as DaySignal)}
                    className={styles.inputField}
                  >
                    <option value="none">None</option>
                    <option value="high">High Demand</option>
                    <option value="maintenance">Maintenance</option>
                    <option value="private">Private Use</option>
                    <option value="flex">Flexible</option>
                  </select>
                  <div className={styles.rangeButtonRow}>
                    <button type="button" className={styles.btnStrong} disabled={bulkSaving} onClick={() => handleBulkSignal(false)}>
                      Apply signal
                    </button>
                    <button type="button" className={styles.navBtn} disabled={bulkSaving} onClick={() => handleBulkSignal(true)}>
                      Clear signal
                    </button>
                  </div>
                </div>

                <div className={styles.rangeButtonRow} style={{ marginTop: 14 }}>
                  <button type="button" className={styles.navBtn} onClick={clearRangeSelection}>
                    Cancel without changes
                  </button>
                </div>
              </section>
            )}
          </>
        )}
      </div>

      {!rangeMode && drawerOpen && inspectorData && selected && (
        <>
          <div onClick={closeDrawer} className={styles.backdrop} aria-hidden="true" />
          <aside className={styles.drawer} aria-label="Day Inspector" role="dialog" aria-modal="true">
            <div className={styles.drawerHeaderRow}>
              <div>
                <div className={styles.drawerTitle}>Day Inspector</div>
                <div className={styles.drawerSub}>
                  {inspectorData.listing?.title ?? "Listing"} · {prettyDate(inspectorData.day)}
                </div>
              </div>
              <button className={styles.drawerClose} onClick={closeDrawer} aria-label="Close day inspector">
                ✕
              </button>
            </div>

            <div className={styles.miniCard} style={{ marginTop: 14 }}>
              <div style={{ fontWeight: 950, fontSize: 16 }}>{inspectorData.listing?.title || "Listing"}</div>
              {inspectorData.listing && (
                <div style={{ opacity: 0.78, marginTop: 6, fontSize: 13 }}>
                  {inspectorData.listing.city}, {inspectorData.listing.state} •{" "}
                  {(() => {
                    const { priceText, period } = getListingPriceLabel(inspectorData.listing);
                    return `${priceText}${period || ""}`;
                  })()}
                </div>
              )}
              <Link href={`/listings/${selected.listingId}`} className={styles.btnSecondary} style={{ marginTop: 12, display: "inline-flex" }}>
                Open listing →
              </Link>
            </div>

            <div className={styles.sectionLabel}>Day Settings</div>

            <div className={styles.miniCard} style={{ marginTop: 10 }}>
              <label className={styles.labelRow}>
                <input type="checkbox" checked={editBlocked} onChange={(e) => setEditBlocked(e.target.checked)} />
                <span style={{ fontWeight: 900 }}>Block this date</span>
              </label>

              {editBlocked && (
                <div style={{ marginTop: 10 }}>
                  <div className={styles.fieldLabel}>Block reason (optional)</div>
                  <input
                    value={editReason}
                    onChange={(e) => setEditReason(e.target.value)}
                    placeholder="Example: maintenance, private use, no hookups today..."
                    className={styles.inputField}
                  />
                </div>
              )}

              <div style={{ marginTop: 12 }}>
                <div className={styles.fieldLabel}>Signal</div>
                <select
                  value={editSignal}
                  onChange={(e) => setEditSignal(e.target.value as DaySignal)}
                  className={styles.inputField}
                >
                  <option value="none">None</option>
                  <option value="high">High Demand</option>
                  <option value="maintenance">Maintenance</option>
                  <option value="private">Private Use</option>
                  <option value="flex">Flexible</option>
                </select>
              </div>

              <div style={{ marginTop: 12 }}>
                <div className={styles.fieldLabel}>Host note (internal)</div>
                <textarea
                  value={editNote}
                  onChange={(e) => setEditNote(e.target.value)}
                  placeholder="Gate code, arrival notes, reminders, etc."
                  rows={4}
                  className={styles.inputField}
                  style={{ resize: "vertical" }}
                />
              </div>

              <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
                <button className={styles.btnStrong} onClick={saveDayMeta} disabled={metaSaving}>
                  {metaSaving ? "Saving..." : "Save Day Settings"}
                </button>
              </div>
            </div>

            <div className={styles.sectionLabel}>Bookings on this day</div>

            {inspectorData.hits.length === 0 ? (
              <div className={styles.miniCard} style={{ marginTop: 10, opacity: 0.9 }}>
                No bookings cover this date.
              </div>
            ) : (
              <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
                {inspectorData.hits.map((b) => (
                  <div key={b.id} className={styles.miniCard}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
                      <div style={{ fontWeight: 950 }}>
                        {b.checkIn} → {b.checkOut}
                      </div>
                      <div className={styles.bookingBadge} style={bookingBadgeStyle(b.status)}>
                        {stayIcon(b.stayType)} {b.status.toUpperCase()}
                      </div>
                    </div>

                    <div style={{ marginTop: 8, opacity: 0.8, fontSize: 13 }}>
                      {b.name ? `Guest: ${b.name}` : b.email ? `Guest: ${b.email}` : `Booking ID: ${b.id}`}
                    </div>

                    <div style={{ display: "flex", gap: 10, marginTop: 12, flexWrap: "wrap" }}>
                      {b.status === "pending" ? (
                        <>
                          <button className={styles.btnStrong} disabled={actionLoading === b.id} onClick={() => setBookingStatus(b.id, "approved")}>
                            {actionLoading === b.id ? "Updating..." : "Approve"}
                          </button>
                          <button className={styles.btnGhost} disabled={actionLoading === b.id} onClick={() => setBookingStatus(b.id, "declined")}>
                            {actionLoading === b.id ? "Updating..." : "Decline"}
                          </button>
                        </>
                      ) : (
                        <div style={{ opacity: 0.75, fontSize: 13 }}>No actions available (already {b.status}).</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div style={{ marginTop: 16, opacity: 0.65, fontSize: 12 }}>
              Tip: Press <b>Esc</b> to close this panel.
            </div>
          </aside>
        </>
      )}
    </div>
  );
}

function ListingCalendar({
  listing,
  bookings,
  dayMetaMap,
  days,
  monthStart,
  monthLabel,
  today,
  selectedDayISO,
  onPrevMonth,
  onToday,
  onNextMonth,
  onOpenDay,
  dayButtonRef,
  rangeMode,
  rangeToggleRef,
  onToggleRangeMode,
  rangeStart,
  rangeEnd,
  rangeMessage,
  tentativeRangeDates,
  onRangeHover,
}: {
  listing: Listing;
  bookings: Booking[];
  dayMetaMap: Record<string, DayMeta>;
  days: Date[];
  monthStart: Date;
  monthLabel: string;
  today: Date;
  selectedDayISO: string | null;
  onPrevMonth: () => void;
  onToday: () => void;
  onNextMonth: () => void;
  onOpenDay: (day: Date) => void;
  dayButtonRef: MutableRefObject<HTMLButtonElement | null>;
  rangeMode: boolean;
  rangeToggleRef: MutableRefObject<HTMLButtonElement | null>;
  onToggleRangeMode: () => void;
  rangeStart: string | null;
  rangeEnd: string | null;
  rangeMessage: string;
  tentativeRangeDates: string[];
  onRangeHover: (dateISO: string) => void;
}) {
  const approved = bookings.filter((b) => b.status === "approved").length;
  const pending = bookings.filter((b) => b.status === "pending").length;
  const declined = bookings.filter((b) => b.status === "declined").length;

  return (
    <section className={styles.calendarPanel}>
      <div className={styles.calendarTopRow}>
        <div>
          <div className={styles.listingTitle}>{listing.title}</div>
          <div className={styles.listingMeta}>
            {listing.city}, {listing.state} •{" "}
            {(() => {
              const { priceText, period } = getListingPriceLabel(listing);
              return `${priceText}${period || ""}`;
            })()}{" "}
            • {listing.hookups} • Max {listing.maxLengthFt}ft
          </div>

          <div className={styles.statsRow}>
            <span className={styles.statPill}>Approved: {approved}</span>
            <span className={styles.statPill}>Pending: {pending}</span>
            <span className={styles.statPill}>Declined: {declined}</span>
          </div>
        </div>

        <div className={styles.navBtns}>
          <button type="button" className={styles.navBtn} onClick={onPrevMonth} aria-label="Previous month">
            ← Prev
          </button>
          <span className={styles.monthLabel}>{monthLabel}</span>
          <button type="button" className={styles.navBtn} onClick={onToday}>
            Today
          </button>
          <button type="button" className={styles.navBtn} onClick={onNextMonth} aria-label="Next month">
            Next →
          </button>
          <button
            type="button"
            ref={rangeToggleRef}
            className={`${styles.navBtn} ${rangeMode ? styles.navBtnActive : ""}`}
            aria-pressed={rangeMode}
            onClick={onToggleRangeMode}
          >
            📅 Select date range
          </button>
        </div>
      </div>

      {rangeMode && (
        <div className={styles.rangeGuidanceBar}>
          {!rangeStart
            ? "Choose a starting date."
            : !rangeEnd
            ? "Now choose an ending date."
            : "Click another date to start a new range, or manage the selection below."}
          {rangeMessage && <span> {rangeMessage}</span>}
        </div>
      )}

      <div className={styles.legendRow}>
        <span className={styles.legendItem}>
          <span className={styles.legendDot} style={{ background: "rgba(255,255,255,0.14)" }} aria-hidden="true" />
          Available
        </span>
        <span className={styles.legendItem}>
          <span className={styles.legendDot} style={{ background: "rgba(59,130,246,0.55)" }} aria-hidden="true" />
          Approved
        </span>
        <span className={styles.legendItem}>
          <span className={styles.legendDot} style={{ background: "rgba(250,204,21,0.65)" }} aria-hidden="true" />
          Pending
        </span>
        <span className={styles.legendItem}>
          <span className={styles.legendDot} style={{ background: "rgba(248,113,113,0.5)" }} aria-hidden="true" />
          Blocked
        </span>
        <span className={styles.legendItem}>
          <span className={styles.legendDot} style={{ background: "rgba(147,197,253,0.85)" }} aria-hidden="true" />
          ⚑ Signal
        </span>
      </div>

      <div className={styles.calendarScroll}>
        <div className={styles.calendarScrollInner}>
          <div className={styles.dowRow}>
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
              <div key={d} className={styles.dowCell}>
                {d}
              </div>
            ))}
          </div>

          <div className={styles.monthGrid}>
            {days.map((day) => {
              const inMonth = day.getMonth() === monthStart.getMonth();
              const dayISO = toISODate(day);

              const hits = bookings.filter((b) => bookingCoversDay(b, day));
              const shown = hits.slice(0, 2);
              const extra = hits.length - shown.length;

              const metaKey = dayMetaId(listing.id, dayISO);
              const meta = dayMetaMap[metaKey];
              const isBlocked = !!meta?.blocked;
              const sig = (meta?.signal as DaySignal) || "none";
              const hasNote = !!meta?.note?.trim();
              const isToday = sameDay(day, today);
              const isSelected = dayISO === selectedDayISO;
              const isRangeStart = rangeMode && dayISO === rangeStart;
              const isRangeEnd = rangeMode && !!rangeEnd && dayISO === rangeEnd;
              const isCommittedInterior =
                rangeMode && rangeStart && rangeEnd && dayISO > rangeStart && dayISO < rangeEnd;
              const isTentative = rangeMode && !rangeEnd && tentativeRangeDates.includes(dayISO);

              const ariaLabel = `${day.toLocaleDateString(undefined, {
                month: "long",
                day: "numeric",
                year: "numeric",
              })}. ${isBlocked ? "Blocked. " : ""}${hits.length} booking${hits.length === 1 ? "" : "s"}.${
                hasNote ? " Has a note." : ""
              }${sig !== "none" ? ` Signal: ${signalLabel(sig)}.` : ""}${
                rangeMode
                  ? !rangeStart
                    ? " Select as start date."
                    : !rangeEnd
                    ? " Select as end date."
                    : ""
                  : " Press Enter to inspect this day."
              }`;

              return (
                <button
                  key={dayISO}
                  type="button"
                  ref={isSelected ? dayButtonRef : undefined}
                  disabled={!inMonth}
                  tabIndex={inMonth ? 0 : -1}
                  onClick={() => inMonth && onOpenDay(day)}
                  onMouseEnter={() => inMonth && rangeMode && onRangeHover(dayISO)}
                  aria-label={inMonth ? ariaLabel : undefined}
                  className={`${styles.dayTile} ${!inMonth ? styles.dayTileMuted : ""} ${
                    isBlocked ? styles.dayTileBlocked : ""
                  } ${isToday ? styles.dayTileToday : ""} ${isSelected ? styles.dayTileSelected : ""} ${
                    isRangeStart ? styles.dayRangeStart : ""
                  } ${isRangeEnd ? styles.dayRangeEnd : ""} ${
                    isCommittedInterior ? styles.dayRangeInterior : ""
                  } ${isTentative ? styles.dayRangeTentative : ""}`}
                >
                  <div className={styles.dayTopRow}>
                    <div className={styles.dayNum}>{day.getDate()}</div>
                    <div className={styles.dayIcons} aria-hidden="true">
                      {hasNote && <span title="Has note">📝</span>}
                      {sig !== "none" && <span title={signalLabel(sig)}>⚑</span>}
                      {isBlocked && <span title={meta?.blockReason || "Blocked"}>⛔</span>}
                    </div>
                  </div>

                  <div className={styles.dayChipList}>
                    {isBlocked && (
                      <div className={`${styles.dayChip} ${styles.dayChipBlocked}`}>
                        <span>BLOCKED</span>
                      </div>
                    )}

                    {shown.map((b) => (
                      <div key={b.id} className={`${styles.dayChip} ${dayChipClass(b.status)}`}>
                        <span>
                          {stayIcon(b.stayType)} {b.status.toUpperCase()}
                        </span>
                      </div>
                    ))}

                    {extra > 0 && <div className={`${styles.dayChip} ${styles.dayChipExtra}`}>+{extra} more</div>}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className={styles.helperText}>Click any day to open the RVNB Day Inspector.</div>
    </section>
  );
}

function HostCalendarParamReader({
  onParams,
}: {
  onParams: (value: {
    date: string | null;
    listingId: string | null;
    start: string | null;
    end: string | null;
  }) => void;
}) {
  const searchParams = useSearchParams();

  useEffect(() => {
    onParams({
      date: searchParams.get("date"),
      listingId: searchParams.get("listingId"),
      start: searchParams.get("start"),
      end: searchParams.get("end"),
    });
  }, [searchParams, onParams]);

  return null;
}

export default function HostCalendarPage() {
  const [params, setParams] = useState<{
    date: string | null;
    listingId: string | null;
    start: string | null;
    end: string | null;
  }>({ date: null, listingId: null, start: null, end: null });

  return (
    <HostGuard>
      <Suspense fallback={null}>
        <HostCalendarParamReader onParams={setParams} />
      </Suspense>
      <HostCalendarContent
        initialDateISO={params.date}
        initialListingId={params.listingId}
        initialStartISO={params.start}
        initialEndISO={params.end}
      />
    </HostGuard>
  );
}

