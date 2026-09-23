"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";

import HostGuard from "../../../components/HostGuard";
import HostLocationPicker from "../../../components/HostLocationPicker";

type Hookups = "Full" | "Partial" | "None";
type PricingType = "Night" | "Weekly" | "Monthly";

type GeocodeResult =
  | {
      ok: true;
      address?: string;
      formattedAddress?: string;
      lat: number;
      lng: number;
      placeId?: string;
    }
  | {
      ok: false;
      status?: string;
      error_message?: string;
      address?: string;
    };

async function geocodeCityState(
  city: string,
  state: string
): Promise<GeocodeResult | null> {
  try {
    const res = await fetch("/api/geocode", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ city, state }),
    });

    const data = await res.json();
    if (!data) return null;

    if (data.ok === true && typeof data.lat === "number" && typeof data.lng === "number") {
      return {
        ok: true,
        address: data.address,
        formattedAddress: data.formattedAddress,
        lat: data.lat,
        lng: data.lng,
        placeId: data.placeId,
      };
    }

    if (data.ok === false) {
      return {
        ok: false,
        status: data.status,
        error_message: data.error_message,
        address: data.address,
      };
    }

    return null;
  } catch {
    return null;
  }
}

export default function NewListingPage() {
  const router = useRouter();
  const { user } = useAuth();
  const userUid = user?.uid ?? "";

  const [title, setTitle] = useState("");
  const [city, setCity] = useState("");
  const [stateCode, setStateCode] = useState("");

  const [price, setPrice] = useState<number>(35);
  const [pricingType, setPricingType] = useState<PricingType>("Night");
  const [isPriceFocused, setIsPriceFocused] = useState(false);

  const [maxLengthFt, setMaxLengthFt] = useState<number>(35);
  const [hookups, setHookups] = useState<Hookups>("Full");

  const [description, setDescription] = useState("");
  const [nearbyAttractions, setNearbyAttractions] = useState("");

  const [power30, setPower30] = useState(false);
  const [power50, setPower50] = useState(true);
  const [water, setWater] = useState(false);
  const [sewer, setSewer] = useState(false);
  const [dump, setDump] = useState(false);

  const [laundry, setLaundry] = useState(false);
  const [washFold, setWashFold] = useState(false);

  const [wifi, setWifi] = useState(false);
  const [petsAllowed, setPetsAllowed] = useState(false);
  const [firePit, setFirePit] = useState(false);
  const [picnicTable, setPicnicTable] = useState(false);
  const [pullThrough, setPullThrough] = useState(false);
  const [trashPickup, setTrashPickup] = useState(false);
  const [securityCameras, setSecurityCameras] = useState(false);

  const [gym, setGym] = useState(false);
  const [bathrooms, setBathrooms] = useState(false);
  const [showers, setShowers] = useState(false);

  const [manualLocationEnabled, setManualLocationEnabled] = useState(false);
  const [manualLat, setManualLat] = useState<number | null>(null);
  const [manualLng, setManualLng] = useState<number | null>(null);

  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string>("");

  const showDollar = isPriceFocused || price > 0;

  const powerValue = useMemo(() => {
    if (power30 && power50) return "30A/50A";
    if (power30) return "30A";
    if (power50) return "50A";
    return "None";
  }, [power30, power50]);

  const waterValue = useMemo(() => (water ? "Yes" : "None"), [water]);

  const sewerValue = useMemo(() => {
    if (sewer) return "Yes";
    if (dump) return "Dump station";
    return "None";
  }, [sewer, dump]);

  const laundryValue = useMemo(() => {
    if (laundry && washFold) return "Both";
    if (laundry) return "Washer/Dryer";
    if (washFold) return "Wash & Fold";
    return "None";
  }, [laundry, washFold]);

  function validate(): string | null {
    const t = title.trim();
    const c = city.trim();
    const s = stateCode.trim().toUpperCase();

    if (!t) return "Please enter a listing title.";
    if (!c) return "Please enter a city.";
    if (s.length !== 2) return "State must be 2 letters (example: TX).";
    if (!Number.isFinite(price) || price < 0) return "Price must be 0 or more.";
    if (!Number.isFinite(maxLengthFt) || maxLengthFt < 0) {
      return "Max length must be 0 or more.";
    }

    if (manualLocationEnabled && (manualLat === null || manualLng === null)) {
      return "Manual location is enabled — please drop a pin on the map (or turn manual location off).";
    }

    return null;
  }

  async function handleCreate() {
    setStatus("");
    const err = validate();
    if (err) {
      setStatus(`⚠️ ${err}`);
      return;
    }

    if (!userUid) {
      setStatus("⚠️ You must be logged in to create a listing.");
      return;
    }

    const c = city.trim();
    const s = stateCode.trim().toUpperCase();

    setSaving(true);
    try {
      let geo: GeocodeResult | null = null;
      if (!manualLocationEnabled && c && s) {
        geo = await geocodeCityState(c, s);
      }

      const basePayload: Record<string, unknown> = {
        hostId: userUid,

        title: title.trim(),
        city: c,
        state: s,

        price: Number(price) || 0,
        pricingType,

        maxLengthFt: Number(maxLengthFt) || 0,
        hookups,

        power: powerValue,
        water: waterValue,
        sewer: sewerValue,
        laundry: laundryValue,

        description: description.trim(),
        nearbyAttractions: nearbyAttractions.trim(),

        wifi,
        petsAllowed,
        firePit,
        picnicTable,
        pullThrough,
        trashPickup,
        securityCameras,
        gym,
        bathrooms,
        showers,

        createdAt: serverTimestamp(),
      };

      if (manualLocationEnabled && manualLat !== null && manualLng !== null) {
        basePayload.lat = manualLat;
        basePayload.lng = manualLng;
        basePayload.geocodeAddress = "MANUAL_PIN";
        basePayload.placeId = "";
      } else if (geo && geo.ok === true) {
        basePayload.lat = geo.lat;
        basePayload.lng = geo.lng;
        basePayload.placeId = geo.placeId ?? "";
        basePayload.geocodeAddress = (geo.formattedAddress ?? geo.address ?? "").toString();
      }

      await addDoc(collection(db, "listings"), basePayload);

      router.push("/host");
    } catch (e) {
      console.error(e);
      setStatus("❌ Could not create listing.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <HostGuard>
      <main style={wrap}>
        <div style={hero}>
          <div>
            <Link href="/host" style={backLink}>
              ← Back to dashboard
            </Link>
            <h1 style={heroTitle}>Add a new listing</h1>
            <p style={heroSub}>
              These fields match what your listing pages read. Create your spot and
              it will appear on your dashboard immediately.
            </p>
          </div>
        </div>

        <section style={card}>
          {status && <div style={statusBox}>{status}</div>}

          <div style={fieldBlock}>
            <label style={label}>Listing title</label>
            <input
              style={input}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Example: Bet RV Park"
            />
          </div>

          <div style={row2}>
            <div style={fieldBlock}>
              <label style={label}>City</label>
              <input
                style={input}
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="Mission"
              />
            </div>

            <div style={fieldBlock}>
              <label style={label}>State</label>
              <input
                style={input}
                value={stateCode}
                onChange={(e) => setStateCode(e.target.value.toUpperCase().trim())}
                placeholder="TX"
                maxLength={2}
              />
            </div>
          </div>

          <div style={{ ...mutedBox, marginTop: 14 }}>
            <label style={{ display: "flex", gap: 10, alignItems: "center", cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={manualLocationEnabled}
                onChange={(e) => {
                  const on = e.target.checked;
                  setManualLocationEnabled(on);
                  if (!on) {
                    setManualLat(null);
                    setManualLng(null);
                  }
                }}
              />
              <div>
                <div style={{ fontWeight: 900 }}>
                  Set exact location manually (recommended for rural)
                </div>
                <div style={{ opacity: 0.8, fontSize: 12, marginTop: 2 }}>
                  If enabled, you&apos;ll drop a pin and we&apos;ll save its lat/lng
                  (overrides auto-geocode).
                </div>
              </div>
            </label>

            {manualLocationEnabled && (
              <div style={{ marginTop: 12 }}>
                <HostLocationPicker
                  height={320}
                  initialValue={
                    manualLat !== null && manualLng !== null
                      ? { lat: manualLat, lng: manualLng }
                      : null
                  }
                  onChange={(v: { lat: number; lng: number } | null) => {
                    setManualLat(v?.lat ?? null);
                    setManualLng(v?.lng ?? null);
                  }}
                />
              </div>
            )}
          </div>

          <div style={fieldBlock}>
            <label style={label}>Price</label>
            <div style={priceRow}>
              <div style={priceInputWrapper}>
                {showDollar && <span style={priceSymbol}>$</span>}
                <input
                  style={{ ...priceInput, paddingLeft: showDollar ? 22 : 12 }}
                  type="number"
                  min={0}
                  value={price}
                  onChange={(e) => setPrice(Math.max(0, Number(e.target.value)))}
                  onFocus={() => setIsPriceFocused(true)}
                  onBlur={() => setIsPriceFocused(false)}
                  placeholder="0"
                />
              </div>

              <select
                style={select}
                value={pricingType}
                onChange={(e) => setPricingType(e.target.value as PricingType)}
              >
                <option style={optionStyle} value="Night">
                  Night
                </option>
                <option style={optionStyle} value="Weekly">
                  Weekly
                </option>
                <option style={optionStyle} value="Monthly">
                  Monthly
                </option>
              </select>
            </div>
          </div>

          <div style={fieldBlock}>
            <label style={label}>Max RV length allowed</label>
            <div style={unitRow}>
              <input
                style={unitInput}
                type="number"
                min={0}
                max={50}
                value={maxLengthFt}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  if (Number.isNaN(val)) return;
                  setMaxLengthFt(Math.min(50, Math.max(0, val)));
                }}
              />
              <span style={unitSuffix}>ft</span>
            </div>
            <small style={tinyHelp}>Enter the longest RV that can fit (max 50 ft).</small>
          </div>

          <div style={fieldBlock}>
            <label style={label}>Hookups</label>
            <select
              style={selectFull}
              value={hookups}
              onChange={(e) => setHookups(e.target.value as Hookups)}
            >
              <option style={optionStyle} value="Full">
                Full Hookups
              </option>
              <option style={optionStyle} value="Partial">
                Partial Hookups
              </option>
              <option style={optionStyle} value="None">
                No Hookups
              </option>
            </select>
          </div>

          <div style={fieldBlock}>
            <label style={label}>Spot description (optional)</label>
            <textarea
              style={textarea}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Example: Level gravel pad, quiet at night, easy pull-through, close to highway..."
              maxLength={800}
            />
            <div style={counterRow}>
              <span style={tinyHelp}>Shows on the listing page later.</span>
              <span style={tinyHelp}>{description.length}/800</span>
            </div>
          </div>

          <div style={fieldBlock}>
            <label style={label}>Nearby attractions / theme parks (optional)</label>
            <textarea
              style={textarea}
              value={nearbyAttractions}
              onChange={(e) => setNearbyAttractions(e.target.value)}
              placeholder="Example: Six Flags (15 min), Water park (10 min), State park trails (5 min)..."
              maxLength={500}
            />
            <div style={counterRow}>
              <span style={tinyHelp}>Helps guests see what&apos;s around your location.</span>
              <span style={tinyHelp}>{nearbyAttractions.length}/500</span>
            </div>
          </div>

          <div style={divider} />

          <div style={amenityWrap}>
            <AmenitySection title="RV Infrastructure">
              <Checkbox label="🔌 30 Amp Power" checked={power30} onChange={setPower30} />
              <Checkbox label="🔌 50 Amp Power" checked={power50} onChange={setPower50} />
              <Checkbox label="💧 Water Hookup" checked={water} onChange={setWater} />
              <Checkbox label="🚽 Full Sewer Hookup" checked={sewer} onChange={setSewer} />
              <Checkbox label="♻️ Dump Station Onsite" checked={dump} onChange={setDump} />
            </AmenitySection>

            <AmenitySection title="Laundry">
              <Checkbox label="🧺 Washer/Dryer Onsite" checked={laundry} onChange={setLaundry} />
              <Checkbox label="🧼 Wash & Fold Service" checked={washFold} onChange={setWashFold} />
            </AmenitySection>

            <AmenitySection title="Facilities">
              <Checkbox label="🏋️ Gym Onsite" checked={gym} onChange={setGym} />
              <Checkbox label="🚻 Bathrooms Onsite" checked={bathrooms} onChange={setBathrooms} />
              <Checkbox label="🚿 Showers Onsite" checked={showers} onChange={setShowers} />
            </AmenitySection>

            <AmenitySection title="Convenience">
              <Checkbox label="📶 Wi-Fi" checked={wifi} onChange={setWifi} />
              <Checkbox label="🗑️ Trash Pickup" checked={trashPickup} onChange={setTrashPickup} />
              <Checkbox
                label="📹 Security Cameras"
                checked={securityCameras}
                onChange={setSecurityCameras}
              />
            </AmenitySection>

            <AmenitySection title="Recreation / Site Features">
              <Checkbox label="🐶 Pets Allowed" checked={petsAllowed} onChange={setPetsAllowed} />
              <Checkbox label="🔥 Fire Pit" checked={firePit} onChange={setFirePit} />
              <Checkbox label="🧺 Picnic Table" checked={picnicTable} onChange={setPicnicTable} />
              <Checkbox
                label="🚚 Pull-Through Site"
                checked={pullThrough}
                onChange={setPullThrough}
              />
            </AmenitySection>
          </div>

          <button style={{ ...btn, opacity: saving ? 0.7 : 1 }} onClick={handleCreate} disabled={saving}>
            {saving ? "Creating..." : "Create Listing"}
          </button>

          <div style={tinyHelp}>
            Saved legacy-compatible fields: <b>power</b>, <b>water</b>, <b>sewer</b>,{" "}
            <b>laundry</b>. New amenities are additive & safe.
          </div>
        </section>
      </main>
    </HostGuard>
  );
}

function Checkbox({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label style={checkRow}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>{label}</span>
    </label>
  );
}

function AmenitySection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={amenityCard}>
      <div style={amenityTitle}>{title}</div>
      <div style={amenityGrid}>{children}</div>
    </div>
  );
}

