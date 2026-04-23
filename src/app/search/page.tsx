"use client";

export const dynamic = "force-dynamic";

import React, { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { collection, getDocs, orderBy, query } from "firebase/firestore";
import { db } from "@/lib/firebase";

/** ---------------- Types ---------------- */
type Hookups = "Full" | "Partial" | "None";
type PricingType = "Night" | "Weekly" | "Monthly";
type SortMode = "Newest" | "PriceLow" | "PriceHigh";

type ListingDoc = {
  title?: string;
  city?: string;
  state?: string;

  price?: number;
  pricePerNight?: number;
  pricingType?: PricingType;

  maxLengthFt?: number;
  hookups?: Hookups;

  power?: string;
  water?: string;
  sewer?: string;
  laundry?: string;

  description?: string;

  wifi?: boolean;
  petsAllowed?: boolean;
  firePit?: boolean;
  picnicTable?: boolean;
  pullThrough?: boolean;
  trashPickup?: boolean;
  securityCameras?: boolean;

  gym?: boolean;
  bathrooms?: boolean;
  showers?: boolean;

  nearbyAttractions?: string;
};

type ListingUI = {
  id: string;
  title: string;
  city: string;
  state: string;

  price: number;
  pricingType: PricingType;

  maxLengthFt: number;
  hookups: Hookups;

  power: string;
  water: string;
  sewer: string;
  laundry: string;

  description: string;

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

  nearbyAttractions: string;
};

/** ---------------- Helpers ---------------- */
function normalizeState(s: string) {
  return s.trim().toUpperCase().slice(0, 2);
}

function toListingUI(id: string, d: ListingDoc): ListingUI {
  const price =
    typeof d.price === "number"
      ? d.price
      : typeof d.pricePerNight === "number"
      ? d.pricePerNight
      : 0;

  return {
    id,
    title: (d.title ?? "(Untitled Listing)").toString(),
    city: (d.city ?? "").toString(),
    state: (d.state ?? "").toString(),

    price,
    pricingType: (d.pricingType ?? "Night") as PricingType,

    maxLengthFt: typeof d.maxLengthFt === "number" ? d.maxLengthFt : 0,
    hookups: (d.hookups ?? "None") as Hookups,

    power: (d.power ?? "None").toString(),
    water: (d.water ?? "None").toString(),
    sewer: (d.sewer ?? "None").toString(),
    laundry: (d.laundry ?? "None").toString(),

    description: (d.description ?? "").toString(),

    wifi: Boolean(d.wifi),
    petsAllowed: Boolean(d.petsAllowed),
    firePit: Boolean(d.firePit),
    picnicTable: Boolean(d.picnicTable),
    pullThrough: Boolean(d.pullThrough),
    trashPickup: Boolean(d.trashPickup),
    securityCameras: Boolean(d.securityCameras),

    gym: Boolean(d.gym),
    bathrooms: Boolean(d.bathrooms),
    showers: Boolean(d.showers),

    nearbyAttractions: (d.nearbyAttractions ?? "").toString(),
  };
}

function getRigCompatibility(spot: ListingUI): string[] {
  const tags: string[] = [];

  const maxLen = spot.maxLengthFt || 0;
  const hasPullThrough = spot.pullThrough;
  const hasHookups = spot.hookups === "Full" || spot.hookups === "Partial";

  if (maxLen > 0 && maxLen <= 24) {
    tags.push("Class B friendly");
  }

  if (maxLen >= 20 && maxLen <= 32) {
    tags.push("Class C friendly");
    tags.push("Travel trailer friendly");
  }

  if (maxLen >= 30) {
    tags.push("5th wheel friendly");
  }

  if (maxLen >= 35) {
    tags.push("Big rig friendly");
  }

  if (hasPullThrough) {
    tags.push("Easy pull-through");
  }

  if (hasHookups) {
    tags.push("Hookup-ready");
  }

  if (tags.length === 0) {
    tags.push("Call ahead for fit");
  }

  return Array.from(new Set(tags)).slice(0, 4);
}

function formatPricingLabel(type: PricingType) {
  return type === "Night" ? "night" : type === "Weekly" ? "week" : "month";
}

function getCompatibilityMessage(
  spot: ListingUI,
  enabled: boolean,
  rigLength: number,
  rigType: string
) {
  if (!enabled || rigLength <= 0) return "";

  if (spot.maxLengthFt <= 0) {
    return `⚠ Compatibility unknown for ${rigType || "your rig"}`;
  }

  if (rigLength <= spot.maxLengthFt) {
    return `✔ Your rig fits (${rigLength} ft)`;
  }

  const overBy = rigLength - spot.maxLengthFt;
  if (overBy <= 3) {
    return `⚠ Tight fit — your rig may be slightly long`;
  }

  return `⚠ Your rig may be too long for this spot`;
}

function MapPreviewCard() {
  return (
    <div style={mapPreviewShell}>
      <div style={mapGrid}>
        {[
          { top: "18%", left: "28%", color: "#f6d36b", size: 10 },
          { top: "28%", left: "54%", color: "#82b6ff", size: 12 },
          { top: "40%", left: "64%", color: "#f6d36b", size: 10 },
          { top: "56%", left: "76%", color: "#82b6ff", size: 12 },
          { top: "66%", left: "46%", color: "#9be58d", size: 9 },
          { top: "48%", left: "24%", color: "#82b6ff", size: 10 },
          { top: "34%", left: "80%", color: "#ffffff", size: 8 },
          { top: "62%", left: "18%", color: "#f6d36b", size: 8 },
          { top: "22%", left: "68%", color: "#f6d36b", size: 9 },
        ].map((pin, i) => (
          <span
            key={i}
            style={{
              ...mapPin,
              top: pin.top,
              left: pin.left,
              background: pin.color,
              width: pin.size,
              height: pin.size,
            }}
          />
        ))}
      </div>
    </div>
  );
}

/** ---------------- Page Wrapper ---------------- */
export default function SearchPage() {
  return (
    <Suspense
      fallback={<div style={{ minHeight: "100vh", background: "#0b0f19" }} />}
    >
      <SearchPageClient />
    </Suspense>
  );
}

/** ---------------- Actual Page ---------------- */
function SearchPageClient() {
  const router = useRouter();
  const sp = useSearchParams();

  /** URL params */
  const paramState = normalizeState(sp.get("state") ?? "");
  const paramMaxPrice = sp.get("maxPrice") ? Number(sp.get("maxPrice")) : NaN;
  const paramHookups = (sp.get("hookups") ?? "").toString();
  const paramQ = (sp.get("q") ?? "").toString();

  /** Basic filters */
  const [qText, setQText] = useState(paramQ);
  const [stateCode, setStateCode] = useState(paramState);
  const [maxPrice, setMaxPrice] = useState<number>(
    Number.isFinite(paramMaxPrice) ? Math.max(0, paramMaxPrice) : 0
  );
  const [hookups, setHookups] = useState<Hookups | "Any">(
    (paramHookups === "Full" ||
    paramHookups === "Partial" ||
    paramHookups === "None"
      ? (paramHookups as Hookups)
      : "Any") as Hookups | "Any"
  );

  /** Advanced filters */
  const [showAdvanced, setShowAdvanced] = useState(true);

  const [minLengthFt, setMinLengthFt] = useState<number>(0);
  const [maxLengthFt, setMaxLengthFt] = useState<number>(0);

  const [pricingType, setPricingType] = useState<PricingType | "Any">("Any");

  const [requireWater, setRequireWater] = useState(false);
  const [requireSewer, setRequireSewer] = useState(false);
  const [acceptDumpStation, setAcceptDumpStation] = useState(true);

  const [powerNeed, setPowerNeed] = useState<"Any" | "30A" | "50A">("Any");

  const [laundryNeed, setLaundryNeed] = useState<
    "Any" | "Washer/Dryer" | "Wash & Fold" | "Both"
  >("Any");

  const [amenWifi, setAmenWifi] = useState(false);
  const [amenPets, setAmenPets] = useState(false);
  const [amenShowers, setAmenShowers] = useState(false);
  const [amenBathrooms, setAmenBathrooms] = useState(false);
  const [amenGym, setAmenGym] = useState(false);
  const [amenFirePit, setAmenFirePit] = useState(false);
  const [amenPullThrough, setAmenPullThrough] = useState(false);
  const [amenSecurity, setAmenSecurity] = useState(false);
  const [amenTrash, setAmenTrash] = useState(false);
  const [amenPicnic, setAmenPicnic] = useState(false);

  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");

  /** Rig fit bar */
  const [checkRigFit, setCheckRigFit] = useState(false);
  const [myRigLength, setMyRigLength] = useState<number>(35);
  const [myRigType, setMyRigType] = useState("5th wheel");
  const [mySlides, setMySlides] = useState<number>(2);

  /** Sort */
  const [sortMode, setSortMode] = useState<SortMode>("Newest");
  const [hasAppliedSearch, setHasAppliedSearch] = useState(false);

  /** Data */
  const [loading, setLoading] = useState(true);
  const [listings, setListings] = useState<ListingUI[]>([]);
  const [error, setError] = useState("");

  async function loadListings() {
    setLoading(true);
    setError("");
    try {
      const q = query(collection(db, "listings"), orderBy("createdAt", "desc"));
      const snap = await getDocs(q);
      const rows = snap.docs.map((d) => toListingUI(d.id, d.data() as ListingDoc));
      setListings(rows);
    } catch (e) {
      console.error(e);
      setError("❌ Could not load listings from Firestore.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadListings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const activeFiltersCount = useMemo(() => {
    let n = 0;
    if (qText.trim()) n++;
    if (normalizeState(stateCode)) n++;
    if (maxPrice > 0) n++;
    if (hookups !== "Any") n++;

    if (minLengthFt > 0) n++;
    if (maxLengthFt > 0) n++;
    if (pricingType !== "Any") n++;
    if (powerNeed !== "Any") n++;
    if (laundryNeed !== "Any") n++;

    if (requireWater) n++;
    if (requireSewer) n++;
    if (!acceptDumpStation) n++;

    if (amenWifi) n++;
    if (amenPets) n++;
    if (amenShowers) n++;
    if (amenBathrooms) n++;
    if (amenGym) n++;
    if (amenFirePit) n++;
    if (amenPullThrough) n++;
    if (amenSecurity) n++;
    if (amenTrash) n++;
    if (amenPicnic) n++;

    return n;
  }, [
    qText,
    stateCode,
    maxPrice,
    hookups,
    minLengthFt,
    maxLengthFt,
    pricingType,
    powerNeed,
    laundryNeed,
    requireWater,
    requireSewer,
    acceptDumpStation,
    amenWifi,
    amenPets,
    amenShowers,
    amenBathrooms,
    amenGym,
    amenFirePit,
    amenPullThrough,
    amenSecurity,
    amenTrash,
    amenPicnic,
  ]);

  const filtered = useMemo(() => {
    const q = qText.trim().toLowerCase();
    const s = normalizeState(stateCode);
    const mp = Number(maxPrice) || 0;

    const minL = Number(minLengthFt) || 0;
    const maxL = Number(maxLengthFt) || 0;

    return listings
      .filter((l) => {
        const hay =
          `${l.title} ${l.city} ${l.state} ${l.description} ${l.nearbyAttractions}`.toLowerCase();
        if (q && !hay.includes(q)) return false;
        if (s && normalizeState(l.state) !== s) return false;
        if (mp > 0 && l.price > mp) return false;
        if (hookups !== "Any" && l.hookups !== hookups) return false;

        if (pricingType !== "Any" && l.pricingType !== pricingType) return false;

        if (minL > 0 && l.maxLengthFt > 0 && l.maxLengthFt < minL) return false;
        if (maxL > 0 && l.maxLengthFt > 0 && l.maxLengthFt > maxL) return false;

        if (powerNeed !== "Any") {
          const p = (l.power || "").toUpperCase();
          if (powerNeed === "30A") {
            if (!(p.includes("30A") || p.includes("30"))) return false;
          }
          if (powerNeed === "50A") {
            if (!(p.includes("50A") || p.includes("50"))) return false;
          }
        }

        if (requireWater && l.water !== "Yes") return false;

        if (requireSewer) {
          if (l.sewer === "Yes") {
            // ok
          } else if (l.sewer === "Dump station") {
            if (!acceptDumpStation) return false;
          } else {
            return false;
          }
        }

        if (laundryNeed !== "Any") {
          if (l.laundry !== laundryNeed) return false;
        }

        if (amenWifi && !l.wifi) return false;
        if (amenPets && !l.petsAllowed) return false;
        if (amenShowers && !l.showers) return false;
        if (amenBathrooms && !l.bathrooms) return false;
        if (amenGym && !l.gym) return false;
        if (amenFirePit && !l.firePit) return false;
        if (amenPullThrough && !l.pullThrough) return false;
        if (amenSecurity && !l.securityCameras) return false;
        if (amenTrash && !l.trashPickup) return false;
        if (amenPicnic && !l.picnicTable) return false;

        return true;
      })
      .sort((a, b) => {
        if (sortMode === "PriceLow") return (a.price || 0) - (b.price || 0);
        if (sortMode === "PriceHigh") return (b.price || 0) - (a.price || 0);
        return 0;
      });
  }, [
    listings,
    qText,
    stateCode,
    maxPrice,
    hookups,
    minLengthFt,
    maxLengthFt,
    pricingType,
    powerNeed,
    requireWater,
    requireSewer,
    acceptDumpStation,
    laundryNeed,
    amenWifi,
    amenPets,
    amenShowers,
    amenBathrooms,
    amenGym,
    amenFirePit,
    amenPullThrough,
    amenSecurity,
    amenTrash,
    amenPicnic,
    sortMode,
  ]);

  function pushParams() {
    const params = new URLSearchParams();

    const s = normalizeState(stateCode);
    if (s) params.set("state", s);
    if (qText.trim()) params.set("q", qText.trim());
    if (Number(maxPrice) > 0) {
      params.set("maxPrice", String(Math.max(0, Number(maxPrice))));
    }
    if (hookups !== "Any") params.set("hookups", hookups);

    setHasAppliedSearch(true);
    router.push(`/search?${params.toString()}`);
  }

  function resetAll() {
    setQText("");
    setStateCode("");
    setMaxPrice(0);
    setHookups("Any");
    setCheckIn("");
    setCheckOut("");

    setMinLengthFt(0);
    setMaxLengthFt(0);
    setPricingType("Any");
    setRequireWater(false);
    setRequireSewer(false);
    setAcceptDumpStation(true);
    setPowerNeed("Any");
    setLaundryNeed("Any");

    setAmenWifi(false);
    setAmenPets(false);
    setAmenShowers(false);
    setAmenBathrooms(false);
    setAmenGym(false);
    setAmenFirePit(false);
    setAmenPullThrough(false);
    setAmenSecurity(false);
    setAmenTrash(false);
    setAmenPicnic(false);

    setSortMode("Newest");

    setCheckRigFit(false);
    setMyRigLength(35);
    setMyRigType("5th wheel");
    setMySlides(2);

    setHasAppliedSearch(false);
    router.push("/search");
  }

  const resultsSummary = useMemo(() => {
    if (loading) return "Loading road-ready spots…";
    return `${filtered.length} match${filtered.length === 1 ? "" : "es"} found`;
  }, [filtered.length, loading]);

  const filterSummaryItems = useMemo(() => {
    const items: Array<{ label: string; value: string }> = [];

    if (stateCode) items.push({ label: "State", value: normalizeState(stateCode) });
    if (maxPrice > 0) items.push({ label: "Max price", value: `$${maxPrice}` });
    if (hookups !== "Any") items.push({ label: "Hookups", value: hookups });
    if (powerNeed !== "Any") items.push({ label: "Power", value: powerNeed });
    if (requireWater) items.push({ label: "Water", value: "Required" });
    if (pricingType !== "Any") items.push({ label: "Pricing", value: pricingType });
    if (minLengthFt > 0 || maxLengthFt > 0) {
      items.push({
        label: "RV length",
        value: `${minLengthFt || 0}-${maxLengthFt || "Any"} ft`,
      });
    }

    return items.slice(0, 6);
  }, [
    stateCode,
    maxPrice,
    hookups,
    powerNeed,
    requireWater,
    pricingType,
    minLengthFt,
    maxLengthFt,
  ]);

  return (
    <main style={wrap}>
      <div style={pageGlowLeft} />
      <div style={pageGlowRight} />
      <div style={pageInner}>
        <div style={hero}>
          <div>
            <h1 style={heroTitle}>Find RV Spots</h1>
            <p style={heroSub}>
              This is the <b>advanced</b> search. Filter by amenities, hookups, RV
              length, utilities and more.
            </p>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Link href="/" style={ghostBtn}>
              ← Back to Home
            </Link>
            <Link href="/listings" style={ghostBtn}>
              Browse listings →
            </Link>
          </div>
        </div>

        <section style={searchShell}>
          <div style={sectionHeader}>
            <div>
              <div
                style={{
                  display: "flex",
                  gap: 10,
                  alignItems: "center",
                  flexWrap: "wrap",
                }}
              >
                <h2 style={sectionTitle}>Search</h2>
                <span style={badge}>{activeFiltersCount} filters</span>
              </div>
              <p style={sectionSub}>
                Use the basics up top. Expand advanced filters to find the exact
                spot.
              </p>
            </div>

            <div
              style={{
                display: "flex",
                gap: 10,
                flexWrap: "wrap",
                justifyContent: "flex-end",
              }}
            >
              <button
                style={smallBtn}
                onClick={pushParams}
                title="Update URL params (basic filters)"
              >
                Apply
              </button>
              <button style={smallBtn} onClick={() => setShowAdvanced((v) => !v)}>
                {showAdvanced ? "Hide Advanced" : "Show Advanced"}
              </button>
              <button style={clearBtn} onClick={resetAll}>
                Reset all
              </button>
            </div>
          </div>

          <div style={toolbar}>
            <div>
              <label style={label}>City / keyword</label>
              <input
                style={input}
                value={qText}
                onChange={(e) => setQText(e.target.value)}
                placeholder="Example: McAllen, mission, park, gravel…"
              />
            </div>

            <div>
              <label style={label}>State</label>
              <input
                style={input}
                value={stateCode}
                onChange={(e) => setStateCode(e.target.value.toUpperCase().trim())}
                placeholder="TX"
                maxLength={2}
              />
            </div>

            <div>
              <label style={label}>Max price</label>
              <input
                style={input}
                type="number"
                min={0}
                value={maxPrice}
                onChange={(e) => setMaxPrice(Math.max(0, Number(e.target.value)))}
                placeholder="0"
              />
            </div>

            <div>
              <label style={label}>Hookups</label>
              <select
                style={selectFull}
                value={hookups}
                onChange={(e) => setHookups(e.target.value as Hookups | "Any")}
              >
                <option style={optionStyle} value="Any">
                  Any
                </option>
                <option style={optionStyle} value="Full">
                  Full
                </option>
                <option style={optionStyle} value="Partial">
                  Partial
                </option>
                <option style={optionStyle} value="None">
                  None
                </option>
              </select>
            </div>

            <div style={dateRow}>
              <div>
                <label style={label}>Check-in (optional)</label>
                <input
                  style={input}
                  type="date"
                  value={checkIn}
                  onChange={(e) => setCheckIn(e.target.value)}
                />
              </div>
              <div>
                <label style={label}>Check-out (optional)</label>
                <input
                  style={input}
                  type="date"
                  value={checkOut}
                  onChange={(e) => setCheckOut(e.target.value)}
                />
              </div>
            </div>
          </div>

          {showAdvanced && (
            <div style={{ marginTop: 20 }}>
              <div style={divider} />

              <div style={advancedHeaderRow}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    flexWrap: "wrap",
                  }}
                >
                  <div style={advancedTitle}>Advanced Filters</div>
                  <span style={activeBadge}>+{activeFiltersCount} Active</span>
                </div>

                <div>
                  <select
                    style={{ ...selectCompact, minWidth: 180 }}
                    value={sortMode}
                    onChange={(e) => setSortMode(e.target.value as SortMode)}
                  >
                    <option style={optionStyle} value="Newest">
                      Newest first
                    </option>
                    <option style={optionStyle} value="PriceLow">
                      Price: low → high
                    </option>
                    <option style={optionStyle} value="PriceHigh">
                      Price: high → low
                    </option>
                  </select>
                </div>
              </div>

              <div style={advancedShell}>
                <div style={advancedLeft}>
                  <div style={advancedTopRow}>
                    <div style={miniCard}>
                      <div style={miniTitle}>RV Size</div>
                      <div style={miniRow2}>
                        <div>
                          <div style={tinyHelp}>Min length (ft)</div>
                          <input
                            style={input}
                            type="number"
                            min={0}
                            value={minLengthFt}
                            onChange={(e) =>
                              setMinLengthFt(Math.max(0, Number(e.target.value)))
                            }
                            placeholder="0"
                          />
                        </div>
                        <div>
                          <div style={tinyHelp}>Max length (ft)</div>
                          <input
                            style={input}
                            type="number"
                            min={0}
                            value={maxLengthFt}
                            onChange={(e) =>
                              setMaxLengthFt(Math.max(0, Number(e.target.value)))
                            }
                            placeholder="0"
                          />
                        </div>
                      </div>
                    </div>

                    <div style={miniCard}>
                      <div style={miniTitle}>Pricing</div>
                      <div style={{ marginTop: 10 }}>
                        <div style={tinyHelp}>Pricing type</div>
                        <select
                          style={selectFull}
                          value={pricingType}
                          onChange={(e) =>
                            setPricingType(e.target.value as PricingType | "Any")
                          }
                        >
                          <option style={optionStyle} value="Any">
                            Any
                          </option>
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
                      <div style={{ ...tinyHelp, marginTop: 8 }}>
                        Night • Weekly • Monthly
                      </div>
                    </div>
                  </div>

                  <div style={wideFilterCard}>
                    <div style={miniTitle}>Utilities</div>

                    <div style={checkGrid}>
                      <Check
                        label="💧 Water required"
                        checked={requireWater}
                        onChange={setRequireWater}
                      />
                      <Check
                        label="🚽 Sewer required"
                        checked={requireSewer}
                        onChange={setRequireSewer}
                      />
                      <Check
                        label="♻ Accept dump station"
                        checked={acceptDumpStation}
                        onChange={setAcceptDumpStation}
                        disabled={!requireSewer}
                      />
                    </div>

                    <div style={utilitySplit}>
                      <div>
                        <div style={tinyHelp}>Power</div>
                        <div style={chipRow}>
                          {(["Any", "30A", "50A"] as const).map((value) => (
                            <button
                              key={value}
                              type="button"
                              style={powerNeed === value ? toggleChipActive : toggleChip}
                              onClick={() => setPowerNeed(value)}
                            >
                              {value}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div>
                        <div style={tinyHelp}>Laundry</div>
                        <div style={chipRow}>
                          {(
                            ["Any", "Washer/Dryer", "Wash & Fold", "Both"] as const
                          ).map((value) => (
                            <button
                              key={value}
                              type="button"
                              style={
                                laundryNeed === value ? toggleChipActive : toggleChip
                              }
                              onClick={() => setLaundryNeed(value)}
                            >
                              {value}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div style={wideFilterCard}>
                    <div style={miniTitle}>Amenities</div>
                    <div style={amenityGrid}>
                      <Check label="📶 Wi-Fi" checked={amenWifi} onChange={setAmenWifi} />
                      <Check
                        label="🚿 Showers"
                        checked={amenShowers}
                        onChange={setAmenShowers}
                      />
                      <Check
                        label="🚻 Bathrooms"
                        checked={amenBathrooms}
                        onChange={setAmenBathrooms}
                      />
                      <Check label="🏋️ Gym" checked={amenGym} onChange={setAmenGym} />
                      <Check label="🐶 Pets" checked={amenPets} onChange={setAmenPets} />
                      <Check
                        label="🔥 Fire pit"
                        checked={amenFirePit}
                        onChange={setAmenFirePit}
                      />
                      <Check
                        label="🚚 Pull-through"
                        checked={amenPullThrough}
                        onChange={setAmenPullThrough}
                      />
                      <Check
                        label="📹 Security"
                        checked={amenSecurity}
                        onChange={setAmenSecurity}
                      />
                      <Check label="🗑 Trash" checked={amenTrash} onChange={setAmenTrash} />
                      <Check
                        label="🧺 Picnic"
                        checked={amenPicnic}
                        onChange={setAmenPicnic}
                      />
                    </div>
                  </div>
                </div>

                <aside style={advancedRight}>
                  <div style={sidebarCard}>
                    <div style={sidebarCardTitle}>RV Stops in TX</div>
                    <MapPreviewCard />
                    <button
                      style={{ ...smallBtn, width: "100%", marginTop: 14 }}
                      onClick={resetAll}
                    >
                      Clear filters
                    </button>
                  </div>
                </aside>
              </div>
            </div>
          )}
        </section>

        <div style={contentGrid}>
          <section style={resultsCard}>
            <div style={resultsHeader}>
              <div>
                <h2 style={resultsTitle}>Results</h2>
                <p style={sectionSubStrong}>{resultsSummary}</p>
              </div>

              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <div style={sortPill}>
                  Sort by{" "}
                  <b>
                    {sortMode === "Newest"
                      ? "Newest first"
                      : sortMode === "PriceLow"
                      ? "Price low → high"
                      : "Price high → low"}
                  </b>
                </div>
                <button style={smallBtn} onClick={loadListings} disabled={loading}>
                  {loading ? "Refreshing…" : "Refresh"}
                </button>
              </div>
            </div>

            <div style={rigBar}>
              <label style={rigToggle}>
                <input
                  type="checkbox"
                  checked={checkRigFit}
                  onChange={(e) => setCheckRigFit(e.target.checked)}
                />
                <span>Check RV compatibility</span>
              </label>

              <div style={rigField}>
                <div style={tinyHelp}>My rig length</div>
                <input
                  style={compactInput}
                  type="number"
                  min={0}
                  value={myRigLength}
                  onChange={(e) =>
                    setMyRigLength(Math.max(0, Number(e.target.value)))
                  }
                />
              </div>

              <div style={rigField}>
                <div style={tinyHelp}>RV Type</div>
                <select
                  style={compactSelect}
                  value={myRigType}
                  onChange={(e) => setMyRigType(e.target.value)}
                >
                  <option style={optionStyle} value="Class B">
                    Class B
                  </option>
                  <option style={optionStyle} value="Class C">
                    Class C
                  </option>
                  <option style={optionStyle} value="Travel trailer">
                    Travel trailer
                  </option>
                  <option style={optionStyle} value="5th wheel">
                    5th wheel
                  </option>
                  <option style={optionStyle} value="Toy hauler">
                    Toy hauler
                  </option>
                </select>
              </div>

              <div style={rigField}>
                <div style={tinyHelp}>Slides</div>
                <select
                  style={compactSelect}
                  value={mySlides}
                  onChange={(e) => setMySlides(Number(e.target.value))}
                >
                  <option style={optionStyle} value={0}>
                    0
                  </option>
                  <option style={optionStyle} value={1}>
                    1
                  </option>
                  <option style={optionStyle} value={2}>
                    2
                  </option>
                  <option style={optionStyle} value={3}>
                    3+
                  </option>
                </select>
              </div>

              <button style={compatCheckBtn} type="button">
                Check fit on results
              </button>
            </div>

            {error && <div style={statusBox}>{error}</div>}

            {!hasAppliedSearch ? (
              <div style={readyStateCard}>
                <div style={readyStateEyebrow}>Start your search</div>
                <h3 style={readyStateTitle}>Ready to find your perfect RV spot?</h3>
                <p style={readyStateText}>
                  Enter a city, state, or keyword above, then hit <b>Apply</b> to see
                  matching RV spots.
                </p>

                <div style={readyStateActions}>
                  <Link href="/listings" style={primaryLinkBtn}>
                    Or browse listings…
                  </Link>
                </div>
              </div>
            ) : loading ? (
              <div style={mutedBox}>Loading listings…</div>
            ) : filtered.length === 0 ? (
              <div style={mutedBox}>
                <div style={{ fontWeight: 950, marginBottom: 6 }}>
                  No road-ready matches found yet
                </div>
                <div style={{ opacity: 0.85, lineHeight: 1.4 }}>
                  Try widening your state, hookups, price, or rig-size filters —
                  or post a request so RVNB can help grow supply in that area.
                </div>

                <Link
                  href="/request-spot"
                  style={{
                    ...smallBtn,
                    marginTop: 12,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    textDecoration: "none",
                  }}
                >
                  Post a request
                </Link>
              </div>
            ) : (
              <div style={resultsGrid}>
                {filtered.map((spot) => {
                  const rigCompatibility = getRigCompatibility(spot);
                  const compatibilityMessage = getCompatibilityMessage(
                    spot,
                    checkRigFit,
                    myRigLength,
                    myRigType
                  );

                  return (
                    <div key={spot.id} style={listingCard}>
                      <div style={listingImageWrap}>
                        <img
                          src="https://images.unsplash.com/photo-1509395176047-4a66953fd231?auto=format&fit=crop&w=1200&q=80"
                          alt="RV Spot"
                          style={listingImage}
                        />
                        <div style={imageOverlay} />
                        <div style={imageTopShade} />
                        <div style={listingImageAccent} />
                        <div style={imagePriceBadge}>
                          ${spot.price} / {formatPricingLabel(spot.pricingType)}
                        </div>
                      </div>

                      <div style={listingTop}>
                        <div style={{ minWidth: 0 }}>
                          <div style={listingTitle}>{spot.title}</div>
                          <div style={listingLocation}>
                            {spot.city}, {spot.state}
                          </div>
                        </div>
                      </div>

                      <div style={pillRowCompact}>
                        <span style={pillStrong}>Hookups: {spot.hookups}</span>
                        <span style={pill}>🚐 {spot.maxLengthFt} ft</span>
                        {spot.wifi && <span style={pill}>Wi-Fi</span>}
                        {spot.petsAllowed && <span style={pill}>Pets</span>}
                        {spot.gym && <span style={pill}>Gym</span>}
                        {spot.pullThrough && <span style={pill}>Pull-through</span>}
                        {spot.laundry !== "None" && <span style={pill}>{spot.laundry}</span>}
                      </div>

                      {compatibilityMessage ? (
                        <div
                          style={
                            compatibilityMessage.startsWith("✔")
                              ? compatPositive
                              : compatWarning
                          }
                        >
                          {compatibilityMessage}
                        </div>
                      ) : null}

                      <div style={compatSection}>
                        <div style={compatLabel}>Rig Compatibility</div>
                        <div style={pillRowCompact}>
                          {rigCompatibility.map((tag) => (
                            <span key={tag} style={compatPill}>
                              {tag}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div style={compatSection}>
                        <div style={compatLabel}>Road Essentials</div>
                        <div style={pillRowCompact}>
                          <span style={pill}>Power: {spot.power}</span>
                          <span style={pill}>Water: {spot.water}</span>
                          <span style={pill}>Sewer: {spot.sewer}</span>
                          <span style={pill}>Laundry: {spot.laundry}</span>
                        </div>
                      </div>

                      {spot.description && (
                        <div style={descBox}>
                          <div style={descHeading}>About this stop</div>
                          <div style={descText}>{spot.description}</div>
                        </div>
                      )}

                      {spot.nearbyAttractions && (
                        <div style={descBox}>
                          <div style={descHeading}>Nearby</div>
                          <div style={descText}>{spot.nearbyAttractions}</div>
                        </div>
                      )}

                      <div style={listingFooter}>
                        <Link href={`/listings/${spot.id}`} style={primaryLinkBtn}>
                          View listing →
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <aside style={sidebarStack}>
            <section style={sidebarCard}>
              <div style={sidebarCardTitle}>Need a road-ready spot?</div>
              <div style={sidebarText}>
                If there are no results, post a request. This helps build new RVNB
                areas.
              </div>
              <Link
                href="/request-spot"
                style={{
                  ...smallBtn,
                  width: "100%",
                  marginTop: 14,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  textDecoration: "none",
                }}
              >
                Post a request →
              </Link>
            </section>

            <section style={sidebarCard}>
              <div style={sidebarCardTitle}>Filter Summary</div>

              {filterSummaryItems.length === 0 ? (
                <div style={sidebarText}>
                  No active summary yet. Apply filters to narrow your search.
                </div>
              ) : (
                <div style={summaryList}>
                  {filterSummaryItems.map((item) => (
                    <div key={item.label} style={summaryRow}>
                      <span style={summaryLabel}>{item.label}</span>
                      <span style={summaryValue}>{item.value}</span>
                    </div>
                  ))}
                </div>
              )}

              <button
                style={{ ...smallBtn, width: "100%", marginTop: 14 }}
                onClick={resetAll}
              >
                Clear filters
              </button>
            </section>
          </aside>
        </div>
      </div>
    </main>
  );
}

/** ---------------- Small components ---------------- */
function Check({
  label,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label style={{ ...checkRow, opacity: disabled ? 0.45 : 1 }}>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span>{label}</span>
    </label>
  );
}

/** ---------------- Styles ---------------- */
const wrap: React.CSSProperties = {
  position: "relative",
  overflow: "hidden",
  minHeight: "100vh",
  padding: 24,
  background: `
    linear-gradient(
      to bottom,
      rgba(5, 10, 20, 0.56) 0%,
      rgba(5, 10, 20, 0.68) 18%,
      rgba(6, 11, 21, 0.82) 36%,
      rgba(7, 12, 22, 0.92) 54%,
      rgba(8, 12, 24, 0.97) 72%,
      #0b0f19 100%
    ),
    radial-gradient(
      1000px 700px at 18% 0%,
      rgba(70, 100, 255, 0.14),
      transparent
    ),
    radial-gradient(
      1000px 720px at 88% 8%,
      rgba(60, 130, 255, 0.10),
      transparent
    ),
    url("/rvnb-search-bg.png")
  `,
  backgroundSize: "103% auto",
  backgroundPosition: "center top",
  backgroundRepeat: "no-repeat",
  backgroundAttachment: "scroll",
  color: "white",
};

const pageGlowLeft: React.CSSProperties = {
  position: "absolute",
  top: 160,
  left: -120,
  width: 320,
  height: 680,
  background: "radial-gradient(circle, rgba(52,92,255,0.12) 0%, transparent 70%)",
  pointerEvents: "none",
};

const pageGlowRight: React.CSSProperties = {
  position: "absolute",
  top: 260,
  right: -120,
  width: 320,
  height: 760,
  background: "radial-gradient(circle, rgba(72,145,255,0.10) 0%, transparent 70%)",
  pointerEvents: "none",
};

const pageInner: React.CSSProperties = {
  position: "relative",
  zIndex: 1,
  maxWidth: 1380,
  margin: "0 auto",
};

const hero: React.CSSProperties = {
  display: "flex",
  alignItems: "flex-end",
  justifyContent: "space-between",
  gap: 20,
  paddingBottom: 22,
  flexWrap: "wrap",
};

const heroTitle: React.CSSProperties = {
  fontSize: 46,
  fontWeight: 950,
  margin: 0,
  letterSpacing: -0.8,
};

const heroSub: React.CSSProperties = {
  marginTop: 10,
  opacity: 0.84,
  maxWidth: 860,
  lineHeight: 1.55,
  fontSize: 15,
};

const searchShell: React.CSSProperties = {
  padding: 22,
  borderRadius: 24,
  border: "1px solid rgba(255,255,255,0.12)",
  background:
    "linear-gradient(180deg, rgba(21,28,47,0.74), rgba(14,20,36,0.80))",
  boxShadow:
    "0 20px 46px rgba(0,0,0,0.28), 0 0 0 1px rgba(255,255,255,0.02) inset, inset 0 1px 0 rgba(255,255,255,0.05)",
  backdropFilter: "blur(12px)",
};

const sectionHeader: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 14,
  flexWrap: "wrap",
};

const sectionTitle: React.CSSProperties = {
  margin: 0,
  fontSize: 22,
  fontWeight: 950,
  letterSpacing: -0.3,
};

const sectionSub: React.CSSProperties = {
  marginTop: 6,
  opacity: 0.75,
  fontSize: 14,
};

const sectionSubStrong: React.CSSProperties = {
  marginTop: 8,
  opacity: 0.82,
  fontSize: 14,
  fontWeight: 700,
};

const badge: React.CSSProperties = {
  padding: "6px 10px",
  borderRadius: 999,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(255,255,255,0.07)",
  fontSize: 12,
  fontWeight: 900,
  opacity: 0.95,
  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)",
};

const toolbar: React.CSSProperties = {
  marginTop: 16,
  display: "grid",
  gridTemplateColumns: "1.35fr 0.48fr 0.48fr 0.7fr",
  gap: 14,
};

const dateRow: React.CSSProperties = {
  gridColumn: "1 / -1",
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 14,
};

const label: React.CSSProperties = {
  fontWeight: 850,
  fontSize: 13,
  opacity: 0.95,
};

const input: React.CSSProperties = {
  width: "100%",
  padding: 13,
  marginTop: 8,
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(255,255,255,0.075)",
  color: "white",
  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.035)",
};

const selectFull: React.CSSProperties = {
  width: "100%",
  padding: 13,
  marginTop: 8,
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(255,255,255,0.075)",
  color: "white",
  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.035)",
};

const selectCompact: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(255,255,255,0.075)",
  color: "white",
  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.03)",
};

const compactInput: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  marginTop: 6,
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(255,255,255,0.075)",
  color: "white",
};

const compactSelect: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  marginTop: 6,
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(255,255,255,0.075)",
  color: "white",
};

const optionStyle: React.CSSProperties = {
  backgroundColor: "#0b0f19",
  color: "white",
};

const tinyHelp: React.CSSProperties = {
  opacity: 0.7,
  fontSize: 12,
};

const statusBox: React.CSSProperties = {
  marginTop: 12,
  padding: 12,
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(255,255,255,0.06)",
  fontWeight: 800,
};

const mutedBox: React.CSSProperties = {
  marginTop: 16,
  padding: 16,
  borderRadius: 16,
  border: "1px solid rgba(255,255,255,0.10)",
  background: "rgba(0,0,0,0.20)",
  opacity: 0.94,
};

const readyStateCard: React.CSSProperties = {
  marginTop: 18,
  minHeight: 420,
  borderRadius: 22,
  border: "1px solid rgba(255,255,255,0.10)",
  background:
    "linear-gradient(180deg, rgba(18,24,42,0.78), rgba(10,15,28,0.86))",
  boxShadow:
    "0 20px 44px rgba(0,0,0,0.26), inset 0 1px 0 rgba(255,255,255,0.04)",
  padding: 28,
  display: "flex",
  flexDirection: "column",
  justifyContent: "flex-start",
};

const readyStateEyebrow: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 900,
  textTransform: "uppercase",
  letterSpacing: 0.8,
  opacity: 0.7,
};

const readyStateTitle: React.CSSProperties = {
  margin: "12px 0 10px 0",
  fontSize: 40,
  fontWeight: 950,
  lineHeight: 1.05,
};

const readyStateText: React.CSSProperties = {
  margin: 0,
  maxWidth: 620,
  fontSize: 18,
  lineHeight: 1.6,
  opacity: 0.86,
};

const readyStateActions: React.CSSProperties = {
  display: "flex",
  gap: 12,
  flexWrap: "wrap",
  marginTop: 22,
};

const divider: React.CSSProperties = {
  height: 1,
  background:
    "linear-gradient(90deg, rgba(255,255,255,0.02), rgba(255,255,255,0.12), rgba(255,255,255,0.02))",
  marginTop: 18,
};

const ghostBtn: React.CSSProperties = {
  display: "inline-block",
  padding: "10px 13px",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.14)",
  background: "rgba(255,255,255,0.06)",
  color: "white",
  fontWeight: 900,
  textDecoration: "none",
  whiteSpace: "nowrap",
  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)",
};

const smallBtn: React.CSSProperties = {
  padding: "10px 13px",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.14)",
  background: "rgba(255,255,255,0.08)",
  color: "white",
  fontWeight: 900,
  cursor: "pointer",
  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.03)",
};

const clearBtn: React.CSSProperties = {
  padding: "10px 13px",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.14)",
  background: "rgba(255,255,255,0.055)",
  color: "white",
  fontWeight: 900,
  cursor: "pointer",
  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.03)",
};

