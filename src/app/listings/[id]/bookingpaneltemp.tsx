"use client";

import React, { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";

type BookingType = "RV" | "LAND" | "RV_PROVIDED";

type Props = {
  listingId: string;
  hostId: string;
  nightlyPrice: number;
  priceLabel: string;
};

// Safer parsing: avoids timezone weirdness
function toDateLocal(yyyyMmDd: string) {
  return new Date(`${yyyyMmDd}T00:00:00`);
}

function addDays(yyyyMmDd: string, days: number) {
  const d = toDateLocal(yyyyMmDd);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export default function BookingPanel({ listingId, hostId, nightlyPrice, priceLabel }: Props) {
  const router = useRouter();
  const { user } = useAuth();
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [bookingType, setBookingType] = useState<BookingType>("RV");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  // Today in YYYY-MM-DD (used for min date)
  const today = useMemo(() => {
    const d = new Date();
    // local date -> yyyy-mm-dd
    const local = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    return local.toISOString().slice(0, 10);
  }, []);

  const nights = useMemo(() => {
    if (!checkIn || !checkOut) return 0;
    const start = toDateLocal(checkIn);
    const end = toDateLocal(checkOut);
    const diff = end.getTime() - start.getTime();
    const n = Math.ceil(diff / (1000 * 60 * 60 * 24));
    return Number.isFinite(n) && n > 0 ? n : 0;
  }, [checkIn, checkOut]);

  const premium = useMemo(() => (bookingType === "RV_PROVIDED" ? 50 : 0), [bookingType]);

  const estimatedTotal = useMemo(() => {
    const base = Number(nightlyPrice) || 0;
    if (!base || nights === 0) return 0;
    return nights * (base + premium);
  }, [nightlyPrice, nights, premium]);

  const minCheckout = useMemo(() => {
    if (!checkIn) return today;
    return addDays(checkIn, 1);
  }, [checkIn, today]);

  async function handleBooking() {
    setMessage("");

    if (!user) {
      setMessage("Please sign in to request dates for this listing.");
      router.push(`/login?next=${encodeURIComponent(`/listings/${listingId}`)}`);
      return;
    }

    const listingSnap = await getDoc(doc(db, "listings", listingId));
    if (!listingSnap.exists()) {
      setMessage("This listing could not be found.");
      return;
    }

    const listingOwnerId = (listingSnap.data()?.hostId ?? "").toString().trim();
    if (!listingOwnerId) {
      setMessage("This listing is missing a valid host owner.");
      return;
    }

    if (user.uid === listingOwnerId) {
      setMessage("You cannot request dates for your own listing.");
      return;
    }

    if (!hostId || hostId.trim() === "") {
      setMessage("This listing does not have a valid host owner yet.");
      return;
    }

    if (hostId !== listingOwnerId) {
      setMessage("This listing owner no longer matches the current listing.");
      return;
    }

    if (!listingId) {
      setMessage("Listing id missing. Please refresh.");
      return;
    }

    if (!checkIn || !checkOut) {
      setMessage("Please select dates.");
      return;
    }

    const start = toDateLocal(checkIn);
    const end = toDateLocal(checkOut);

    if (!(end > start)) {
      setMessage("Check-out must be after check-in.");
      return;
    }

    // Prevent past check-ins
    if (toDateLocal(checkIn).getTime() < toDateLocal(today).getTime()) {
      setMessage("Check-in cannot be in the past.");
      return;
    }

    // Optional: keep notes small & clean (prevents giant messages)
    const cleanNote = note.trim().slice(0, 500);

    setSaving(true);

    try {
      // Pending inquiries do not reserve dates; host approval is authoritative.
      await addDoc(collection(db, "bookings"), {
        listingId,
        guestId: user.uid,
        hostId: listingOwnerId,
        checkIn,
        checkOut,
        bookingType,
        nights,
        estimatedTotal,
        note: cleanNote || "",
        status: "pending",
        createdAt: serverTimestamp(),
      });

      setMessage("✅ Date inquiry sent. The host must approve it before the stay is confirmed.");
      setCheckIn("");
      setCheckOut("");
      setBookingType("RV");
      setNote("");
    } catch (err: unknown) {
      console.error(err);
      setMessage("❌ Could not submit date inquiry.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      style={{
        padding: 20,
        borderRadius: 16,
        border: "1px solid rgba(255,255,255,0.12)",
        background: "rgba(255,255,255,0.06)",
      }}
    >
      <div style={{ fontWeight: 900, fontSize: 18 }}>
        ${nightlyPrice} / {priceLabel}
      </div>

      {/* Price breakdown (nice touch, no schema change) */}
      <div style={{ marginTop: 8, opacity: 0.85, fontSize: 13, lineHeight: 1.4 }}>
        Base: <b>${Number(nightlyPrice) || 0}</b>
        {premium > 0 && (
          <>
            {" "}
            • RV Provided premium: <b>+${premium}</b>
          </>
        )}
      </div>

      <div style={{ marginTop: 16 }}>
        <label style={{ fontWeight: 700 }}>Check-in</label>
        <input
          type="date"
          value={checkIn}
          min={today}
          onChange={(e) => {
            const next = e.target.value;
            setCheckIn(next);

            // If checkout is now invalid, clear it
            if (checkOut && next) {
              const minCo = addDays(next, 1);
              if (toDateLocal(checkOut).getTime() < toDateLocal(minCo).getTime()) {
                setCheckOut("");
              }
            }
          }}
          style={inputStyle}
        />

        <label style={{ fontWeight: 700 }}>Check-out</label>
        <input
          type="date"
          value={checkOut}
          min={minCheckout}
          onChange={(e) => setCheckOut(e.target.value)}
          style={inputStyle}
          disabled={!checkIn}
        />

        {!checkIn && (
          <div style={{ marginTop: -6, marginBottom: 10, opacity: 0.75, fontSize: 12 }}>
            Select a check-in date first to unlock check-out.
          </div>
        )}
      </div>

      <div style={{ marginTop: 16 }}>
        <strong>Booking Type</strong>
        <div style={{ display: "flex", gap: 10, marginTop: 10, flexWrap: "wrap" }}>
          <SelectorButton
            label="🚐 RV Stay"
            active={bookingType === "RV"}
            onClick={() => setBookingType("RV")}
          />
          <SelectorButton
            label="🌾 Land"
            active={bookingType === "LAND"}
            onClick={() => setBookingType("LAND")}
          />
          <SelectorButton
            label="🚌 RV Provided"
            active={bookingType === "RV_PROVIDED"}
            onClick={() => setBookingType("RV_PROVIDED")}
          />
        </div>
      </div>

      {/* Note to host */}
      <div style={{ marginTop: 16 }}>
        <label style={{ fontWeight: 700 }}>Note to host (optional)</label>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Example: arriving around 8pm, 32ft trailer, need a level spot…"
          rows={3}
          style={textareaStyle}
          maxLength={500}
        />
        <div style={{ opacity: 0.75, fontSize: 12, marginTop: 6 }}>
          {note.trim().length}/500
        </div>
      </div>

      <div style={{ marginTop: 16 }}>
        Nights: <strong>{nights}</strong>
        {nights > 0 && (
          <>
            {" "}
            • Total: <strong>${estimatedTotal}</strong>
          </>
        )}
      </div>

      <button
        onClick={handleBooking}
        disabled={saving}
        style={{
          marginTop: 20,
          width: "100%",
          padding: 14,
          borderRadius: 12,
          border: "1px solid rgba(255,255,255,0.15)",
          background: "rgba(255,255,255,0.15)",
          color: "white",
          fontWeight: 900,
          cursor: saving ? "not-allowed" : "pointer",
          opacity: saving ? 0.7 : 1,
        }}
      >
        {saving ? "Checking availability..." : "Request Booking"}
      </button>

      {message && <div style={{ marginTop: 12, fontWeight: 700 }}>{message}</div>}

      <div style={{ marginTop: 10, opacity: 0.65, fontSize: 12, lineHeight: 1.35 }}>
        By requesting a booking you agree to the host’s rules and RVNB terms (coming soon).
      </div>
    </div>
  );
}

function SelectorButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: "8px 12px",
        borderRadius: 999,
        border: active
          ? "1px solid rgba(255,255,255,0.4)"
          : "1px solid rgba(255,255,255,0.15)",
        background: active
          ? "rgba(255,255,255,0.25)"
          : "rgba(255,255,255,0.08)",
        color: "white",
        fontWeight: 800,
        cursor: "pointer",
      }}
    >
      {label}
    </button>
  );
}

const inputStyle: React.CSSProperties = {
  display: "block",
  width: "100%",
  padding: 12,
  marginTop: 6,
  marginBottom: 12,
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.15)",
  background: "rgba(255,255,255,0.06)",
  color: "white",
};

const textareaStyle: React.CSSProperties = {
  display: "block",
  width: "100%",
  padding: 12,
  marginTop: 6,
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.15)",
  background: "rgba(255,255,255,0.06)",
  color: "white",
  resize: "vertical",
};
