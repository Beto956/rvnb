"use client";

import styles from "./hostDashboard.module.css";
import {
  HostAnalyticsBooking,
  HostAnalyticsListing,
  getLifetimeRevenue,
  getRevenueLast30Days,
  getRevenueThisMonth,
  getUpcomingBookings,
  formatMoney,
} from "./hostDashboardUtils";

type Props = {
  listings: HostAnalyticsListing[];
  bookings: HostAnalyticsBooking[];
};

export default function HostDashboardKpis({ listings, bookings }: Props) {
  const totalListings = listings.length;

  const upcomingBookings = getUpcomingBookings(bookings).length;

  const revenueThisMonth = getRevenueThisMonth(bookings);
  const revenueLast30Days = getRevenueLast30Days(bookings);
  const lifetimeRevenue = getLifetimeRevenue(bookings);

  return (
    <div className={styles.section}>
      <h2 className={styles.h2}>Host Overview</h2>

      <div className={styles.gridKpi}>
        <div className={styles.card}>
          <div className={styles.cardTitle}>Total Listings</div>
          <div className={styles.cardValue}>{totalListings}</div>
        </div>

        <div className={styles.card}>
          <div className={styles.cardTitle}>Upcoming Bookings</div>
          <div className={styles.cardValue}>{upcomingBookings}</div>
        </div>

        <div className={styles.card}>
          <div className={styles.cardTitle}>Revenue This Month</div>
          <div className={styles.cardValue}>{formatMoney(revenueThisMonth)}</div>
        </div>

        <div className={styles.card}>
          <div className={styles.cardTitle}>Revenue (Last 30 Days)</div>
          <div className={styles.cardValue}>{formatMoney(revenueLast30Days)}</div>
        </div>

        <div className={styles.card}>
          <div className={styles.cardTitle}>Lifetime Revenue</div>
          <div className={styles.cardValue}>{formatMoney(lifetimeRevenue)}</div>
        </div>
      </div>
    </div>
  );
}