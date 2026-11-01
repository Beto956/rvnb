"use client";

import Link from "next/link";
import { useMyTransport } from "@/lib/use-my-transport";
import styles from "../requests/workspace.module.css";

export default function AccountTransportPanel({ uid }: { uid: string }) {
  const { requests, providers, loading, error, retry } = useMyTransport(uid);
  return <section className={`${styles.list} ${styles.accountPanel}`} aria-labelledby="my-transport-panel">
    <div className={styles.toolbar}>
      <h2 id="my-transport-panel">Transport</h2>
      <Link href="/transport">Transport home →</Link>
    </div>
    <p>Your private transport requests and provider registration. Only you can see these.</p>
    {loading ? <p role="status">Loading your transport activity...</p> : error ? <div role="alert"><p>{error}</p><button onClick={retry}>Retry transport activity</button></div> :
      !requests.length && !providers.length ? <p>No transport activity yet. <Link href="/transport/request">Request transport</Link> or <Link href="/transport/provider">register as a provider</Link>.</p> :
        <>
          {requests.length > 0 && <ul className={styles.requestList} aria-label="Your transport requests">
            {requests.map((item) => <li className={styles.requestCard} key={item.id}>
              <div className={styles.selectRequest}>
                <strong>{item.route}</strong>
                <p>{[item.rvSummary, item.method].filter(Boolean).join(" · ")}</p>
                <p>{[item.pickupDate ? `Pickup ${item.pickupDate}` : "", item.status].filter(Boolean).join(" · ")}</p>
              </div>
            </li>)}
          </ul>}
          {providers.map((item) => <div className={styles.requestCard} key={item.id}>
            <div className={styles.selectRequest}>
              <strong>{item.name} · Provider registration</strong>
              <p>{[item.typeLabel, item.scopeLabel].filter(Boolean).join(" · ") || "Provider details not provided"}</p>
              {item.services.length > 0 && <p>Services: {item.services.join(", ")}</p>}
              {item.serviceArea && <p>Service area: {item.serviceArea}</p>}
            </div>
          </div>)}
        </>}
  </section>;
}
