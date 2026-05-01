import { Suspense } from "react";
import DetailsPageContent from "./detailspagecontent";

export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <Suspense fallback={<div style={{ padding: 20 }}>Loading...</div>}>
      <DetailsPageContent />
    </Suspense>
  );
}