const wrap: React.CSSProperties = {
  minHeight: "100vh",
  padding: 24,
  background: "#060b14",
  color: "white",
};

const hero: React.CSSProperties = {
  maxWidth: 760,
  margin: "0 auto",
  paddingBottom: 16,
};

const backLink: React.CSSProperties = {
  display: "inline-block",
  color: "#93c5fd",
  fontWeight: 700,
  fontSize: 13,
  textDecoration: "none",
  marginBottom: 12,
};

const heroTitle: React.CSSProperties = { fontSize: 32, fontWeight: 950, margin: 0 };
const heroSub: React.CSSProperties = {
  marginTop: 10,
  opacity: 0.8,
  maxWidth: 640,
  lineHeight: 1.5,
};

const card: React.CSSProperties = {
  padding: 20,
  borderRadius: 18,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(255,255,255,0.05)",
  maxWidth: 760,
  margin: "0 auto",
};

const mutedBox: React.CSSProperties = {
  marginTop: 14,
  padding: 14,
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.10)",
  background: "rgba(0,0,0,0.18)",
  opacity: 0.95,
};

const statusBox: React.CSSProperties = {
  marginTop: 12,
  padding: 12,
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(255,255,255,0.06)",
  fontWeight: 800,
};

const fieldBlock: React.CSSProperties = { marginTop: 14 };

