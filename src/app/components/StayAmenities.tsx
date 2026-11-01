import { AMENITY_STATE_LABELS, relevantAmenities, normalizeStayAmenities } from "@/lib/stay-amenities";
import styles from "./stayFields.module.css";

export function AmenityIcon({ kind }: { kind: string }) {
  const paths: Record<string, string> = {
    signal: "M3 9a15 15 0 0 1 18 0M6 13a10 10 0 0 1 12 0M10 17a3 3 0 0 1 4 0M12 21h.01",
    climate: "M12 3v18M3 12h18M5 5l14 14M5 19 19 5",
    home: "m3 11 9-8 9 8M5 10v11h14V10M10 21v-7h4v7",
    water: "M12 3S5 11 5 15a7 7 0 0 0 14 0c0-4-7-12-7-12Z",
    outdoors: "m12 3-8 11h5l-4 5h14l-4-5h5L12 3ZM12 19v3",
    power: "m13 2-9 12h7l-1 8 10-13h-8l1-7Z",
    shield: "m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6l8-3Z",
  };
  return <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d={paths[kind] ?? paths.home} /></svg>;
}
export default function StayAmenities({ data }: { data: Record<string, unknown> }) {
  const amenities = normalizeStayAmenities(data), catalog = relevantAmenities(data.listingType);
  return <div className={styles.groups}>
    {Array.from(new Set(catalog.map(([, , group]) => group))).map(group => <section key={group}>
      <h3>{group}</h3>
      {group === "Host safety declarations" && <p className={styles.help}>Host declarations only, not RVNB inspections or safety certifications.</p>}
      <dl className={styles.amenities}>{catalog.filter(([, , value]) => value === group).map(([key, label, , icon]) => <div key={key}>
        <dt><AmenityIcon kind={icon} />{label}</dt><dd>{AMENITY_STATE_LABELS[amenities[key] ?? "unknown"]}</dd>
      </div>)}</dl>
    </section>)}
  </div>;
}
