"use client";

export const dynamic = "force-dynamic";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { collection, getDocsFromServer, orderBy, query } from "firebase/firestore";
import { db } from "@/lib/firebase";
import AuthNav from "../components/authnav";
import styles from "./page.module.css";
import { isAccommodation, listingType, listingTypeLabel, capacity, sleepingLabel, type ListingType } from "@/lib/listing-types";
import { normalizeStayAmenities, amenityAvailable } from "@/lib/stay-amenities";

type Hookups = "Full" | "Partial" | "None";
type PricingType = "Night" | "Weekly" | "Monthly";
type SortMode = "Newest" | "PriceLow" | "PriceHigh";

const amenities = [
  ["wifi", "Wi-Fi"], ["petsAllowed", "Pets allowed"], ["showers", "Showers"],
  ["bathrooms", "Bathrooms"], ["gym", "Gym"], ["firePit", "Fire pit"],
  ["pullThrough", "Pull-through"], ["securityCameras", "Security cameras"],
  ["trashPickup", "Trash pickup"], ["picnicTable", "Picnic table"],
] as const;
type Amenity = (typeof amenities)[number][0];
type Filters = {
  q: string; state: string; maxPrice: number; hookups: Hookups | "Any";
  minLengthFt: number; maxLengthFt: number; pricingType: PricingType | "Any";
  requireWater: boolean; requireSewer: boolean; acceptDumpStation: boolean;
  powerNeed: "Any" | "30A" | "50A";
  laundryNeed: "Any" | "Washer/Dryer" | "Wash & Fold" | "Both";
  checkIn: string; checkOut: string;
} & Record<Amenity, boolean>;

type Listing = {
  listingType: ListingType | null; raw: Record<string, unknown>;
  id: string; title: string; city: string; state: string;
  price: number | null; pricingType: PricingType | null;
  maxLengthFt: number | null; hookups: Hookups | null;
  power: string; water: string; sewer: string; laundry: string;
  description: string; nearbyAttractions: string; photo: string;
} & Record<Amenity, boolean>;

const defaults: Filters = {
  q: "", state: "", maxPrice: 0, hookups: "Any",
  minLengthFt: 0, maxLengthFt: 0, pricingType: "Any",
  requireWater: false, requireSewer: false, acceptDumpStation: true,
  powerNeed: "Any", laundryNeed: "Any", checkIn: "", checkOut: "",
  wifi: false, petsAllowed: false, showers: false, bathrooms: false, gym: false,
  firePit: false, pullThrough: false, securityCameras: false, trashPickup: false, picnicTable: false,
};

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function nonNegative(value: string | null) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, number) : 0;
}

function choice<T extends string>(value: unknown, choices: readonly T[], fallback: T): T {
  return choices.find((item) => item === value) ?? fallback;
}

