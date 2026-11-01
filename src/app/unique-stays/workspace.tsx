"use client";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { collection, getDocsFromServer, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { capacity, LISTING_TYPES, sleepingLabel } from "@/lib/listing-types";
import { matchesUniqueStay, normalizeUniqueStay, readStayFilters, type UniqueStay } from "@/lib/unique-stays";
import { STAY_AMENITIES } from "@/lib/stay-amenities";
import { hasListingCoordinates } from "@/lib/listing-location";
import ListingPhoto from "../components/ListingPhoto";
import ListingRating from "../components/ListingRating";
import useListingRatings from "../components/useListingRatings";
import AuthNav from "../components/authnav";
import styles from "./uniqueStays.module.css";

export default function UniqueStays() {
  const searchParams = useSearchParams(), params = searchParams.toString();
  const filters = useMemo(() => readStayFilters(new URLSearchParams(params)), [params]);
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{ attempt: number; stays: UniqueStay[]; error?: string }>();
  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const snap = await getDocsFromServer(query(collection(db, "listings"), where("listingType", "in", ["host_rv", "mobile_home", "cabin"])));
        if (active) setResult({ attempt, stays: snap.docs.map(doc => normalizeUniqueStay(doc.id, doc.data())).filter((stay): stay is UniqueStay => stay !== null) });
      } catch (error) {
        console.error("[RVNB] Unique Stays load failed", error);
        if (active) setResult({ attempt, stays: [], error: "We couldn't load Unique Stays. Please retry." });
      }
    }
    void load();
    return () => { active = false; };
  }, [attempt]);
  const loaded = result?.attempt === attempt ? result : undefined;
  const stays = useMemo(() => (loaded?.stays ?? []).filter(stay => matchesUniqueStay(stay, filters)), [loaded, filters]);
  const { ratings, retry } = useListingRatings(stays);
  const categories = [["", "All stays"], ["host_rv", "Host-provided RVs"], ["mobile_home", "Mobile homes"], ["cabin", "Cabins"]];
  function categoryHref(type: string) {
    const next = new URLSearchParams(params);
    if (type) next.set("type", type); else next.delete("type");
    return `/unique-stays${next.size ? `?${next}` : ""}`;
  }
  return <main className={styles.page}><div className={styles.container}>
    <header className={styles.header}>
      <Link href="/" className={styles.brand} aria-label="RVNB Home"><Image src="/rvnb-logo-icon.png" alt="RVNB" width={2000} height={1333} sizes="320px" /></Link>
      <nav aria-label="Primary"><Link href="/search">Search</Link><Link href="/listings">Listings</Link><AuthNav navLinkClassName={styles.navLink} navCtaClassName={styles.navLink} /></nav>
    </header>
    <section className={styles.hero}>
      <p className={styles.eyebrow}>RVNB · Unique Stays</p>
      <h1>Your getaway. Already here.</h1>
      <p>Explore host-provided RVs, mobile homes, and cabins—no RV of your own needed.</p>
      <p className={styles.help}>Stationary accommodations only. Guests may not drive, tow, or remove them. Each listing represents one independently bookable accommodation. Date inquiries are not confirmed reservations.</p>
    </section>
    <form key={params} action="/unique-stays" method="get" className={styles.filters} aria-label="Filter Unique Stays">
      {filters.type && <input type="hidden" name="type" value={filters.type} />}
      <div className={styles.filterRow}>
        <label>Location<input name="q" maxLength={120} defaultValue={filters.q} placeholder="City, state, or stay name" /></label>
        <label>Guests<select name="guests" defaultValue={filters.guests || ""}><option value="">Any declared capacity</option>{Array.from({ length: 30 }, (_, i) => <option key={i + 1} value={i + 1}>{i + 1} guest{i ? "s" : ""}</option>)}</select></label>
        <button className={styles.primary} type="submit">Find stays</button>
      </div>
      <details><summary>Amenity filters{filters.amenities.length ? ` (${filters.amenities.length})` : ""}</summary>
        <p className={styles.help}>Only declared amenities match. Shared facilities count unless private/in-unit is selected. Missing or not-applicable values never match.</p>
        <label className={styles.check}><input type="checkbox" name="private" value="true" defaultChecked={filters.privateOnly} />Require private / in-unit for selected amenities</label>
        <div className={styles.amenityFilters}>{STAY_AMENITIES.map(([key, label]) => <label key={key} className={styles.check}><input type="checkbox" name="amenity" value={key} defaultChecked={filters.amenities.includes(key)} />{label}</label>)}</div>
      </details>
    </form>
    <nav className={styles.categories} aria-label="Accommodation categories">{categories.map(([type, label]) =>
      <Link key={type} href={categoryHref(type)} aria-current={filters.type === type ? "page" : undefined}>{label}</Link>)}</nav>
    <div className={styles.summary}><p role="status">{!loaded ? "Loading Unique Stays..." : loaded.error ? "Stays unavailable" : `${stays.length} stay${stays.length === 1 ? "" : "s"} found`}</p><Link href="/unique-stays">Clear filters</Link></div>
    {!loaded ? <div className={styles.panel} aria-busy="true">Loading real host listings...</div>
      : loaded.error ? <div className={styles.panel} role="alert"><p>{loaded.error}</p><button className={styles.primary} onClick={() => setAttempt(value => value + 1)}>Retry listings</button></div>
      : !stays.length ? <div className={styles.panel}><h2>No matching Unique Stays yet</h2><p>Try fewer filters or a nearby location. RV parking spaces remain available in <Link href="/search">Search</Link> and <Link href="/listings">Listings</Link>.</p><Link href="/host/listings/new">Host a stationary accommodation</Link></div>
      : <div className={styles.grid}>{stays.map(stay => <article className={styles.card} key={stay.id}>
        <Link href={`/listings/${encodeURIComponent(stay.id)}`} className={styles.photoLink} aria-label={`View ${stay.title}`}><ListingPhoto photos={stay.photos} className={styles.photo} fill fallback={<div className={styles.fallback}><strong>RVNB</strong><span>Photos not added</span></div>} /></Link>
        <div className={styles.cardBody}><p className={styles.eyebrow}>{LISTING_TYPES[stay.listingType]}</p><h2><Link href={`/listings/${encodeURIComponent(stay.id)}`}>{stay.title}</Link></h2>
          <p>{[stay.city, stay.state].filter(Boolean).join(", ") || "Location not provided"}</p>
          <ListingRating state={ratings[stay.id] ?? { status: "loading" }} />
          <p>{capacity(stay.raw) === null ? "Guest capacity not provided" : `Up to ${capacity(stay.raw)} guests`} · {sleepingLabel(stay.raw)}</p>
          <p className={styles.rate}>{stay.price === null ? "Price not provided" : `$${stay.price}`} {stay.price !== null && (stay.pricingType ? `/ ${stay.pricingType === "Night" ? "night" : stay.pricingType === "Weekly" ? "week" : "month"}` : "· billing period not provided")}</p>
          <p className={styles.help}>Stationary accommodation · availability requires host approval</p>
          <div className={styles.actions}><Link href={`/listings/${encodeURIComponent(stay.id)}`} className={styles.primary}>View listing</Link>
            {hasListingCoordinates(stay) ? <Link href={`/listings/${encodeURIComponent(stay.id)}#listing-location`}>View location</Link> : <span className={styles.help}>Location not mapped yet</span>}</div>
        </div>
      </article>)}</div>}
    {Object.values(ratings).some(state => state.status === "error") && <div role="status" className={styles.panel}>Some ratings are unavailable. <button className={styles.secondary} onClick={retry}>Retry ratings</button></div>}
  </div></main>;
}