const row2: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 140px",
  gap: 12,
};

const input: React.CSSProperties = {
  width: "100%",
  padding: 12,
  marginTop: 8,
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.15)",
  background: "rgba(255,255,255,0.08)",
  color: "white",
};

const textarea: React.CSSProperties = {
  width: "100%",
  padding: 12,
  marginTop: 8,
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.15)",
  background: "rgba(255,255,255,0.08)",
  color: "white",
  minHeight: 90,
  resize: "vertical",
};

const counterRow: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  marginTop: 8,
};

const label: React.CSSProperties = { fontWeight: 800 };
const tinyHelp: React.CSSProperties = { opacity: 0.7, fontSize: 12 };

const priceRow: React.CSSProperties = { display: "flex", gap: 12, marginTop: 8 };
const priceInputWrapper: React.CSSProperties = { position: "relative", flex: 1 };

const priceSymbol: React.CSSProperties = {
  position: "absolute",
  left: 12,
  top: "50%",
  transform: "translateY(-50%)",
  fontWeight: 900,
  opacity: 0.85,
};

const priceInput: React.CSSProperties = {
  width: "100%",
  padding: "12px 12px",
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.15)",
  background: "rgba(255,255,255,0.08)",
  color: "white",
};

const select: React.CSSProperties = {
  padding: 12,
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.15)",
  background: "rgba(255,255,255,0.08)",
  color: "white",
  minWidth: 150,
};

