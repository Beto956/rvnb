"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  collection,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

type Hookups = "Full" | "Partial" | "None";

type Listing = {
  id: string;
  title: string;
  city: string;
  state: string;
  pricePerNight: number;
  hookups: Hookups;
  maxLengthFt: number;
};

type BookingStatus = "pending" | "approved" | "declined";

// ✅ NEW: stay type
type StayType = "rv" | "land";

type Booking = {
  id: string;
  listingId: string;
  checkIn: string; // YYYY-MM-DD
  checkOut: string; // YYYY-MM-DD
  status: BookingStatus;
  name?: string;
  email?: string;

  // ✅ NEW: optional for backwards compatibility
  stayType?: StayType;
};

type DaySignal = "none" | "high" | "maintenance" | "private" | "flex";

type DayMeta = {
  listingId: string;
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

/**
 * checkIn included, checkOut excluded
 */
function bookingCoversDay(b: Booking, day: Date) {
  const inD = clampMidnight(parseISODate(b.checkIn));
  const outD = clampMidnight(parseISODate(b.checkOut));
  const x = clampMidnight(day);
  return x >= inD && x < outD;
}

function statusStyle(status: BookingStatus): React.CSSProperties {
  if (status === "approved") {
    return {
      border: "1px solid rgba(255,255,255,0.22)",
      background: "rgba(255,255,255,0.12)",
      opacity: 0.98,
    };
  }
  if (status === "pending") {
    return {
      border: "1px dashed rgba(255,255,255,0.22)",
      background: "rgba(255,255,255,0.08)",
      opacity: 0.92,
    };
  }
  return {
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(255,255,255,0.04)",
    opacity: 0.7,
  };
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

// ✅ NEW: stay icon helper
function stayIcon(stayType?: StayType) {
  return (stayType ?? "rv") === "rv" ? "🚐" : "🏕️";
}

export default function HostCalendarPage() {
  const [loading, setLoading] = useState(true);
  const [listings, setListings] = useState<Listing[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [error, setError] = useState("");

  const [monthCursor, setMonthCursor] = useState(() => startOfMonth(new Date()));

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

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDrawerOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const monthStart = useMemo(() => startOfMonth(monthCursor), [monthCursor]);
  const monthEnd = useMemo(() => endOfMonth(monthCursor), [monthCursor]);

  // Load listings + bookings once
  useEffect(() => {
    const run = async () => {
      setLoading(true);
      setError("");

      try {
        const listingsSnap = await getDocs(collection(db, "listings"));
        const listingsData: Listing[] = listingsSnap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<Listing, "id">),
        }));
        setListings(listingsData);

        const listingIds = listingsData.map((l) => l.id);
        if (listingIds.length === 0) {
          setBookings([]);
          return;
        }

        const chunks: string[][] = [];
        for (let i = 0; i < listingIds.length; i += 10) {
          chunks.push(listingIds.slice(i, i + 10));
        }

        const all: Booking[] = [];
        for (const chunk of chunks) {
          const qy = query(
            collection(db, "bookings"),
            where("listingId", "in", chunk),
            orderBy("checkIn", "asc")
          );
          const snap = await getDocs(qy);
          snap.docs.forEach((d) => {
            const data = d.data() as any;
            all.push({
              id: d.id,
              ...(data as Omit<Booking, "id">),
              // ✅ ensure stayType comes through if present
              stayType: (data.stayType as StayType) ?? undefined,
            });
          });
        }

        all.sort((a, b) => a.checkIn.localeCompare(b.checkIn));
        setBookings(all);
      } catch (e: any) {
        console.error(e);
        setError(e?.message || "Failed to load calendar data.");
      } finally {
        setLoading(false);
      }
    };

    run();
  }, []);

  // Load dayMeta for the visible month (refresh when month changes)
  useEffect(() => {
    const run = async () => {
      try {
        if (listings.length === 0) return;

        const startISO = toISODate(monthStart);
        const endISO = toISODate(monthEnd);

        const listingIds = listings.map((l) => l.id);
        const chunks: string[][] = [];
        for (let i = 0; i < listingIds.length; i += 10) chunks.push(listingIds.slice(i, i + 10));

        const next: Record<string, DayMeta> = {};

        for (const chunk of chunks) {
          const qy = query(
            collection(db, "dayMeta"),
            where("listingId", "in", chunk),
            where("date", ">=", startISO),
            where("date", "<=", endISO),
            orderBy("date", "asc")
          );

          const snap = await getDocs(qy);
          snap.docs.forEach((d) => {
            const data = d.data() as DayMeta;
            next[dayMetaId(data.listingId, data.date)] = data;
          });
        }

        setDayMetaMap(next);
      } catch (e: any) {
        console.error(e);
      }
    };

    run();
  }, [listings, monthStart, monthEnd]);

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

  function openDayInspector(listingId: string, day: Date) {
    const dayISO = toISODate(day);
    setSelected({ listingId, dayISO });
    setDrawerOpen(true);

    const key = dayMetaId(listingId, dayISO);
    const meta = dayMetaMap[key];

    setEditBlocked(!!meta?.blocked);
    setEditReason(meta?.blockReason || "");
    setEditSignal((meta?.signal as DaySignal) || "none");
    setEditNote(meta?.note || "");
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
      await updateDoc(doc(db, "bookings", bookingId), { status });
      setBookings((prev) => prev.map((b) => (b.id === bookingId ? { ...b, status } : b)));
    } catch (e: any) {
      console.error(e);
      alert(e?.message || "Failed to update booking status.");
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
        date: selected.dayISO,
        blocked: editBlocked,
        blockReason: editBlocked ? editReason.trim() : "",
        signal: editSignal,
        note: editNote.trim(),
      };

      const id = dayMetaId(selected.listingId, selected.dayISO);

      await setDoc(
        doc(db, "dayMeta", id),
        { ...payload, updatedAt: serverTimestamp() },
        { merge: true }
      );

      setDayMetaMap((prev) => ({ ...prev, [id]: payload }));
    } catch (e: any) {
      console.error(e);
      alert(e?.message || "Failed to save day settings.");
    } finally {
      setMetaSaving(false);
    }
  }

  if (loading) {
    return (
      <main style={pageStyle}>
        <h1 style={h1}>Host Calendar</h1>
        <div style={card}>Loading…</div>
      </main>
    );
  }

  return (
    <main style={pageStyle}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <h1 style={h1}>Host Calendar</h1>
        <Link href="/host" style={linkBtn}>
          ← Back to Host
        </Link>
        <Link href="/listings" style={linkBtn}>
          View Public Listings
        </Link>
      </div>

      {error && (
        <div style={{ ...card, borderColor: "rgba(255,80,80,0.35)" }}>{error}</div>
      )}

      <section
        style={{
          ...card,
          display: "flex",
          justifyContent: "space-between",
          gap: 10,
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        <div style={{ fontWeight: 900, fontSize: 18 }}>
          {monthStart.toLocaleString(undefined, { month: "long", year: "numeric" })}
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button style={btn} onClick={() => setMonthCursor(addMonths(monthCursor, -1))}>
            ← Prev
          </button>
          <button style={btn} onClick={() => setMonthCursor(startOfMonth(new Date()))}>
            Today
          </button>
          <button style={btn} onClick={() => setMonthCursor(addMonths(monthCursor, 1))}>
            Next →
          </button>
        </div>
      </section>

      <div style={{ display: "grid", gap: 14, marginTop: 14 }}>
        {listings.map((l) => {
          const items = bookingsByListing.get(l.id) || [];
          const approved = items.filter((b) => b.status === "approved").length;
          const pending = items.filter((b) => b.status === "pending").length;
          const declined = items.filter((b) => b.status === "declined").length;

          return (
            <section key={l.id} style={card}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 12,
                  flexWrap: "wrap",
                }}
              >
                <div>
                  <div style={{ fontSize: 18, fontWeight: 950 }}>{l.title}</div>
                  <div style={{ opacity: 0.82 }}>
                    {l.city}, {l.state} • ${l.pricePerNight}/night • {l.hookups} • Max {l.maxLengthFt}ft
                  </div>
                  <div style={{ display: "flex", gap: 10, marginTop: 10, flexWrap: "wrap" }}>
                    <div style={pill}>Approved: {approved}</div>
                    <div style={pill}>Pending: {pending}</div>
                    <div style={pill}>Declined: {declined}</div>
                  </div>
                </div>
                <Link href={`/listings/${l.id}`} style={linkBtn}>
                  Open Listing →
                </Link>
              </div>

              <div style={{ marginTop: 14 }}>
                <div style={dowRow}>
                  {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
                    <div key={d} style={dowCell}>
                      {d}
                    </div>
                  ))}
                </div>

                <div style={grid}>
                  {days.map((day) => {
                    const inMonth = day.getMonth() === monthStart.getMonth();
                    const dayISO = toISODate(day);

                    const hits = items.filter((b) => bookingCoversDay(b, day));
                    const shown = hits.slice(0, 2);
                    const extra = hits.length - shown.length;

                    const metaKey = dayMetaId(l.id, dayISO);
                    const meta = dayMetaMap[metaKey];
                    const isBlocked = !!meta?.blocked;
                    const sig = (meta?.signal as DaySignal) || "none";
                    const hasNote = !!meta?.note?.trim();

                    return (
                      <button
                        key={`${l.id}-${dayISO}`}
                        type="button"
                        onClick={() => openDayInspector(l.id, day)}
                        style={{
                          ...cellBtn,
                          opacity: inMonth ? 1 : 0.45,
                          outline: sameDay(day, today)
                            ? "2px solid rgba(255,255,255,0.28)"
                            : "none",
                        }}
                        title={`Inspect ${dayISO}`}
                      >
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "baseline",
                          }}
                        >
                          <div style={{ fontWeight: 900 }}>{day.getDate()}</div>
                          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                            {hasNote && (
                              <span title="Has note" style={miniTag}>
                                📝
                              </span>
                            )}
                            {sig !== "none" && (
                              <span title={signalLabel(sig)} style={miniTag}>
                                ⚑
                              </span>
                            )}
                            {isBlocked && (
                              <span title={meta?.blockReason || "Blocked"} style={miniTag}>
                                ⛔
                              </span>
                            )}
                            {hits.length > 0 && (
                              <span
                                title="Bookings on day"
                                style={{ fontSize: 12, opacity: 0.75, fontWeight: 900 }}
                              >
                                {hits.length}
                              </span>
                            )}
                          </div>
                        </div>

                        <div style={{ display: "grid", gap: 6, marginTop: 8 }}>
                          {isBlocked && (
                            <div
                              style={{
                                ...chip,
                                border: "1px solid rgba(255,255,255,0.18)",
                                background: "rgba(255,255,255,0.06)",
                                opacity: 0.95,
                              }}
                            >
                              <span style={{ fontWeight: 950, fontSize: 11 }}>BLOCKED</span>
                              <span style={{ opacity: 0.8, fontSize: 11 }}>
                                {meta?.blockReason?.trim()
                                  ? meta.blockReason.trim().slice(0, 14) +
                                    (meta.blockReason.trim().length > 14 ? "…" : "")
                                  : ""}
                              </span>
                            </div>
                          )}

                          {/* ✅ UPDATED: show 🚐/🏕️ on chips */}
                          {shown.map((b) => (
                            <div key={b.id} style={{ ...chip, ...statusStyle(b.status) }}>
                              <span style={{ fontWeight: 900, fontSize: 11 }}>
                                {stayIcon(b.stayType)} {b.status.toUpperCase()}
                              </span>
                              <span style={{ opacity: 0.85, fontSize: 11 }}>
                                {b.checkIn.split("-").slice(1).join("/")}→
                                {b.checkOut.split("-").slice(1).join("/")}
                              </span>
                            </div>
                          ))}

                          {extra > 0 && (
                            <div
                              style={{
                                ...chip,
                                border: "1px solid rgba(255,255,255,0.12)",
                                background: "rgba(255,255,255,0.03)",
                                opacity: 0.85,
                              }}
                            >
                              +{extra} more
                            </div>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>

                <div style={{ marginTop: 10, opacity: 0.75, fontSize: 13 }}>
                  Click any day to open the RVNB Day Inspector.
                </div>
              </div>
            </section>
          );
        })}
      </div>

      {drawerOpen && inspectorData && selected && (
        <>
          <div onClick={() => setDrawerOpen(false)} style={backdrop} aria-hidden="true" />
          <aside style={drawer} aria-label="Day Inspector">
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 12,
                alignItems: "center",
              }}
            >
              <div>
                <div style={{ fontWeight: 950, fontSize: 18 }}>Day Inspector</div>
                <div style={{ opacity: 0.8, marginTop: 4 }}>{prettyDate(inspectorData.day)}</div>
              </div>
              <button style={iconBtn} onClick={() => setDrawerOpen(false)} title="Close">
                ✕
              </button>
            </div>

            <div style={{ ...miniCard, marginTop: 14 }}>
              <div style={{ fontWeight: 950, fontSize: 16 }}>
                {inspectorData.listing?.title || "Listing"}
              </div>
              {inspectorData.listing && (
                <div style={{ opacity: 0.78, marginTop: 6 }}>
                  {inspectorData.listing.city}, {inspectorData.listing.state} • $
                  {inspectorData.listing.pricePerNight}/night
                </div>
              )}
              <Link href={`/listings/${selected.listingId}`} style={{ ...linkBtn, marginTop: 12 }}>
                Open Listing →
              </Link>
            </div>

            <div style={{ marginTop: 16, fontWeight: 950, opacity: 0.9 }}>Day Settings</div>

            <div style={{ ...miniCard, marginTop: 10 }}>
              <label style={labelRow}>
                <input
                  type="checkbox"
                  checked={editBlocked}
                  onChange={(e) => setEditBlocked(e.target.checked)}
                />
                <span style={{ fontWeight: 900 }}>Block this date</span>
              </label>

              {editBlocked && (
                <div style={{ marginTop: 10 }}>
                  <div style={{ fontWeight: 900, opacity: 0.85, marginBottom: 6 }}>
                    Block reason (optional)
                  </div>
                  <input
                    value={editReason}
                    onChange={(e) => setEditReason(e.target.value)}
                    placeholder="Example: maintenance, private use, no hookups today..."
                    style={input}
                  />
                </div>
              )}

              <div style={{ marginTop: 12 }}>
                <div style={{ fontWeight: 900, opacity: 0.85, marginBottom: 6 }}>Signal</div>
                <select
                  value={editSignal}
                  onChange={(e) => setEditSignal(e.target.value as DaySignal)}
                  style={input}
                >
                  <option value="none">None</option>
                  <option value="high">High Demand</option>
                  <option value="maintenance">Maintenance</option>
                  <option value="private">Private Use</option>
                  <option value="flex">Flexible</option>
                </select>
              </div>

              <div style={{ marginTop: 12 }}>
                <div style={{ fontWeight: 900, opacity: 0.85, marginBottom: 6 }}>
                  Host note (internal)
                </div>
                <textarea
                  value={editNote}
                  onChange={(e) => setEditNote(e.target.value)}
                  placeholder="Gate code, arrival notes, reminders, etc."
                  rows={4}
                  style={{ ...input, resize: "vertical" }}
                />
              </div>

              <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
                <button style={btnStrong} onClick={saveDayMeta} disabled={metaSaving}>
                  {metaSaving ? "Saving..." : "Save Day Settings"}
                </button>
              </div>
            </div>

            <div style={{ marginTop: 16, fontWeight: 900, opacity: 0.9 }}>
              Bookings on this day
            </div>

            {inspectorData.hits.length === 0 ? (
              <div style={{ ...miniCard, marginTop: 10, opacity: 0.9 }}>
                No bookings cover this date.
              </div>
            ) : (
              <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
                {inspectorData.hits.map((b) => (
                  <div key={b.id} style={miniCard}>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: 10,
                        alignItems: "center",
                      }}
                    >
                      <div style={{ fontWeight: 950 }}>
                        {b.checkIn} → {b.checkOut}
                      </div>

                      {/* ✅ UPDATED: show stay icon here too */}
                      <div style={{ ...badge, ...statusStyle(b.status) }}>
                        {stayIcon(b.stayType)} {b.status.toUpperCase()}
                      </div>
                    </div>

                    <div style={{ marginTop: 8, opacity: 0.8, fontSize: 13 }}>
                      {b.name
                        ? `Guest: ${b.name}`
                        : b.email
                        ? `Guest: ${b.email}`
                        : `Booking ID: ${b.id}`}
                    </div>

                    <div style={{ display: "flex", gap: 10, marginTop: 12, flexWrap: "wrap" }}>
                      {b.status === "pending" ? (
                        <>
                          <button
                            style={btnStrong}
                            disabled={actionLoading === b.id}
                            onClick={() => setBookingStatus(b.id, "approved")}
                          >
                            {actionLoading === b.id ? "Updating..." : "Approve"}
                          </button>
                          <button
                            style={btnGhost}
                            disabled={actionLoading === b.id}
                            onClick={() => setBookingStatus(b.id, "declined")}
                          >
                            {actionLoading === b.id ? "Updating..." : "Decline"}
                          </button>
                        </>
                      ) : (
                        <div style={{ opacity: 0.75, fontSize: 13 }}>
                          No actions available (already {b.status}).
                        </div>
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
    </main>
  );
}

// Styles
const pageStyle: React.CSSProperties = { padding: 20, maxWidth: 1100, margin: "0 auto" };
const h1: React.CSSProperties = { fontSize: 28, fontWeight: 950, margin: 0 };

const card: React.CSSProperties = {
  marginTop: 12,
  padding: 16,
  borderRadius: 14,
  border: "1px solid rgba(255,255,255,0.14)",
  background: "rgba(255,255,255,0.05)",
};

const linkBtn: React.CSSProperties = {
  display: "inline-block",
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.14)",
  background: "rgba(255,255,255,0.05)",
  textDecoration: "none",
  fontWeight: 800,
  opacity: 0.95,
  color: "white",
};

const btn: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.14)",
  background: "rgba(255,255,255,0.05)",
  color: "white",
  fontWeight: 900,
  cursor: "pointer",
};

const btnStrong: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.18)",
  background: "rgba(255,255,255,0.12)",
  color: "white",
  fontWeight: 950,
  cursor: "pointer",
};

const btnGhost: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(255,255,255,0.04)",
  color: "white",
  fontWeight: 950,
  cursor: "pointer",
};