const advancedHeaderRow: React.CSSProperties = {
  marginTop: 20,
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 14,
  flexWrap: "wrap",
};

const advancedTitle: React.CSSProperties = {
  fontSize: 29,
  fontWeight: 950,
  lineHeight: 1,
  letterSpacing: -0.5,
};

const activeBadge: React.CSSProperties = {
  padding: "8px 12px",
  borderRadius: 999,
  border: "1px solid rgba(110,180,255,0.18)",
  background: "rgba(80,140,255,0.10)",
  fontSize: 13,
  fontWeight: 900,
};

const advancedShell: React.CSSProperties = {
  marginTop: 16,
  display: "grid",
  gridTemplateColumns: "1.68fr 0.56fr",
  gap: 20,
  alignItems: "start",
};

const advancedLeft: React.CSSProperties = {
  display: "grid",
  gap: 14,
};

const advancedRight: React.CSSProperties = {
  display: "grid",
  gap: 14,
};

const advancedTopRow: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 14,
};

const miniCard: React.CSSProperties = {
  padding: 16,
  borderRadius: 20,
  border: "1px solid rgba(255,255,255,0.10)",
  background: "rgba(0,0,0,0.18)",
  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.03)",
};

const wideFilterCard: React.CSSProperties = {
  padding: 16,
  borderRadius: 20,
  border: "1px solid rgba(255,255,255,0.10)",
  background: "rgba(0,0,0,0.18)",
  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.03)",
};

