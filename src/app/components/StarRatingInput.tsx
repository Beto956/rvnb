"use client";

type Props = {
  label: string;
  value: number;
  onChange: (next: number) => void;
  name: string;
  disabled?: boolean;
};

/** Accessible 1-5 star rating using native radio semantics (works with keyboard + screen readers). */
export default function StarRatingInput({ label, value, onChange, name, disabled }: Props) {
  return (
    <fieldset style={{ border: "none", padding: 0, margin: 0 }}>
      <legend style={{ fontWeight: 700, fontSize: 13.5, marginBottom: 6 }}>{label}</legend>
      <div role="radiogroup" aria-label={label} style={{ display: "flex", gap: 6, alignItems: "center" }}>
        {[1, 2, 3, 4, 5].map((star) => {
          const checked = value === star;
          return (
            <label
              key={star}
              style={{
                cursor: disabled ? "not-allowed" : "pointer",
                fontSize: 26,
                lineHeight: 1,
                color: star <= value ? "#facc15" : "rgba(255,255,255,0.25)",
              }}
            >
              <input
                type="radio"
                name={name}
                value={star}
                checked={checked}
                disabled={disabled}
                onChange={() => onChange(star)}
                style={{
                  position: "absolute",
                  width: 1,
                  height: 1,
                  overflow: "hidden",
                  clip: "rect(0,0,0,0)",
                }}
                aria-label={`${star} star${star === 1 ? "" : "s"}`}
              />
              <span aria-hidden="true">★</span>
            </label>
          );
        })}
        <span style={{ fontSize: 12.5, opacity: 0.7, marginLeft: 6 }}>
          {value > 0 ? `${value} of 5` : "Not rated"}
        </span>
      </div>
    </fieldset>
  );
}
