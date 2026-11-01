"use client";

import Link from "next/link";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { collection, doc, getCountFromServer, getDoc, getDocs, query, where } from "firebase/firestore";
import { useAuth } from "@/lib/auth-context";
import { db } from "@/lib/firebase";
import { useMyRequests } from "@/lib/use-my-requests";
import { normalizeHostResponse, type HostResponse, type MyRequest } from "@/lib/my-requests";
import AuthNav from "../../components/authnav";
import styles from "./workspace.module.css";

function responseQuery(uid: string, requestId: string) {
  return query(collection(db, "hostOpportunities"), where("requesterId", "==", uid), where("requestId", "==", requestId));
}

function HostResponseCard({ response }: { response: HostResponse }) {
  const [profile, setProfile] = useState<"loading" | "public" | "unavailable" | "error">("loading");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    if (!response.hostId) return;
    Promise.resolve().then(() => getDoc(doc(db, "memberProfiles", response.hostId))).then((snapshot) => {
      if (active) setProfile(snapshot.exists() && snapshot.data().visibility === "public" ? "public" : "unavailable");
    }).catch((error: unknown) => {
      const code = error && typeof error === "object" && "code" in error ? error.code : "";
      if (code !== "permission-denied") console.error("[RVNB] Host public profile lookup failed", error);
      if (active) setProfile(code === "permission-denied" ? "unavailable" : "error");
    });
    return () => { active = false; };
  }, [response.hostId, attempt]);
  return <article className={styles.responseCard}>
    <div className={styles.hostHeading}>
      <span className={styles.avatar} aria-hidden="true">{response.name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("")}</span>
      <div><h3>{response.name}</h3><p>{response.location}</p>
        {profile === "public" ? <Link href={`/members/${encodeURIComponent(response.hostId)}`}>Public profile ↗</Link> :
          profile === "error" ? <span role="status">Profile unavailable. <button type="button" onClick={() => setAttempt((value) => value + 1)}>Retry profile</button></span> :
            <span className={styles.muted}>{profile === "loading" && response.hostId ? "Checking public profile..." : "Public profile unavailable"}</span>}
      </div>
    </div>
    <div className={styles.pills}>{response.amenities.length ? response.amenities.map((item) => <span key={item}>{item}</span>) : <span>Amenities not provided</span>}</div>
    <details className={styles.disclosure}>
      <summary>Host response details</summary>
      {response.description ? <p className={styles.message}>{response.description}</p> : <p>Description not provided.</p>}
      {response.notes && <p className={styles.message}>{response.notes}</p>}
      <dl className={styles.facts}>{[
        ["Distance to requested area", response.distance], ["Host-stated timing", response.timeFrame],
        ["Stay length", response.stayLength], ["Access", response.access], ["Hosting readiness", response.readiness],
      ].filter(([, value]) => value).map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
      <div className={styles.contact}><strong>Contact provided by host</strong>
        {response.email ? <><p>Email: <a href={`mailto:${response.email}`}>{response.email}</a></p><a className={styles.outline} href={`mailto:${response.email}`}>Email host ↗</a><small>Opens your email app</small></> : <p>Email not provided or unavailable.</p>}
        {response.phone && <p>Phone: {response.phone}</p>}
        {response.openToCall !== undefined && <p>{response.openToCall ? "Host is open to a call." : "Host has not opted in to a call."}</p>}
      </div>
    </details>
  </article>;
}

function ResponsePanel({ uid, request }: { uid: string; request: MyRequest }) {
  const [attempt, setAttempt] = useState(0);
  const [result, setState] = useState<{ attempt: number; loading: boolean; error: string; items: HostResponse[] }>({ attempt: -1, loading: true, error: "", items: [] });
  const state = result.attempt === attempt ? result : { loading: true, error: "", items: [] };
  useEffect(() => {
    let active = true;
    if (request.status === "draft") return;
    getDocs(responseQuery(uid, request.id)).then((snapshot) => {
      if (active) setState({ attempt, loading: false, error: "", items: snapshot.docs.map((item) => normalizeHostResponse(item.id, item.data())) });
    }).catch((error: unknown) => {
      console.error("[RVNB] Request responses load failed", error);
      if (active) setState({ attempt, loading: false, error: "We couldn't load these host responses.", items: [] });
    });
    return () => { active = false; };
  }, [uid, request.id, request.status, attempt]);
  if (request.status === "draft") return <><h2>Draft in progress</h2><p>Finish your draft before hosts can see it. Drafts are not published to the host request board.</p><Link className={styles.primary} href={`/request-spot?requestId=${encodeURIComponent(request.id)}`}>Continue draft →</Link></>;
  return <>
    <h2>Responses to your request</h2>
    <h3>{request.title} · {request.location}</h3><p className={styles.muted}>{request.dates}</p>
    <p className={styles.notice}>Responses are offers to discuss a stay, not confirmed reservations.</p>
    {state.loading ? <p role="status">Loading host responses...</p> : state.error ? <div role="alert"><p>{state.error}</p><button className={styles.outline} onClick={() => setAttempt((value) => value + 1)}>Retry responses</button></div> :
      <><p className={styles.muted}>{state.items.length} host {state.items.length === 1 ? "response" : "responses"}</p>
        {state.items.length ? state.items.map((response) => <HostResponseCard key={response.id} response={response} />) : <div className={styles.empty}><h3>No responses yet</h3><p>Hosts have not responded to this request yet.</p></div>}</>}
  </>;
}

