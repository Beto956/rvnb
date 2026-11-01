import Link from "next/link";
import Image from "next/image";
import { listingPhotos } from "@/lib/listing-photos";
import styles from "./listings.module.css";

import ListingsResults from "../components/ListingsResults";
import { hasListingCoordinates } from "@/lib/listing-location";
import { accommodationRate, isAccommodation, listingType, record, type ListingType } from "@/lib/listing-types";
import AuthNav from "../components/authnav";

import { db } from "@/lib/firebase";
import { collection, getDocs } from "firebase/firestore";

type Hookups = "Full" | "Partial" | "None";
type PricingType = "Night" | "Weekly" | "Monthly";

type ListingDoc = {
  listingType?: unknown;
  accommodation?: unknown;
  title?: string;
  city?: string;
  state?: string;

  hookups?: Hookups;
  maxLengthFt?: number;

  // ✅ ADD: optional map coordinates
  lat?: number;
  lng?: number;

  // OLD
  pricePerNight?: number;

  // NEW
  price?: number;
  pricingType?: PricingType;

  imageUrl?: string;
  photoURL?: string;
  photos?: string[];
};

type ListingUI = {
  listingType: ListingType | null;
  accommodation: Record<string, unknown>;
  id: string;
  title: string;
  city: string;
  state: string;

  hookups: Hookups;
  maxLengthFt: number;

  // ✅ ADD: optional map coordinates
  lat?: number;
  lng?: number;

  displayPriceValue: number | null;
  displayPriceLabel: string;
  photos: string[];
  hasCoords: boolean;
};

function normalizePricingLabel(pricingType: PricingType): string {
  if (pricingType === "Night") return "night";
  if (pricingType === "Weekly") return "week";
  return "month";
}

function buildListingUI(id: string, data: ListingDoc): ListingUI {
  const title = (data.title ?? "").toString().trim();
  const city = (data.city ?? "").toString().trim();
  const state = (data.state ?? "").toString().trim();

  const hookups = (data.hookups ?? "None") as Hookups;
  const maxLengthFt =
    typeof data.maxLengthFt === "number" ? data.maxLengthFt : 0;

  const lat = typeof data.lat === "number" ? data.lat : undefined;
  const lng = typeof data.lng === "number" ? data.lng : undefined;
  const hasCoords = hasListingCoordinates({ lat, lng });

  const rate = accommodationRate(data);
  const accommodationMode = isAccommodation(data.listingType);
  const hasNewPrice = typeof data.price === "number" && (!accommodationMode || (Number.isFinite(data.price) && data.price >= 0));
  const hasNewPricingType =
    data.pricingType === "Night" ||
    data.pricingType === "Weekly" ||
    data.pricingType === "Monthly";

  if (hasNewPrice && hasNewPricingType) {
    return {
      listingType: listingType(data.listingType), accommodation: record(data.accommodation),
      id,
      title: title || "(Untitled Listing)",
      city: city || "(City not set)",
      state: state || "(State)",
      hookups,
      maxLengthFt,
      lat,
      lng,
      displayPriceValue: data.price as number,
      displayPriceLabel: normalizePricingLabel(data.pricingType as PricingType),
      photos: listingPhotos(data),
      hasCoords,
    };
  }

  const oldPrice =
    typeof data.pricePerNight === "number" ? data.pricePerNight : 0;

  return {
    listingType: listingType(data.listingType), accommodation: record(data.accommodation),
    id,
    title: title || "(Untitled Listing)",
    city: city || "(City not set)",
    state: state || "(State)",
    hookups,
    maxLengthFt,
    lat,
    lng,
    displayPriceValue: accommodationMode ? rate.price : oldPrice,
    displayPriceLabel: accommodationMode ? rate.label : "night",
    photos: listingPhotos(data),
    hasCoords,
  };
}

type ListingsSearchParams = {
  state?: string;
  hookups?: string;
  maxPrice?: string;
  sort?: string;
};