const miniTitle: React.CSSProperties = {
  fontWeight: 950,
  opacity: 0.97,
  letterSpacing: -0.2,
};

const miniRow2: React.CSSProperties = {
  marginTop: 10,
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 12,
};

const utilitySplit: React.CSSProperties = {
  marginTop: 14,
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 18,
};

const chipRow: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 10,
  marginTop: 10,
};

const toggleChip: React.CSSProperties = {
  padding: "10px 14px",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(255,255,255,0.05)",
  color: "white",
  fontWeight: 800,
  cursor: "pointer",
};

const toggleChipActive: React.CSSProperties = {
  ...toggleChip,
  background: "rgba(255,255,255,0.14)",
  border: "1px solid rgba(255,255,255,0.20)",
};

const amenityGrid: React.CSSProperties = {
  marginTop: 12,
  display: "grid",
  gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
  gap: 10,
};

const checkGrid: React.CSSProperties = {
  marginTop: 10,
  display: "grid",
  gridTemplateColumns: "1fr 1fr 1fr",
  gap: 10,
};

const checkRow: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.10)",
  background: "rgba(255,255,255,0.04)",
  minHeight: 46,
};

const contentGrid: React.CSSProperties = {
  marginTop: 22,
  display: "grid",
  gridTemplateColumns: "minmax(0, 1.74fr) minmax(300px, 0.58fr)",
  gap: 20,
  alignItems: "start",
};