function RequestWorkspace({ uid }: { uid: string }) {
  const params = useSearchParams();
  const requestId = params.get("requestId") || "";
  const { items, loading, error, retry } = useMyRequests(uid);
  const [filter, setFilter] = useState("All");
  const [search, setSearch] = useState("");
  const [countState, setCountState] = useState<{ key: string; counts: Record<string, number>; error: boolean }>({ key: "", counts: {}, error: false });
  const [countAttempt, setCountAttempt] = useState(0);
  const [missingState, setMissingState] = useState<{ key: string; value: "missing" | "unauthorized" | "error" }>({ key: "", value: "error" });
  const panelRef = useRef<HTMLElement>(null);
  const selected = items.find((item) => item.id === requestId);
  const countsKey = JSON.stringify(items.filter((item) => item.status !== "draft").map((item) => item.id));
  const countKey = `${countsKey}:${countAttempt}`;
  const counts = countState.key === countKey ? countState.counts : {};
  const countError = countState.key === countKey && countState.error;
  const missingKey = `${requestId}:${loading}`;
  const missing = missingState.key === missingKey ? missingState.value : "loading";
  useEffect(() => {
    let active = true;
    const ids: string[] = JSON.parse(countsKey);
    Promise.all(ids.map(async (id) => [id, (await getCountFromServer(responseQuery(uid, id))).data().count] as const))
      .then((values) => { if (active) setCountState({ key: countKey, counts: Object.fromEntries(values), error: false }); })
      .catch((error: unknown) => {
        console.error("[RVNB] Response counts failed", error);
        if (active) setCountState({ key: countKey, counts: {}, error: true });
      });
    return () => { active = false; };
  }, [uid, countsKey, countKey]);
  useEffect(() => {
    let active = true;
    if (!requestId || selected || loading || error) return;
    Promise.resolve().then(() => getDoc(doc(db, "spotRequests", requestId))).then((snapshot) => {
      if (!active) return;
      setMissingState({ key: missingKey, value: !snapshot.exists() ? "missing" : snapshot.data().requesterId !== uid ? "unauthorized" : "error" });
    }).catch((error: unknown) => {
      const code = error && typeof error === "object" && "code" in error ? error.code : "";
      if (code !== "permission-denied") console.error("[RVNB] Selected request lookup failed", error);
      if (active) setMissingState({ key: missingKey, value: code === "permission-denied" ? "unauthorized" : "error" });
    });
    return () => { active = false; };
  }, [uid, requestId, selected, loading, error, missingKey]);
  useEffect(() => {
    if (requestId && window.matchMedia("(max-width: 760px)").matches) panelRef.current?.focus();
  }, [requestId]);
  const visible = items.filter((item) => (filter === "All" || item.status === filter.toLowerCase()) && item.location.toLowerCase().includes(search.toLowerCase()));
  return <>
    <p className={styles.notice}>Published request details are visible to hosts. Your private contact details stay separate.</p>
    <div className={`${styles.columns} ${requestId ? styles.hasSelection : ""}`}>
      <section className={styles.list} aria-labelledby="requests-heading">
        <div className={styles.toolbar}><h2 id="requests-heading">Your requests</h2><button type="button" className={styles.outline} onClick={() => { retry(); setCountAttempt((value) => value + 1); }}>Refresh</button></div>
        <div className={styles.toolbar}>
          <div className={styles.filters} aria-label="Filter requests">{["All", "Open", "Draft"].map((value) => <button key={value} type="button" aria-pressed={filter === value} onClick={() => setFilter(value)}>{value === "Draft" ? "Drafts" : value}{!loading && !error && <span> {value === "All" ? items.length : items.filter((item) => item.status === value.toLowerCase()).length}</span>}</button>)}</div>
          <label className={styles.search}><span className={styles.srOnly}>Search by location</span><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by location" /></label>
        </div>
        {loading ? <p role="status">Loading your requests...</p> : error ? <div role="alert"><p>{error}</p><button className={styles.outline} onClick={retry}>Retry requests</button></div> :
          !items.length ? <div className={styles.empty}><h3>No requests yet</h3><p>Tell hosts where you need an RV stay.</p><Link className={styles.primary} href="/request-spot">New request</Link></div> :
            !visible.length ? <p>No requests match this filter and location.</p> :
              <ul className={styles.requestList}>{visible.map((item) => <li key={item.id} className={`${styles.requestCard} ${selected?.id === item.id ? styles.selected : ""}`}>
                <Link className={styles.selectRequest} href={`/account/requests?requestId=${encodeURIComponent(item.id)}`} aria-current={selected?.id === item.id ? "true" : undefined} scroll={false}>
                  <div className={styles.cardTitle}><h3>{item.title} · {item.location}</h3><span className={item.status === "draft" ? styles.draft : styles.badge}>{item.status === "unknown" ? "Status unknown" : item.status}</span></div>
                  <p>{item.dates}</p><p>{item.rigSummary}</p>
                  <p>{item.status === "draft" ? "Finish your draft before hosts can see it." : counts[item.id] !== undefined ? `${counts[item.id]} host ${counts[item.id] === 1 ? "response" : "responses"}` : countError ? "Response count unavailable" : "Loading response count..."}</p>
                  {selected?.id === item.id && <span className={styles.selectionLabel}>Selected</span>}
                </Link>
                {item.status === "draft" && <Link className={styles.continueLink} href={`/request-spot?requestId=${encodeURIComponent(item.id)}`}>Continue draft →</Link>}
              </li>)}</ul>}
        {countError && <p role="status">Response counts could not be loaded. <button className={styles.outline} onClick={() => setCountAttempt((value) => value + 1)}>Retry counts</button></p>}
      </section>
      <section className={styles.responses} aria-label="Selected request" tabIndex={-1} ref={panelRef}>
        <Link href="/account/requests" className={styles.back} scroll={false}>← Back to requests</Link>
        {loading ? <p role="status">Loading request...</p> : error ? <p>Responses are unavailable until your requests can be loaded.</p> : selected ? <ResponsePanel key={selected.id} uid={uid} request={selected} /> : requestId ?
          <div role={missing === "loading" ? "status" : "alert"}><h2>{missing === "loading" ? "Checking request..." : missing === "missing" ? "Request not found" : missing === "unauthorized" ? "Request unavailable or unauthorized" : "Couldn't load this request"}</h2><p>{missing === "unauthorized" ? "You can only view your own requests. A missing request may also be unavailable." : "Choose a request from your list or try loading again."}</p>{missing !== "loading" && <button className={styles.outline} onClick={retry}>Reload requests</button>}</div> :
            <div className={styles.empty}><h2>Select a request</h2><p>Choose a request to compare its host responses.</p></div>}
      </section>
    </div>
  </>;
}

