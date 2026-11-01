import { Suspense } from "react";
import UniqueStays from "./workspace";
export const metadata = { title: "Unique Stays | RVNB", description: "Explore stationary host-provided RVs, mobile homes, and cabins. No RV of your own needed." };
export default function UniqueStaysPage() {
  return <Suspense fallback={<p role="status">Loading Unique Stays...</p>}><UniqueStays /></Suspense>;
}
