"use client";

import Link from "next/link";
import { useMyRequests } from "@/lib/use-my-requests";
import styles from "../requests/workspace.module.css";

export default function AccountRequestsPanel({ uid }: { uid: string }) {
  const { items, loading, error, retry } = useMyRequests(uid);
  return <section className={`${styles.list} ${styles.accountPanel}`} aria-labelledby="my-requests-panel">
    <div className={styles.toolbar}><h2 id="my-requests-panel">My Requests</h2><Link href="/account/requests">View all →</Link></div>
    <p>Track your requests and compare host responses. Booking inquiries remain in Trips.</p>
    {loading ? <p role="status">Loading your requests...</p> : error ? <div role="alert"><p>{error}</p><button onClick={retry}>Retry requests</button></div> :
      !items.length ? <p>No requests yet. <Link href="/request-spot">Create a request</Link></p> :
        <ul className={styles.requestList}>{items.slice(0, 3).map((item) => <li className={styles.requestCard} key={item.id}><Link className={styles.selectRequest} href={`/account/requests?requestId=${encodeURIComponent(item.id)}`}><strong>{item.title} · {item.location}</strong><p>{item.dates} · {item.status}</p>{item.status === "draft" && <p>Private draft - not visible to hosts</p>}</Link></li>)}</ul>}
  </section>;
}
