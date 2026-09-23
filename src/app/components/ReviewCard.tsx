import type { ReviewDirection } from "@/lib/reviews";

export type ReviewCardItem = {
  id: string;
  reviewerId: string;
  reviewerName: string;
  reviewerInitials: string;
  rating: number;
  direction: ReviewDirection;
  comment: string;
  createdAtLabel: string;
  categoryRatings?: Record<string, number>;
  listingTitle?: string;
  verified: boolean;
};

type ReviewCardProps = {
  review: ReviewCardItem;
  onReport?: (reviewId: string) => void;
  reportDisabled?: boolean;
  alreadyReported?: boolean;
};

function formatCategoryLabel(key: string) {
  const labels: Record<string, string> = {
    accuracy: "Accuracy",
    communication: "Communication",
    location: "Location",
    respect: "Respect",
    cleanliness: "Cleanliness",
    overall: "Overall",
  };
  return labels[key] ?? key;
}

export default function ReviewCard({
  review,
  onReport,
  reportDisabled = false,
  alreadyReported = false,
}: ReviewCardProps) {
  const categoryEntries = review.categoryRatings ? Object.entries(review.categoryRatings) : [];
  const stars = "★".repeat(Math.round(review.rating));

  return (
    <article
      aria-label={`Review by ${review.reviewerName}`}
      style={{
        border: "1px solid rgba(148, 163, 184, 0.18)",
        background: "rgba(7, 16, 29, 0.82)",
        borderRadius: 18,
        padding: 18,
        display: "grid",
        gap: 12,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: "50%",
              background: "linear-gradient(135deg, #3b82f6, #1d4ed8)",
              display: "grid",
              placeItems: "center",
              fontWeight: 800,
              fontSize: 14,
            }}
          >
            {review.reviewerInitials}
          </div>
          <div>
            <div style={{ fontWeight: 800 }}>{review.reviewerName}</div>
            <div style={{ fontSize: 12, color: "#b7c4d9" }}>
              {review.direction === "traveler_to_host" ? "Review from a traveler" : "Review from a host"}
              {review.verified ? " · Verified stay" : ""}
            </div>
          </div>
        </div>

        <div style={{ textAlign: "right", fontSize: 12, color: "#dfe7ff" }}>{review.createdAtLabel}</div>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div style={{ color: "#facc15", letterSpacing: 0.3 }}>{stars}</div>
        <div style={{ fontSize: 12, color: "#b7c4d9" }}>
          <strong style={{ color: "#dfe7ff" }}>{review.rating}.0</strong> / 5 overall
        </div>
      </div>

      {review.listingTitle ? (
        <div style={{ fontSize: 12, color: "#9ad5ff" }}>Listing: {review.listingTitle}</div>
      ) : null}

      <p style={{ margin: 0, color: "#f5f7fb", lineHeight: 1.6 }}>{review.comment}</p>

      {categoryEntries.length > 0 ? (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {categoryEntries.map(([key, value]) => (
            <span
              key={`${review.id}-${key}`}
              style={{
                display: "inline-flex",
                alignItems: "center",
                borderRadius: 999,
                border: "1px solid rgba(96, 165, 250, 0.25)",
                background: "rgba(59, 130, 246, 0.08)",
                padding: "6px 10px",
                fontSize: 12,
                color: "#dfe7ff",
              }}
            >
              {formatCategoryLabel(key)}: {value}/5
            </span>
          ))}
        </div>
      ) : null}

      {onReport ? (
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button
            type="button"
            onClick={() => onReport(review.id)}
            disabled={reportDisabled || alreadyReported}
            style={{
              border: "1px solid rgba(248, 113, 113, 0.3)",
              background: alreadyReported ? "rgba(34, 197, 94, 0.14)" : "rgba(248, 113, 113, 0.08)",
              color: alreadyReported ? "#bbf7d0" : "#fecaca",
              borderRadius: 10,
              padding: "8px 12px",
              fontWeight: 700,
              cursor: reportDisabled || alreadyReported ? "not-allowed" : "pointer",
              opacity: reportDisabled ? 0.7 : 1,
            }}
          >
            {alreadyReported ? "Reported" : "Report review"}
          </button>
        </div>
      ) : null}
    </article>
  );
}
