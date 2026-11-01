"use client";

import { useEffect, useState } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "./firebase";
import { normalizeMyRequest, type MyRequest } from "./my-requests";

export function useMyRequests(uid: string) {
  const [attempt, setAttempt] = useState(0);
  const key = `${uid}:${attempt}`;
  const [state, setState] = useState<{ key: string; items: MyRequest[]; loading: boolean; error: string }>({
    key: "", items: [], loading: true, error: "",
  });
  useEffect(() => {
    let active = true;
    if (!uid) return;
    getDocs(query(collection(db, "spotRequests"), where("requesterId", "==", uid)))
      .then((snapshot) => {
        if (active) setState({
          key, loading: false, error: "",
          items: snapshot.docs.map((item) => normalizeMyRequest(item.id, item.data()))
            .sort((a, b) => b.createdAt - a.createdAt || a.id.localeCompare(b.id)),
        });
      })
      .catch((error: unknown) => {
        console.error("[RVNB] My Requests load failed", error);
        if (active) setState({ key, items: [], loading: false, error: "We couldn't load your requests. Please try again." });
      });
    return () => { active = false; };
  }, [uid, key]);
  return {
    ...(state.key === key && uid ? state : { items: [], loading: Boolean(uid), error: "" }),
    retry: () => setAttempt((value) => value + 1),
  };
}
