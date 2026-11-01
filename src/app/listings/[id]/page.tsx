"use client";

import Link from "next/link";
import Image from "next/image";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import styles from "./listingdetail.module.css";

import { db } from "@/lib/firebase";
import { doc, getDoc, getDocsFromServer, orderBy, query } from "firebase/firestore";
import { isValidRatingValue, summarizeRatings, type ReviewDirection } from "@/lib/reviews";
import { publishedListingReviews, type ListingRatingState } from "@/lib/listing-ratings";
import { hasListingCoordinates } from "@/lib/listing-location";
import ListingRating from "@/app/components/ListingRating";
import AccommodationDetails from "@/app/components/AccommodationDetails";
import { accommodationRate, capacity, isAccommodation, listingTypeLabel, record, type ListingType, listingType as readListingType } from "@/lib/listing-types";
import ReviewCard, { type ReviewCardItem } from "@/app/components/ReviewCard";
import ReviewSummary from "@/app/components/ReviewSummary";
import BookingPanel from "./bookingpaneltemp";
import ListingPhotoGallery from "../../components/ListingPhotoGallery";
import { listingPhotos, type PhotoFields } from "@/lib/listing-photos";

type Hookups = "Full" | "Partial" | "None";
type PricingType = "Night" | "Weekly" | "Monthly";

type ListingDoc = PhotoFields & {
  listingType?: ListingType;
  accommodation?: unknown;
  stayAmenities?: unknown;
  title?: string;
  city?: string;
  state?: string;
  hostId?: string;

  hookups?: Hookups;
  maxLengthFt?: number;

  power?: string;
  water?: string;
  sewer?: string;
  laundry?: string;
  description?: string;
  nearbyAttractions?: string;

  pricePerNight?: number;
  price?: number;
  pricingType?: PricingType;

  lat?: number;
  lng?: number;

  geocodeAddress?: string;
  placeId?: string;
};

