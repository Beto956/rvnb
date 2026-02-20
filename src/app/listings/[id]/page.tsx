"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import styles from "./listingdetail.module.css";

import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import BookingPanel from "./bookingpaneltemp";

type Hookups = "Full" | "Partial" | "None";
type PricingType = "Night" | "Weekly" | "Monthly";

type ListingDoc = {
  title?: string;
  city?: string;
  state?: string;

  hookups?: Hookups;
  maxLengthFt?: number;

  // Optional amenities (if you have them already)
  power?: string; // "None" | "15A" | "30A" | "50A" etc
  water?: string;
  sewer?: string;
  laundry?: string;

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
  displayPriceLabel: string;

  power: string;
  water: string;
  sewer: string;
  laundry: string;
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
  const maxLengthFt = typeof data.maxLengthFt === "number" ? data.maxLengthFt : 0;

  const power = (data.power ?? "None").toString();
  const water = (data.water ?? "None").toString();
  const sewer = (data.sewer ?? "None").toString();
  const laundry = (data.laundry ?? "None").toString();

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
      power,
      water,
      sewer,
      laundry,
    };
  }

  const oldPrice = typeof data.pricePerNight === "number" ? data.pricePerNight : 0;

  return {
    id,
    title: title || "(Untitled Listing)",
    city: city || "(City not set)",
    state: state || "(State)",
    hookups,
    maxLengthFt,
    displayPriceValue: oldPrice,
    displayPriceLabel: "night",
    power,
    water,
    sewer,
    laundry,
  };
}

function CameraIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
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

export default function ListingDetailPage() {
  const params = useParams<{ id?: string }>();
  const listingId = params?.id;

  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [listing, setListing] = useState<ListingUI | null>(null);

  useEffect(() => {
    const run = async () => {
      try {
        if (!listingId) {
          setNotFound(true);
          setLoading(false);
          return;
        }

        const ref = doc(db, "listings", listingId);
        const snap = await getDoc(ref);

        if (!snap.exists()) {
          setNotFound(true);
          setListing(null);
        } else {
          setNotFound(false);
          setListing(buildListingUI(snap.id, snap.data() as ListingDoc));
        }
      } catch (e) {
        console.error(e);
        setNotFound(true);
        setListing(null);
      } finally {
        setLoading(false);
      }
    };

    run();
  }, [listingId]);

  // Missing ID (or navigated weirdly)
  if (!listingId) {
    return (
      <div className={styles.page}>
        <div className={styles.container}>
          <Link href="/listings" className={styles.backLink}>
            ← Back to listings
          </Link>
          <div className={styles.heroCard}>
            <h1 className={styles.h1}>Listing ID missing</h1>
            <p className={styles.sub}>
              This page needs a listing id in the URL. Example: /listings/ABC123
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className={styles.page}>
        <div className={styles.container}>
          <Link href="/listings" className={styles.backLink}>
            ← Back to listings
          </Link>
          <div className={styles.heroCard}>
            <h1 className={styles.h1}>Loading…</h1>
            <p className={styles.sub}>Fetching listing details.</p>
          </div>
        </div>
      </div>
    );
  }

  if (notFound || !listing) {
    return (
      <div className={styles.page}>
        <div className={styles.container}>
          <Link href="/listings" className={styles.backLink}>
            ← Back to listings
          </Link>
          <div className={styles.heroCard}>
            <h1 className={styles.h1}>Listing not found</h1>
            <p className={styles.sub}>
              This listing may have been removed or the link is incorrect.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <Link href="/listings" className={styles.backLink}>
          ← Back to listings
        </Link>

        {/* Header */}
        <div className={styles.header}>
          <div>
            <h1 className={styles.h1}>{listing.title}</h1>
            <div className={styles.location}>
              {listing.city}, {listing.state}
            </div>
          </div>

          <div className={styles.priceBox}>
            <div className={styles.priceValue}>${listing.displayPriceValue}</div>
            <div className={styles.priceLabel}>per {listing.displayPriceLabel}</div>
          </div>
        </div>

        {/* Photo area */}
        <div className={styles.photoArea}>
          <div className={styles.photoBadge}>
            <CameraIcon />
            Photos coming soon
          </div>
        </div>

        {/* Main layout */}
        <div className={styles.layout}>
          {/* Left column */}
          <div className={styles.leftCol}>
            <div className={styles.card}>
              <div className={styles.cardTitle}>Spot details</div>

              <div className={styles.pills}>
                <span className={styles.pill}>Hookups: {listing.hookups}</span>
                <span className={styles.pill}>Max RV length: {listing.maxLengthFt} ft</span>
              </div>

              <div className={styles.features}>
                <div className={styles.featureRow}>
                  <span className={styles.featureKey}>Power</span>
                  <span className={styles.featureVal}>{listing.power}</span>
                </div>
                <div className={styles.featureRow}>
                  <span className={styles.featureKey}>Water</span>
                  <span className={styles.featureVal}>{listing.water}</span>
                </div>
                <div className={styles.featureRow}>
                  <span className={styles.featureKey}>Sewer</span>
                  <span className={styles.featureVal}>{listing.sewer}</span>
                </div>
                <div className={styles.featureRow}>
                  <span className={styles.featureKey}>Laundry</span>
                  <span className={styles.featureVal}>{listing.laundry}</span>
                </div>
              </div>

              <div className={styles.note}>
                Tip: When photos are added later, this page won’t change — only the photo area fills in.
              </div>
            </div>

            <div className={styles.card}>
              <div className={styles.cardTitle}>What to expect</div>
              <p className={styles.paragraph}>
                RVNB spots are designed to be simple, host-backed places to park and reset.
                This listing page will expand later with rules, check-in instructions, and verified details.
              </p>
            </div>
          </div>

          {/* Right column (Booking) */}
          <div className={styles.rightCol}>
            <BookingPanel
              listingId={listing.id}
              nightlyPrice={listing.displayPriceValue}
              priceLabel={listing.displayPriceLabel}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
