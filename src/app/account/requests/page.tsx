import { Suspense } from "react";
import MyRequestsWorkspace from "./workspace";

export default function MyRequestsPage() {
  return <Suspense fallback={<p role="status">Loading My Requests...</p>}><MyRequestsWorkspace /></Suspense>;
}
