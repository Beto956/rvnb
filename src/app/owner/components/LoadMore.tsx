"use client";

import styles from "../owner.module.css";

type LoadMoreProps = {
  loadingMore: boolean;
  endReached: boolean;
  onLoadMore: () => void;
};

export default function LoadMore({ loadingMore, endReached, onLoadMore }: LoadMoreProps) {
  if (endReached) return null;
  return (
    <div className={styles.loadMore}>
      <button type="button" className={styles.button} onClick={onLoadMore} disabled={loadingMore}>
        {loadingMore ? "Loading…" : "Load more"}
      </button>
    </div>
  );
}