function normalizeHookups(v: string | undefined): Hookups | "Any" {
  if (!v) return "Any";
  const val = v.toString().trim();
  if (val === "Full" || val === "Partial" || val === "None") return val;
  return "Any";
}

function normalizeSort(
  v: string | undefined
): "recommended" | "price_asc" | "price_desc" | "title_asc" {
  if (!v) return "recommended";
  const val = v.toString().trim();
  if (val === "price_asc") return "price_asc";
  if (val === "price_desc") return "price_desc";
  if (val === "title_asc") return "title_asc";
  return "recommended";
}

function safeMaxPrice(v: string | undefined): number | null {
  if (!v) return null;
  const raw = v.toString().trim();
  if (!raw) return null;
  const n = Number(raw);
  if (!Number.isFinite(n)) return null;
  if (n <= 0) return null;
  return n;
}

function safeState(v: string | undefined): string {
  if (!v) return "";
  return v.toString().trim();
}

/**
 * ✅ Next.js 16:
 * searchParams is now a Promise.
 * We MUST unwrap it before accessing properties.
 */
export default async function ListingsPage({
  searchParams,
}: {
  searchParams?: ListingsSearchParams | Promise<ListingsSearchParams>;
}) {
  const params = (await searchParams) ?? {};

  const selectedState = safeState(params.state);
  const selectedHookups = normalizeHookups(params.hookups);
  const selectedMaxPrice = safeMaxPrice(params.maxPrice);
  const selectedSort = normalizeSort(params.sort);

  const snap = await getDocs(collection(db, "listings"));

  const allListings: ListingUI[] = snap.docs.map((docSnap) => {
    const data = docSnap.data() as ListingDoc;
    return buildListingUI(docSnap.id, data);
  });

  let listings = allListings.slice();

  if (selectedState) {
    const st = selectedState.toLowerCase();
    listings = listings.filter((l) => l.state.toLowerCase() === st);
  }

  if (selectedHookups !== "Any") {
    listings = listings.filter((l) => !isAccommodation(l.listingType) && l.hookups === selectedHookups);
  }

  if (selectedMaxPrice !== null) {
    listings = listings.filter((l) => l.displayPriceValue !== null && l.displayPriceValue <= selectedMaxPrice);
  }

  if (selectedSort === "price_asc") {
    listings.sort((a, b) => (a.displayPriceValue ?? Infinity) - (b.displayPriceValue ?? Infinity));
  } else if (selectedSort === "price_desc") {
    listings.sort((a, b) => (b.displayPriceValue ?? -Infinity) - (a.displayPriceValue ?? -Infinity));
  } else if (selectedSort === "title_asc") {
    listings.sort((a, b) => a.title.localeCompare(b.title));
  }

  const mappedCount = listings.filter((listing) => listing.hasCoords).length;
  const activeFilterCount = [selectedState, selectedHookups !== "Any", selectedMaxPrice !== null].filter(Boolean).length;

  return (
    <div className={styles.page}>
      <header className={styles.headerBar}>
        <div className={styles.headerInner}>
          <Link href="/" className={styles.brand} aria-label="RVNB Home">
            <Image src="/rvnb-logo-icon.png" alt="RVNB" className={styles.brandIcon} width={320} height={213} />
          </Link>

          <nav className={styles.nav} aria-label="Listings navigation">
            <Link href="/search" className={styles.navLink}>Search</Link>
            <Link href="/request-spot" className={styles.navLink}>Request a Spot</Link>
            <AuthNav navLinkClassName={styles.navLink} navCtaClassName={styles.navCta} navLogoutClassName={styles.navLink} />
          </nav>
        </div>
      </header>

      <div className={styles.container}>
        <div className={styles.breadcrumb}>
          <Link href="/" className={styles.breadcrumbLink}>
            Home
          </Link>
          <span className={styles.breadcrumbSep}>/</span>
          <span className={styles.breadcrumbHere}>Listings</span>
        </div>

        <div className={styles.heroCard}>
          <div className={styles.heroCopy}>
            <p className={styles.eyebrow}>RVNB stays marketplace</p>
            <h1 className={styles.h1}>Find a road-ready place to park, settle, and stay.</h1>
            <p className={styles.sub}>
              Browse RV-ready listings with practical details up front: location, hookups,
              rig length, price, and map coverage when hosts have saved coordinates.
            </p>
          </div>

          <div className={styles.heroStats} aria-label="Listings results summary">
            <div className={styles.statBlock}>
              <span className={styles.statValue}>{listings.length}</span>
              <span className={styles.statLabel}>matching spot{listings.length === 1 ? "" : "s"}</span>
            </div>
            <div className={styles.statBlock}>
              <span className={styles.statValue}>{mappedCount}</span>
              <span className={styles.statLabel}>mapped</span>
            </div>
            <div className={styles.statBlock}>
              <span className={styles.statValue}>{activeFilterCount}</span>
              <span className={styles.statLabel}>active filter{activeFilterCount === 1 ? "" : "s"}</span>
            </div>
          </div>
        </div>

        <form className={styles.filtersCard} method="get" action="/listings">
          <div className={styles.filtersTop}>
            <div>
              <div className={styles.filtersTitle}>Refine stays</div>
              <div className={styles.filtersHint}>Filter by state, budget, hookups, then sort the visible cards.</div>
            </div>
            <Link href="/listings" className={activeFilterCount > 0 ? styles.clearAll : styles.clearAllDisabled} aria-disabled={activeFilterCount === 0}>
              Clear filters
            </Link>
          </div>

          <div className={styles.filtersGrid}>
            <div className={styles.filtersField}>
              <label className={styles.filtersLabel} htmlFor="listing-state-filter">State</label>
              <input
                id="listing-state-filter"
                name="state"
                className={styles.filtersControl}
                defaultValue={selectedState}
              />
            </div>

            <div className={styles.filtersField}>
              <label className={styles.filtersLabel} htmlFor="listing-max-price-filter">Max Price</label>
              <input
                id="listing-max-price-filter"
                name="maxPrice"
                className={styles.filtersControl}
                defaultValue={selectedMaxPrice ?? ""}
              />
            </div>

            <div className={styles.filtersField}>
              <label className={styles.filtersLabel} htmlFor="listing-hookups-filter">Hookups</label>
              <select
                id="listing-hookups-filter"
                name="hookups"
                className={styles.filtersControl}
                defaultValue={
                  selectedHookups === "Any" ? "" : selectedHookups
                }
              >
                <option value="">Any</option>
                <option value="Full">Full</option>
                <option value="Partial">Partial</option>
                <option value="None">None</option>
              </select>
            </div>

            <div className={styles.filtersField}>
              <label className={styles.filtersLabel} htmlFor="listing-sort-filter">Sort</label>
              <select
                id="listing-sort-filter"
                name="sort"
                className={styles.filtersControl}
                defaultValue={selectedSort}
              >
                <option value="recommended">Recommended</option>
                <option value="price_asc">Price: Low → High</option>
                <option value="price_desc">Price: High → Low</option>
                <option value="title_asc">Title: A → Z</option>
              </select>
            </div>

            <div className={styles.filtersBtns}>
              <button className={styles.applyBtn} type="submit">
                Apply
              </button>
            </div>
          </div>
        </form>

        <div className={styles.resultsBar}>
          <div className={styles.resultsLeft}>
            <span className={styles.resultsCount}>{listings.length} stay{listings.length === 1 ? "" : "s"} shown</span>
            <span className={styles.resultsDot}>•</span>
            <span className={styles.resultsMeta}>{mappedCount} on the map</span>
          </div>
          <Link href="/unique-stays" className={styles.resultsRequestLink}>Explore Unique Stays</Link>
          <Link href="/request-spot" className={styles.resultsRequestLink}>Need something specific?</Link>
        </div>

        <ListingsResults listings={listings} />
      </div>
    </div>
  );
}