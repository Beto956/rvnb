"use client";

import { useEffect, useRef, useState } from "react";
import { onIdTokenChanged, type User } from "firebase/auth";
import { auth } from "./firebase";
import { hasOwnerClaim } from "./owner-claim";

type OwnerState = {
  // Keyed by uid + attempt so account switching and retries never reuse
  // another user's claim state.
  key: string;
  loading: boolean;
  isOwner: boolean;
  error: string;
};

const SIGNED_OUT: OwnerState = { key: "signed-out", loading: false, isOwner: false, error: "" };

export function useIsOwner() {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<OwnerState>({ key: "", loading: true, isOwner: false, error: "" });
  const userRef = useRef<User | null>(null);
  const keyRef = useRef("");

  useEffect(() => {
    let active = true;

    async function readClaim(user: User, forceRefresh: boolean, key: string) {
      try {
        const token = await user.getIdTokenResult(forceRefresh);
        if (active) {
          setState({ key, loading: false, isOwner: hasOwnerClaim(token.claims), error: "" });
        }
      } catch (error) {
        console.error("[RVNB] Owner claim check failed", error);
        // Fail closed: an unverifiable claim is never treated as owner.
        if (active) {
          setState({
            key,
            loading: false,
            isOwner: false,
            error: "We couldn't verify owner access. Check your connection and try again.",
          });
        }
      }
    }

    const unsubscribe = onIdTokenChanged(auth, (user) => {
      userRef.current = user;
      if (!user) {
        keyRef.current = SIGNED_OUT.key;
        setState(SIGNED_OUT);
        return;
      }
      const key = `${user.uid}:${attempt}`;
      keyRef.current = key;
      // Same-user token refreshes re-check silently; only a new key shows loading.
      setState((previous) =>
        previous.key === key ? previous : { key, loading: true, isOwner: false, error: "" }
      );
      void readClaim(user, false, key);
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [attempt]);

  return {
    ...state,
    retry: () => setAttempt((value) => value + 1),
    // Forces a token refresh so a newly provisioned/revoked claim takes effect
    // without waiting for the hourly automatic refresh.
    refreshClaim: () => {
      const user = userRef.current;
      if (!user) return;
      const key = keyRef.current;
      user
        .getIdTokenResult(true)
        .then((token) => {
          setState({ key, loading: false, isOwner: hasOwnerClaim(token.claims), error: "" });
        })
        .catch((error: unknown) => {
          console.error("[RVNB] Owner claim refresh failed", error);
          setState({
            key,
            loading: false,
            isOwner: false,
            error: "We couldn't verify owner access. Check your connection and try again.",
          });
        });
    },
  };
}
