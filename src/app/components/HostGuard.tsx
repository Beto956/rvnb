"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";
import Link from "next/link";

type Role = "guest" | "host";

type UserProfile = {
  email?: string;
  role?: Role;
  createdAt?: unknown;
};

type Props = {
  children: React.ReactNode;
  redirectTo?: string;
};

export default function HostGuard({ children, redirectTo }: Props) {
  const router = useRouter();
  const pathname = usePathname();

  const loginRedirect = useMemo(
    () => redirectTo ?? `/login?next=${encodeURIComponent(pathname || "/host")}`,
    [redirectTo, pathname]
  );

  const [authUser, setAuthUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<Role | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Listen to auth state
  useEffect(() => {
    let revision = 0;
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      const currentRevision = ++revision;
      setLoading(true);
      setAuthUser(user);
      setRole(null);
      setError(null);

      if (!user) {
        setLoading(false);
        return;
      }

      try {
        const userRef = doc(db, "users", user.uid);
        const snapshot = await getDoc(userRef);
        if (currentRevision !== revision) return;

        if (snapshot.exists()) {
          const data = snapshot.data() as UserProfile;
          setRole(data.role === "host" ? "host" : "guest");
        } else {
          // Safety: create minimal profile if missing
          await setDoc(
            userRef,
            {
              email: user.email ?? "",
              role: "guest",
              createdAt: serverTimestamp(),
            },
            { merge: true }
          );

          if (currentRevision !== revision) return;
          setRole("guest");
        }
      } catch {
        if (currentRevision !== revision) return;
        setError("Couldn't load your account. Refresh this page to try again.");
        setRole(null);
      } finally {
        if (currentRevision === revision) setLoading(false);
      }
    });

    return () => {
      revision++;
      unsubscribe();
    };
  }, []);

  // Redirect if not logged in
  useEffect(() => {
    if (!loading && !authUser) {
      router.push(loginRedirect);
    }
  }, [loading, authUser, router, loginRedirect]);

  async function becomeHost() {
    if (!authUser || busy || role !== "guest") return;

    setBusy(true);
    setError(null);

    try {
      const userRef = doc(db, "users", authUser.uid);

      // The existing account's email and creation timestamp are immutable.
      await updateDoc(userRef, { role: "host" });

      if (auth.currentUser?.uid === authUser.uid) setRole("host");
    } catch {
      if (auth.currentUser?.uid === authUser.uid) {
        setError("Couldn't upgrade your account. Please try again.");
      }
    } finally {
      setBusy(false);
    }
  }

  // Loading state
  if (loading) {
    return (
      <div
        style={{
          minHeight: "60vh",
          display: "grid",
          placeItems: "center",
          color: "white",
        }}
      >
        <div style={{ opacity: 0.8 }}>Loading host access…</div>
      </div>
    );
  }

  // Redirecting state (not logged in)
  if (!authUser) {
    return (
      <div
        style={{
          minHeight: "60vh",
          display: "grid",
          placeItems: "center",
          color: "white",
        }}
      >
        <div style={{ opacity: 0.8 }}>Redirecting to login…</div>
      </div>
    );
  }

  // Logged in but not host
  if (role !== "host") {
    return (
      <div
        style={{
          minHeight: "80vh",
          display: "grid",
          placeItems: "center",
          padding: 24,
          color: "white",
        }}
      >
        <div
          style={{
            width: "min(720px, 100%)",
            borderRadius: 18,
            padding: 22,
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.10)",
            boxShadow: "0 18px 60px rgba(0,0,0,0.35)",
          }}
        >
          <h1 style={{ fontSize: 26, marginBottom: 8 }}>
            Host Access Required
          </h1>

          <p style={{ opacity: 0.85, lineHeight: 1.5 }}>
            This area is for hosts only. Upgrade your account to create listings
            and manage booking requests.
          </p>

          {error && (
            <div
              role="alert"
              style={{
                marginTop: 12,
                padding: "10px 12px",
                borderRadius: 12,
                background: "rgba(255, 80, 80, 0.12)",
                border: "1px solid rgba(255, 80, 80, 0.25)",
              }}
            >
              <div style={{ fontSize: 13 }}>{error}</div>
            </div>
          )}

          <div style={{ display: "flex", gap: 12, marginTop: 16 }}>
            <button
              onClick={becomeHost}
              disabled={busy || role !== "guest"}
              style={{
                border: "1px solid rgba(255,255,255,0.18)",
                background: "rgba(255,255,255,0.12)",
                color: "white",
                borderRadius: 12,
                padding: "10px 14px",
                cursor: busy ? "not-allowed" : "pointer",
              }}
            >
              {busy ? "Upgrading…" : "Become a Host"}
            </button>

            <Link
              href="/listings"
              style={{
                border: "1px solid rgba(255,255,255,0.12)",
                background: "rgba(0,0,0,0.18)",
                color: "white",
                borderRadius: 12,
                padding: "10px 14px",
                textDecoration: "none",
              }}
            >
              Back to listings
            </Link>
          </div>

          <div style={{ marginTop: 14, fontSize: 12, opacity: 0.65 }}>
            Signed in as: {authUser.email ?? authUser.uid}
          </div>
        </div>
      </div>
    );
  }

  // Host allowed
  return <>{children}</>;
}
