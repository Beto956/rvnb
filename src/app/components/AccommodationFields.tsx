"use client";
import { BED_TYPES, type Accommodation } from "@/lib/listing-types";
import { AMENITY_STATE_LABELS, AMENITY_STATES, relevantAmenities, type StayAmenities, type AmenityState } from "@/lib/stay-amenities";
import { AmenityIcon } from "./StayAmenities";
import styles from "./stayFields.module.css";

export default function AccommodationFields({ type, value, amenities, onChange, onAmenities }: {
  type: string; value: Accommodation; amenities: StayAmenities;
  onChange: (value: Accommodation) => void; onAmenities: (value: StayAmenities) => void;
}) {
  const catalog = relevantAmenities(type);
  return <div className={styles.fields}>
    <p className={styles.notice}>One independently bookable accommodation per listing. It is stationary: guests may not drive, tow, or remove it. Hidden RV-space fields and other type-specific data are retained, not offered to these guests.</p>
    <div className={styles.grid}>
      {(["maxGuests", "bedrooms", "sleepingAreas", "bathrooms"] as const).map(key => <label key={key}>
        {{ maxGuests: "Maximum guests (1–30)", bedrooms: "Bedrooms (0 for studio)", sleepingAreas: "Sleeping areas", bathrooms: "Bathrooms (0 if none in unit)" }[key]}
        <input type="number" min={key === "maxGuests" || key === "sleepingAreas" ? 1 : 0} max={key === "maxGuests" ? 30 : 20} step={key === "bathrooms" ? .5 : 1} value={Number.isNaN(value[key]) ? "" : value[key]} onChange={event => onChange({ ...value, [key]: event.target.value === "" ? NaN : Number(event.target.value) })} required />
      </label>)}
    </div>
    <fieldset><legend>Beds, by type (count bunk beds, not assumed guest capacity)</legend><div className={styles.grid}>
      {BED_TYPES.map(key => <label key={key}>{key === "sofa" ? "Sofa beds" : key === "bunk" ? "Bunk beds" : `${key[0].toUpperCase()}${key.slice(1)} beds`}
        <input type="number" min={0} max={30} step={1} value={value.beds[key]} onChange={event => onChange({ ...value, beds: { ...value.beds, [key]: event.target.value === "" ? NaN : Number(event.target.value) } })} />
      </label>)}
    </div></fieldset>
    <div className={styles.grid}>
      {(["checkInFrom", "checkInTo", "checkOutBy"] as const).map(key => <label key={key}>{{ checkInFrom: "Check-in from (optional)", checkInTo: "Check-in until (optional)", checkOutBy: "Check-out by (optional)" }[key]}
        <input type="time" value={value[key]} onChange={event => onChange({ ...value, [key]: event.target.value })} />
      </label>)}
    </div>
    <label>House rules (optional; up to 2,000 characters)<textarea maxLength={2000} value={value.houseRules} onChange={event => onChange({ ...value, houseRules: event.target.value })} /></label>
    {type === "host_rv" && <>
      <div className={styles.grid}><label>RV type<input maxLength={80} required value={value.rvType} onChange={event => onChange({ ...value, rvType: event.target.value })} /></label>
        <label>Approximate RV size (ft)<input type="number" min={1} max={100} required value={value.rvLengthFt ?? ""} onChange={event => onChange({ ...value, rvLengthFt: event.target.value === "" ? null : Number(event.target.value) })} /></label></div>
      <label>Host-managed utility arrangements / limitations<textarea maxLength={1000} value={value.utilityNotes} onChange={event => onChange({ ...value, utilityNotes: event.target.value })} /></label>
    </>}
    <label>Specific access features or limitations (optional; no compliance claim)<textarea maxLength={500} value={value.accessNotes} onChange={event => onChange({ ...value, accessNotes: event.target.value })} /></label>
    <h3>Declared accommodation amenities</h3>
    <p className={styles.help}>Choose only what is actually provided. Private/in-unit and shared are different. Not provided is not “No.” Full kitchen, kitchenette, and shared cooking facilities are separately described. Safety items are host declarations, not inspections.</p>
    {Array.from(new Set(catalog.map(([, , group]) => group))).map(group => <fieldset key={group}><legend>{group}</legend><div className={styles.grid}>
      {catalog.filter(([, , value]) => value === group).map(([key, label, , icon]) => <label key={key}>
        <span className={styles.iconLabel}><AmenityIcon kind={icon} />{label}</span>
        <select value={amenities[key] ?? "unknown"} onChange={event => onAmenities({ ...amenities, [key]: event.target.value as AmenityState })}>
          {AMENITY_STATES.map(state => <option key={state} value={state}>{AMENITY_STATE_LABELS[state]}</option>)}
        </select>
      </label>)}
    </div></fieldset>)}
  </div>;
}
