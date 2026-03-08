"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { GoogleMap, Marker, useJsApiLoader } from "@react-google-maps/api";

type LatLng = { lat: number; lng: number };

type Props = {
  height?: number;
  initialValue?: LatLng | null;
  defaultCenter?: LatLng;
  onChange: (value: LatLng | null) => void;

  // Optional UX:
  title?: string;
  subtitle?: string;
};

const USA_CENTER: LatLng = { lat: 39.8283, lng: -98.5795 };

export default function HostLocationPicker({
  height = 340,
  initialValue = null,
  defaultCenter = USA_CENTER,
  onChange,
  title = "Set exact location (optional)",
  subtitle = "If your address is rural or hard to find, drop a pin on the entrance/driveway.",
}: Props) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "";

  // ✅ IMPORTANT: Hook is always called (never conditional)
  const { isLoaded, loadError } = useJsApiLoader({
    id: "rvnb-google-maps",
    googleMapsApiKey: apiKey,
  });

  const [pin, setPin] = useState<LatLng | null>(initialValue);

  // keep local pin in sync if parent changes it
  useEffect(() => {
    setPin(initialValue);
  }, [initialValue?.lat, initialValue?.lng]); // safe + stable

  const center = useMemo<LatLng>(() => {
    if (pin) return pin;
    return defaultCenter;
  }, [pin, defaultCenter]);

  const handleMapClick = useCallback(
    (e: google.maps.MapMouseEvent) => {
      const lat = e.latLng?.lat();
      const lng = e.latLng?.lng();
      if (typeof lat !== "number" || typeof lng !== "number") return;

      const next = { lat, lng };
      setPin(next);
      onChange(next);
    },
    [onChange]
  );

  function clearPin() {
    setPin(null);
    onChange(null);
  }

  async function useMyLocation() {
    if (!navigator.geolocation) return;

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const next = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setPin(next);
        onChange(next);
      },
      () => {
        // silent fail (no breaking UX)
      },
      { enableHighAccuracy: true, timeout: 9000 }
    );
  }

  // ✅ UI (hooks already executed above, so safe to return any UI below)

  if (!apiKey) {
    return (
      <div
        style={{
          height,
          borderRadius: 16,
          padding: 16,
          background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(255,255,255,0.10)",
          color: "white",
        }}
      >
        <div style={{ fontWeight: 900, marginBottom: 6 }}>{title}</div>
        <div style={{ opacity: 0.85, lineHeight: 1.45 }}>
          Google Maps API key missing. Add{" "}
          <code>NEXT_PUBLIC_GOOGLE_MAPS_API_KEY</code> to <code>.env.local</code> and Vercel.
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
          border: "1px solid rgba(255,255,255,0.10)",
          color: "white",
        }}
      >
        <div style={{ fontWeight: 900, marginBottom: 6 }}>{title}</div>
        <div style={{ opacity: 0.85, lineHeight: 1.45 }}>
          Failed to load Google Maps. Check API key restrictions + billing in Google Cloud.
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
          border: "1px solid rgba(255,255,255,0.10)",
          color: "white",
        }}
      >
        Loading map…
      </div>
    );
  }

  return (
    <section
      style={{
        borderRadius: 18,
        border: "1px solid rgba(255,255,255,0.12)",
        background: "rgba(255,255,255,0.03)",
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div style={{ padding: 14 }}>
        <div style={{ fontWeight: 950, marginBottom: 6 }}>{title}</div>
        <div style={{ opacity: 0.8, fontSize: 13, lineHeight: 1.45 }}>{subtitle}</div>

        <div style={{ display: "flex", gap: 10, marginTop: 12, flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={useMyLocation}
            style={btn}
            title="Use your current device location"
          >
            Use my location
          </button>

          <button
            type="button"
            onClick={clearPin}
            style={{ ...btn, opacity: pin ? 1 : 0.5, cursor: pin ? "pointer" : "not-allowed" }}
            disabled={!pin}
            title="Clear the pin"
          >
            Clear pin
          </button>

          <div style={{ marginLeft: "auto", opacity: 0.85, fontSize: 12 }}>
            {pin ? (
              <>
                Saved pin:{" "}
                <code style={code}>
                  {pin.lat.toFixed(6)}, {pin.lng.toFixed(6)}
                </code>
              </>
            ) : (
              <>No pin set</>
            )}
          </div>
        </div>
      </div>

      {/* Map */}
      <div style={{ height, width: "100%" }}>
        <GoogleMap
          mapContainerStyle={{ height: "100%", width: "100%" }}
          center={center}
          zoom={pin ? 14 : 4}
          options={{
            fullscreenControl: false,
            streetViewControl: false,
            mapTypeControl: false,
            clickableIcons: false,
          }}
          onClick={handleMapClick}
        >
          {pin && <Marker position={pin} />}
        </GoogleMap>
      </div>

      {/* Footer hint */}
      <div style={{ padding: 12, opacity: 0.8, fontSize: 12 }}>
        Tip: Click the map to drop the pin at the <b>entrance</b> (best for rural driveways / gates).
      </div>
    </section>
  );
}

const btn: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.15)",
  background: "rgba(255,255,255,0.08)",
  color: "white",
  fontWeight: 900,
  cursor: "pointer",
};

const code: React.CSSProperties = {
  padding: "2px 6px",
  borderRadius: 8,
  border: "1px solid rgba(255,255,255,0.14)",
  background: "rgba(0,0,0,0.20)",
};