function dateParam(value: string | null) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return "";
  const date = new Date(`${value}T12:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value ? value : "";
}

function readFilters(params: URLSearchParams): Filters {
  return {
    q: params.get("q") || "", state: (params.get("state") || "").trim().toUpperCase().slice(0, 2),
    maxPrice: nonNegative(params.get("maxPrice")),
    hookups: choice(params.get("hookups"), ["Any", "Full", "Partial", "None"] as const, "Any"),
    minLengthFt: nonNegative(params.get("minLengthFt")), maxLengthFt: nonNegative(params.get("maxLengthFt")),
    pricingType: choice(params.get("pricingType"), ["Any", "Night", "Weekly", "Monthly"] as const, "Any"),
    requireWater: params.get("requireWater") === "true",
    requireSewer: params.get("requireSewer") === "true",
    acceptDumpStation: params.get("acceptDumpStation") !== "false",
    powerNeed: choice(params.get("powerNeed"), ["Any", "30A", "50A"] as const, "Any"),
    laundryNeed: choice(params.get("laundryNeed"), ["Any", "Washer/Dryer", "Wash & Fold", "Both"] as const, "Any"),
    checkIn: dateParam(params.get("checkIn")), checkOut: dateParam(params.get("checkOut")),
    wifi: params.get("wifi") === "true", petsAllowed: params.get("petsAllowed") === "true",
    showers: params.get("showers") === "true", bathrooms: params.get("bathrooms") === "true",
    gym: params.get("gym") === "true", firePit: params.get("firePit") === "true",
    pullThrough: params.get("pullThrough") === "true", securityCameras: params.get("securityCameras") === "true",
    trashPickup: params.get("trashPickup") === "true", picnicTable: params.get("picnicTable") === "true",
  };
}

function advancedCount(filters: Filters) {
  return [
    filters.minLengthFt > 0, filters.maxLengthFt > 0, filters.pricingType !== "Any",
    filters.powerNeed !== "Any", filters.laundryNeed !== "Any", filters.requireWater,
    filters.requireSewer, !filters.acceptDumpStation, ...amenities.map(([key]) => filters[key]),
  ].filter(Boolean).length;
}

function filterCount(filters: Filters) {
  return advancedCount(filters) + [filters.q.trim(), filters.state, filters.maxPrice > 0, filters.hookups !== "Any"].filter(Boolean).length;
}

function serializeFilters(filters: Filters) {
  const params = new URLSearchParams();
  for (const key of Object.keys(defaults) as (keyof Filters)[]) {
    if (filters[key] !== defaults[key]) params.set(key, String(filters[key]));
  }
  return params;
}

function normalizeListing(id: string, data: Record<string, unknown>): Listing {
  const price = typeof data.price === "number" ? data.price : typeof data.pricePerNight === "number" ? data.pricePerNight : null;
  const period = data.pricingType === "Night" || data.pricingType === "Weekly" || data.pricingType === "Monthly"
    ? data.pricingType : typeof data.price !== "number" && typeof data.pricePerNight === "number" ? "Night" : null;
  const photoCandidates = [data.imageUrl, data.photoURL, ...(Array.isArray(data.photos) ? data.photos : [])];
  const photo = photoCandidates.map(text).find((value) => (value.startsWith("/") && !value.startsWith("//")) || /^https?:\/\//.test(value)) || "";
  const accommodationMode = isAccommodation(data.listingType);
  const declared = normalizeStayAmenities(data);
  return {
    listingType: listingType(data.listingType), raw: data,
    id, title: text(data.title) || "Untitled listing", city: text(data.city), state: text(data.state),
    price: price !== null && Number.isFinite(price) && price >= 0 ? price : null,
    pricingType: period,
    maxLengthFt: !accommodationMode && typeof data.maxLengthFt === "number" && data.maxLengthFt > 0 ? data.maxLengthFt : null,
    hookups: !accommodationMode && (data.hookups === "Full" || data.hookups === "Partial" || data.hookups === "None") ? data.hookups : null,
    power: accommodationMode ? "" : text(data.power), water: accommodationMode ? "" : text(data.water), sewer: accommodationMode ? "" : text(data.sewer), laundry: text(data.laundry),
    description: text(data.description), nearbyAttractions: text(data.nearbyAttractions), photo,
    wifi: accommodationMode ? amenityAvailable(declared.wifi) : data.wifi === true, petsAllowed: accommodationMode ? amenityAvailable(declared.petsAllowed) : data.petsAllowed === true, showers: accommodationMode ? amenityAvailable(declared.shower) : data.showers === true,
    bathrooms: accommodationMode ? amenityAvailable(declared.bathroom) : data.bathrooms === true, gym: !accommodationMode && data.gym === true, firePit: accommodationMode ? amenityAvailable(declared.firePit) : data.firePit === true,
    pullThrough: !accommodationMode && data.pullThrough === true, securityCameras: !accommodationMode && data.securityCameras === true,
    trashPickup: !accommodationMode && data.trashPickup === true, picnicTable: accommodationMode ? amenityAvailable(declared.picnicTable) : data.picnicTable === true,
  };
}

function matches(listing: Listing, filters: Filters) {
  if (isAccommodation(listing.listingType) && (filters.minLengthFt > 0 || filters.maxLengthFt > 0 || filters.hookups !== "Any" || filters.powerNeed !== "Any" || filters.requireWater || filters.requireSewer || filters.laundryNeed !== "Any")) return false;
  const haystack = `${listing.title} ${listing.city} ${listing.state} ${listing.description} ${listing.nearbyAttractions}`.toLowerCase();
  if (filters.q.trim() && !haystack.includes(filters.q.trim().toLowerCase())) return false;
  if (filters.state && listing.state.toUpperCase() !== filters.state.trim().toUpperCase()) return false;
  if (filters.maxPrice > 0 && (listing.price === null || listing.price > filters.maxPrice)) return false;
  if (filters.hookups !== "Any" && listing.hookups !== filters.hookups) return false;
  if (filters.pricingType !== "Any" && listing.pricingType !== filters.pricingType) return false;
  if (filters.minLengthFt > 0 && listing.maxLengthFt !== null && listing.maxLengthFt < filters.minLengthFt) return false;
  if (filters.maxLengthFt > 0 && listing.maxLengthFt !== null && listing.maxLengthFt > filters.maxLengthFt) return false;
  if (filters.powerNeed !== "Any" && !listing.power.toUpperCase().includes(filters.powerNeed.slice(0, 2))) return false;
  if (filters.requireWater && listing.water !== "Yes") return false;
  if (filters.requireSewer && listing.sewer !== "Yes" && !(filters.acceptDumpStation && listing.sewer === "Dump station")) return false;
  if (filters.laundryNeed !== "Any" && listing.laundry !== filters.laundryNeed) return false;
  return amenities.every(([key]) => !filters[key] || listing[key]);
}

function fitMessage(listing: Listing, length: number, rigType: string) {
  if (!listing.maxLengthFt) return `Length capacity unknown for ${rigType.toLowerCase()}. Ask the host about fit.`;
  if (length <= listing.maxLengthFt) return `Within the listed length limit (${length} ft). Confirm clearance with the host.`;
  if (length - listing.maxLengthFt <= 3) return "Tight fit: your rig may be slightly long. Confirm with the host.";
  return "Your rig may be too long for this spot.";
}

function rigTags(listing: Listing) {
  const tags: string[] = [];
  const max = listing.maxLengthFt || 0;
  if (max > 0 && max <= 24) tags.push("Class B length range");
  if (max >= 20 && max <= 32) tags.push("Class C / travel trailer length range");
  if (max >= 30) tags.push("5th wheel length range");
  if (max >= 35) tags.push("Big rig length range");
  if (listing.pullThrough) tags.push("Pull-through");
  if (listing.hookups === "Full" || listing.hookups === "Partial") tags.push("Hookups listed");
  return tags.length ? tags : ["Ask host about rig fit"];
}

function SearchIcon({ kind = "search" }: { kind?: "search" | "filters" | "arrow" | "pin" | "rv" }) {
  return <svg className={styles.icon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {kind === "search" ? <><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 5 5" /></> :
      kind === "filters" ? <><path d="M4 7h16M4 17h16" /><circle cx="9" cy="7" r="2" /><circle cx="15" cy="17" r="2" /></> :
        kind === "arrow" ? <path d="M4 12h16m-6-6 6 6-6 6" /> :
          kind === "pin" ? <><path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z" /><circle cx="12" cy="10" r="2" /></> :
            <><path d="M3 16V7h12l5 5v4H3Zm11-9v6h6M6 10h4" /><circle cx="7" cy="18" r="2" /><circle cx="17" cy="18" r="2" /></>}
  </svg>;
}

export default function SearchPage() {
  return <Suspense fallback={<main className={styles.page}><p className={styles.status} role="status">Loading search...</p></main>}><SearchRoute /></Suspense>;
}

function SearchRoute() {
  const params = useSearchParams();
  const serialized = params.toString();
  return <SearchPageClient key={serialized} params={new URLSearchParams(serialized)} />;
}

function SearchPageClient({ params }: { params: URLSearchParams }) {
  const router = useRouter();
  const initial = readFilters(params);
  const initialSort = choice(params.get("sort"), ["Newest", "PriceLow", "PriceHigh"] as const, "Newest");
  const [filters, setFilters] = useState(initial);
  const [applied, setApplied] = useState(
    Boolean(params.get("search") === "1" || filterCount(initial) > 0 || initial.checkIn || initial.checkOut || initialSort !== "Newest")
  );
  const [showAdvanced, setShowAdvanced] = useState(true);
  const [sort, setSort] = useState<SortMode>(initialSort);
  const [checkRigFit, setCheckRigFit] = useState(params.get("checkRigFit") === "true");
  const [rigLength, setRigLength] = useState(nonNegative(params.get("myRigLength")) || 35);
  const [rigType, setRigType] = useState(params.get("myRigType") || "5th wheel");
  const [slides, setSlides] = useState(Math.min(3, nonNegative(params.get("mySlides") ?? "2")));
  const [attempt, setAttempt] = useState(0);
  const [load, setLoad] = useState<{ attempt: number; listings: Listing[]; error: string }>({ attempt: -1, listings: [], error: "" });
  const loading = load.attempt !== attempt;
  const error = loading ? "" : load.error;
  useEffect(() => {
    let active = true;
    getDocsFromServer(query(collection(db, "listings"), orderBy("createdAt", "desc"))).then((snapshot) => {
      if (active) setLoad({ attempt, listings: snapshot.docs.map((item) => normalizeListing(item.id, item.data())), error: "" });
    }).catch((error: unknown) => {
      console.error("[RVNB] Search listings query failed", error);
      if (active) setLoad({ attempt, listings: [], error: "We couldn't load listings right now. Please try again." });
    });
    return () => { active = false; };
  }, [attempt]);

  const filtered = useMemo(() => {
    if (!applied) return [];
    return load.listings.filter((listing) => matches(listing, filters)).sort((a, b) => {
      if (sort === "Newest") return 0;
      if (a.price === null) return b.price === null ? 0 : 1;
      if (b.price === null) return -1;
      return sort === "PriceLow" ? a.price - b.price : b.price - a.price;
    });
  }, [load.listings, applied, filters, sort]);
  const advanced = advancedCount(filters);
  const activeLabels = [
    filters.q && `Keyword: ${filters.q}`, filters.state && `State: ${filters.state}`,
    filters.maxPrice > 0 && `Up to $${filters.maxPrice}`,
    filters.hookups !== "Any" && `${filters.hookups} hookups`,
    filters.minLengthFt > 0 && `Min capacity: ${filters.minLengthFt} ft`,
    filters.maxLengthFt > 0 && `Max capacity: ${filters.maxLengthFt} ft`,
    filters.pricingType !== "Any" && `Pricing: ${filters.pricingType}`,
    filters.powerNeed !== "Any" && `Power: ${filters.powerNeed}`,
    filters.laundryNeed !== "Any" && `Laundry: ${filters.laundryNeed}`,
    filters.requireWater && "Water required", filters.requireSewer && "Sewer required",
    !filters.acceptDumpStation && "No dump station", ...amenities.filter(([key]) => filters[key]).map(([, label]) => label),
  ].filter(Boolean);

  function update<K extends keyof Filters>(key: K, value: Filters[K]) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  function search(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const next = { ...filters, q: filters.q.trim(), state: filters.state.trim().toUpperCase().slice(0, 2) };
    setFilters(next);
    setApplied(true);
    const url = serializeFilters(next);
    url.set("search", "1");
    if (sort !== "Newest") url.set("sort", sort);
    if (checkRigFit) url.set("checkRigFit", "true");
    if (rigLength !== 35) url.set("myRigLength", String(rigLength));
    if (rigType !== "5th wheel") url.set("myRigType", rigType);
    if (slides !== 2) url.set("mySlides", String(slides));
    router.push(`/search?${url}`, { scroll: false });
  }

  function reset() {
    setFilters(defaults); setApplied(false); setShowAdvanced(true); setSort("Newest");
    setCheckRigFit(false); setRigLength(35); setRigType("5th wheel"); setSlides(2);
    router.push("/search", { scroll: false });
  }

  return <main className={styles.page}>
    <header className={styles.header}><div className={styles.headerInner}>
      <Link href="/" className={styles.brand} aria-label="RVNB Home"><Image src="/rvnb-logo-icon.png" alt="RVNB" width={320} height={213} priority /></Link>
      <nav className={styles.nav} aria-label="Primary">
        <Link href="/search" className={styles.navLink} aria-current="page">Find a stay</Link>
        <Link href="/listings" className={styles.navLink}>Listings</Link>
        <Link href="/unique-stays" className={styles.navLink}>Unique Stays</Link>
        <AuthNav navLinkClassName={styles.navLink} navCtaClassName={styles.navLink} navLogoutClassName={styles.navLink} />
      </nav>
    </div></header>
    <div className={styles.container}>
      <section className={styles.hero} aria-labelledby="search-title">
        <p className={styles.eyebrow}>A little closer to the open road</p>
        <h1 id="search-title">Find your next RV stay</h1>
        <p className={styles.subtitle}>Search by location, hookups, and the space your rig needs.</p>
      </section>

      <form onSubmit={search} className={styles.searchForm} aria-label="Find RV spots">
        <div className={styles.searchHeading}><h2>Search</h2><span className={styles.help}>{filterCount(filters)} filters selected</span></div>
        <div className={styles.basicFields}>
          <label className={styles.locationField}>City or keyword<input type="search" value={filters.q} onChange={(event) => update("q", event.target.value)} placeholder="City, area, or a place you love" /></label>
          <label>State<input value={filters.state} onChange={(event) => update("state", event.target.value.toUpperCase())} maxLength={2} placeholder="Any state" autoCapitalize="characters" /></label>
          <label>Max price ($)<input type="number" min="0" value={filters.maxPrice || ""} onChange={(event) => update("maxPrice", nonNegative(event.target.value))} placeholder="No limit" aria-describedby="price-help" /></label>
          <label>Hookups<select value={filters.hookups} onChange={(event) => update("hookups", choice(event.target.value, ["Any", "Full", "Partial", "None"] as const, "Any"))}><option value="Any">Any hookups</option><option>Full</option><option>Partial</option><option>None</option></select></label>
        </div>
        <div className={styles.datesAndHelp}>
          <div className={styles.dateFields}>
            <label>Check-in <span>(optional)</span><input type="date" value={filters.checkIn} onChange={(event) => update("checkIn", event.target.value)} aria-describedby="date-help" /></label>
            <label>Check-out <span>(optional)</span><input type="date" value={filters.checkOut} onChange={(event) => update("checkOut", event.target.value)} aria-describedby="date-help" /></label>
          </div>
          <div className={styles.helpers}><p id="date-help">Dates are planning notes only. Search does not check availability; confirm dates with the host.</p><p id="price-help">Prices use each listing&apos;s night, week, or month rate. Choose a pricing period in advanced filters to compare like rates.</p></div>
        </div>
        <div className={styles.formActions}>
          <button className={styles.primary} type="submit"><SearchIcon />Search spots</button>
          <button className={styles.secondary} type="button" aria-expanded={showAdvanced} aria-controls="advanced-filters" onClick={() => setShowAdvanced((value) => !value)}><SearchIcon kind="filters" />Advanced filters{advanced > 0 && <span className={styles.count}>{advanced} selected</span>}<span aria-hidden="true">{showAdvanced ? "−" : "+"}</span></button>
          <button type="button" className={styles.quiet} onClick={reset}>Reset</button>
        </div>

        <div id="advanced-filters" hidden={!showAdvanced} className={styles.advanced}>
          <div className={styles.advancedHeading}><div className={styles.sectionHeading}><h2>Advanced filters</h2><p>Choose only what matters to your trip.</p></div>
            <label>Sort by<select value={sort} onChange={(event) => setSort(choice(event.target.value, ["Newest", "PriceLow", "PriceHigh"] as const, "Newest"))}><option value="Newest">Newest first</option><option value="PriceLow">Price: low to high</option><option value="PriceHigh">Price: high to low</option></select></label>
          </div>
          <div className={styles.advancedGrid}>
            <fieldset><legend>RV size &amp; pricing</legend><div className={styles.sizeFields}>
              <label>Min length capacity (ft)<input type="number" min="0" value={filters.minLengthFt || ""} placeholder="Any" onChange={(event) => update("minLengthFt", nonNegative(event.target.value))} /></label>
              <label>Max length capacity (ft)<input type="number" min="0" value={filters.maxLengthFt || ""} placeholder="Any" onChange={(event) => update("maxLengthFt", nonNegative(event.target.value))} /></label>
              <label>Pricing period<select value={filters.pricingType} onChange={(event) => update("pricingType", choice(event.target.value, ["Any", "Night", "Weekly", "Monthly"] as const, "Any"))}><option value="Any">Any period</option><option value="Night">Night</option><option value="Weekly">Weekly</option><option value="Monthly">Monthly</option></select></label>
            </div><p className={styles.help}>Length filters use listed capacity. Listings without a capacity may still appear; ask the host about fit.</p></fieldset>
            <fieldset><legend>Utilities</legend><div className={styles.checks}>
              <Check label="Water required" checked={filters.requireWater} onChange={(value) => update("requireWater", value)} />
              <Check label="Sewer required" checked={filters.requireSewer} onChange={(value) => update("requireSewer", value)} />
              <Check label="Accept dump station" checked={filters.acceptDumpStation} disabled={!filters.requireSewer} onChange={(value) => update("acceptDumpStation", value)} />
            </div><div className={styles.utilityFields}>
              <fieldset className={styles.choiceGroup}><legend>Power</legend><div className={styles.chips}>{(["Any", "30A", "50A"] as const).map((value) => <button key={value} type="button" aria-pressed={filters.powerNeed === value} onClick={() => update("powerNeed", value)}>{value}</button>)}</div></fieldset>
              <fieldset className={styles.choiceGroup}><legend>Laundry</legend><div className={styles.chips}>{(["Any", "Washer/Dryer", "Wash & Fold", "Both"] as const).map((value) => <button key={value} type="button" aria-pressed={filters.laundryNeed === value} onClick={() => update("laundryNeed", value)}>{value}</button>)}</div></fieldset>
            </div></fieldset>
          </div>
          <fieldset className={styles.amenities}><legend>Amenities</legend><div className={styles.amenityGrid}>{amenities.map(([key, label]) => <Check key={key} label={label} checked={filters[key]} onChange={(value) => update(key, value)} />)}</div></fieldset>
          <div className={styles.advancedFooter}><span className={styles.help}>{advanced ? `${advanced} advanced ${advanced === 1 ? "filter" : "filters"} selected` : "No advanced filters selected"}</span><button type="submit" className={styles.primary}>Search spots<SearchIcon kind="arrow" /></button></div>
        </div>
      </form>

      <div className={styles.contentGrid}>
      <section className={styles.results} aria-labelledby="results-title" aria-busy={Boolean(applied && loading)}>
        <div className={styles.resultsHeading}><div><h2 id="results-title">Results</h2>
          <p role="status" aria-live="polite">{!applied ? "Start with a destination, or search all spots to explore." : loading ? "Looking for RV stays..." : error ? "Results are unavailable right now." : `${filtered.length} ${filtered.length === 1 ? "stay" : "stays"} found`}</p>
        </div><div className={styles.resultTools}>
          <span className={styles.help}>{sort === "Newest" ? "Newest first" : sort === "PriceLow" ? "Price: low to high" : "Price: high to low"}</span>
          <button className={styles.quiet} type="button" disabled={loading} onClick={() => setAttempt((value) => value + 1)}>{loading ? "Refreshing..." : "Refresh"}</button>
        </div></div>
        <section className={styles.rigDetails} aria-label="RV compatibility">
          <h3><SearchIcon kind="rv" />Check RV compatibility</h3>
          <div className={styles.rigFields}><Check label="Show fit guidance on results" checked={checkRigFit} onChange={setCheckRigFit} />
            <label>My rig length (ft)<input type="number" min="0" value={rigLength} onChange={(event) => setRigLength(nonNegative(event.target.value))} /></label>
            <label>RV type<select value={rigType} onChange={(event) => setRigType(event.target.value)}>{["Class B", "Class C", "Travel trailer", "5th wheel", "Toy hauler"].map((value) => <option key={value}>{value}</option>)}</select></label>
            <label>Slides<select value={slides} onChange={(event) => setSlides(Number(event.target.value))}><option value="0">0</option><option value="1">1</option><option value="2">2</option><option value="3">3+</option></select></label>
          </div><p className={styles.help}>Guidance updates as you change these controls. It compares length only, not slide clearance, access, or availability. Confirm all dimensions with the host.</p>
        </section>
        {!applied ? <div className={styles.initialState}><span className={styles.stateIcon}><SearchIcon kind="rv" /></span><div><h3>Where will the road take you?</h3><p>Enter a city, state, or keyword, then choose Search spots. Use advanced filters to refine your stay.</p><Link href="/listings" className={styles.textLink}>Browse all listings<SearchIcon kind="arrow" /></Link></div></div> :
          loading ? <div className={styles.loadingState} role="status"><span className={styles.stateIcon}><SearchIcon /></span><p>Loading listings. Your next stop is on the horizon.</p></div> :
            error ? <div className={styles.errorState} role="alert"><h3>We hit a bump in the road</h3><p>{error}</p><button className={styles.secondary} type="button" onClick={() => setAttempt((value) => value + 1)}>Try again</button></div> :
              !filtered.length ? <div className={styles.emptyState}><SearchIcon kind="pin" /><h3>No stays match this search yet</h3><p>Try a nearby area or fewer filters. If the right spot isn&apos;t listed, let hosts know what you need.</p><div className={styles.emptyActions}><button className={styles.secondary} type="button" onClick={reset}>Reset filters</button><Link className={styles.textLink} href="/request-spot">Request a spot<SearchIcon kind="arrow" /></Link></div></div> :
                <div className={styles.resultsGrid}>{filtered.map((listing) => <article className={styles.listingCard} key={listing.id}>
                  <Link href={`/listings/${encodeURIComponent(listing.id)}`} className={styles.photoLink} aria-label={`View ${listing.title}`}>
                    {listing.photo ? <ListingPhoto src={listing.photo} title={listing.title} /> : <div className={styles.photoPlaceholder}><SearchIcon kind="rv" /><span>No photo provided</span></div>}
                  </Link>
                  <div className={styles.listingBody}><div className={styles.cardHeading}><div><p className={styles.listingLocation}><SearchIcon kind="pin" />{[listing.city, listing.state].filter(Boolean).join(", ") || "Location not provided"}</p><h3><Link href={`/listings/${encodeURIComponent(listing.id)}`}>{listing.title}</Link></h3></div>
                    <p className={styles.price}>{listing.price === null ? "Price not provided" : <><strong>${listing.price.toLocaleString("en-US")}</strong><span>{listing.pricingType ? ` / ${listing.pricingType === "Night" ? "night" : listing.pricingType === "Weekly" ? "week" : "month"}` : " · period not provided"}</span></>}</p></div>
                    <div className={styles.listingTags}><span>{listingTypeLabel(listing.listingType)}</span>{!isAccommodation(listing.listingType) && <><span>{listing.hookups ? `${listing.hookups} hookups` : "Hookups not provided"}</span><span>{listing.maxLengthFt ? `Up to ${listing.maxLengthFt} ft` : "Length not provided"}</span></>}{amenities.filter(([key]) => listing[key]).map(([key, label]) => <span key={key}>{label}</span>)}</div>
                    {isAccommodation(listing.listingType) ? <section className={styles.listingDetails}><h4>Stationary accommodation</h4><p>{capacity(listing.raw) === null ? "Guest capacity not provided" : `Up to ${capacity(listing.raw)} guests`} · {sleepingLabel(listing.raw)}</p><p className={styles.help}>No RV of your own needed. Guests may not drive, tow, or remove this accommodation. See listing for private/shared facilities.</p></section> : <>
                    {checkRigFit && rigLength > 0 && <p className={listing.maxLengthFt && rigLength <= listing.maxLengthFt ? styles.fitNote : styles.fitWarning}>{fitMessage(listing, rigLength, rigType)}</p>}
                    <section className={styles.listingDetails} aria-label="Rig compatibility"><h4>Rig compatibility</h4><p className={styles.help}>Length-based estimates, not a verified fit.</p><div className={styles.listingTags}>{rigTags(listing).map((tag) => <span key={tag}>{tag}</span>)}</div></section>
                    <section className={styles.listingDetails} aria-label="Road essentials"><h4>Road essentials</h4><dl className={styles.essentials}>{[["Power", listing.power], ["Water", listing.water], ["Sewer", listing.sewer], ["Laundry", listing.laundry]].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value || "Not provided"}</dd></div>)}</dl></section>
                    </>}
                    {listing.description && <section><h4>About this stop</h4><p className={styles.description}>{listing.description}</p></section>}
                    {listing.nearbyAttractions && <section><h4>Nearby</h4><p className={styles.nearby}>{listing.nearbyAttractions}</p></section>}
                    <Link href={`/listings/${encodeURIComponent(listing.id)}`} className={styles.listingAction}>View listing<SearchIcon kind="arrow" /></Link>
                  </div>
                </article>)}</div>}
      </section>
      <aside className={styles.sidebar}>
        <section className={styles.sidebarCard}><h2>Need a road-ready spot?</h2><p>Share your destination and rig needs with hosts on RVNB.</p><Link href="/request-spot" className={styles.secondary}>Request a spot<SearchIcon kind="arrow" /></Link></section>
        <section className={styles.sidebarCard}><h2>Filter Summary</h2>{activeLabels.length ? <ul className={styles.summaryList}>{activeLabels.map((label) => <li key={String(label)}>{label}</li>)}</ul> : <p>No filters selected. Use the controls above to narrow your search.</p>}
          <button type="button" className={styles.quiet} onClick={reset}>Clear filters</button>
        </section>
      </aside>
      </div>
    </div>
  </main>;
}

function Check({ label, checked, onChange, disabled }: { label: string; checked: boolean; onChange: (value: boolean) => void; disabled?: boolean }) {
  return <label className={styles.check}><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} disabled={disabled} /><span>{label}</span></label>;
}

function ListingPhoto({ src, title }: { src: string; title: string }) {
  const [failed, setFailed] = useState(false);
  return failed ? <div className={styles.photoPlaceholder}><SearchIcon kind="rv" /><span>Photo unavailable</span></div> :
    // Host-provided photo URLs are not restricted to a single Next Image remote host.
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={title} loading="lazy" onError={() => setFailed(true)} />;
}
