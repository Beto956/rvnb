"use client";

import { useEffect, useState } from "react";
import { collection, getCountFromServer, query } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { OVERVIEW_DATASETS, type OverviewDatasetId } from "@/lib/owner-dashboard";

type OverviewState = {
  key: string;
  counts: Partial<Record<OverviewDatasetId, number>>;
  loading: boolean;
  error: string;
};

/**
 * Exact stored-record counts for every dashboard dataset via server-side
 * aggregation. No documents are downloaded. Keyed by uid + attempt so account
 * switching never shows another user's totals.
 */
export function useOwnerOverview(uid: string) {
  const [attempt, setAttempt] = useState(0);
  const key = `${uid}:${attempt}`;
  const [state, setState] = useState<OverviewState>({ key: "", counts: {}, loading: true, error: "" });

  useEffect(() => {
    let active = true;
    if (!uid) return;
    Promise.all(
      OVERVIEW_DATASETS.map(async (dataset) => {
        const snapshot = await getCountFromServer(query(collection(db, dataset.id)));
        return [dataset.id, snapshot.data().count] as const;
      })
    )
      .then((entries) => {
        if (active) setState({ key, counts: Object.fromEntries(entries), loading: false, error: "" });
      })
      .catch((error: unknown) => {
        console.error("[RVNB] Owner overview counts failed", error);
        if (active) {
          setState({ key, counts: {}, loading: false, error: "We couldn't load the overview counts. Please try again." });
        }
      });
    return () => { active = false; };
  }, [uid, key]);

  const fallback: OverviewState = { key, counts: {}, loading: Boolean(uid), error: "" };
  return {
    ...(state.key === key && uid ? state : fallback),
    retry: () => setAttempt((value) => value + 1),
  };
}
