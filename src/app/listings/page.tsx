import Link from "next/link";
import styles from "./listings.module.css";

import ListingsMapPanel from "../components/ListingsMapPanel";

import { db } from "@/lib/firebase";
import { collection, getDocs } from "firebase/firestore";

type Hookups = "Full" | "Partial" | "None";
type PricingType = "Night" | "Weekly" | "Monthly";

type ListingDoc = {
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
};

type ListingUI = {
  id: string;
  title: string;
  city: string;
  state: string;

  hookups: Hookups;
  maxLengthFt: number;

  // ✅ ADD: optional map coordinates
  lat?: number;
  lng?: number;

  displayPriceValue: number;
  displayPriceLabel: string;
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

  const hasNewPrice = typeof data.price === "number";
  const hasNewPricingType =
    data.pricingType === "Night" ||
    data.pricingType === "Weekly" ||
    data.pricingType === "Monthly";

  if (hasNewPrice && hasNewPricingType) {
    return {
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
    };
  }

  const oldPrice =
    typeof data.pricePerNight === "number" ? data.pricePerNight : 0;

  return {
    id,
    title: title || "(Untitled Listing)",
    city: city || "(City not set)",
    state: state || "(State)",
    hookups,
    maxLengthFt,
    lat,
    lng,
    displayPriceValue: oldPrice,
    displayPriceLabel: "night",
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
    listings = listings.filter((l) => l.hookups === selectedHookups);
  }

  if (selectedMaxPrice !== null) {
    listings = listings.filter((l) => l.displayPriceValue <= selectedMaxPrice);
  }

  if (selectedSort === "price_asc") {
    listings.sort((a, b) => a.displayPriceValue - b.displayPriceValue);
  } else if (selectedSort === "price_desc") {
    listings.sort((a, b) => b.displayPriceValue - a.displayPriceValue);
  } else if (selectedSort === "title_asc") {
    listings.sort((a, b) => a.title.localeCompare(b.title));
  }

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <div className={styles.breadcrumb}>
          <Link href="/" className={styles.breadcrumbLink}>
            Home
          </Link>
          <span className={styles.breadcrumbSep}>/</span>
          <span className={styles.breadcrumbHere}>Listings</span>
        </div>

        <div className={styles.heroCard}>
          <h1 className={styles.h1}>RVNB Listings</h1>
          <p className={styles.sub}>
            Discover RV spots across the country — clean, host-backed, and built
            for real RV life.
          </p>

          <div className={styles.countLine}>
            Showing <strong>{listings.length}</strong> spot
            {listings.length === 1 ? "" : "s"}
          </div>
        </div>

        <div className={styles.sectionDivider} />

        <form className={styles.filtersCard} method="get" action="/listings">
          <div className={styles.filtersGrid}>
            <div className={styles.filtersField}>
              <label className={styles.filtersLabel}>State</label>
              <input
                name="state"
                className={styles.filtersControl}
                defaultValue={selectedState}
              />
            </div>

            <div className={styles.filtersField}>
              <label className={styles.filtersLabel}>Max Price</label>
              <input
                name="maxPrice"
                className={styles.filtersControl}
                defaultValue={selectedMaxPrice ?? ""}
              />
            </div>

            <div className={styles.filtersField}>
              <label className={styles.filtersLabel}>Hookups</label>
              <select
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
              <label className={styles.filtersLabel}>Sort</label>
              <select
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

        <div className={styles.resultsLayout}>
          <div className={styles.mapCol}>
            <ListingsMapPanel listings={listings} />
          </div>

          <div className={styles.cardsCol}>
            <div className={styles.grid}>
              {listings.map((l) => (
                <Link
                  key={l.id}
                  href={`/listings/${l.id}`}
                  className={styles.card}
                >
                  <div className={styles.cardTop}>
                    <div className={styles.cardTitle}>{l.title}</div>
                    <div className={styles.price}>
                      <span className={styles.priceValue}>
                        ${l.displayPriceValue}
                      </span>
                      <span className={styles.per}>
                        / {l.displayPriceLabel}
                      </span>
                    </div>
                  </div>

                  <div className={styles.cardMeta}>
                    <span className={styles.pill}>
                      {l.city}, {l.state}
                    </span>
                    <span className={styles.pill}>{l.hookups} hookups</span>
                    <span className={styles.pill}>
                      Max {l.maxLengthFt} ft
                    </span>
                  </div>

                  <div className={styles.cardCta}>
                    View spot →
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}