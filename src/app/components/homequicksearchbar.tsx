"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "../page.module.css";

type Hookups = "Full" | "Partial" | "None" | "";

type StateOption = {
  code: string;
  name: string;
};

export default function HomeQuickSearchBar() {
  const router = useRouter();

  const states: StateOption[] = useMemo(
    () => [
      { code: "", name: "Any State" },
      { code: "AL", name: "Alabama" },
      { code: "AK", name: "Alaska" },
      { code: "AZ", name: "Arizona" },
      { code: "AR", name: "Arkansas" },
      { code: "CA", name: "California" },
      { code: "CO", name: "Colorado" },
      { code: "CT", name: "Connecticut" },
      { code: "DE", name: "Delaware" },
      { code: "FL", name: "Florida" },
      { code: "GA", name: "Georgia" },
      { code: "HI", name: "Hawaii" },
      { code: "ID", name: "Idaho" },
      { code: "IL", name: "Illinois" },
      { code: "IN", name: "Indiana" },
      { code: "IA", name: "Iowa" },
      { code: "KS", name: "Kansas" },
      { code: "KY", name: "Kentucky" },
      { code: "LA", name: "Louisiana" },
      { code: "ME", name: "Maine" },
      { code: "MD", name: "Maryland" },
      { code: "MA", name: "Massachusetts" },
      { code: "MI", name: "Michigan" },
      { code: "MN", name: "Minnesota" },
      { code: "MS", name: "Mississippi" },
      { code: "MO", name: "Missouri" },
      { code: "MT", name: "Montana" },
      { code: "NE", name: "Nebraska" },
      { code: "NV", name: "Nevada" },
      { code: "NH", name: "New Hampshire" },
      { code: "NJ", name: "New Jersey" },
      { code: "NM", name: "New Mexico" },
      { code: "NY", name: "New York" },
      { code: "NC", name: "North Carolina" },
      { code: "ND", name: "North Dakota" },
      { code: "OH", name: "Ohio" },
      { code: "OK", name: "Oklahoma" },
      { code: "OR", name: "Oregon" },
      { code: "PA", name: "Pennsylvania" },
      { code: "RI", name: "Rhode Island" },
      { code: "SC", name: "South Carolina" },
      { code: "SD", name: "South Dakota" },
      { code: "TN", name: "Tennessee" },
      { code: "TX", name: "Texas" },
      { code: "UT", name: "Utah" },
      { code: "VT", name: "Vermont" },
      { code: "VA", name: "Virginia" },
      { code: "WA", name: "Washington" },
      { code: "WV", name: "West Virginia" },
      { code: "WI", name: "Wisconsin" },
      { code: "WY", name: "Wyoming" },
    ],
    []
  );

  const [stateCode, setStateCode] = useState<string>("");
  const [maxPrice, setMaxPrice] = useState<string>("");
  const [hookups, setHookups] = useState<Hookups>("");

  const onSearch = () => {
    const params = new URLSearchParams();

    // We only add params if user chooses values.
    if (stateCode) params.set("state", stateCode);
    if (maxPrice) params.set("maxPrice", maxPrice);
    if (hookups) params.set("hookups", hookups);

    const qs = params.toString();
    router.push(qs ? `/search?${qs}` : "/search");
  };

  return (
    <div className={styles.qsCard}>
      <div className={styles.qsHeader}>
        <h3 className={styles.qsTitle}>Quick Search</h3>
        <p className={styles.qsSub}>Start fast — refine more on the search page.</p>
      </div>

      <div className={styles.qsGrid}>
        <label className={styles.qsField}>
          <span className={styles.qsLabel}>State</span>
          <select
            className={styles.qsControl}
            value={stateCode}
            onChange={(e) => setStateCode(e.target.value)}
          >
            {states.map((s) => (
              <option key={s.code || "any"} value={s.code}>
                {s.code ? `${s.code} — ${s.name}` : s.name}
              </option>
            ))}
          </select>
        </label>

        <label className={styles.qsField}>
          <span className={styles.qsLabel}>Max Price (optional)</span>
          <input
            className={styles.qsControl}
            inputMode="numeric"
            placeholder="e.g. 60"
            value={maxPrice}
            onChange={(e) => {
              // keep only digits
              const cleaned = e.target.value.replace(/[^\d]/g, "");
              setMaxPrice(cleaned);
            }}
          />
        </label>

        <label className={styles.qsField}>
          <span className={styles.qsLabel}>Hookups</span>
          <select
            className={styles.qsControl}
            value={hookups}
            onChange={(e) => setHookups(e.target.value as Hookups)}
          >
            <option value="">Any</option>
            <option value="Full">Full</option>
            <option value="Partial">Partial</option>
            <option value="None">None</option>
          </select>
        </label>

        <button className={styles.qsButton} onClick={onSearch} type="button">
          Search
        </button>
      </div>

      <div className={styles.qsHint}>
        This only builds query params — your existing <strong>/search</strong> page stays in control.
      </div>
    </div>
  );
}
