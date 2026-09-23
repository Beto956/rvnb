"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { collection, getDocs, orderBy, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import HostGuard from "../../components/HostGuard";
import styles from "./page.module.css";

type Opportunity = {
  id: string;
  requestId?: string;
  hostId?: string;
  requesterId?: string;
  submissionType?: string;
  city?: string;
  state?: string;
  spots?: number;
  readiness?: string;
  power?: string;
  water?: boolean;
  sewer?: boolean;
  wifi?: boolean;
  pets?: boolean;
  createdAt?: { seconds?: number };
};

function HostOpportunitiesContent() {
  const { user } = useAuth();
  const [data, setData] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      if (!user?.uid) {
        setData([]);
        setLoading(false);
        return;
      }

      try {
        const q = query(
          collection(db, "hostOpportunities"),
          where("hostId", "==", user.uid),
          orderBy("createdAt", "desc")
        );
        const snap = await getDocs(q);

        const items: Opportunity[] = snap.docs.map((doc) => ({
          ...(doc.data() as Omit<Opportunity, "id">),
          id: doc.id,
        }));

        setData(items);
      } catch (err) {
        console.error("Failed to load opportunities", err);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [user?.uid]);

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
                    {item.requestId ? "Response" : item.readiness || "unknown"}
                  </span>
                </div>

                {item.requestId ? (
                  <div className={styles.row}>
                    <span>Request:</span>
                    <strong>{item.requestId}</strong>
                  </div>
                ) : null}

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

export default function HostOpportunitiesPage() {
  return (
    <HostGuard>
      <HostOpportunitiesContent />
    </HostGuard>
  );
}