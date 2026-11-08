"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useIsOwner } from "@/lib/use-is-owner";

type AuthNavProps = {
  navLinkClassName?: string;
  navCtaClassName?: string;
  navLogoutClassName?: string;
};

export default function AuthNav({
  navLinkClassName = "",
  navCtaClassName = "",
  navLogoutClassName = "",
}: AuthNavProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, loading, logout } = useAuth();
  // Hidden until the server-managed owner claim is verified — never shown on
  // speculation, and disappears on logout/account switch.
  const { isOwner } = useIsOwner();

  async function handleLogout() {
    try {
      await logout();
      router.push("/");
      router.refresh();
    } catch (error) {
      console.error("Logout failed:", error);
    }
  }

  if (loading) {
    return <span className={navLinkClassName}>Checking session...</span>;
  }

  if (!user) {
    return (
      <>
        <Link className={navLinkClassName} href="/login">
          Login
        </Link>
        <Link className={navCtaClassName} href="/signup">
          Sign Up
        </Link>
      </>
    );
  }

  return (
    <>
      <Link className={navLinkClassName} href="/account/requests" aria-current={pathname === "/account/requests" ? "page" : undefined}>
        My Requests
      </Link>
      <Link className={navLinkClassName} href="/host">
        Host Dashboard
      </Link>

      {/* ✅ FIXED: Now points to /account instead of /host */}
      <Link className={navLinkClassName} href="/account">
        My Account
      </Link>

      {isOwner && (
        <Link className={navLinkClassName} href="/owner" aria-current={pathname === "/owner" ? "page" : undefined}>
          Owner Dashboard
        </Link>
      )}

      <button
        type="button"
        className={navLogoutClassName || navLinkClassName}
        onClick={handleLogout}
      >
        Logout
      </button>
    </>
  );
}
