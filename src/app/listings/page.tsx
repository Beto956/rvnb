import Link from "next/link";
import styles from "./listings.module.css";

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

  displayPriceValue: number;
  displayPriceLabel: string; // "night" | "week" | "month"
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
    displayPriceValue: oldPrice,
    displayPriceLabel: "night",
  };
}

function CameraIcon() {
  // Inline SVG so we don’t add any dependencies
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M9 7l1.2-2.2c.3-.5.8-.8 1.4-.8h2.8c.6 0 1.1.3 1.4.8L17 7"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M7 7h10c2 0 3 1 3 3v8c0 2-1 3-3 3H7c-2 0-3-1-3-3v-8c0-2 1-3 3-3z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M12 17a4 4 0 100-8 4 4 0 000 8z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default async function ListingsPage() {
  const snap = await getDocs(collection(db, "listings"));

  const listings: ListingUI[] = snap.docs.map((docSnap) => {
    const data = docSnap.data() as ListingDoc;
    return buildListingUI(docSnap.id, data);
  });

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        {/* Hero */}
        <div className={styles.heroCard}>
          <div className={styles.badge}>
            <span className={styles.badgeDot} />
            Explore
          </div>

          <h1 className={styles.h1}>RVNB Listings</h1>
          <p className={styles.sub}>
            Discover RV spots across the country — clean, host-backed, and built
            for real RV life.
          </p>

          <div className={styles.countLine}>
            Showing <strong>{listings.length}</strong> available spots
          </div>
        </div>

        {listings.length === 0 ? (
          <div className={styles.emptyCard}>
            <div className={styles.emptyTitle}>No listings yet.</div>
            <div className={styles.emptySub}>
              Be the first to list your RV spot.
            </div>

            <Link href="/host" className={styles.primaryBtn}>
              List Your Spot
            </Link>
          </div>
        ) : (
          <div className={styles.grid}>
            {listings.map((l) => (
              <Link
                key={l.id}
                href={`/listings/${l.id}`}
                className={styles.card}
              >
                {/* Photo area (future-ready) */}
                <div className={styles.photoArea}>
                  <div className={styles.photoBadge}>
                    <CameraIcon />
                    <span>Photos coming soon</span>
                  </div>
                </div>

                <div className={styles.cardTop}>
                  <div className={styles.cardTitle}>{l.title}</div>

                  <div className={styles.price}>
                    <span className={styles.priceValue}>
                      ${l.displayPriceValue}
                    </span>
                    <span className={styles.per}>/ {l.displayPriceLabel}</span>
                  </div>
                </div>

                <div className={styles.cardMeta}>
                  <span className={styles.pill}>
                    {l.city}, {l.state}
                  </span>
                  <span className={styles.pill}>{l.hookups} hookups</span>
                  <span className={styles.pill}>Max {l.maxLengthFt} ft</span>
                </div>

                <div className={styles.cardCta}>
                  View spot <span className={styles.arrow}>→</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
