type ReviewSummaryProps = {
  title?: string;
  average: number | null;
  count: number;
  loading?: boolean;
  error?: string;
  emptyText?: string;
};

export default function ReviewSummary({
  title = "Ratings & reviews",
  average,
  count,
  loading = false,
  error,
  emptyText = "Not available yet.",
}: ReviewSummaryProps) {
  if (loading) {
    return (
      <div style={{ display: "grid", gap: 6 }}>
        <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>{title}</h3>
        <p style={{ margin: 0, color: "#b7c4d9" }}>Loading reviews...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ display: "grid", gap: 6 }}>
        <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>{title}</h3>
        <p style={{ margin: 0, color: "#fca5a5" }}>{error}</p>
      </div>
    );
  }

  if (count === 0) {
    return (
      <div style={{ display: "grid", gap: 6 }}>
        <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>{title}</h3>
        <p style={{ margin: 0, color: "#b7c4d9" }}>{emptyText}</p>
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gap: 6 }}>
      <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>{title}</h3>
      <p style={{ margin: 0, color: "#dfe7ff" }}>
        <span aria-label={`Average rating ${average?.toFixed(1) ?? "not available"}`}>
          {average !== null ? `${average.toFixed(1)} / 5` : "—"}
        </span>
        {" · "}
        {count} review{count === 1 ? "" : "s"}
      </p>
    </div>
  );
}
