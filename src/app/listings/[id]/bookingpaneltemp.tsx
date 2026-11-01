"use client";

import React, { useMemo, useRef, useState } from "react";
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
import styles from "./listingdetail.module.css";
import { capacity, inquiryBookingType, inquiryEstimate, inquiryNights, isAccommodation, listingTypeLabel, listingType as readListingType, type ListingType } from "@/lib/listing-types";

type BookingType = "RV" | "LAND" | "RV_PROVIDED";

type Props = {
  listingType?: ListingType | null;
  accommodation?: Record<string, unknown>;
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

export default function BookingPanel({ listingId, hostId, nightlyPrice, priceLabel, listingType = null, accommodation = {} }: Props) {
  const router = useRouter();
  const { user } = useAuth();
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [bookingType, setBookingType] = useState<BookingType>("RV");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [guests, setGuests] = useState(1);
  const locked = useRef(false);
  const accommodationMode = isAccommodation(listingType);
  const maximumGuests = capacity({ accommodation });
  const offeredBookingType = listingType ? inquiryBookingType(listingType) : bookingType;

  // Today in YYYY-MM-DD (used for min date)
  const today = useMemo(() => {
    const d = new Date();
    // local date -> yyyy-mm-dd
    const local = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    return `${local.getFullYear()}-${String(local.getMonth() + 1).padStart(2, "0")}-${String(local.getDate()).padStart(2, "0")}`;
  }, []);

  const nights = useMemo(() => inquiryNights(checkIn, checkOut), [checkIn, checkOut]);

  const estimatedTotal = inquiryEstimate(nightlyPrice, priceLabel, nights);

  const minCheckout = useMemo(() => {
    if (!checkIn) return today;
    return addDays(checkIn, 1);
  }, [checkIn, today]);

  async function handleBooking() {
    if (locked.current) return;
    setMessage("");

    if (!user) {
      setMessage("Please sign in to request dates for this listing.");
      router.push(`/login?next=${encodeURIComponent(`/listings/${listingId}`)}`);
      return;
    }

    locked.current = true;
    setSaving(true);
    try {
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
    const current = listingSnap.data();
    const currentType = readListingType(current.listingType);
    if (currentType !== listingType) { setMessage("The offering changed. Refresh this listing before requesting dates."); return; }
    if (accommodationMode) {
      const max = capacity(current);
      if (max === null || !Number.isInteger(guests) || guests < 1 || guests > max) {
        setMessage("Enter a guest count within the host's declared capacity. Missing capacity must be supplied by the host first."); return;
      }
    }
    const currentRate = typeof current.price === "number" ? current.price : current.pricePerNight;
    const currentPeriod = typeof current.price === "number" ? current.pricingType : "Night";
    const expectedLabel = currentPeriod === "Night" ? "night" : currentPeriod === "Weekly" ? "week" : currentPeriod === "Monthly" ? "month" : "";
    if (currentRate !== nightlyPrice || expectedLabel !== priceLabel) { setMessage("The rate changed or is incomplete. Refresh before requesting dates."); return; }

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
    if (!nights) {
      setMessage("Choose valid dates, no more than 3,660 nights apart.");
      return;
    }

    // Prevent past check-ins
    if (toDateLocal(checkIn).getTime() < toDateLocal(today).getTime()) {
      setMessage("Check-in cannot be in the past.");
      return;
    }

    // Optional: keep notes small & clean (prevents giant messages)
    const cleanNote = note.trim().slice(0, 500);

      // Pending inquiries do not reserve dates; host approval is authoritative.
      await addDoc(collection(db, "bookings"), {
        listingId,
        guestId: user.uid,
        hostId: listingOwnerId,
        checkIn,
        checkOut,
        bookingType: offeredBookingType,
        ...(listingType ? { listingType } : {}),
        ...(accommodationMode ? { guestCount: guests } : {}),
        nights,
        estimatedTotal,
        estimateStatus: estimatedTotal === null ? "host_confirmation_required" : "nightly_estimate",
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
      locked.current = false;
      setSaving(false);
    }
  }

  return (
    <section className={styles.bookingCard} aria-labelledby="booking-title" aria-busy={saving}>
      <div className={styles.bookingTop}>
        <h2 id="booking-title" className={styles.bookingTitle}>Request your stay</h2>
        <p className={styles.bookingSub}>Send your dates to the host. This is an inquiry, not a confirmed booking.</p>
      </div>
      <div className={styles.bookingRate}>
        ${nightlyPrice} / {priceLabel}
      </div>

      <div className={styles.bookingBreakdown}>
        Listed rate: <b>${nightlyPrice} / {priceLabel}</b>. No automatic RV surcharge.
      </div>

      <div className={styles.bookingFields}>
        <label className={styles.label} htmlFor="booking-check-in">Check-in</label>
        <input
          id="booking-check-in"
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
          className={styles.input}
        />

        <label className={styles.label} htmlFor="booking-check-out">Check-out</label>
        <input
          id="booking-check-out"
          aria-describedby={!checkIn ? "booking-check-out-help" : undefined}
          type="date"
          value={checkOut}
          min={minCheckout}
          onChange={(e) => setCheckOut(e.target.value)}
          className={styles.input}
          disabled={!checkIn}
        />

        {!checkIn && (
          <div id="booking-check-out-help" className={styles.bookingSub}>
            Select a check-in date first to unlock check-out.
          </div>
        )}
      </div>

      {!listingType ? <fieldset className={styles.bookingTypes}>
        <legend className={styles.label}>Booking type</legend>
        <div className={styles.segmentRow}>
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
        </div>
      </fieldset> : <p className={styles.bookingSub}>Offering: {listingTypeLabel(listingType)}{accommodationMode ? ". Stationary accommodation; guests may not drive, tow, or remove it." : ""}</p>}
      {accommodationMode && <div className={styles.bookingFields}>
        <label htmlFor="booking-guests" className={styles.label}>Guests{maximumGuests ? ` (maximum ${maximumGuests})` : ""}</label>
        <input id="booking-guests" type="number" min={1} max={maximumGuests ?? undefined} step={1} value={Number.isNaN(guests) ? "" : guests} onChange={event => setGuests(event.target.value === "" ? NaN : Number(event.target.value))} className={styles.input} disabled={saving || maximumGuests === null} />
        {maximumGuests === null && <p className={styles.bookingSub}>The host has not declared guest capacity. Inquiries are unavailable until it is supplied.</p>}
      </div>}

      {/* Note to host */}
      <div className={styles.bookingFields}>
        <label className={styles.label} htmlFor="booking-note">Note to host (optional)</label>
        <textarea
          id="booking-note"
          aria-describedby="booking-note-count"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={accommodationMode ? "Arrival questions or accommodation needs..." : "Example: arriving around 8pm, 32ft trailer, need a level spot…"}
          rows={3}
          className={styles.textarea}
          maxLength={500}
        />
        <div id="booking-note-count" className={styles.bookingSub}>
          {note.trim().length}/500
        </div>
      </div>

      <div className={styles.summary} aria-live="polite">
        Nights: <strong>{nights}</strong>
        {nights > 0 && (
          <>
            {" "}
            {estimatedTotal === null ? "Total to be confirmed by host" : <> · Estimated total: <strong>${estimatedTotal}</strong></>}
          </>
        )}
      </div>

      <button
        type="button"
        onClick={handleBooking}
        disabled={saving || (accommodationMode && maximumGuests === null)}
        className={styles.primaryAction}
      >
        {saving ? "Sending inquiry..." : "Request Booking"}
      </button>

      {message && <div role="status" aria-live="polite" className={styles.message}>{message}</div>}

      <p className={styles.bookingSub}>Selected dates do not verify availability. The host must approve your inquiry.</p>
      <div className={styles.bookingSub}>
        Client totals are estimates, not authoritative charges. No payment is collected.
      </div>
    </section>
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
      aria-pressed={active}
      className={`${styles.segmentBtn} ${active ? styles.segmentActive : ""}`}
    >
      {label}
    </button>
  );
}
