"use client";

import { useMemo, useState } from "react";
import styles from "./hostDashboard.module.css";
import {
  HostAnalyticsBooking,
  expandBookingDays,
  getUpcomingBookings,
  parseYmd,
} from "./hostDashboardUtils";

type Props = {
  bookings: HostAnalyticsBooking[];
};

function toYmdLocal(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatDateLabel(value: string) {
  const d = parseYmd(value);
  if (!d) return value;

  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function HostBookingCalendar({ bookings }: Props) {
  const [cursor, setCursor] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  const bookedDaysSet = useMemo(() => {
    const set = new Set<string>();

    bookings
      .filter((b) => b.status !== "cancelled")
      .forEach((b) => {
        const days = expandBookingDays(b.checkIn, b.checkOut);
        days.forEach((day) => set.add(day));
      });

    return set;
  }, [bookings]);

  const upcoming = useMemo(() => getUpcomingBookings(bookings).slice(0, 8), [bookings]);

  const monthLabel = cursor.toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });

  const year = cursor.getFullYear();
  const month = cursor.getMonth();

  const firstDayOfMonth = new Date(year, month, 1);
  const lastDayOfMonth = new Date(year, month + 1, 0);
  const firstWeekday = firstDayOfMonth.getDay();
  const daysInMonth = lastDayOfMonth.getDate();

  const cells: Array<{
    key: string;
    date: Date;
    inMonth: boolean;
    isBooked: boolean;
  }> = [];

  for (let i = 0; i < firstWeekday; i++) {
    const d = new Date(year, month, 1 - (firstWeekday - i));
    cells.push({
      key: `prev-${toYmdLocal(d)}`,
      date: d,
      inMonth: false,
      isBooked: bookedDaysSet.has(toYmdLocal(d)),
    });
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const d = new Date(year, month, day);
    cells.push({
      key: `cur-${toYmdLocal(d)}`,
      date: d,
      inMonth: true,
      isBooked: bookedDaysSet.has(toYmdLocal(d)),
    });
  }

  while (cells.length % 7 !== 0) {
    const nextIndex = cells.length - (firstWeekday + daysInMonth) + 1;
    const d = new Date(year, month + 1, nextIndex);
    cells.push({
      key: `next-${toYmdLocal(d)}`,
      date: d,
      inMonth: false,
      isBooked: bookedDaysSet.has(toYmdLocal(d)),
    });
  }

  return (
    <div className={styles.card}>
      <div className={styles.calendarHeader}>
        <div>
          <div className={styles.cardTitle}>Booking Calendar</div>
          <div className={styles.cardValue}>{monthLabel}</div>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <button
            type="button"
            className={styles.btn}
            onClick={() => setCursor(new Date(year, month - 1, 1))}
          >
            ←
          </button>

          <button
            type="button"
            className={styles.btn}
            onClick={() => {
              const now = new Date();
              setCursor(new Date(now.getFullYear(), now.getMonth(), 1));
            }}
          >
            Today
          </button>

          <button
            type="button"
            className={styles.btn}
            onClick={() => setCursor(new Date(year, month + 1, 1))}
          >
            →
          </button>
        </div>
      </div>

      <div className={styles.calendarGrid}>
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((label) => (
          <div key={label} className={styles.dow}>
            {label}
          </div>
        ))}

        {cells.map((cell) => (
          <div
            key={cell.key}
            className={`${styles.day} ${!cell.inMonth ? styles.dayMuted : ""}`}
            title={cell.isBooked ? "Booked" : "Available"}
          >
            <div className={styles.dayNum}>{cell.date.getDate()}</div>
            {cell.isBooked ? <div className={styles.badgeBooked}>Booked</div> : null}
          </div>
        ))}
      </div>

      <div className={styles.section}>
        <div className={styles.cardTitle}>Upcoming Bookings</div>

        {upcoming.length === 0 ? (
          <div className={styles.muted}>No upcoming bookings yet.</div>
        ) : (
          <div className={styles.list}>
            {upcoming.map((booking) => (
              <div key={booking.id} className={styles.listItem}>
                <div className={styles.listTop}>
                  <strong>{booking.listingTitle}</strong>
                  <span className={styles.small}>
                    {booking.status.charAt(0).toUpperCase() + booking.status.slice(1)}
                  </span>
                </div>

                <div className={styles.small} style={{ marginTop: 4 }}>
                  {formatDateLabel(booking.checkIn)} → {formatDateLabel(booking.checkOut)}
                </div>

                <div className={styles.small} style={{ marginTop: 4 }}>
                  Booking ID: {booking.id}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}