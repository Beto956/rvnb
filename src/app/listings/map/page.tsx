"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import styles from "./page.module.css";
import { collection, getDocs, limit, orderBy, query } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { MapListing } from "@/app/components/ListingsMap";

// ✅ Client-only map render (prevents hydration issues)
// NOTE: we cast to `any` so this file can pass new optional props
// without forcing you to refactor ListingsMap immediately.
const ListingsMap = dynamic(() => import("@/app/components/ListingsMap"), { ssr: false }) as any;

type ListingDoc = {
  title?: string;
  city?: string;
  state?: string;

  price?: number;
  pricingType?: string;

  createdAt?: any;

  // ✅ Phase 1 additive fields (optional; no migration required)
  lat?: number;
  lng?: number;
};

export default function ListingsMapPage() {
  const [loading, setLoading] = useState(true);
  const [listings, setListings] = useState<MapListing[]>([]);
  const [error, setError] = useState<string | null>(null);

  // ✅ NEW: selected listing id (card click -> map center, marker click -> highlight + scroll)
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // ✅ NEW: refs so marker click can scroll matching card into view
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    let mounted = true;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        // ✅ Public listings view (no ownership filtering here)
        const q = query(collection(db, "listings"), orderBy("createdAt", "desc"), limit(200));
        const snap = await getDocs(q);

        const rows: MapListing[] = snap.docs.map((d) => {
          const data = d.data() as ListingDoc;
          return {
            id: d.id,
            title: data.title,
            city: data.city,
            state: data.state,
            price: data.price,
            pricingType: data.pricingType,
            lat: typeof data.lat === "number" ? data.lat : undefined,
            lng: typeof data.lng === "number" ? data.lng : undefined,
          };
        });

        if (mounted) setListings(rows);
      } catch (e: any) {
        if (mounted) setError(e?.message || "Failed to load listings.");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    load();
    return () => {
      mounted = false;
    };
  }, []);

  const withCoordsCount = useMemo(
    () => listings.filter((l) => typeof l.lat === "number" && typeof l.lng === "number").length,
    [listings]
  );

  // ✅ NEW: when a card is clicked
  function handleCardSelect(id: string) {
    setSelectedId(id);
    // Map centering happens inside ListingsMap when it receives selectedId
  }

  // ✅ NEW: when a marker is clicked (ListingsMap will call onSelect)
  function handleMarkerSelect(id: string) {
    setSelectedId(id);

    // Scroll the corresponding card into view
    // (small delay to ensure state updates & DOM is ready)
    setTimeout(() => {
      const el = cardRefs.current[id];
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }, 50);
  }

  return (
    <main className={styles.page}>
      <div className={styles.container}>
        <div className={styles.headerRow}>
          <div>
            <div className={styles.title}>Listings Map (Phase 1)</div>
            <div className={styles.subtle}>
              Markers show only listings that already have <code>lat/lng</code>. No migration required.
            </div>
          </div>

          <Link href="/listings" className={styles.subtle} style={{ textDecoration: "underline" }}>
            Back to Listings
          </Link>
        </div>

        {error && (
          <div
            style={{
              marginBottom: 12,
              padding: 12,
              borderRadius: 12,
              border: "1px solid rgba(255,80,80,0.35)",
              background: "rgba(255,80,80,0.08)",
            }}
          >
            {error}
          </div>
        )}

        <div className={styles.grid}>
          {/* Left: list */}
          <section className={styles.panel}>
            <div className={styles.panelHeader}>
              <div style={{ fontWeight: 800 }}>Results</div>
              <div className={styles.subtle}>
                {loading ? "Loading…" : `${listings.length} total • ${withCoordsCount} with coords`}
              </div>
            </div>

            <div className={styles.panelBody}>
              {loading ? (
                <div className={styles.subtle}>Loading listings…</div>
              ) : listings.length === 0 ? (
                <div className={styles.subtle}>No listings found.</div>
              ) : (
                <div className={styles.list}>
                  {listings.map((l) => {
                    const isSelected = selectedId === l.id;

                    return (
                      <div
                        key={l.id}
                        ref={(el) => {
                          cardRefs.current[l.id] = el;
                        }}
                        className={styles.card}
                        role="button"
                        tabIndex={0}
                        onClick={() => handleCardSelect(l.id)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") handleCardSelect(l.id);
                        }}
                        style={{
                          cursor: "pointer",
                          outline: "none",
                          border: isSelected ? "1px solid rgba(120,180,255,0.45)" : undefined,
                          boxShadow: isSelected ? "0 0 0 2px rgba(120,180,255,0.15)" : undefined,
                        }}
                      >
                        <div className={styles.cardTitle}>{l.title || "Listing"}</div>
                        <div className={styles.cardMeta}>
                          {(l.city || "")}
                          {l.city ? ", " : ""}
                          {l.state || ""}
                        </div>

                        <div className={styles.badgeRow}>
                          <span className={styles.badge}>
                            {typeof l.price === "number" ? `$${l.price}` : "No price"}
                            {l.pricingType ? ` / ${l.pricingType}` : ""}
                          </span>
                          <span className={styles.badge}>
                            {typeof l.lat === "number" && typeof l.lng === "number" ? "Has coords ✅" : "No coords"}
                          </span>
                        </div>

                        {/* Keep navigation available without breaking “card click selects” */}
                        <div style={{ marginTop: 10 }}>
                          <Link
                            href={`/listings/${l.id}`}
                            style={{ textDecoration: "underline", color: "inherit", opacity: 0.9 }}
                            onClick={(e) => e.stopPropagation()}
                          >
                            View listing →
                          </Link>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </section>

          {/* Right: map */}
          <section className={styles.mapWrap}>
            <ListingsMap
              listings={listings}
              height={640}
              // ✅ NEW props (interactive wiring)
              selectedId={selectedId}
              onSelect={handleMarkerSelect}
            />
          </section>
        </div>
      </div>
    </main>
  );
}