const resultsCard: React.CSSProperties = {
  padding: 20,
  borderRadius: 24,
  border: "1px solid rgba(255,255,255,0.12)",
  background:
    "linear-gradient(180deg, rgba(20,27,45,0.76), rgba(12,18,31,0.83))",
  boxShadow:
    "0 20px 46px rgba(0,0,0,0.28), 0 0 0 1px rgba(255,255,255,0.02) inset, inset 0 1px 0 rgba(255,255,255,0.05)",
};

const resultsHeader: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-end",
  gap: 14,
  flexWrap: "wrap",
};

const resultsTitle: React.CSSProperties = {
  margin: 0,
  fontSize: 40,
  fontWeight: 950,
  lineHeight: 1,
  letterSpacing: -0.9,
};

const sortPill: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.10)",
  background: "rgba(255,255,255,0.055)",
  fontSize: 13,
  color: "rgba(255,255,255,0.92)",
};

const rigBar: React.CSSProperties = {
  marginTop: 16,
  display: "grid",
  gridTemplateColumns: "1.15fr 0.62fr 0.62fr 0.42fr 0.74fr",
  gap: 12,
  alignItems: "end",
  padding: 14,
  borderRadius: 18,
  border: "1px solid rgba(255,255,255,0.10)",
  background:
    "linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.03))",
  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.03)",
};

