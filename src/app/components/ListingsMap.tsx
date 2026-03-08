"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  GoogleMap,
  Marker,
  InfoWindow,
  useJsApiLoader,
} from "@react-google-maps/api";

/**
 * Public listing shape for map rendering.
 * Keep this lightweight and safe.
 */
export type MapListing = {
  id: string;
  title?: string;
  city?: string;
  state?: string;
  price?: number;
  pricingType?: string;

  // Phase 1 optional coords (no migration required)
  lat?: number;
  lng?: number;
};

type Props = {
  listings: MapListing[];

  defaultCenter?: { lat: number; lng: number };
  height?: number;

  // ✅ ADDITIVE (Phase 2): selection wiring from /listings/map
  selectedId?: string | null;
  onSelect?: (id: string) => void;
};

const DEFAULT_CENTER = {
  lat: 39.8283, // USA center
  lng: -98.5795,
};

export default function ListingsMap({
  listings,
  defaultCenter = DEFAULT_CENTER,
  height = 600,
  selectedId = null,
  onSelect,
}: Props) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  const { isLoaded, loadError } = useJsApiLoader({
    id: "rvnb-google-maps",
    googleMapsApiKey: apiKey || "",
  });

  /**
   * Only render markers for listings that have coordinates.
   * This avoids breaking older listings.
   */
  const listingsWithCoords = useMemo(() => {
    return listings.filter(
      (l) => typeof l.lat === "number" && typeof l.lng === "number"
    );
  }, [listings]);

  /**
   * Phase 1 center fallback:
   * If we have markers → center on first marker.
   * Otherwise → use USA center.
   */
  const mapCenter = useMemo(() => {
    if (listingsWithCoords.length > 0) {
      return {
        lat: listingsWithCoords[0].lat as number,
        lng: listingsWithCoords[0].lng as number,
      };
    }
    return defaultCenter;
  }, [listingsWithCoords, defaultCenter]);

  // ✅ Active InfoWindow marker id
  const [activeId, setActiveId] = useState<string | null>(null);

  // ✅ Map ref so we can pan/fit bounds without refactoring
  const mapRef = useRef<google.maps.Map | null>(null);

  // ✅ Compute selected listing (only if it has coords)
  const selectedListingWithCoords = useMemo(() => {
    if (!selectedId) return null;
    const found = listingsWithCoords.find((x) => x.id === selectedId);
    return found || null;
  }, [selectedId, listingsWithCoords]);

  // ✅ Fit bounds to all markers with coords (only once after map loads + whenever coords list changes)
  useEffect(() => {
    // Guard inside effect so hooks order never changes
    if (!isLoaded) return;
    if (!mapRef.current) return;
    if (listingsWithCoords.length === 0) return;

    const map = mapRef.current;

    const bounds = new google.maps.LatLngBounds();
    listingsWithCoords.forEach((l) => {
      bounds.extend({ lat: l.lat as number, lng: l.lng as number });
    });

    map.fitBounds(bounds);

    // Clamp zoom after fit
    const once = google.maps.event.addListenerOnce(map, "idle", () => {
      const z = map.getZoom();
      if (typeof z === "number" && z > 14) map.setZoom(14);
    });

    return () => {
      if (once) google.maps.event.removeListener(once);
    };
  }, [isLoaded, listingsWithCoords]);

  // ✅ When selectedId changes (card click), pan to it + open its InfoWindow
  useEffect(() => {
    if (!isLoaded) return;
    if (!mapRef.current) return;
    if (!selectedListingWithCoords) return;

    const map = mapRef.current;

    const pos = {
      lat: selectedListingWithCoords.lat as number,
      lng: selectedListingWithCoords.lng as number,
    };

    setActiveId(selectedListingWithCoords.id);
    map.panTo(pos);

    const currentZoom = map.getZoom();
    if (typeof currentZoom === "number" && currentZoom < 10) {
      map.setZoom(10);
    }
  }, [isLoaded, selectedListingWithCoords]);

  const activeListing = activeId ? listings.find((x) => x.id === activeId) : undefined;
  const activeListingCoords = activeId
    ? listingsWithCoords.find((x) => x.id === activeId)
    : undefined;

  /* ---------------- SAFETY UI (AFTER HOOKS) ---------------- */

  if (!apiKey) {
    return (
      <div
        style={{
          height,
          borderRadius: 16,
          padding: 16,
          background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(255,255,255,0.1)",
          color: "white",
        }}
      >
        <strong>Google Maps API key missing.</strong>
        <div style={{ marginTop: 8, opacity: 0.8 }}>
          Add NEXT_PUBLIC_GOOGLE_MAPS_API_KEY to .env.local and Vercel.
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div
        style={{
          height,
          borderRadius: 16,
          padding: 16,
          background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(255,255,255,0.1)",
          color: "white",
        }}
      >
        <strong>Failed to load Google Maps.</strong>
        <div style={{ marginTop: 8, opacity: 0.8 }}>
          Check API key + billing in Google Cloud Console.
        </div>
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div
        style={{
          height,
          borderRadius: 16,
          padding: 16,
          background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(255,255,255,0.1)",
          color: "white",
        }}
      >
        Loading map…
      </div>
    );
  }

  /* ---------------- MAP RENDER ---------------- */

  return (
    <div
      style={{
        height,
        borderRadius: 18,
        overflow: "hidden",
        border: "1px solid rgba(255,255,255,0.12)",
        background: "rgba(255,255,255,0.03)",
      }}
    >
      <GoogleMap
        mapContainerStyle={{
          width: "100%",
          height: "100%",
        }}
        center={mapCenter}
        zoom={listingsWithCoords.length > 0 ? 8 : 4}
        options={{
          fullscreenControl: false,
          streetViewControl: false,
          mapTypeControl: false,
          clickableIcons: false,
        }}
        onLoad={(map) => {
          mapRef.current = map;
        }}
        onUnmount={() => {
          mapRef.current = null;
        }}
        onClick={() => setActiveId(null)}
      >
        {listingsWithCoords.map((l) => (
          <Marker
            key={l.id}
            position={{
              lat: l.lat as number,
              lng: l.lng as number,
            }}
            onClick={() => {
              setActiveId(l.id);
              if (onSelect) onSelect(l.id);
            }}
          />
        ))}

        {activeId && activeListingCoords && (
          <InfoWindow
            position={{
              lat: activeListingCoords.lat as number,
              lng: activeListingCoords.lng as number,
            }}
            onCloseClick={() => setActiveId(null)}
          >
            <div style={{ maxWidth: 260 }}>
              <div style={{ fontWeight: 800, marginBottom: 6 }}>
                {activeListing?.title || "Listing"}
              </div>

              <div style={{ fontSize: 12, opacity: 0.85, marginBottom: 10 }}>
                {(activeListing?.city || "")}
                {activeListing?.city ? ", " : ""}
                {activeListing?.state || ""}
              </div>

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
                <span
                  style={{
                    padding: "6px 10px",
                    borderRadius: 999,
                    border: "1px solid rgba(0,0,0,0.12)",
                    background: "rgba(0,0,0,0.04)",
                    fontSize: 12,
                    fontWeight: 700,
                  }}
                >
                  {typeof activeListing?.price === "number"
                    ? `$${activeListing.price}`
                    : "No price"}
                  {activeListing?.pricingType ? ` / ${activeListing.pricingType}` : ""}
                </span>
              </div>

              <Link
                href={`/listings/${activeId}`}
                style={{ textDecoration: "underline", fontSize: 13 }}
              >
                View listing
              </Link>
            </div>
          </InfoWindow>
        )}
      </GoogleMap>
    </div>
  );
}