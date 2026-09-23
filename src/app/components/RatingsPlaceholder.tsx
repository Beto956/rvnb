type Props = {
  className?: string;
  titleClassName?: string;
  textClassName?: string;
};

/**
 * Shared Phase 3 placeholder — intentionally non-functional (no reviews, no ratings).
 * Replace the body of this component when the verified-stay review system ships.
 */
export default function RatingsPlaceholder({ className, titleClassName, textClassName }: Props) {
  return (
    <div className={className}>
      <h3 className={titleClassName}>Ratings &amp; Reviews</h3>
      <p className={textClassName}>
        Not available yet. Verified-stay reviews will appear here after RVNB&apos;s review
        system launches.
      </p>
    </div>
  );
}