const rigToggle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  paddingTop: 8,
  fontWeight: 850,
};

const rigField: React.CSSProperties = {
  minWidth: 0,
};

const compatCheckBtn: React.CSSProperties = {
  minWidth: 260,
  padding: "14px 20px",
  borderRadius: 16,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(255,255,255,0.08)",
  color: "white",
  fontWeight: 900,
  fontSize: 16,
  cursor: "pointer",
  whiteSpace: "nowrap",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
};

const resultsGrid: React.CSSProperties = {
  marginTop: 18,
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 18,
};

const listingCard: React.CSSProperties = {
  padding: 18,
  borderRadius: 22,
  border: "1px solid rgba(255,255,255,0.12)",
  background:
    "linear-gradient(180deg, rgba(20,24,43,0.94), rgba(12,16,31,0.97))",
  boxShadow:
    "0 18px 34px rgba(0,0,0,0.24), 0 0 0 1px rgba(255,255,255,0.02) inset, inset 0 1px 0 rgba(255,255,255,0.05)",
};

const listingImageWrap: React.CSSProperties = {
  position: "relative",
  width: "100%",
  height: 178,
  borderRadius: 16,
  overflow: "hidden",
  marginBottom: 14,
  border: "1px solid rgba(255,255,255,0.08)",
  boxShadow: "0 10px 24px rgba(0,0,0,0.24)",
};

