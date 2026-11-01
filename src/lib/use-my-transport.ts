"use client";

import { useEffect, useState } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "./firebase";
import {
  normalizeMyTransportProvider,
  normalizeMyTransportRequest,
  type MyTransportProvider,
  type MyTransportRequest,
} from "./my-transport";

type TransportState = {
  key: string;
  requests: MyTransportRequest[];
  providers: MyTransportProvider[];
  loading: boolean;
  error: string;
};

export function useMyTransport(uid: string) {
  const [attempt, setAttempt] = useState(0);
  const key = `${uid}:${attempt}`;
  const [state, setState] = useState<TransportState>({
    key: "", requests: [], providers: [], loading: true, error: "",
  });
  useEffect(() => {
    let active = true;
    if (!uid) return;
    const requestsQuery = getDocs(query(collection(db, "transportRequests"), where("requesterId", "==", uid)));
    const providersQuery = getDocs(query(collection(db, "transportProviders"), where("userId", "==", uid)));
    Promise.all([requestsQuery, providersQuery])
      .then(([requestSnapshot, providerSnapshot]) => {
        if (active) setState({
          key, loading: false, error: "",
          requests: requestSnapshot.docs.map((item) => normalizeMyTransportRequest(item.id, item.data()))
            .sort((a, b) => b.createdAt - a.createdAt || a.id.localeCompare(b.id)),
          providers: providerSnapshot.docs.map((item) => normalizeMyTransportProvider(item.id, item.data()))
            .sort((a, b) => b.createdAt - a.createdAt || a.id.localeCompare(b.id)),
        });
      })
      .catch((error: unknown) => {
        console.error("[RVNB] My Transport load failed", error);
        if (active) setState({
          key, requests: [], providers: [], loading: false,
          error: "We couldn't load your transport activity. Please try again.",
        });
      });
    return () => { active = false; };
  }, [uid, key]);
  return {
    ...(state.key === key && uid
      ? state
      : { requests: [], providers: [], loading: Boolean(uid), error: "" }),
    retry: () => setAttempt((value) => value + 1),
  };
}
