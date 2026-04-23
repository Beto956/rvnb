"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { collection, getDocs, orderBy, query } from "firebase/firestore";
import { db } from "@/lib/firebase";
import styles from "./page.module.css";

type Opportunity = {
  id: string;
  city?: string;
  state?: string;
  spots?: number;
  readiness?: string;
  power?: string;
  water?: boolean;
  sewer?: boolean;
  wifi?: boolean;
  pets?: boolean;
  createdAt?: any;
};

export default function HostOpportunitiesPage() {
  const [data, setData] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const q = query(collection(db, "hostOpportunities"));
        const snap = await getDocs(q);

        const items: Opportunity[] = snap.docs.map((doc) => ({
          id: doc.id,
          ...(doc.data() as any),
        }));

        // newest first (fallback if no timestamp yet)
        items.sort((a, b) => {
          const aTime = a.createdAt?.seconds || 0;
          const bTime = b.createdAt?.seconds || 0;
          return bTime - aTime;
        });

        setData(items);
      } catch (err) {
        console.error("Failed to load opportunities", err);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        {/* HEADER */}
        <div className={styles.header}>
          <h1 className={styles.title}>Host Opportunities</h1>
          <p className={styles.subtitle}>
            Review submitted spaces and evaluate potential RV hosting locations.
          </p>
        </div>

        {/* STATES */}
        {loading ? (
          <div className={styles.state}>Loading opportunities...</div>
        ) : data.length === 0 ? (
          <div className={styles.state}>No opportunities submitted yet.</div>
        ) : (
          <div className={styles.grid}>
            {data.map((item) => (
              <div key={item.id} className={styles.card}>
                <div className={styles.cardHeader}>
                  <h3>
                    {item.city || "Unknown"}, {item.state || "--"}
                  </h3>
                  <span className={styles.badge}>
                    {item.readiness || "unknown"}
                  </span>
                </div>

                <div className={styles.row}>
                  <span>Spots:</span>
                  <strong>{item.spots || 1}</strong>
                </div>

                <div className={styles.row}>
                  <span>Power:</span>
                  <strong>{item.power || "N/A"}</strong>
                </div>

                <div className={styles.row}>
                  <span>Water:</span>
                  <strong>{item.water ? "Yes" : "No"}</strong>
                </div>

                <div className={styles.row}>
                  <span>Sewer:</span>
                  <strong>{item.sewer ? "Yes" : "No"}</strong>
                </div>

                <div className={styles.row}>
                  <span>Wi-Fi:</span>
                  <strong>{item.wifi ? "Yes" : "No"}</strong>
                </div>

                <div className={styles.row}>
                  <span>Pets:</span>
                  <strong>{item.pets ? "Allowed" : "No"}</strong>
                </div>

                <div className={styles.footer}>
                  <span className={styles.id}>ID: {item.id}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* NAV */}
        <div className={styles.actions}>
          <Link href="/request-spot" className={styles.linkBtn}>
            ← Back to Requests
          </Link>
          <Link href="/listings" className={styles.linkBtnPrimary}>
            Browse Listings →
          </Link>
        </div>
      </div>
    </main>
  );
}