const listingImage: React.CSSProperties = {
  width: "100%",
  height: "100%",
  objectFit: "cover",
  transform: "scale(1.02)",
};

const imageOverlay: React.CSSProperties = {
  position: "absolute",
  inset: 0,
  background:
    "linear-gradient(to bottom, rgba(3,7,18,0.08), rgba(4,8,18,0.34) 46%, rgba(4,8,18,0.72))",
};

const imageTopShade: React.CSSProperties = {
  position: "absolute",
  inset: 0,
  background:
    "radial-gradient(circle at top left, rgba(255,255,255,0.16), transparent 36%)",
};

const listingImageAccent: React.CSSProperties = {
  position: "absolute",
  inset: 0,
  boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.04)",
  pointerEvents: "none",
};

const imagePriceBadge: React.CSSProperties = {
  position: "absolute",
  bottom: 12,
  right: 12,
  padding: "8px 11px",
  borderRadius: 12,
  background: "rgba(6,10,20,0.74)",
  border: "1px solid rgba(255,255,255,0.18)",
  fontWeight: 950,
  fontSize: 13,
  color: "white",
  boxShadow: "0 10px 24px rgba(0,0,0,0.22)",
  backdropFilter: "blur(8px)",
};

const listingTop: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  alignItems: "flex-start",
};

