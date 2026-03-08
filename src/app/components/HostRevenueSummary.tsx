"use client";

import styles from "./hostDashboard.module.css";
import {
  HostAnalyticsBooking,
  HostAnalyticsListing,
  formatMoney,
  getLifetimeRevenue,
  getMonthlyRevenueBreakdown,
  getRevenuePerListing,
} from "./hostDashboardUtils";

type Props = {
  listings: HostAnalyticsListing[];
  bookings: HostAnalyticsBooking[];
};

export default function HostRevenueSummary({ listings, bookings }: Props) {
  const monthlyRevenue = getMonthlyRevenueBreakdown(bookings);
  const revenuePerListing = getRevenuePerListing(listings, bookings);
  const lifetimeRevenue = getLifetimeRevenue(bookings);

  return (
    <div className={styles.card}>
      <div className={styles.cardTitle}>Revenue Summary</div>

      <div style={{ marginTop: 8 }}>
        <div className={styles.cardValue}>{formatMoney(lifetimeRevenue)}</div>
        <div className={styles.muted} style={{ marginTop: 6 }}>
          Total non-cancelled booking revenue across all your listings.
        </div>
      </div>

      <div className={styles.section}>
        <div className={styles.cardTitle}>Monthly Revenue</div>

        {monthlyRevenue.length === 0 ? (
          <div className={styles.muted} style={{ marginTop: 8 }}>
            No revenue data yet.
          </div>
        ) : (
          <table className={styles.table} style={{ marginTop: 10 }}>
            <thead>
              <tr>
                <th className={styles.th}>Month</th>
                <th className={styles.th}>Revenue</th>
              </tr>
            </thead>
            <tbody>
              {monthlyRevenue.map((row) => (
                <tr key={row.key}>
                  <td className={styles.td}>{row.label}</td>
                  <td className={styles.td}>{formatMoney(row.revenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className={styles.section}>
        <div className={styles.cardTitle}>Revenue Per Listing</div>

        {revenuePerListing.length === 0 ? (
          <div className={styles.muted} style={{ marginTop: 8 }}>
            No listings yet.
          </div>
        ) : (
          <table className={styles.table} style={{ marginTop: 10 }}>
            <thead>
              <tr>
                <th className={styles.th}>Listing</th>
                <th className={styles.th}>Revenue</th>
              </tr>
            </thead>
            <tbody>
              {revenuePerListing.map((row) => (
                <tr key={row.listingId}>
                  <td className={styles.td}>{row.title}</td>
                  <td className={styles.td}>{formatMoney(row.revenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}