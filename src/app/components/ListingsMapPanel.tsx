"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useJsApiLoader } from "@react-google-maps/api";

type MapListing = {
  id: string;
  title: string;
  city: string;
  state: string;
  displayPriceValue: number;
  displayPriceLabel: string;
  lat?: number;
  lng?: number;
};

type Props = {
  listings: MapListing[];
};

type GoogleMapInstance = google.maps.Map;
type GoogleMarkerInstance = google.maps.Marker;
type GoogleInfoWindowInstance = google.maps.InfoWindow;
type GoogleLatLngBounds = google.maps.LatLngBounds;

function hasValidCoords(listing: MapListing) {
  return (
    typeof listing.lat === "number" &&
    Number.isFinite(listing.lat) &&
    typeof listing.lng === "number" &&
    Number.isFinite(listing.lng)
  );
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export default function ListingsMapPanel({ listings }: Props) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "";
  const { isLoaded, loadError } = useJsApiLoader({
    id: "rvnb-google-maps",
    googleMapsApiKey: apiKey,
  });

  const [mapNode, setMapNode] = useState<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<GoogleMapInstance | null>(null);
  const markersRef = useRef<GoogleMarkerInstance[]>([]);
  const infoWindowRef = useRef<GoogleInfoWindowInstance | null>(null);

  const mappableListings = useMemo(() => {
    return listings.filter(hasValidCoords);
  }, [listings]);

  const mapReady = Boolean(apiKey) && isLoaded && !loadError;

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!isLoaded) return;
    if (!mapNode) return;

    const googleMaps = window.google?.maps;
    if (!googleMaps) {
      return;
    }

    if (!mapInstanceRef.current) {
      mapInstanceRef.current = new googleMaps.Map(mapNode, {
        center: { lat: 31.9686, lng: -99.9018 }, // Texas-centered fallback
        zoom: 5,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: true,
        clickableIcons: false,
        gestureHandling: "greedy",
      });

      infoWindowRef.current = new googleMaps.InfoWindow();
    }
  }, [isLoaded, mapNode]);

  useEffect(() => {
    const googleMaps = window.google?.maps;
    const map = mapInstanceRef.current;

    if (!googleMaps || !map) return;

    // Clear old markers
    markersRef.current.forEach((marker) => marker.setMap(null));
    markersRef.current = [];

    if (infoWindowRef.current) {
      infoWindowRef.current.close();
    }

    if (mappableListings.length === 0) {
      map.setCenter({ lat: 31.9686, lng: -99.9018 });
      map.setZoom(5);
      return;
    }

    const bounds: GoogleLatLngBounds = new googleMaps.LatLngBounds();

    mappableListings.forEach((listing) => {
      const position = {
        lat: listing.lat as number,
        lng: listing.lng as number,
      };

      const marker = new googleMaps.Marker({
        map,
        position,
        title: listing.title,
      });

      marker.addListener("click", () => {
        if (!infoWindowRef.current) return;

        const html = `
          <div style="min-width:220px;max-width:260px;padding:4px 2px 2px 2px;color:#111;">
            <div style="font-weight:800;font-size:15px;line-height:1.25;">
              ${escapeHtml(listing.title)}
            </div>
            <div style="margin-top:6px;font-size:13px;opacity:0.8;">
              ${escapeHtml(listing.city)}, ${escapeHtml(listing.state)}
            </div>
            <div style="margin-top:8px;font-size:14px;font-weight:700;">
              $${listing.displayPriceValue} / ${escapeHtml(listing.displayPriceLabel)}
            </div>
            <a
              href="/listings/${encodeURIComponent(listing.id)}"
              style="
                display:inline-block;
                margin-top:10px;
                font-size:13px;
                font-weight:700;
                color:#0b57d0;
                text-decoration:none;
              "
            >
              View listing →
            </a>
          </div>
        `;

        infoWindowRef.current.setContent(html);
        infoWindowRef.current.open({
          anchor: marker,
          map,
        });
      });

      markersRef.current.push(marker);
      bounds.extend(position);
    });

    if (mappableListings.length === 1) {
      map.setCenter({
        lat: mappableListings[0].lat as number,
        lng: mappableListings[0].lng as number,
      });
      map.setZoom(12);
    } else {
      map.fitBounds(bounds, 60);
    }
  }, [mappableListings]);

  return (
    <div style={wrap}>
      <div style={topRow}>
        <div>
          <div style={eyebrow}>Map View</div>
          <div style={title}>Browse by location</div>
        </div>

        <div style={metaPill}>
          {mappableListings.length} of {listings.length} mapped
        </div>
      </div>

      {!apiKey ? (
        <div style={fallbackBox}>
          <div style={fallbackTitle}>Map key missing</div>
          <div style={fallbackText}>
            Listing cards are available. Add a Google Maps API key to enable the map preview.
          </div>
        </div>
      ) : loadError ? (
        <div style={fallbackBox}>
          <div style={fallbackTitle}>Map unavailable</div>
          <div style={fallbackText}>
            Google Maps could not load. Listing cards are still available below.
          </div>
        </div>
      ) : !mapReady ? (
        <div style={fallbackBox}>
          <div style={fallbackTitle}>Loading map</div>
          <div style={fallbackText}>
            Preparing the location preview for mapped listings.
          </div>
        </div>
      ) : null}

      {mapReady && mappableListings.length === 0 ? (
        <div style={fallbackBox}>
          <div style={fallbackTitle}>No mapped listings yet</div>
          <div style={fallbackText}>
            Listings without saved coordinates will still appear in cards, but not on the map.
          </div>
        </div>
      ) : null}

      <div
        ref={setMapNode}
        style={{
          ...mapBox,
          display: mapReady && mappableListings.length > 0 ? "block" : "none",
        }}
      />

      <div style={footNote}>
        Click a pin to preview the listing and jump directly to its detail page.
      </div>
    </div>
  );
}

