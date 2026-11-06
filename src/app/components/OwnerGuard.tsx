"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useIsOwner } from "@/lib/use-is-owner";

const centerStyle: React.CSSProperties = {
  minHeight: "60vh",
  display: "grid",
  placeItems: "center",
  padding: 24,
  color: "white",
};

/**
 * Client-side gate for the owner dashboard. The real enforcement is the
 * `isOwner()` custom-claim check in Firestore rules; this guard only controls
 * what renders. It never shows dashboard content before the claim is verified,
 * and there is deliberately no self-service upgrade path.
 */
export default function OwnerGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { loading: claimLoading, isOwner, error, retry } = useIsOwner();

  const loading = authLoading || (Boolean(user) && claimLoading);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push(`/login?next=${encodeURIComponent("/owner")}`);
    }
  }, [authLoading, user, router]);

  if (loading) {
    return (
      <div style={centerStyle}>
        <div style={{ opacity: 0.8 }} role="status">Checking owner access…</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div style={centerStyle}>
        <div style={{ opacity: 0.8 }} role="status">Redirecting to login…</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={centerStyle}>
        <div
          role="alert"
          style={{
            width: "min(560px, 100%)",
            borderRadius: 18,
            padding: 22,
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.10)",
          }}
        >
          <h1 style={{ fontSize: 24, marginBottom: 8 }}>Owner access check failed</h1>
          <p style={{ opacity: 0.85, lineHeight: 1.5 }}>{error}</p>
          <button
            type="button"
            onClick={retry}
            style={{
              marginTop: 12,
              border: "1px solid rgba(255,255,255,0.18)",
              background: "rgba(255,255,255,0.12)",
              color: "white",
              borderRadius: 12,
              padding: "10px 14px",
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  if (!isOwner) {
    return (
      <div style={centerStyle}>
        <div
          style={{
            width: "min(560px, 100%)",
            borderRadius: 18,
            padding: 22,
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.10)",
            boxShadow: "0 18px 60px rgba(0,0,0,0.35)",
          }}
        >
          <h1 style={{ fontSize: 24, marginBottom: 8 }}>Owner access required</h1>
          <p style={{ opacity: 0.85, lineHeight: 1.5 }}>
            This area is restricted to the RVNB site owner. Owner access is granted
            through a server-managed authorization process and cannot be requested
            or enabled from an account.
          </p>
          <div style={{ display: "flex", gap: 12, marginTop: 16, flexWrap: "wrap" }}>
            <Link
              href="/account"
              style={{
                border: "1px solid rgba(255,255,255,0.18)",
                background: "rgba(255,255,255,0.12)",
                color: "white",
                borderRadius: 12,
                padding: "10px 14px",
                textDecoration: "none",
              }}
            >
              Go to My Account
            </Link>
            <Link
              href="/"
              style={{
                border: "1px solid rgba(255,255,255,0.12)",
                background: "rgba(0,0,0,0.18)",
                color: "white",
                borderRadius: 12,
                padding: "10px 14px",
                textDecoration: "none",
              }}
            >
              Back to home
            </Link>
          </div>
          <div style={{ marginTop: 14, fontSize: 12, opacity: 0.65 }}>
            Signed in as: {user.email ?? user.uid}
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