const pill: React.CSSProperties = {
  padding: "6px 10px",
  borderRadius: 999,
  fontSize: 13,
  fontWeight: 800,
  border: "1px solid rgba(255,255,255,0.14)",
  background: "rgba(255,255,255,0.05)",
};

const dowRow: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(7, 1fr)",
  gap: 10,
  marginBottom: 10,
};

const dowCell: React.CSSProperties = {
  padding: "8px 10px",
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.10)",
  background: "rgba(0,0,0,0.18)",
  fontWeight: 900,
  opacity: 0.9,
  textAlign: "center",
};

const grid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(7, 1fr)",
  gap: 10,
};

const cellBtn: React.CSSProperties = {
  minHeight: 92,
  padding: 10,
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.10)",
  background: "rgba(0,0,0,0.16)",
  textAlign: "left",
  color: "white",
  cursor: "pointer",
};

const chip: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 8,
  padding: "6px 8px",
  borderRadius: 10,
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

const miniTag: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: 22,
  height: 22,
  borderRadius: 8,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(255,255,255,0.04)",
  fontSize: 12,
  opacity: 0.9,
};

const backdrop: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.55)",
  zIndex: 50,
};

const drawer: React.CSSProperties = {
  position: "fixed",
  top: 0,
  right: 0,
  height: "100vh",
  width: "min(420px, 92vw)",
  background: "rgba(10,10,10,0.96)",
  borderLeft: "1px solid rgba(255,255,255,0.12)",
  padding: 16,
  zIndex: 60,
  overflowY: "auto",
};

const iconBtn: React.CSSProperties = {
  width: 40,
  height: 40,
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(255,255,255,0.05)",
  color: "white",
  fontWeight: 950,
  cursor: "pointer",
};

const miniCard: React.CSSProperties = {
  padding: 14,
  borderRadius: 14,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(255,255,255,0.05)",
};

const badge: React.CSSProperties = {
  padding: "6px 10px",
  borderRadius: 999,
  fontSize: 12,
  fontWeight: 900,
};

const labelRow: React.CSSProperties = {
  display: "flex",
  gap: 10,
  alignItems: "center",
};

const input: React.CSSProperties = {
  width: "100%",
  padding: 12,
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.14)",
  background: "rgba(255,255,255,0.05)",
  color: "white",
  fontSize: 14,
  outline: "none",
};