const wrap: React.CSSProperties = {
  position: "sticky",
  top: 92,
  borderRadius: 10,
  border: "1px solid rgba(180,205,255,0.16)",
  background: "linear-gradient(180deg, rgba(7,13,28,0.88), rgba(7,13,28,0.68))",
  boxShadow: "0 18px 44px rgba(0,0,0,0.28), inset 0 1px 0 rgba(255,255,255,0.08)",
  padding: 12,
  backdropFilter: "blur(12px)",
};

const topRow: React.CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: 12,
  marginBottom: 12,
};

const eyebrow: React.CSSProperties = {
  fontSize: 12,
  color: "rgba(169,200,255,0.9)",
  fontWeight: 950,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
};

const title: React.CSSProperties = {
  fontSize: 18,
  fontWeight: 900,
  marginTop: 4,
};

const metaPill: React.CSSProperties = {
  padding: "7px 9px",
  borderRadius: 8,
  border: "1px solid rgba(180,205,255,0.16)",
  background: "rgba(255,255,255,0.07)",
  fontSize: 12,
  fontWeight: 900,
  whiteSpace: "nowrap",
};

const mapBox: React.CSSProperties = {
  width: "100%",
  height: 420,
  borderRadius: 10,
  overflow: "hidden",
  background: "rgba(0,0,0,0.18)",
};

const fallbackBox: React.CSSProperties = {
  minHeight: 220,
  borderRadius: 10,
  border: "1px solid rgba(180,205,255,0.14)",
  background: "rgba(0,0,0,0.22)",
  padding: 18,
  display: "flex",
  flexDirection: "column",
  justifyContent: "center",
};

const fallbackTitle: React.CSSProperties = {
  fontSize: 18,
  fontWeight: 900,
};

const fallbackText: React.CSSProperties = {
  marginTop: 8,
  fontSize: 14,
  lineHeight: 1.5,
  opacity: 0.8,
};

const footNote: React.CSSProperties = {
  marginTop: 10,
  fontSize: 12,
  opacity: 0.72,
};