const selectFull: React.CSSProperties = {
  width: "100%",
  padding: 12,
  marginTop: 8,
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.15)",
  background: "rgba(255,255,255,0.08)",
  color: "white",
};

const optionStyle: React.CSSProperties = {
  backgroundColor: "#0b0f19",
  color: "white",
};

const unitRow: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  marginTop: 8,
};

const unitSuffix: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.15)",
  background: "rgba(255,255,255,0.06)",
  fontWeight: 900,
};

const unitInput: React.CSSProperties = {
  flex: 1,
  padding: 12,
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.15)",
  background: "rgba(255,255,255,0.08)",
  color: "white",
};

const divider: React.CSSProperties = {
  height: 1,
  background: "rgba(255,255,255,0.10)",
  marginTop: 18,
};

const btn: React.CSSProperties = {
  marginTop: 18,
  padding: 14,
  width: "100%",
  borderRadius: 12,
  border: "1px solid rgba(96,165,250,0.4)",
  background: "linear-gradient(180deg, #3b82f6, #2563eb)",
  color: "white",
  fontWeight: 950,
  cursor: "pointer",
};

const checkRow: React.CSSProperties = {
  display: "flex",
  gap: 10,
  marginTop: 10,
  alignItems: "center",
};

const amenityWrap: React.CSSProperties = {
  marginTop: 18,
  display: "grid",
  gap: 12,
};

const amenityCard: React.CSSProperties = {
  padding: 12,
  borderRadius: 14,
  border: "1px solid rgba(255,255,255,0.10)",
  background: "rgba(0,0,0,0.18)",
};

const amenityTitle: React.CSSProperties = {
  fontWeight: 950,
  marginBottom: 8,
  opacity: 0.95,
};

const amenityGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 8,
};