const listingTitle: React.CSSProperties = {
  fontWeight: 950,
  fontSize: 20,
  lineHeight: 1.12,
  letterSpacing: -0.35,
};

const listingLocation: React.CSSProperties = {
  opacity: 0.82,
  marginTop: 7,
  fontSize: 14,
};

const pillRowCompact: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 8,
  marginTop: 13,
};

const pill: React.CSSProperties = {
  padding: "6px 10px",
  borderRadius: 999,
  border: "1px solid rgba(255,255,255,0.11)",
  background: "rgba(255,255,255,0.055)",
  fontSize: 12,
  fontWeight: 800,
  opacity: 0.96,
};

const pillStrong: React.CSSProperties = {
  ...pill,
  background: "rgba(255,255,255,0.11)",
  border: "1px solid rgba(255,255,255,0.15)",
};

const compatSection: React.CSSProperties = {
  marginTop: 15,
};

const compatLabel: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 900,
  letterSpacing: 0.45,
  opacity: 0.8,
  marginBottom: 4,
  textTransform: "uppercase",
};

const compatPill: React.CSSProperties = {
  padding: "6px 10px",
  borderRadius: 999,
  border: "1px solid rgba(110,180,255,0.22)",
  background: "rgba(80,140,255,0.11)",
  color: "white",
  fontSize: 12,
  fontWeight: 900,
  opacity: 0.98,
};

