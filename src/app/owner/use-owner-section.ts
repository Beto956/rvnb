"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  collection,
  getCountFromServer,
  getDocs,
  limit,
  orderBy,
  query,
  startAfter,
  type QueryDocumentSnapshot,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

export const OWNER_PAGE_SIZE = 10;

type SectionState<T> = {
  key: string;
  items: T[];
  // Count of the same query the pages come from, so "showing N of M" stays
  // consistent with what pagination can actually load.
  total: number | null;
  // Legacy records without the ordering field never appear in the ordered
  // pages; this bounded count keeps that gap visible instead of hiding it.
  missingTimestamp: number;
  loading: boolean;
  loadingMore: boolean;
  error: string;
  endReached: boolean;
};

/**
 * Bounded, paginated, owner-scoped reader for one dashboard collection.
 * Keyed by uid + attempt so account switching and retries never show stale
 * data. Counts use server-side aggregation; pages use limit/startAfter —
 * nothing downloads a whole collection.
 */
export function useOwnerSection<T>(
  uid: string,
  collectionName: string,
  normalize: (id: string, data: Record<string, unknown>) => T,
  orderField: string | null = "createdAt"
) {
  const [attempt, setAttempt] = useState(0);
  const key = `${uid}:${collectionName}:${attempt}`;
  const cursorRef = useRef<QueryDocumentSnapshot | null>(null);
  const [state, setState] = useState<SectionState<T>>({
    key: "", items: [], total: null, missingTimestamp: 0, loading: true, loadingMore: false, error: "", endReached: false,
  });

  const baseQuery = useMemo(
    () => query(collection(db, collectionName), ...(orderField ? [orderBy(orderField, "desc")] : [])),
    [collectionName, orderField]
  );

  useEffect(() => {
    let active = true;
    if (!uid) return;
    cursorRef.current = null;
    Promise.all([
      // Total stored records (no ordering) — includes legacy records.
      getCountFromServer(query(collection(db, collectionName))),
      // Records the ordered pages can actually show.
      getCountFromServer(baseQuery),
      getDocs(query(baseQuery, limit(OWNER_PAGE_SIZE))),
    ])
      .then(([allSnap, orderedSnap, pageSnap]) => {
        if (!active) return;
        cursorRef.current = pageSnap.docs[pageSnap.docs.length - 1] ?? null;
        const total = allSnap.data().count;
        const ordered = orderedSnap.data().count;
        setState({
          key,
          items: pageSnap.docs.map((item) => normalize(item.id, item.data())),
          total,
          // Firestore cannot query for a missing field, so the legacy gap is
          // derived as total minus orderable. Both are bounded aggregations.
          missingTimestamp: Math.max(0, total - ordered),
          loading: false,
          loadingMore: false,
          error: "",
          endReached: pageSnap.size < OWNER_PAGE_SIZE,
        });
      })
      .catch((error: unknown) => {
        console.error(`[RVNB] Owner dashboard ${collectionName} load failed`, error);
        if (active) {
          setState({
            key, items: [], total: null, missingTimestamp: 0, loading: false, loadingMore: false,
            error: "We couldn't load this dataset. Please try again.", endReached: false,
          });
        }
      });
    return () => { active = false; };
  }, [uid, key, baseQuery, collectionName, normalize]);

  const current = state.key === key && uid
    ? state
    : { items: [] as T[], total: null, missingTimestamp: 0, loading: Boolean(uid), loadingMore: false, error: "", endReached: false };

  const loadMore = useCallback(() => {
    const cursor = cursorRef.current;
    if (!cursor || state.loadingMore || state.endReached || state.key !== key) return;
    setState((previous) => previous.key === key ? { ...previous, loadingMore: true } : previous);
    getDocs(query(baseQuery, startAfter(cursor), limit(OWNER_PAGE_SIZE)))
      .then((snap) => {
        cursorRef.current = snap.docs[snap.docs.length - 1] ?? cursorRef.current;
        setState((previous) => previous.key === key
          ? {
            ...previous,
            items: [...previous.items, ...snap.docs.map((item) => normalize(item.id, item.data()))],
            loadingMore: false,
            endReached: snap.size < OWNER_PAGE_SIZE,
          }
          : previous);
      })
      .catch((error: unknown) => {
        console.error(`[RVNB] Owner dashboard ${collectionName} pagination failed`, error);
        setState((previous) => previous.key === key
          ? { ...previous, loadingMore: false, error: "We couldn't load more records. Please try again." }
          : previous);
      });
  }, [baseQuery, collectionName, key, normalize, state.endReached, state.key, state.loadingMore]);

  return { ...current, loadMore, retry: () => setAttempt((value) => value + 1) };
}
