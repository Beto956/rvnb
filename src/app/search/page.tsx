"use client";

export const dynamic = "force-dynamic";

import React, { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  addDoc,
  collection,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
} from "firebase/firestore";
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
  pricePerNight?: number; // legacy fallback
  pricingType?: PricingType;

  maxLengthFt?: number;
  hookups?: Hookups;

  power?: string; // "None" | "30A" | "50A" | "30A/50A"
  water?: string; // "None" | "Yes"
  sewer?: string; // "None" | "Yes" | "Dump station"
  laundry?: string; // "None" | "Washer/Dryer" | "Wash & Fold" | "Both"

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

type SpotRequestDoc = {
  locationText?: string;
  city?: string;
  state?: string;

  startDate?: string;
  endDate?: string;

  hookupsNeeded?: Hookups;
  budgetMax?: number;

  rvDetails?: string;
  note?: string;

  status?: "open" | "closed";
  createdAt?: any;
};

type SpotRequestUI = {
  id: string;
  locationText: string;
  city: string;
  state: string;
  startDate: string;
  endDate: string;
  hookupsNeeded: Hookups;
  budgetMax: number | null;
  rvDetails: string;
  note: string;
  status: "open" | "closed";
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

function toRequestUI(id: string, d: SpotRequestDoc): SpotRequestUI {
  return {
    id,
    locationText: (d.locationText ?? "").toString(),
    city: (d.city ?? "").toString(),
    state: (d.state ?? "").toString(),
    startDate: (d.startDate ?? "").toString(),
    endDate: (d.endDate ?? "").toString(),
    hookupsNeeded: ((d.hookupsNeeded ?? "None") as Hookups) || "None",
    budgetMax: typeof d.budgetMax === "number" ? d.budgetMax : null,
    rvDetails: (d.rvDetails ?? "").toString(),
    note: (d.note ?? "").toString(),
    status: ((d.status ?? "open") as "open" | "closed") || "open",
  };
}

/** ---------------- Page Wrapper (Suspense-safe) ---------------- */
export default function SearchPage() {
  return (
    <Suspense
      fallback={<div style={{ minHeight: "100vh", background: "#0b0f19" }} />}
    >
      <SearchPageClient />
    </Suspense>
  );
}

/** ---------------- Actual Client Page (uses useSearchParams) ---------------- */
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

  /** Sort */
  const [sortMode, setSortMode] = useState<SortMode>("Newest");

  /** Data */
  const [loading, setLoading] = useState(true);
  const [listings, setListings] = useState<ListingUI[]>([]);
  const [error, setError] = useState("");

  /** Request system */
  const [showRequestForm, setShowRequestForm] = useState(false);
  const [requestSaving, setRequestSaving] = useState(false);
  const [requestMsg, setRequestMsg] = useState("");

  const [reqLocationText, setReqLocationText] = useState("");
  const [reqCity, setReqCity] = useState("");
  const [reqState, setReqState] = useState(paramState || "");
  const [reqStart, setReqStart] = useState("");
  const [reqEnd, setReqEnd] = useState("");
  const [reqHookups, setReqHookups] = useState<Hookups>("None");
  const [reqBudget, setReqBudget] = useState<number>(0);
  const [reqRvDetails, setReqRvDetails] = useState("");
  const [reqNote, setReqNote] = useState("");

  const [recentRequests, setRecentRequests] = useState<SpotRequestUI[]>([]);
  const [requestsLoading, setRequestsLoading] = useState(false);

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

  async function loadRecentRequests() {
    setRequestsLoading(true);
    try {
      const q = query(collection(db, "spotRequests"), orderBy("createdAt", "desc"));
      const snap = await getDocs(q);
      const rows = snap.docs.map((d) => toRequestUI(d.id, d.data() as SpotRequestDoc));
      setRecentRequests(rows.slice(0, 50));
    } catch (e) {
      console.error(e);
    } finally {
      setRequestsLoading(false);
    }
  }

  useEffect(() => {
    loadListings();
    loadRecentRequests();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (stateCode && stateCode.length === 2) setReqState(stateCode);
  }, [stateCode]);

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
        return 0; // keep Firestore order for "Newest"
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

  useEffect(() => {
    if (!loading && filtered.length === 0 && activeFiltersCount > 0) {
      setShowRequestForm(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, filtered.length]);

  function pushParams() {
    const params = new URLSearchParams();

    const s = normalizeState(stateCode);
    if (s) params.set("state", s);
    if (qText.trim()) params.set("q", qText.trim());
    if (Number(maxPrice) > 0)
      params.set("maxPrice", String(Math.max(0, Number(maxPrice))));
    if (hookups !== "Any") params.set("hookups", hookups);

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
    setShowRequestForm(false);

    router.push("/search");
  }

  async function submitRequest() {
    setRequestMsg("");

    const cleanLoc = reqLocationText.trim().slice(0, 80);
    const cleanCity = reqCity.trim().slice(0, 40);
    const cleanState = normalizeState(reqState);
    const cleanRv = reqRvDetails.trim().slice(0, 200);
    const cleanNote = reqNote.trim().slice(0, 500);
    const cleanBudget = Number(reqBudget) || 0;

    if (!cleanLoc && (!cleanCity || !cleanState)) {
      setRequestMsg("⚠️ Add a location (ex: McAllen, TX) or city + state.");
      return;
    }
    if (!cleanRv) {
      setRequestMsg("⚠️ Add RV details (ex: 2 bumper pulls: 32ft + 34ft).");
      return;
    }
    if (reqStart && reqEnd) {
      if (!(new Date(reqEnd) > new Date(reqStart))) {
        setRequestMsg("⚠️ End date must be after start date.");
        return;
      }
    }

    setRequestSaving(true);
    try {
      await addDoc(collection(db, "spotRequests"), {
        locationText: cleanLoc,
        city: cleanCity,
        state: cleanState,

        startDate: reqStart || "",
        endDate: reqEnd || "",

        hookupsNeeded: reqHookups,
        budgetMax: cleanBudget > 0 ? cleanBudget : 0,

        rvDetails: cleanRv,
        note: cleanNote,

        status: "open",
        createdAt: serverTimestamp(),
      });

      setRequestMsg("✅ Request posted! Local hosts will be able to see it.");
      setReqLocationText("");
      setReqCity("");
      setReqRvDetails("");
      setReqNote("");
      setReqBudget(0);

      await loadRecentRequests();
    } catch (e) {
      console.error(e);
      setRequestMsg("❌ Could not post request. Please try again.");
    } finally {
      setRequestSaving(false);
    }
  }

  const recentForArea = useMemo(() => {
    const s = normalizeState(stateCode) || normalizeState(reqState);
    const q = qText.trim().toLowerCase();

    return recentRequests
      .filter((r) => r.status === "open")
      .filter((r) => {
        if (s && normalizeState(r.state) !== s) return false;
        if (!q) return true;

        const hay =
          `${r.locationText} ${r.city} ${r.state} ${r.rvDetails} ${r.note}`.toLowerCase();
        return hay.includes(q) || (r.city || "").toLowerCase().includes(q);
      })
      .slice(0, 6);
  }, [recentRequests, stateCode, reqState, qText]);

  return (
    <main style={wrap}>
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

      <section style={card}>
        <div style={sectionHeader}>
          <div>
            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <h2 style={sectionTitle}>Search</h2>
              <span style={badge}>{activeFiltersCount} filters</span>
            </div>
            <p style={sectionSub}>
              Use the basics up top. Expand advanced filters to find the exact spot.
            </p>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "flex-end" }}>
            <button style={smallBtn} onClick={pushParams} title="Update URL params (basic filters)">
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
              <option style={optionStyle} value="Any">Any</option>
              <option style={optionStyle} value="Full">Full</option>
              <option style={optionStyle} value="Partial">Partial</option>
              <option style={optionStyle} value="None">None</option>
            </select>
          </div>

          <div style={dateRow}>
            <div>
              <label style={label}>Check-in (optional)</label>
              <input style={input} type="date" value={checkIn} onChange={(e) => setCheckIn(e.target.value)} />
            </div>
            <div>
              <label style={label}>Check-out (optional)</label>
              <input style={input} type="date" value={checkOut} onChange={(e) => setCheckOut(e.target.value)} />
            </div>
          </div>
        </div>

        {showAdvanced && (
          <div style={{ marginTop: 16 }}>
            <div style={divider} />

            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
              <div>
                <div style={{ fontWeight: 950, fontSize: 16 }}>Advanced filters</div>
                <div style={tinyHelp}>These make this page feel different than the homepage search.</div>
              </div>

              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <div>
                  <div style={tinyHelp}>Sort by</div>
                  <select
                    style={{ ...selectFull, marginTop: 6, minWidth: 160 }}
                    value={sortMode}
                    onChange={(e) => setSortMode(e.target.value as SortMode)}
                  >
                    <option style={optionStyle} value="Newest">Newest</option>
                    <option style={optionStyle} value="PriceLow">Price: low → high</option>
                    <option style={optionStyle} value="PriceHigh">Price: high → low</option>
                  </select>
                </div>
              </div>
            </div>

            <div style={advancedGrid}>
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
                      onChange={(e) => setMinLengthFt(Math.max(0, Number(e.target.value)))}
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
                      onChange={(e) => setMaxLengthFt(Math.max(0, Number(e.target.value)))}
                      placeholder="0"
                    />
                  </div>
                </div>
                <div style={tinyHelp}>Uses the host’s “Max RV length allowed”.</div>
              </div>

              <div style={miniCard}>
                <div style={miniTitle}>Pricing</div>
                <div style={{ marginTop: 10 }}>
                  <div style={tinyHelp}>Pricing type</div>
                  <select
                    style={{ ...selectFull, marginTop: 6 }}
                    value={pricingType}
                    onChange={(e) => setPricingType(e.target.value as PricingType | "Any")}
                  >
                    <option style={optionStyle} value="Any">Any</option>
                    <option style={optionStyle} value="Night">Night</option>
                    <option style={optionStyle} value="Weekly">Weekly</option>
                    <option style={optionStyle} value="Monthly">Monthly</option>
                  </select>
                </div>
                <div style={tinyHelp}>Example: show only weekly / monthly spots.</div>
              </div>

              <div style={miniCard}>
                <div style={miniTitle}>Utilities</div>

                <div style={checkGrid}>
                  <Check label="💧 Water required" checked={requireWater} onChange={setRequireWater} />
                  <Check label="🚽 Sewer required" checked={requireSewer} onChange={setRequireSewer} />
                  <Check
                    label="♻️ Accept dump station"
                    checked={acceptDumpStation}
                    onChange={setAcceptDumpStation}
                    disabled={!requireSewer}
                  />
                </div>

                <div style={{ marginTop: 10 }}>
                  <div style={tinyHelp}>Power</div>
                  <select
                    style={{ ...selectFull, marginTop: 6 }}
                    value={powerNeed}
                    onChange={(e) => setPowerNeed(e.target.value as any)}
                  >
                    <option style={optionStyle} value="Any">Any</option>
                    <option style={optionStyle} value="30A">30A</option>
                    <option style={optionStyle} value="50A">50A</option>
                  </select>
                </div>

                <div style={{ marginTop: 10 }}>
                  <div style={tinyHelp}>Laundry</div>
                  <select
                    style={{ ...selectFull, marginTop: 6 }}
                    value={laundryNeed}
                    onChange={(e) => setLaundryNeed(e.target.value as any)}
                  >
                    <option style={optionStyle} value="Any">Any</option>
                    <option style={optionStyle} value="Washer/Dryer">Washer/Dryer</option>
                    <option style={optionStyle} value="Wash & Fold">Wash & Fold</option>
                    <option style={optionStyle} value="Both">Both</option>
                  </select>
                </div>
              </div>

              <div style={miniCard}>
                <div style={miniTitle}>Amenities</div>
                <div style={checkGrid}>
                  <Check label="📶 Wi-Fi" checked={amenWifi} onChange={setAmenWifi} />
                  <Check label="🐶 Pets allowed" checked={amenPets} onChange={setAmenPets} />
                  <Check label="🚿 Showers" checked={amenShowers} onChange={setAmenShowers} />
                  <Check label="🚻 Bathrooms" checked={amenBathrooms} onChange={setAmenBathrooms} />
                  <Check label="🏋️ Gym" checked={amenGym} onChange={setAmenGym} />
                  <Check label="🔥 Fire pit" checked={amenFirePit} onChange={setAmenFirePit} />
                  <Check label="🚚 Pull-through" checked={amenPullThrough} onChange={setAmenPullThrough} />
                  <Check label="📹 Security cameras" checked={amenSecurity} onChange={setAmenSecurity} />
                  <Check label="🗑️ Trash pickup" checked={amenTrash} onChange={setAmenTrash} />
                  <Check label="🧺 Picnic table" checked={amenPicnic} onChange={setAmenPicnic} />
                </div>
              </div>
            </div>

            <div style={{ marginTop: 10, opacity: 0.7, fontSize: 12 }}>
              Note: Date availability checks will come later when we fully integrate booking overlap logic into search.
            </div>
          </div>
        )}
      </section>

      <div style={grid}>
        <section style={card}>
          <div style={sectionHeader}>
            <div>
              <h2 style={sectionTitle}>Results</h2>
              <p style={sectionSub}>
                {loading ? "Loading…" : `${filtered.length} match${filtered.length === 1 ? "" : "es"}`}
              </p>
            </div>

            <button style={smallBtn} onClick={loadListings} disabled={loading}>
              {loading ? "Refreshing…" : "Refresh"}
            </button>
          </div>

          {error && <div style={statusBox}>{error}</div>}

          {loading ? (
            <div style={mutedBox}>Loading listings…</div>
          ) : filtered.length === 0 ? (
            <div style={mutedBox}>
              <div style={{ fontWeight: 950, marginBottom: 6 }}>No listings found</div>
              <div style={{ opacity: 0.85, lineHeight: 1.4 }}>
                Try adjusting filters — or post a request to build supply in that area.
              </div>

              <button style={{ ...smallBtn, marginTop: 12 }} onClick={() => setShowRequestForm(true)}>
                Post a request
              </button>
            </div>
          ) : (
            <div style={{ display: "grid", gap: 12, marginTop: 12 }}>
              {filtered.map((spot) => (
                <div key={spot.id} style={listingCard}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                    <div>
                      <div style={{ fontWeight: 950, fontSize: 18 }}>{spot.title}</div>
                      <div style={{ opacity: 0.8 }}>
                        {spot.city}, {spot.state}
                      </div>
                    </div>

                    <div style={pillPrice}>
                      ${spot.price} /{" "}
                      {spot.pricingType === "Night"
                        ? "night"
                        : spot.pricingType === "Weekly"
                        ? "week"
                        : "month"}
                    </div>
                  </div>

                  <div style={pillRow}>
                    <span style={pill}>Hookups: {spot.hookups}</span>
                    <span style={pill}>Max: {spot.maxLengthFt} ft</span>
                    <span style={pill}>Power: {spot.power}</span>
                    <span style={pill}>Water: {spot.water}</span>
                    <span style={pill}>Sewer: {spot.sewer}</span>
                    <span style={pill}>Laundry: {spot.laundry}</span>

                    {spot.showers && <span style={pill}>Showers</span>}
                    {spot.bathrooms && <span style={pill}>Bathrooms</span>}
                    {spot.gym && <span style={pill}>Gym</span>}
                    {spot.wifi && <span style={pill}>Wi-Fi</span>}
                    {spot.petsAllowed && <span style={pill}>Pets</span>}
                    {spot.firePit && <span style={pill}>Fire pit</span>}
                    {spot.pullThrough && <span style={pill}>Pull-through</span>}
                  </div>

                  {spot.description && (
                    <div style={descBox}>
                      <div style={{ fontWeight: 900, marginBottom: 6 }}>Description</div>
                      <div style={{ opacity: 0.9, lineHeight: 1.4 }}>{spot.description}</div>
                    </div>
                  )}

                  {spot.nearbyAttractions && (
                    <div style={descBox}>
                      <div style={{ fontWeight: 900, marginBottom: 6 }}>Nearby Attractions</div>
                      <div style={{ opacity: 0.9, lineHeight: 1.4 }}>{spot.nearbyAttractions}</div>
                    </div>
                  )}

                  {(checkIn || checkOut) && (
                    <div style={{ marginTop: 10, opacity: 0.75, fontSize: 12 }}>
                      Dates: <b>{checkIn || "—"}</b> to <b>{checkOut || "—"}</b>
                    </div>
                  )}

                  <div style={{ display: "flex", gap: 10, marginTop: 12, alignItems: "center" }}>
                    <Link href={`/listings/${spot.id}`} style={primaryLinkBtn}>
                      View listing →
                    </Link>
                    <span style={tinyHelp}>ID: {spot.id}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section style={card}>
          <div style={sectionHeader}>
            <div>
              <h2 style={sectionTitle}>Can’t find a spot?</h2>
              <p style={sectionSub}>
                Post a request so hosts (and locals) can help. This builds supply in new areas.
              </p>
            </div>

            <button style={smallBtn} onClick={() => setShowRequestForm((v) => !v)}>
              {showRequestForm ? "Hide" : "Open"}
            </button>
          </div>

          {showRequestForm ? (
            <>
              {requestMsg && <div style={statusBox}>{requestMsg}</div>}

              <div style={fieldBlock}>
                <label style={label}>Location (quick)</label>
                <input
                  style={input}
                  value={reqLocationText}
                  onChange={(e) => setReqLocationText(e.target.value)}
                  placeholder="Example: McAllen, TX"
                  maxLength={80}
                />
                <div style={tinyHelp}>You can also fill City + State below instead.</div>
              </div>

              <div style={row2}>
                <div style={fieldBlock}>
                  <label style={label}>City</label>
                  <input
                    style={input}
                    value={reqCity}
                    onChange={(e) => setReqCity(e.target.value)}
                    placeholder="McAllen"
                    maxLength={40}
                  />
                </div>

                <div style={fieldBlock}>
                  <label style={label}>State</label>
                  <input
                    style={input}
                    value={reqState}
                    onChange={(e) => setReqState(e.target.value.toUpperCase().trim())}
                    placeholder="TX"
                    maxLength={2}
                  />
                </div>
              </div>

              <div style={row2}>
                <div style={fieldBlock}>
                  <label style={label}>Start date (optional)</label>
                  <input style={input} type="date" value={reqStart} onChange={(e) => setReqStart(e.target.value)} />
                </div>
                <div style={fieldBlock}>
                  <label style={label}>End date (optional)</label>
                  <input style={input} type="date" value={reqEnd} onChange={(e) => setReqEnd(e.target.value)} />
                </div>
              </div>

              <div style={fieldBlock}>
                <label style={label}>RV details</label>
                <input
                  style={input}
                  value={reqRvDetails}
                  onChange={(e) => setReqRvDetails(e.target.value)}
                  placeholder="Example: 2 bumper pulls — 32ft and 34ft. Staying ~3 months."
                  maxLength={200}
                />
              </div>

              <div style={row2}>
                <div style={fieldBlock}>
                  <label style={label}>Hookups needed</label>
                  <select
                    style={selectFull}
                    value={reqHookups}
                    onChange={(e) => setReqHookups(e.target.value as Hookups)}
                  >
                    <option style={optionStyle} value="None">None</option>
                    <option style={optionStyle} value="Partial">Partial</option>
                    <option style={optionStyle} value="Full">Full</option>
                  </select>
                </div>

                <div style={fieldBlock}>
                  <label style={label}>Max budget (optional)</label>
                  <input
                    style={input}
                    type="number"
                    min={0}
                    value={reqBudget}
                    onChange={(e) => setReqBudget(Math.max(0, Number(e.target.value)))}
                    placeholder="0"
                  />
                </div>
              </div>

              <div style={fieldBlock}>
                <label style={label}>Note (optional)</label>
                <textarea
                  style={textarea}
                  value={reqNote}
                  onChange={(e) => setReqNote(e.target.value)}
                  placeholder="Example: Will be working locally and need long-term accommodations. Can arrive evenings."
                  maxLength={500}
                />
                <div style={counterRow}>
                  <span style={tinyHelp}>Keep it short and clear.</span>
                  <span style={tinyHelp}>{reqNote.length}/500</span>
                </div>
              </div>

              <button
                style={{ ...btn, opacity: requestSaving ? 0.7 : 1 }}
                disabled={requestSaving}
                onClick={submitRequest}
              >
                {requestSaving ? "Posting…" : "Post Request"}
              </button>

              <div style={divider} />

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 10 }}>
                <div>
                  <div style={{ fontWeight: 950 }}>Recent open requests</div>
                  <div style={tinyHelp}>Shown for your current search area (best-effort).</div>
                </div>

                <button style={smallBtn} onClick={loadRecentRequests} disabled={requestsLoading}>
                  {requestsLoading ? "Refreshing…" : "Refresh"}
                </button>
              </div>

              {recentForArea.length === 0 ? (
                <div style={mutedBox}>No open requests found for this area yet.</div>
              ) : (
                <div style={{ display: "grid", gap: 12, marginTop: 12 }}>
                  {recentForArea.map((r) => (
                    <div key={r.id} style={listingCard}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                        <div style={{ fontWeight: 950 }}>
                          {r.locationText || `${r.city}, ${r.state}`}
                        </div>
                        <span style={pill}>Open</span>
                      </div>

                      <div style={{ marginTop: 8, opacity: 0.9, lineHeight: 1.4 }}>
                        <b>RV:</b> {r.rvDetails || "—"}
                      </div>

                      <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <span style={pill}>Hookups: {r.hookupsNeeded}</span>
                        {r.budgetMax && r.budgetMax > 0 && <span style={pill}>Budget: ${r.budgetMax}</span>}
                        {(r.startDate || r.endDate) && (
                          <span style={pill}>
                            Dates: {r.startDate || "—"} → {r.endDate || "—"}
                          </span>
                        )}
                      </div>

                      {r.note && (
                        <div style={{ marginTop: 10, opacity: 0.85, fontSize: 13, lineHeight: 1.4 }}>
                          {r.note}
                        </div>
                      )}

                      <div style={{ marginTop: 10, opacity: 0.65, fontSize: 12 }}>
                        Request ID: {r.id}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div style={mutedBox}>
              Click <b>Open</b> to post a request if you can’t find anything.
            </div>
          )}
        </section>
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
  minHeight: "100vh",
  padding: 24,
  background: "#0b0f19",
  color: "white",
};

const hero: React.CSSProperties = {
  display: "flex",
  alignItems: "flex-end",
  justifyContent: "space-between",
  gap: 16,
  maxWidth: 1200,
  margin: "0 auto",
  paddingBottom: 16,
};

const heroTitle: React.CSSProperties = { fontSize: 44, fontWeight: 950, margin: 0 };
const heroSub: React.CSSProperties = { marginTop: 10, opacity: 0.8, maxWidth: 820, lineHeight: 1.5 };

const grid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 18,
  maxWidth: 1200,
  margin: "18px auto 0",
};

const card: React.CSSProperties = {
  padding: 20,
  borderRadius: 18,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(255,255,255,0.05)",
};

const sectionHeader: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 12,
};

const sectionTitle: React.CSSProperties = { margin: 0, fontSize: 20, fontWeight: 900 };
const sectionSub: React.CSSProperties = { marginTop: 6, opacity: 0.75 };

const badge: React.CSSProperties = {
  padding: "6px 10px",
  borderRadius: 999,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(255,255,255,0.06)",
  fontSize: 12,
  fontWeight: 900,
  opacity: 0.95,
};

const toolbar: React.CSSProperties = {
  marginTop: 14,
  display: "grid",
  gridTemplateColumns: "1.3fr 0.5fr 0.5fr 0.6fr",
  gap: 12,
};

const dateRow: React.CSSProperties = {
  gridColumn: "1 / -1",
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 12,
};

const row2: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 140px",
  gap: 12,
};

const fieldBlock: React.CSSProperties = { marginTop: 14 };

const label: React.CSSProperties = { fontWeight: 800 };

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

const selectFull: React.CSSProperties = {
  width: "100%",
  padding: 12,
  marginTop: 8,
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.15)",
  background: "rgba(255,255,255,0.08)",
  color: "white",
};

const optionStyle: React.CSSProperties = { backgroundColor: "#0b0f19", color: "white" };

const tinyHelp: React.CSSProperties = { opacity: 0.7, fontSize: 12 };

const counterRow: React.CSSProperties = { display: "flex", justifyContent: "space-between", marginTop: 8 };

const statusBox: React.CSSProperties = {
  marginTop: 12,
  padding: 12,
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(255,255,255,0.06)",
  fontWeight: 800,
};

const mutedBox: React.CSSProperties = {
  marginTop: 14,
  padding: 14,
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.10)",
  background: "rgba(0,0,0,0.18)",
  opacity: 0.9,
};

const divider: React.CSSProperties = { height: 1, background: "rgba(255,255,255,0.10)", marginTop: 18 };

const btn: React.CSSProperties = {
  marginTop: 18,
  padding: 14,
  width: "100%",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.15)",
  background: "rgba(255,255,255,0.12)",
  color: "white",
  fontWeight: 950,
  cursor: "pointer",
};

const listingCard: React.CSSProperties = {
  padding: 16,
  borderRadius: 14,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(0,0,0,0.22)",
};

const pillRow: React.CSSProperties = { display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12 };

const pill: React.CSSProperties = {
  padding: "6px 10px",
  borderRadius: 999,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(255,255,255,0.06)",
  fontSize: 12,
  fontWeight: 800,
  opacity: 0.95,
};

const pillPrice: React.CSSProperties = {
  padding: "8px 12px",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(255,255,255,0.06)",
  fontWeight: 950,
  whiteSpace: "nowrap",
};

const descBox: React.CSSProperties = {
  marginTop: 12,
  padding: 12,
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.10)",
  background: "rgba(255,255,255,0.05)",
};

const primaryLinkBtn: React.CSSProperties = {
  display: "inline-block",
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.15)",
  background: "rgba(255,255,255,0.12)",
  color: "white",
  fontWeight: 900,
  textDecoration: "none",
};

const ghostBtn: React.CSSProperties = {
  display: "inline-block",
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.15)",
  background: "rgba(255,255,255,0.06)",
  color: "white",
  fontWeight: 900,
  textDecoration: "none",
  whiteSpace: "nowrap",
};

const smallBtn: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.15)",
  background: "rgba(255,255,255,0.08)",
  color: "white",
  fontWeight: 900,
  cursor: "pointer",
};

const clearBtn: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.15)",
  background: "rgba(255,255,255,0.06)",
  color: "white",
  fontWeight: 900,
  cursor: "pointer",
};

const checkRow: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  padding: "8px 10px",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.10)",
  background: "rgba(255,255,255,0.04)",
};

const advancedGrid: React.CSSProperties = {
  marginTop: 14,
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 12,
};

const miniCard: React.CSSProperties = {
  padding: 14,
  borderRadius: 14,
  border: "1px solid rgba(255,255,255,0.10)",
  background: "rgba(0,0,0,0.18)",
};

const miniTitle: React.CSSProperties = { fontWeight: 950, opacity: 0.95 };

const miniRow2: React.CSSProperties = {
  marginTop: 10,
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 12,
};

const checkGrid: React.CSSProperties = {
  marginTop: 10,
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 10,
};
