"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
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

  power?: string;
  water?: string;
  sewer?: string;
  laundry?: string;

  pricePerNight?: number;
  price?: number;
  pricingType?: PricingType;

  lat?: number;
  lng?: number;

  geocodeAddress?: string;
  placeId?: string;
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

  lat?: number;
  lng?: number;
  geocodeAddress?: string;
  placeId?: string;
};

function normalizePricingLabel(pricingType: PricingType): string {
  if (pricingType === "Night") return "night";
  if (pricingType === "Weekly") return "week";
  return "month";
}

function buildGoogleMapsUrl(lat: number, lng: number, placeId?: string) {
  if (placeId && placeId.trim()) {
    return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}&query_place_id=${encodeURIComponent(
      placeId
    )}`;
  }
  return `https://www.google.com/maps?q=${lat},${lng}`;
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

  const lat = typeof data.lat === "number" ? data.lat : undefined;
  const lng = typeof data.lng === "number" ? data.lng : undefined;
  const geocodeAddress = (data.geocodeAddress ?? "").toString().trim() || undefined;
  const placeId = (data.placeId ?? "").toString().trim() || undefined;

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
      lat,
      lng,
      geocodeAddress,
      placeId,
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
    lat,
    lng,
    geocodeAddress,
    placeId,
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

function AmenityIcon({ symbol }: { symbol: string }) {
  return <span className={styles.amenityIcon}>{symbol}</span>;
}

function buildAboutText(listing: ListingUI) {
  const locationText = `${listing.city}, ${listing.state}`;
  const rigText =
    listing.maxLengthFt > 0 ? `for rigs up to ${listing.maxLengthFt} ft` : "for a range of RV sizes";

  return `This RVNB stay in ${locationText} is designed to be a simple, comfortable stop ${
    listing.hookups !== "None" ? `with ${listing.hookups.toLowerCase()} hookups` : ""
  } ${rigText}. Whether you're passing through, staying for the week, or looking for a reliable reset point, this listing is built to give travelers a clean, host-backed place to park and settle in.`;
}

function buildTravelHighlights(listing: ListingUI) {
  const highlights: string[] = [];

  if (listing.hookups === "Full") highlights.push("Full hookup setup for an easier stay");
  if (listing.hookups === "Partial") highlights.push("Partial hookups available for added convenience");
  if (listing.maxLengthFt >= 35) highlights.push(`Large-rig friendly with room for up to ${listing.maxLengthFt} ft`);
  if (listing.power !== "None") highlights.push(`${listing.power} power connection available`);
  if (listing.water !== "None") highlights.push("Water access available");
  if (listing.sewer !== "None") highlights.push("Sewer access available");
  if (listing.laundry !== "None") highlights.push(`${listing.laundry} available on site`);
  if (highlights.length < 4) highlights.push("Host-backed booking experience through RVNB");
  if (highlights.length < 4) highlights.push("Simple stopover setup with future-ready listing details");

  return highlights.slice(0, 4);
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

  const hasCoords = useMemo(() => {
    return !!listing && typeof listing.lat === "number" && typeof listing.lng === "number";
  }, [listing]);

  const mapsUrl = useMemo(() => {
    if (!listing) return "";
    if (typeof listing.lat !== "number" || typeof listing.lng !== "number") return "";
    return buildGoogleMapsUrl(listing.lat, listing.lng, listing.placeId);
  }, [listing]);

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
            <p className={styles.sub}>This listing may have been removed or the link is incorrect.</p>
          </div>
        </div>
      </div>
    );
  }

  const travelHighlights = buildTravelHighlights(listing);
  const aboutText = buildAboutText(listing);

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <Link href="/listings" className={styles.backLink}>
          ← Back to listings
        </Link>

        <div className={styles.header}>
          <div className={styles.headerContent}>
            <h1 className={styles.h1}>{listing.title}</h1>

            <div className={styles.location}>
              {listing.city}, {listing.state}
            </div>

            {listing.geocodeAddress ? (
              <div className={styles.addressLine}>{listing.geocodeAddress}</div>
            ) : null}

            <div className={styles.headerBadges}>
              <span className={styles.headerBadge}>RV-ready stay</span>
              <span className={styles.headerBadge}>Host-backed</span>
              {hasCoords ? (
                <span className={styles.headerBadgeAccent}>📍 Exact pin saved</span>
              ) : (
                <span className={styles.headerBadge}>Location details available</span>
              )}
            </div>
          </div>

          <div className={styles.priceBox}>
            <div className={styles.priceValue}>${listing.displayPriceValue}</div>
            <div className={styles.priceLabel}>per {listing.displayPriceLabel}</div>
          </div>
        </div>

        <div className={styles.photoShowcase}>
          <div className={styles.photoHero}>
            <div className={styles.photoOverlayContent}>
              <div className={styles.photoEyebrow}>RVNB Listing Preview</div>
              <div className={styles.photoHeadline}>A cleaner, richer listing experience starts here.</div>
              <div className={styles.photoCaption}>
                Photos can be added later without changing the page structure.
              </div>
              <div className={styles.photoBadge}>
                <CameraIcon />
                Photos coming soon
              </div>
            </div>
          </div>

          <div className={styles.photoThumbGrid}>
            <div className={styles.photoThumb}>Arrival view</div>
            <div className={styles.photoThumb}>Hookup area</div>
            <div className={styles.photoThumb}>Parking setup</div>
            <div className={styles.photoThumb}>Surroundings</div>
          </div>
        </div>

        <div className={styles.layout}>
          <div className={styles.leftCol}>
            <div className={styles.card}>
              <div className={styles.cardTitle}>Quick highlights</div>

              <div className={styles.highlightsGrid}>
                <div className={styles.highlightTile}>
                  <div className={styles.highlightLabel}>Hookups</div>
                  <div className={styles.highlightValue}>{listing.hookups}</div>
                </div>

                <div className={styles.highlightTile}>
                  <div className={styles.highlightLabel}>Rig size</div>
                  <div className={styles.highlightValue}>
                    {listing.maxLengthFt > 0 ? `${listing.maxLengthFt} ft max` : "Flexible"}
                  </div>
                </div>

                <div className={styles.highlightTile}>
                  <div className={styles.highlightLabel}>Rate</div>
                  <div className={styles.highlightValue}>
                    ${listing.displayPriceValue}/{listing.displayPriceLabel}
                  </div>
                </div>

                <div className={styles.highlightTile}>
                  <div className={styles.highlightLabel}>Location</div>
                  <div className={styles.highlightValue}>{hasCoords ? "Exact pin saved" : "General details"}</div>
                </div>
              </div>
            </div>

            <div className={styles.card}>
              <div className={styles.cardTitle}>Spot details</div>

              <div className={styles.pills}>
                <span className={styles.pill}>Hookups: {listing.hookups}</span>
                <span className={styles.pill}>Max RV length: {listing.maxLengthFt} ft</span>
              </div>

              <div className={styles.features}>
                <div className={styles.featureRow}>
                  <div className={styles.featureLeft}>
                    <AmenityIcon symbol="⚡" />
                    <span className={styles.featureKey}>Power</span>
                  </div>
                  <span className={styles.featureVal}>{listing.power}</span>
                </div>

                <div className={styles.featureRow}>
                  <div className={styles.featureLeft}>
                    <AmenityIcon symbol="🚿" />
                    <span className={styles.featureKey}>Water</span>
                  </div>
                  <span className={styles.featureVal}>{listing.water}</span>
                </div>

                <div className={styles.featureRow}>
                  <div className={styles.featureLeft}>
                    <AmenityIcon symbol="🧻" />
                    <span className={styles.featureKey}>Sewer</span>
                  </div>
                  <span className={styles.featureVal}>{listing.sewer}</span>
                </div>

                <div className={styles.featureRow}>
                  <div className={styles.featureLeft}>
                    <AmenityIcon symbol="🧺" />
                    <span className={styles.featureKey}>Laundry</span>
                  </div>
                  <span className={styles.featureVal}>{listing.laundry}</span>
                </div>
              </div>

              <div className={styles.note}>
                Tip: When photos are added later, this page won’t change — only the photo area fills in.
              </div>
            </div>

            <div className={styles.card}>
              <div className={styles.cardTitle}>About this spot</div>
              <p className={styles.paragraph}>{aboutText}</p>
            </div>

            <div className={styles.card}>
              <div className={styles.cardTitle}>Why travelers like this spot</div>

              <div className={styles.travelList}>
                {travelHighlights.map((item) => (
                  <div key={item} className={styles.travelListItem}>
                    <span className={styles.travelCheck}>✓</span>
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className={styles.card}>
              <div className={styles.cardTitle}>Location</div>

              <div className={styles.locationStatusRow}>
                <span className={styles.locationStatusLabel}>Location details</span>
                <span className={hasCoords ? styles.locationBadgeExact : styles.locationBadgeSoft}>
                  {hasCoords ? "Exact pin available" : "General location only"}
                </span>
              </div>

              {listing.geocodeAddress ? (
                <p className={styles.paragraph} style={{ marginTop: 10 }}>
                  <b>Saved address:</b> {listing.geocodeAddress}
                </p>
              ) : (
                <p className={styles.paragraph} style={{ marginTop: 10 }}>
                  <b>Address:</b> Not provided.
                </p>
              )}

              {hasCoords ? (
                <>
                  <div className={styles.features} style={{ marginTop: 10 }}>
                    <div className={styles.featureRow}>
                      <div className={styles.featureLeft}>
                        <AmenityIcon symbol="📍" />
                        <span className={styles.featureKey}>Latitude</span>
                      </div>
                      <span className={styles.featureVal}>{listing.lat}</span>
                    </div>

                    <div className={styles.featureRow}>
                      <div className={styles.featureLeft}>
                        <AmenityIcon symbol="🧭" />
                        <span className={styles.featureKey}>Longitude</span>
                      </div>
                      <span className={styles.featureVal}>{listing.lng}</span>
                    </div>
                  </div>

                  <div className={styles.locationActions}>
                    <a
                      href={mapsUrl}
                      target="_blank"
                      rel="noreferrer"
                      className={styles.mapAction}
                    >
                      Open in Google Maps →
                    </a>

                    <span className={styles.locationHelpText}>
                      Rural property? Hosts can save the entrance or driveway pin for easier arrival.
                    </span>
                  </div>
                </>
              ) : (
                <div className={styles.note} style={{ marginTop: 10 }}>
                  No exact pin saved for this listing yet. Hosts can add a manual pin when creating the listing.
                </div>
              )}
            </div>

            <div className={styles.card}>
              <div className={styles.cardTitle}>What to expect</div>
              <p className={styles.paragraph}>
                RVNB spots are designed to be simple, host-backed places to park and reset. This listing page will
                expand later with rules, check-in instructions, and verified details.
              </p>
            </div>
          </div>

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