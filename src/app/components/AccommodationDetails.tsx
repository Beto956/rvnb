import { capacity, isAccommodation, listingTypeLabel, record, sleepingLabel } from "@/lib/listing-types";
import StayAmenities from "./StayAmenities";
import styles from "../listings/[id]/listingdetail.module.css";

export default function AccommodationDetails({ data }: { data: Record<string, unknown> }) {
  const a = record(data.accommodation);
  const text = (key: string) => typeof a[key] === "string" && String(a[key]).trim() ? String(a[key]) : "Not provided";
  const count = (key: string) => {
    const value = a[key];
    return typeof value === "number" && value >= (key === "sleepingAreas" ? 1 : 0) && value <= 20
      && Number.isInteger(key === "bathrooms" ? value * 2 : value) ? String(value) : "Not provided";
  };
  return <>
    <section className={styles.card}>
      <h2 className={styles.cardTitle}>Your accommodation</h2>
      <p className={styles.paragraph}>{listingTypeLabel(data.listingType)} · {capacity(data) === null ? "Guest capacity not provided" : `Up to ${capacity(data)} guests`}</p>
      <p className={styles.paragraph}>Stationary accommodation. Guests may not drive, tow, or remove it. One independently bookable unit.</p>
      <div className={styles.features}>
        {[
          ["Bedrooms", a.bedrooms === 0 ? "Studio / open sleeping arrangement" : count("bedrooms")],
          ["Sleeping areas", count("sleepingAreas")], ["Beds", sleepingLabel(data)], ["Bathrooms in unit", count("bathrooms")],
        ].map(([label, value]) => <div className={styles.featureRow} key={label}><span className={styles.featureKey}>{label}</span><span className={styles.featureVal}>{value}</span></div>)}
      </div>
      {data.listingType === "host_rv" && <p className={styles.paragraph}>RV type: {text("rvType")} · Approximate size: {typeof a.rvLengthFt === "number" && Number.isFinite(a.rvLengthFt) && a.rvLengthFt > 0 && a.rvLengthFt <= 100 ? `${a.rvLengthFt} ft` : "Not provided"}</p>}
    </section>
    <section className={styles.card}><h2 className={styles.cardTitle}>Accommodation amenities</h2><StayAmenities data={data} /></section>
    <section className={styles.card}>
      <h2 className={styles.cardTitle}>Arrival, departure & house rules</h2>
      <p className={styles.paragraph}>Check-in from: {text("checkInFrom")} · until: {text("checkInTo")}<br />Check-out by: {text("checkOutBy")}</p>
      <h3 className={styles.subheading}>House rules</h3><p className={styles.paragraph} style={{ whiteSpace: "pre-wrap" }}>{text("houseRules")}</p>
      {isAccommodation(data.listingType) && <><h3 className={styles.subheading}>Specific access features</h3><p className={styles.paragraph}>{text("accessNotes")}</p><p className={styles.note}>Host-described features, not a claim of accessibility compliance.</p></>}
      {data.listingType === "host_rv" && <><h3 className={styles.subheading}>Utility arrangements / limitations</h3><p className={styles.paragraph}>{text("utilityNotes")}</p></>}
    </section>
  </>;
}