type ListingUI = {
  listingType: ListingType | null;
  raw: Record<string, unknown>;
  photos: string[];
  id: string;
  title: string;
  city: string;
  state: string;
  hostId: string;

  hookups: Hookups;
  maxLengthFt: number;

  displayPriceValue: number | null;
  displayPriceLabel: string;

  power: string;
  water: string;
  sewer: string;
  laundry: string;
  description: string;
  nearbyAttractions: string;

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

  const accommodationMode = isAccommodation(data.listingType);
  const rate = accommodationRate(data);
  const hasNewPrice = typeof data.price === "number" && (!accommodationMode || (Number.isFinite(data.price) && data.price >= 0));
  const hasNewPricingType =
    data.pricingType === "Night" ||
    data.pricingType === "Weekly" ||
    data.pricingType === "Monthly";

  if (hasNewPrice && hasNewPricingType) {
    return {
      listingType: readListingType(data.listingType), raw: data,
      id,
      photos: listingPhotos(data),
      title: title || "(Untitled Listing)",
      city: city || "(City not set)",
      state: state || "(State)",
      hostId: (data.hostId ?? "").toString(),
      hookups,
      maxLengthFt,
      displayPriceValue: data.price as number,
      displayPriceLabel: normalizePricingLabel(data.pricingType as PricingType),
      power,
      water,
      sewer,
      laundry,
      description: (data.description ?? "").toString().trim(),
      nearbyAttractions: (data.nearbyAttractions ?? "").toString().trim(),
      lat,
      lng,
      geocodeAddress,
      placeId,
    };
  }

  const oldPrice = typeof data.pricePerNight === "number" && Number.isFinite(data.pricePerNight) && data.pricePerNight >= 0
    ? data.pricePerNight : accommodationMode ? null : 0;

  return {
    listingType: readListingType(data.listingType), raw: data,
    id,
    photos: listingPhotos(data),
    title: title || "(Untitled Listing)",
    city: city || "(City not set)",
    state: state || "(State)",
      hostId: (data.hostId ?? "").toString(),
    hookups,
    maxLengthFt,
    displayPriceValue: accommodationMode ? rate.price : oldPrice,
    displayPriceLabel: accommodationMode ? rate.label : "night",
    power,
    water,
    sewer,
    laundry,
    description: (data.description ?? "").toString().trim(),
    nearbyAttractions: (data.nearbyAttractions ?? "").toString().trim(),
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
  if (listing.description) return listing.description;
  if (isAccommodation(listing.listingType)) return "The host has not provided an accommodation description yet.";
  const locationText = `${listing.city}, ${listing.state}`;
  const rigText =
    listing.maxLengthFt > 0 ? ` The listed maximum RV length is ${listing.maxLengthFt} ft.` : "";
  return `RV space listed in ${locationText}.${rigText} The host has not added a description yet. Review the listed amenities and location below.`;
}

function buildTravelHighlights(listing: ListingUI) {
  const highlights: string[] = [];
  if (isAccommodation(listing.listingType)) {
    highlights.push(listingTypeLabel(listing.listingType), "Stationary accommodation; no RV of your own needed");
    const maximum = capacity(listing.raw);
    if (maximum !== null) highlights.push(`Host-declared maximum: ${maximum} guests`);
    if (listing.displayPriceValue !== null) highlights.push(`Listed rate: $${listing.displayPriceValue}${listing.displayPriceLabel ? ` per ${listing.displayPriceLabel}` : " (billing period not provided)"}`);
    return highlights;
  }

  if (listing.hookups === "Full") highlights.push("Full hookup setup for an easier stay");
  if (listing.hookups === "Partial") highlights.push("Partial hookups available for added convenience");
  if (listing.maxLengthFt >= 35) highlights.push(`Large-rig friendly with room for up to ${listing.maxLengthFt} ft`);
  if (listing.power !== "None") highlights.push(`${listing.power} power connection available`);
  if (listing.water !== "None") highlights.push("Water access available");
  if (listing.sewer !== "None") highlights.push("Sewer access available");
  if (listing.laundry !== "None") highlights.push(`${listing.laundry} available on site`);
  if (highlights.length < 4) highlights.push(`Listed in ${listing.city}, ${listing.state}`);
  if (highlights.length < 4) highlights.push(`Listed rate: $${listing.displayPriceValue} per ${listing.displayPriceLabel}`);

  return highlights.slice(0, 4);
}

export default function ListingDetailPage() {
  const params = useParams<{ id?: string }>();
  const listingId = params?.id;

  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [listing, setListing] = useState<ListingUI | null>(null);
  const [reviews, setReviews] = useState<ReviewCardItem[]>([]);
  const [reviewsLoading, setReviewsLoading] = useState(true);
  const [reviewsError, setReviewsError] = useState("");
  const [reviewsForId, setReviewsForId] = useState<string>();
  const [reviewRetry, setReviewRetry] = useState(0);

  useEffect(() => {
    let active = true;
    const run = async () => {
      try {
        if (!listingId) {
          setNotFound(true);
          setLoading(false);
          return;
        }

        const ref = doc(db, "listings", listingId);
        const snap = await getDoc(ref);
        if (!active) return;

        if (!snap.exists()) {
          setNotFound(true);
          setListing(null);
        } else {
          setNotFound(false);
          setListing(buildListingUI(snap.id, snap.data() as ListingDoc));
        }
      } catch (e) {
        if (!active) return;
        console.error(e);
        setNotFound(true);
        setListing(null);
      } finally {
        if (active) setLoading(false);
      }
    };

    run();
    return () => { active = false; };
  }, [listingId]);

  useEffect(() => {
    let active = true;
    async function loadListingReviews() {
      if (!listingId) {
        setReviews([]);
        setReviewsLoading(false);
        return;
      }

      setReviewsLoading(true);
      setReviewsError("");
      setReviews([]);
      setReviewsForId(listingId);

      try {
        const snap = await getDocsFromServer(
          query(publishedListingReviews(db, listingId), orderBy("createdAt", "desc"))
        );
        if (!active) return;

        const rows = snap.docs.map((d) => {
          const data = d.data() as {
            reviewerId?: string;
            rating?: number;
            comment?: string;
            createdAt?: unknown;
          };
          if (!isValidRatingValue(data.rating)) throw new Error("Invalid published review rating.");
          return {
            id: d.id,
            reviewerId: data.reviewerId ?? "",
            rating: typeof data.rating === "number" ? data.rating : 0,
            direction: "traveler_to_host" as ReviewDirection,
            comment: typeof data.comment === "string" ? data.comment : "",
            createdAt: data.createdAt,
          };
        });

        const reviewerIds = Array.from(new Set(rows.slice(0, 20).map((row) => row.reviewerId).filter(Boolean)));
        const reviewerMap = new Map<string, string>();

        if (reviewerIds.length > 0) {
          const profileSnaps = await Promise.all(
            reviewerIds.map(async (reviewerId) => {
              try {
                const profileSnap = await getDoc(doc(db, "memberProfiles", reviewerId));
                if (!profileSnap.exists()) return null;
                const data = profileSnap.data() as { displayName?: string; visibility?: string };
                if (data.visibility !== "public") return null;
                return [reviewerId, (data.displayName ?? "RVNB member").toString()];
              } catch {
                return null;
              }
            })
          );

          for (const entry of profileSnaps) {
            if (entry) reviewerMap.set(entry[0], entry[1]);
          }
        }

        const nextReviews: ReviewCardItem[] = rows.map((row) => {
          const reviewerName = reviewerMap.get(row.reviewerId) ?? "RVNB member";
          const initials = reviewerName.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "").join("") || "R";
          const createdAtLabel = (() => {
            const value = row.createdAt;
            if (value && typeof value === "object" && "toDate" in value && typeof (value as { toDate: () => Date }).toDate === "function") {
              try {
                return (value as { toDate: () => Date }).toDate().toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                });
              } catch {
                return "Recent review";
              }
            }
            return "Recent review";
          })();

          return {
            id: row.id,
            reviewerId: row.reviewerId,
            reviewerName,
            reviewerInitials: initials,
            rating: row.rating,
            direction: "traveler_to_host",
            comment: row.comment,
            createdAtLabel,
            verified: true,
          };
        });

        if (active) setReviews(nextReviews);
      } catch (e) {
        if (!active) return;
        console.error("[RVNB] listing reviews query failed", e);
        setReviews([]);
        setReviewsError("We couldn't load reviews right now.");
      } finally {
        if (active) setReviewsLoading(false);
      }
    }

    loadListingReviews();
    return () => { active = false; };
  }, [listingId, reviewRetry]);

  const hasCoords = useMemo(() => {
    return !!listing && hasListingCoordinates(listing);
  }, [listing]);

  const mapsUrl = useMemo(() => {
    if (!listing) return "";
    if (!hasListingCoordinates(listing)) return "";
    return buildGoogleMapsUrl(listing.lat, listing.lng, listing.placeId);
  }, [listing]);

  const listingReviewSummary = useMemo(() => summarizeRatings(reviews.map((review) => ({ rating: review.rating }))), [reviews]);
  const reviewsPending = reviewsLoading || reviewsForId !== listingId;
  const ratingState: ListingRatingState = reviewsPending ? { status: "loading" }
    : reviewsError ? { status: "error", message: reviewsError }
    : { status: "ready", summary: listingReviewSummary };

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

  if (loading || (listing !== null && listing.id !== listingId)) {
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
        <div className={styles.topBar}>
          <Link href="/" className={styles.brand} aria-label="RVNB Home">
            <Image src="/rvnb-logo-icon.png" alt="RVNB" width={2000} height={1333}
              sizes="(max-width: 540px) 267px, 320px" className={styles.brandIcon} />
          </Link>
        <Link href="/listings" className={styles.backLink}>
          ← Back to listings
        </Link>
        </div>

        <div className={styles.header}>
          <div className={styles.headerContent}>
            <p className={styles.eyebrow}>RVNB stays marketplace</p>
            <h1 className={styles.h1}>{listing.title}</h1>

            <div className={styles.location}>
              {listing.city}, {listing.state}
            </div>

            {listing.geocodeAddress ? (
              <div className={styles.addressLine}>{listing.geocodeAddress === "MANUAL_PIN" ? "Host-selected map location." : listing.geocodeAddress}</div>
            ) : null}

            <div className={styles.ratingLocation}>
              <a href="#listing-reviews" className={styles.summaryLink}>
                <ListingRating state={ratingState} />
              </a>
              {hasCoords ? <a href="#listing-location" className={styles.summaryLink}>View location</a>
                : <span className={styles.locationHelpText}>Location not mapped yet</span>}
            </div>

            <div className={styles.headerBadges}>
              <span className={styles.headerBadge}>{listingTypeLabel(listing.listingType)}</span>
              <span className={styles.headerBadge}>Host listing</span>
              {hasCoords ? (
                <span className={styles.headerBadgeAccent}>Map pin saved</span>
              ) : (
                <span className={styles.headerBadge}>Map pin not provided</span>
              )}
            </div>
          </div>

          <div className={styles.priceBox}>
            <div className={styles.priceValue}>{listing.displayPriceValue === null ? "Rate not provided" : `$${listing.displayPriceValue}`}</div>
            <div className={styles.priceLabel}>{listing.displayPriceLabel ? `per ${listing.displayPriceLabel}` : "Billing period not provided"}</div>
          </div>
        </div>

        <ListingPhotoGallery key={listing.id} photos={listing.photos} fallback={<div className={styles.photoShowcase}>
          <div className={styles.photoHero}>
            <div className={styles.photoOverlayContent}>
              <div className={styles.photoEyebrow}>RVNB Listing Preview</div>
              <div className={styles.photoHeadline}>Host photos have not been added yet.</div>
              <div className={styles.photoCaption}>
                Review the listing details, amenities, and saved location below. This is an RVNB placeholder, not a property photo.
              </div>
              <div className={styles.photoBadge}>
                <CameraIcon />
                Photos not available
              </div>
            </div>
          </div>
        </div>} />

        <div className={styles.layout}>
          <div className={styles.leftCol}>
            {isAccommodation(listing.listingType) ? <AccommodationDetails data={listing.raw} /> : <>
            <div className={styles.card}>
              <h2 className={styles.cardTitle}>Quick highlights</h2>

              <div className={styles.highlightsGrid}>
                <div className={styles.highlightTile}>
                  <div className={styles.highlightLabel}>Hookups</div>
                  <div className={styles.highlightValue}>{listing.hookups}</div>
                </div>

                <div className={styles.highlightTile}>
                  <div className={styles.highlightLabel}>Rig size</div>
                  <div className={styles.highlightValue}>
                    {listing.maxLengthFt > 0 ? `${listing.maxLengthFt} ft max` : "Not specified"}
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
                  <div className={styles.highlightValue}>{hasCoords ? "Map pin saved" : "General details"}</div>
                </div>
              </div>
            </div>

            <div className={styles.card}>
              <h2 className={styles.cardTitle}>Spot details</h2>

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
                Ask the host for approach, parking, and hookup details if you need extra arrival context.
              </div>
            </div>
            </>}

            <div className={styles.card}>
              <h2 className={styles.cardTitle}>About this spot</h2>
              <p className={styles.paragraph}>{aboutText}</p>
              {listing.nearbyAttractions && <>
                <h3 className={styles.subheading}>Nearby attractions</h3>
                <p className={styles.paragraph}>{listing.nearbyAttractions}</p>
              </>}
            </div>

            <section id="listing-reviews" tabIndex={-1} aria-label="Ratings and reviews" className={`${styles.card} ${styles.anchorSection}`}>
              <div role={!reviewsPending && reviewsError ? "alert" : undefined}>
                <ReviewSummary
                  title="Ratings & reviews"
                  average={listingReviewSummary.average}
                  count={listingReviewSummary.count}
                  loading={reviewsPending}
                  error={reviewsError || undefined}
                  emptyText="No reviews yet."
                />
                {!reviewsPending && reviewsError && <div>
                  <button type="button" className={styles.mapAction} onClick={() => setReviewRetry(value => value + 1)}>Retry reviews</button>
                </div>}
              </div>

              {!reviewsPending && !reviewsError && reviews.length > 0 && (
                <div style={{ display: "grid", gap: 12, marginTop: 12 }}>
                  {reviews.length > 20 && <p className={styles.locationHelpText}>Showing the latest 20 of {reviews.length} reviews. The rating includes all published traveler reviews for this listing.</p>}
                  {reviews.slice(0, 20).map((review) => (
                    <ReviewCard key={review.id} review={review} />
                  ))}
                </div>
              )}
            </section>

            <div className={styles.card}>
              <h2 className={styles.cardTitle}>Listing highlights</h2>

              <div className={styles.travelList}>
                {travelHighlights.map((item) => (
                  <div key={item} className={styles.travelListItem}>
                    <span className={styles.travelCheck}>✓</span>
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>

            <section id="listing-location" tabIndex={-1} aria-label="Location" className={`${styles.card} ${styles.anchorSection}`}>
              <h2 className={styles.cardTitle}>Location</h2>

              <div className={styles.locationStatusRow}>
                <span className={styles.locationStatusLabel}>Location details</span>
                <span className={hasCoords ? styles.locationBadgeExact : styles.locationBadgeSoft}>
                  {hasCoords ? "Host-selected location" : "Location not mapped yet"}
                </span>
              </div>

              {listing.geocodeAddress ? (
                <p className={styles.paragraph} style={{ marginTop: 10 }}>
                  {listing.geocodeAddress === "MANUAL_PIN" ? "Host-selected map location." : <><b>Saved address:</b> {listing.geocodeAddress}</>}
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
            </section>

            <div className={styles.card}>
              <h2 className={styles.cardTitle}>What to expect</h2>
              <p className={styles.paragraph}>
                Sending a date inquiry does not reserve this space or confirm a stay. The host must approve
                the inquiry before the stay is confirmed. Include any arrival questions in the optional note.
              </p>
            </div>
          </div>

          <div className={styles.rightCol}>
            {listing.displayPriceValue !== null && listing.displayPriceLabel ? <BookingPanel
              key={listing.id}
              listingId={listing.id}
              hostId={listing.hostId}
              nightlyPrice={listing.displayPriceValue}
              priceLabel={listing.displayPriceLabel}
              listingType={listing.listingType}
              accommodation={record(listing.raw.accommodation)}
            /> : <section className={styles.bookingCard}><h2 className={styles.bookingTitle}>Rate information incomplete</h2><p className={styles.bookingSub}>The host must provide a valid rate and billing period before date inquiries are available.</p></section>}
          </div>
        </div>
      </div>
    </div>
  );
}