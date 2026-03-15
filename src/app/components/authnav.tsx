"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

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
  const { user, loading, logout } = useAuth();

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
      <Link className={navLinkClassName} href="/host">
        Host Dashboard
      </Link>

      {/* ✅ FIXED: Now points to /account instead of /host */}
      <Link className={navLinkClassName} href="/account">
        My Account
      </Link>

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
