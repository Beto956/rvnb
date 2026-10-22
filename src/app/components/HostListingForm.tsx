"use client";

/**
 * Shared host listing form used by both /host/listings/new (create) and
 * /host/listings/[id]/edit (edit). The form UI, validation and the
 * Firestore field mapping live here so both pages write identical
 * field names/types/normalization.
 */

import React, { useMemo, useState } from "react";

import HostLocationPicker from "./HostLocationPicker";

export type Hookups = "Full" | "Partial" | "None";
export type PricingType = "Night" | "Weekly" | "Monthly";

export type GeocodeResult =
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

export async function geocodeCityState(
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

export type ListingFormValues = {
  title: string;
  city: string;
  stateCode: string;
  price: number;
  pricingType: PricingType;
  maxLengthFt: number;
  hookups: Hookups;
  description: string;
  nearbyAttractions: string;
  power30: boolean;
  power50: boolean;
  water: boolean;
  sewer: boolean;
  dump: boolean;
  laundry: boolean;
  washFold: boolean;
  wifi: boolean;
  petsAllowed: boolean;
  firePit: boolean;
  picnicTable: boolean;
  pullThrough: boolean;
  trashPickup: boolean;
  securityCameras: boolean;
  gym: boolean;
  bathrooms: boolean;
  showers: boolean;
  manualLocationEnabled: boolean;
  manualLat: number | null;
  manualLng: number | null;
};

/** Defaults used by the create page (unchanged from the original create form). */
export const DEFAULT_LISTING_FORM_VALUES: ListingFormValues = {
  title: "",
  city: "",
  stateCode: "",
  price: 35,
  pricingType: "Night",
  maxLengthFt: 35,
  hookups: "Full",
  description: "",
  nearbyAttractions: "",
  power30: false,
  power50: true,
  water: false,
  sewer: false,
  dump: false,
  laundry: false,
  washFold: false,
  wifi: false,
  petsAllowed: false,
  firePit: false,
  picnicTable: false,
  pullThrough: false,
  trashPickup: false,
  securityCameras: false,
  gym: false,
  bathrooms: false,
  showers: false,
  manualLocationEnabled: false,
  manualLat: null,
  manualLng: null,
};

export function toPowerValue(power30: boolean, power50: boolean): string {
  if (power30 && power50) return "30A/50A";
  if (power30) return "30A";
  if (power50) return "50A";
  return "None";
}

export function toWaterValue(water: boolean): string {
  return water ? "Yes" : "None";
}

export function toSewerValue(sewer: boolean, dump: boolean): string {
  if (sewer) return "Yes";
  if (dump) return "Dump station";
  return "None";
}

export function toLaundryValue(laundry: boolean, washFold: boolean): string {
  if (laundry && washFold) return "Both";
  if (laundry) return "Washer/Dryer";
  if (washFold) return "Wash & Fold";
  return "None";
}

/** Case/whitespace-insensitive comparison used to detect a city/state change. */
function sameLocationText(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

export function validateListingForm(values: ListingFormValues): string | null {
  const t = values.title.trim();
  const c = values.city.trim();
  const s = values.stateCode.trim().toUpperCase();

  if (!t) return "Please enter a listing title.";
  if (!c) return "Please enter a city.";
  if (s.length !== 2) return "State must be 2 letters (example: TX).";
  if (!Number.isFinite(values.price) || values.price < 0) return "Price must be 0 or more.";
  if (!Number.isFinite(values.maxLengthFt) || values.maxLengthFt < 0) {
    return "Max length must be 0 or more.";
  }

  if (values.manualLocationEnabled && (values.manualLat === null || values.manualLng === null)) {
    return "Manual location is enabled — please drop a pin on the map (or turn manual location off).";
  }

  return null;
}

/**
 * Listing content fields written by both create and edit.
 * Never includes the owner field (hostId), createdAt, or location fields.
 */
export function buildListingFields(values: ListingFormValues): Record<string, unknown> {
  return {
    title: values.title.trim(),
    city: values.city.trim(),
    state: values.stateCode.trim().toUpperCase(),

    price: Number(values.price) || 0,
    pricingType: values.pricingType,

    maxLengthFt: Number(values.maxLengthFt) || 0,
    hookups: values.hookups,

    power: toPowerValue(values.power30, values.power50),
    water: toWaterValue(values.water),
    sewer: toSewerValue(values.sewer, values.dump),
    laundry: toLaundryValue(values.laundry, values.washFold),

    description: values.description.trim(),
    nearbyAttractions: values.nearbyAttractions.trim(),

    wifi: values.wifi,
    petsAllowed: values.petsAllowed,
    firePit: values.firePit,
    picnicTable: values.picnicTable,
    pullThrough: values.pullThrough,
    trashPickup: values.trashPickup,
    securityCameras: values.securityCameras,
    gym: values.gym,
    bathrooms: values.bathrooms,
    showers: values.showers,
  };
}

/**
 * Location fields written when a location is known (manual pin wins over geocode).
 * Returns null when neither a manual pin nor a successful geocode is available.
 */
export function buildLocationFields(
  values: ListingFormValues,
  geo: GeocodeResult | null
): Record<string, unknown> | null {
  if (values.manualLocationEnabled && values.manualLat !== null && values.manualLng !== null) {
    return {
      lat: values.manualLat,
      lng: values.manualLng,
      geocodeAddress: "MANUAL_PIN",
      placeId: "",
    };
  }
  if (geo && geo.ok === true) {
    return {
      lat: geo.lat,
      lng: geo.lng,
      placeId: geo.placeId ?? "",
      geocodeAddress: (geo.formattedAddress ?? geo.address ?? "").toString(),
    };
  }
  return null;
}

/** Amenity fields stored as a single string on the listing doc. */
export type AmenityField = "power" | "water" | "sewer" | "laundry";

/** Which stored amenity fields the host actually interacted with in this form session. */
export type AmenityTouches = Record<AmenityField, boolean>;

type HostListingFormProps = {
  initialValues: ListingFormValues;
  saving: boolean;
  status: string;
  submitLabel: string;
  savingLabel: string;
  onSubmit: (values: ListingFormValues, touched: AmenityTouches) => void;
  /** Stored amenity values that did not map to any checkbox (edit flow only), shown as hints. */
  legacyAmenityHints?: Partial<Record<AmenityField, string>>;
};

const AMENITY_LABELS: Record<AmenityField, string> = {
  power: "Power",
  water: "Water",
  sewer: "Sewer",
  laundry: "Laundry",
};

export default function HostListingForm({
  initialValues,
  saving,
  status,
  submitLabel,
  savingLabel,
  onSubmit,
  legacyAmenityHints,
}: HostListingFormProps) {
  const [title, setTitle] = useState(initialValues.title);
  const [city, setCity] = useState(initialValues.city);
  const [stateCode, setStateCode] = useState(initialValues.stateCode);

  const [price, setPrice] = useState<number>(initialValues.price);
  const [pricingType, setPricingType] = useState<PricingType>(initialValues.pricingType);
  const [isPriceFocused, setIsPriceFocused] = useState(false);

  const [maxLengthFt, setMaxLengthFt] = useState<number>(initialValues.maxLengthFt);
  const [hookups, setHookups] = useState<Hookups>(initialValues.hookups);

  const [description, setDescription] = useState(initialValues.description);
  const [nearbyAttractions, setNearbyAttractions] = useState(initialValues.nearbyAttractions);

  const [power30, setPower30] = useState(initialValues.power30);
  const [power50, setPower50] = useState(initialValues.power50);
  const [water, setWater] = useState(initialValues.water);
  const [sewer, setSewer] = useState(initialValues.sewer);
  const [dump, setDump] = useState(initialValues.dump);

  const [laundry, setLaundry] = useState(initialValues.laundry);
  const [washFold, setWashFold] = useState(initialValues.washFold);

  const [touched, setTouched] = useState<AmenityTouches>({
    power: false,
    water: false,
    sewer: false,
    laundry: false,
  });
  function touch(field: AmenityField, set: (v: boolean) => void) {
    return (v: boolean) => {
      setTouched((t) => (t[field] ? t : { ...t, [field]: true }));
      set(v);
    };
  }

  const [wifi, setWifi] = useState(initialValues.wifi);
  const [petsAllowed, setPetsAllowed] = useState(initialValues.petsAllowed);
  const [firePit, setFirePit] = useState(initialValues.firePit);
  const [picnicTable, setPicnicTable] = useState(initialValues.picnicTable);
  const [pullThrough, setPullThrough] = useState(initialValues.pullThrough);
  const [trashPickup, setTrashPickup] = useState(initialValues.trashPickup);
  const [securityCameras, setSecurityCameras] = useState(initialValues.securityCameras);

  const [gym, setGym] = useState(initialValues.gym);
  const [bathrooms, setBathrooms] = useState(initialValues.bathrooms);
  const [showers, setShowers] = useState(initialValues.showers);

  const [manualLocationEnabled, setManualLocationEnabled] = useState(
    initialValues.manualLocationEnabled
  );
  const [manualLat, setManualLat] = useState<number | null>(initialValues.manualLat);
  const [manualLng, setManualLng] = useState<number | null>(initialValues.manualLng);

  // A pin loaded with the listing (edit flow) belongs to the original city/state. If the host
  // changes city/state and has not placed a new pin since, that old pin must not override the
  // new location: it is hidden and the form submits without it, so the save geocodes the new
  // location. New listings never start with a pin, so the create flow is unaffected.
  const [initialPinUntouched, setInitialPinUntouched] = useState(true);
  const hadInitialPin =
    initialValues.manualLocationEnabled &&
    initialValues.manualLat !== null &&
    initialValues.manualLng !== null;
  const initialPinStale =
    hadInitialPin &&
    initialPinUntouched &&
    manualLocationEnabled &&
    (!sameLocationText(city, initialValues.city) ||
      !sameLocationText(stateCode, initialValues.stateCode));

  const showDollar = isPriceFocused || price > 0;

  const values = useMemo<ListingFormValues>(
    () => ({
      title,
      city,
      stateCode,
      price,
      pricingType,
      maxLengthFt,
      hookups,
      description,
      nearbyAttractions,
      power30,
      power50,
      water,
      sewer,
      dump,
      laundry,
      washFold,
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
      manualLocationEnabled: initialPinStale ? false : manualLocationEnabled,
      manualLat: initialPinStale ? null : manualLat,
      manualLng: initialPinStale ? null : manualLng,
    }),
    [
      title,
      city,
      stateCode,
      price,
      pricingType,
      maxLengthFt,
      hookups,
      description,
      nearbyAttractions,
      power30,
      power50,
      water,
      sewer,
      dump,
      laundry,
      washFold,
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
      manualLocationEnabled,
      manualLat,
      manualLng,
      initialPinStale,
    ]
  );

  function handleSubmit() {
    onSubmit(values, touched);
  }

  return (
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
              setInitialPinUntouched(false);
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

        {initialPinStale && (
          <div style={{ marginTop: 10, fontSize: 13, fontWeight: 700, color: "#fbbf24" }}>
            📍 City/state changed, so your previous map pin was cleared. We&apos;ll auto-locate
            the new location when you save — drop a new pin below if you want an exact spot.
          </div>
        )}

        {manualLocationEnabled && (
          <div style={{ marginTop: 12 }}>
            <HostLocationPicker
              height={320}
              initialValue={
                !initialPinStale && manualLat !== null && manualLng !== null
                  ? { lat: manualLat, lng: manualLng }
                  : null
              }
              onChange={(v: { lat: number; lng: number } | null) => {
                setInitialPinUntouched(false);
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

      {legacyAmenityHints &&
        (Object.keys(AMENITY_LABELS) as AmenityField[])
          .filter((f) => legacyAmenityHints[f] && !touched[f])
          .map((f) => (
            <div key={f} style={{ ...tinyHelp, marginBottom: 6 }}>
              {AMENITY_LABELS[f]} — current saved value: &quot;{legacyAmenityHints[f]}&quot;
              (doesn&apos;t match a checkbox; kept as-is unless you change this field).
            </div>
          ))}

      <div style={amenityWrap}>
        <AmenitySection title="RV Infrastructure">
          <Checkbox label="🔌 30 Amp Power" checked={power30} onChange={touch("power", setPower30)} />
          <Checkbox label="🔌 50 Amp Power" checked={power50} onChange={touch("power", setPower50)} />
          <Checkbox label="💧 Water Hookup" checked={water} onChange={touch("water", setWater)} />
          <Checkbox label="🚽 Full Sewer Hookup" checked={sewer} onChange={touch("sewer", setSewer)} />
          <Checkbox label="♻️ Dump Station Onsite" checked={dump} onChange={touch("sewer", setDump)} />
        </AmenitySection>

        <AmenitySection title="Laundry">
          <Checkbox
            label="🧺 Washer/Dryer Onsite"
            checked={laundry}
            onChange={touch("laundry", setLaundry)}
          />
          <Checkbox
            label="🧼 Wash & Fold Service"
            checked={washFold}
            onChange={touch("laundry", setWashFold)}
          />
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

      <button style={{ ...btn, opacity: saving ? 0.7 : 1 }} onClick={handleSubmit} disabled={saving}>
        {saving ? savingLabel : submitLabel}
      </button>

      <div style={tinyHelp}>
        Saved legacy-compatible fields: <b>power</b>, <b>water</b>, <b>sewer</b>,{" "}
        <b>laundry</b>. New amenities are additive & safe.
      </div>
    </section>
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

export const wrap: React.CSSProperties = {
  minHeight: "100vh",
  padding: 24,
  background: "#060b14",
  color: "white",
};

export const hero: React.CSSProperties = {
  maxWidth: 760,
  margin: "0 auto",
  paddingBottom: 16,
};

export const backLink: React.CSSProperties = {
  display: "inline-block",
  color: "#93c5fd",
  fontWeight: 700,
  fontSize: 13,
  textDecoration: "none",
  marginBottom: 12,
};

export const heroTitle: React.CSSProperties = { fontSize: 32, fontWeight: 950, margin: 0 };
export const heroSub: React.CSSProperties = {
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