const compatPositive: React.CSSProperties = {
  marginTop: 14,
  padding: "11px 12px",
  borderRadius: 13,
  border: "1px solid rgba(82,205,141,0.22)",
  background: "rgba(47,142,95,0.16)",
  color: "#bff3d4",
  fontWeight: 900,
  fontSize: 13,
};

const compatWarning: React.CSSProperties = {
  marginTop: 14,
  padding: "11px 12px",
  borderRadius: 13,
  border: "1px solid rgba(255,184,80,0.22)",
  background: "rgba(150,108,34,0.16)",
  color: "#ffdca3",
  fontWeight: 900,
  fontSize: 13,
};

const descBox: React.CSSProperties = {
  marginTop: 13,
  padding: 13,
  borderRadius: 14,
  border: "1px solid rgba(255,255,255,0.09)",
  background: "rgba(255,255,255,0.05)",
  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.025)",
};

const descHeading: React.CSSProperties = {
  fontWeight: 900,
  marginBottom: 6,
  fontSize: 13,
};

const descText: React.CSSProperties = {
  opacity: 0.9,
  lineHeight: 1.46,
  fontSize: 13,
};

const listingFooter: React.CSSProperties = {
  display: "flex",
  gap: 10,
  marginTop: 16,
  alignItems: "center",
  flexWrap: "wrap",
};

const primaryLinkBtn: React.CSSProperties = {
  display: "inline-block",
  padding: "12px 15px",
  borderRadius: 13,
  border: "1px solid rgba(255,255,255,0.16)",
  background:
    "linear-gradient(180deg, rgba(255,255,255,0.14), rgba(255,255,255,0.10))",
  color: "white",
  fontWeight: 950,
  textDecoration: "none",
  boxShadow: "0 10px 22px rgba(0,0,0,0.18), inset 0 1px 0 rgba(255,255,255,0.04)",
};

const sidebarStack: React.CSSProperties = {
  display: "grid",
  gap: 18,
  position: "sticky",
  top: 18,
};

const sidebarCard: React.CSSProperties = {
  padding: 17,
  borderRadius: 20,
  border: "1px solid rgba(255,255,255,0.12)",
  background:
    "linear-gradient(180deg, rgba(20,27,44,0.72), rgba(12,18,31,0.80))",
  boxShadow:
    "0 14px 30px rgba(0,0,0,0.20), 0 0 0 1px rgba(255,255,255,0.02) inset, inset 0 1px 0 rgba(255,255,255,0.045)",
};

const sidebarCardTitle: React.CSSProperties = {
  fontSize: 18,
  fontWeight: 950,
  marginBottom: 10,
  letterSpacing: -0.2,
};

const sidebarText: React.CSSProperties = {
  opacity: 0.84,
  lineHeight: 1.52,
  fontSize: 14,
};

const summaryList: React.CSSProperties = {
  display: "grid",
  gap: 10,
};

const summaryRow: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  padding: "11px 12px",
  borderRadius: 13,
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.08)",
};

const summaryLabel: React.CSSProperties = {
  opacity: 0.72,
  fontWeight: 800,
};

const summaryValue: React.CSSProperties = {
  fontWeight: 900,
};

const mapPreviewShell: React.CSSProperties = {
  borderRadius: 16,
  overflow: "hidden",
  border: "1px solid rgba(255,255,255,0.08)",
  background:
    "radial-gradient(800px 300px at 50% 30%, rgba(90,130,255,0.10), transparent), linear-gradient(180deg, rgba(14,20,38,0.98), rgba(22,28,44,0.98))",
  minHeight: 190,
  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.03)",
};

const mapGrid: React.CSSProperties = {
  position: "relative",
  width: "100%",
  height: 190,
  background:
    "linear-gradient(rgba(255,255,255,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.06) 1px, transparent 1px)",
  backgroundSize: "42px 42px",
};

const mapPin: React.CSSProperties = {
  position: "absolute",
  borderRadius: "50%",
  boxShadow: "0 0 0 4px rgba(255,255,255,0.08), 0 0 18px rgba(255,255,255,0.16)",
};