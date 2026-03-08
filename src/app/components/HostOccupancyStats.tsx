"use client";

import styles from "./hostDashboard.module.css";
import {
  HostAnalyticsBooking,
  HostAnalyticsListing,
  getOccupancyStats,
} from "./hostDashboardUtils";

type Props = {
  listings: HostAnalyticsListing[];
  bookings: HostAnalyticsBooking[];
};

export default function HostOccupancyStats({ listings, bookings }: Props) {
  const occupancy = getOccupancyStats(listings, bookings);

  return (
    <div className={styles.card}>
      <div className={styles.cardTitle}>Occupancy (Last 30 Days)</div>

      <div style={{ marginTop: 8 }}>
        <div className={styles.cardValue}>
          {occupancy.overallOccupancyPct.toFixed(1)}%
        </div>

        <div className={styles.muted} style={{ marginTop: 6 }}>
          {occupancy.overallBookedDays} booked day
          {occupancy.overallBookedDays === 1 ? "" : "s"} out of{" "}
          {occupancy.overallAvailableDays} available day
          {occupancy.overallAvailableDays === 1 ? "" : "s"} across all listings.
        </div>
      </div>

      <div className={styles.section}>
        <div className={styles.cardTitle}>Per Listing</div>

        {occupancy.perListing.length === 0 ? (
          <div className={styles.muted} style={{ marginTop: 8 }}>
            No listings yet.
          </div>
        ) : (
          <table className={styles.table} style={{ marginTop: 10 }}>
            <thead>
              <tr>
                <th className={styles.th}>Listing</th>
                <th className={styles.th}>Booked</th>
                <th className={styles.th}>Available</th>
                <th className={styles.th}>Occupancy</th>
              </tr>
            </thead>
            <tbody>
              {occupancy.perListing.map((row) => (
                <tr key={row.listingId}>
                  <td className={styles.td}>{row.title}</td>
                  <td className={styles.td}>{row.bookedDays}</td>
                  <td className={styles.td}>{row.availableDays}</td>
                  <td className={styles.td}>{row.occupancyPct.toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}