export default function MyRequestsWorkspace() {
  const { user, loading } = useAuth();
  const params = useSearchParams();
  const next = params.get("requestId") ? `/account/requests?requestId=${encodeURIComponent(params.get("requestId") || "")}` : "/account/requests";
  return <main className={styles.page}>
    <header className={styles.header}><div className={styles.headerInner}>
      <Link href="/" className={styles.brand} aria-label="RVNB Home"><Image src="/rvnb-logo-icon.png" width={320} height={213} alt="RVNB" priority /></Link>
      <nav className={styles.nav} aria-label="Primary"><Link href="/search">Find a Stay</Link><AuthNav navLinkClassName={styles.navLink} navLogoutClassName={styles.navLink} /></nav>
    </div></header>
    <section className={styles.hero}><div className={styles.heroInner}><div><Link href="/account">← My Account</Link><h1>My Requests</h1><p>Track your requests and compare host responses.</p></div><div className={styles.heroAction}><Link className={styles.primary} href="/request-spot">＋ New request</Link><p>Private account workspace</p></div></div></section>
    <div className={styles.content}>{loading ? <p role="status">Checking your session...</p> : !user ? <section className={styles.empty}><h2>Please sign in</h2><p>My Requests is a private account workspace.</p><Link className={styles.primary} href={`/login?next=${encodeURIComponent(next)}`}>Sign in</Link></section> : <RequestWorkspace key={user.uid} uid={user.uid} />}</div>
  </main>;
}
