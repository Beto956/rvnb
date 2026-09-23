"use client";

import styles from "./hostDashboard.module.css";
import {
  HostAnalyticsBooking,
  HostAnalyticsListing,
  formatMoney,
  getOccupancyStats,
  getRevenueThisMonth,
  getUpcomingBookings,
} from "./hostDashboardUtils";

type Props = {
  listings: HostAnalyticsListing[];
  bookings: HostAnalyticsBooking[];
  pendingCount: number;
};

type StatIconName = "listings" | "upcoming" | "occupancy" | "revenue" | "pending";

const iconCommonProps = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

function StatIcon({ name }: { name: StatIconName }) {
  if (name === "listings") {
    return (
      <svg {...iconCommonProps}>
        <path d="M4 11.5 12 5l8 6.5" />
        <path d="M6 10v9h12v-9" />
      </svg>
    );
  }

  if (name === "upcoming") {
    return (
      <svg {...iconCommonProps}>
        <rect x="4" y="5" width="16" height="15" rx="2" />
        <path d="M4 9.5h16" />
        <path d="M8 3.5v3M16 3.5v3" />
      </svg>
    );
  }

  if (name === "occupancy") {
    return (
      <svg {...iconCommonProps}>
        <circle cx="12" cy="12" r="8" />
        <path d="M12 4v8l6 3" />
      </svg>
    );
  }

  if (name === "revenue") {
    return (
      <svg {...iconCommonProps}>
        <path d="M12 3v18" />
        <path d="M16.5 7c0-1.8-2-3-4.5-3s-4.5 1.4-4.5 3.2S9 10.2 12 10.5c3 .3 4.5 1.6 4.5 3.3S14.5 17 12 17s-4.5-1-4.5-2.8" />
      </svg>
    );
  }

  return (
    <svg {...iconCommonProps}>
      <circle cx="12" cy="12" r="8" />
      <path d="M9 12.5 11 15l4-5" />
    </svg>
  );
}

export default function HostStatsRow({ listings, bookings, pendingCount }: Props) {
  const activeListings = listings.length;
  const upcomingCount = getUpcomingBookings(bookings).length;
  const revenueThisMonth = getRevenueThisMonth(bookings);
  const occupancy = getOccupancyStats(listings, bookings);

  const stats: Array<{
    key: StatIconName;
    label: string;
    value: string;
    sub: string;
  }> = [
    {
      key: "listings",
      label: "Total Listings",
      value: String(activeListings),
      sub: "Active on RVNB",
    },
    {
      key: "upcoming",
      label: "Upcoming Bookings",
      value: String(upcomingCount),
      sub: upcomingCount === 0 ? "No upcoming stays" : "Approved & pending stays",
    },
    {
      key: "occupancy",
      label: "Occupancy (30 days)",
      value:
        activeListings === 0
          ? "Not available yet"
          : `${occupancy.overallOccupancyPct.toFixed(0)}%`,
      sub:
        activeListings === 0
          ? "Add a listing to calculate"
          : `${occupancy.overallBookedDays} of ${occupancy.overallAvailableDays} days booked`,
    },
    {
      key: "revenue",
      label: "Revenue This Month",
      value: formatMoney(revenueThisMonth),
      sub: revenueThisMonth === 0 ? "No revenue yet" : "Non-cancelled bookings",
    },
    {
      key: "pending",
      label: "Pending Requests",
      value: String(pendingCount),
      sub: pendingCount === 0 ? "No requests to review" : "Awaiting your response",
    },
  ];

  return (
    <div className={styles.statsGrid}>
      {stats.map((s) => (
        <div className={styles.statCard} key={s.key}>
          <div className={styles.statIconRow}>
            <span className={styles.statIcon}>
              <StatIcon name={s.key} />
            </span>
          </div>
          <div className={styles.statLabel}>{s.label}</div>
          <div className={styles.statValue}>{s.value}</div>
          <div className={styles.statSub}>{s.sub}</div>
        </div>
      ))}
    </div>
  );
}

