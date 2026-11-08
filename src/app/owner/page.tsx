import type { Metadata } from "next";
import OwnerGuard from "../components/OwnerGuard";
import OwnerDashboard from "./OwnerDashboard";

export const metadata: Metadata = {
  title: "Owner Dashboard | RVNB",
  description: "Private RVNB owner workspace.",
  robots: { index: false, follow: false },
};

export default function OwnerPage() {
  return (
    <OwnerGuard>
      <OwnerDashboard />
    </OwnerGuard>
  );
}
