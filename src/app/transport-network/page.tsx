"use client";

import Link from "next/link";
import styles from "./page.module.css";

const serviceCards = [
  {
    icon: "🚚",
    title: "RV & Rig Relocation",
    text: "Move RVs, trailers, toy haulers, and rigs between cities, states, job sites, or campgrounds.",
  },
  {
    icon: "🤝",
    title: "Trusted Driver Network",
    text: "Connect with transport businesses, hotshot drivers, and community helpers who understand RV life.",
  },
  {
    icon: "🧭",
    title: "Route-Based Logistics",
    text: "Match transport needs with drivers already moving through similar routes to save time and reduce cost.",
  },
  {
    icon: "🛡️",
    title: "Safety-Focused Support",
    text: "Build toward verified providers, insurance details, equipment standards, and reliable communication.",
  },
];

const audienceCards = [
  {
    title: "Travelers",
    text: "Need your RV moved but cannot drive it yourself? Post your transport need and connect with help.",
  },
  {
    title: "Hosts",
    text: "Help guests relocate rigs between RV spots, long-term stays, job locations, and seasonal destinations.",
  },
  {
    title: "Providers",
    text: "List your hotshot, hauling, or RV transport service and become part of the growing RVNB network.",
  },
];

export default function TransportNetworkPage() {
  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <div className={styles.heroOverlay} />

        <div className={styles.heroInner}>
          <p className={styles.kicker}>RVNB ECOSYSTEM</p>

          <h1 className={styles.title}>
            Transport <span>Network</span>
          </h1>

          <p className={styles.subtitle}>
            Move RVs, trailers, and rigs with trusted drivers, hotshot providers,
            transport businesses, and real people helping real RVers get where
            they need to go.
          </p>

          <div className={styles.actions}>
            <Link href="/transport-network/request" className={styles.primaryBtn}>
              Request Transport
            </Link>

            <a href="#providers" className={styles.secondaryBtn}>
              Become a Provider
            </a>
          </div>

          <div className={styles.heroStats}>
            <div>
              <strong>RV Moves</strong>
              <span>City-to-city, state-to-state, or job site relocation.</span>
            </div>

            <div>
              <strong>Hotshot Ready</strong>
              <span>Built for businesses, independent drivers, and helpers.</span>
            </div>

            <div>
              <strong>Route Matching</strong>
              <span>Future-ready for smart transport availability.</span>
            </div>
          </div>
        </div>
      </section>

      <section className={styles.featureBand}>
        {serviceCards.map((card) => (
          <article className={styles.featureCard} key={card.title}>
            <div className={styles.iconBubble}>{card.icon}</div>
            <h3>{card.title}</h3>
            <p>{card.text}</p>
          </article>
        ))}
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <p className={styles.kicker}>HOW IT WORKS</p>
          <h2>Simple transport support for RV life.</h2>
          <p>
            RVNB Transport Network is being built to connect requests, providers,
            route availability, and community help in one place.
          </p>
        </div>

        <div className={styles.steps}>
          <article className={styles.step}>
            <span>1</span>
            <h3>Submit a Request</h3>
            <p>
              Tell us where the RV is, where it needs to go, the type of rig,
              timeline, and special requirements.
            </p>
          </article>

          <article className={styles.step}>
            <span>2</span>
            <h3>Connect With Options</h3>
            <p>
              Transport businesses, hotshot drivers, and available helpers can
              review the need and offer support.
            </p>
          </article>

          <article className={styles.step}>
            <span>3</span>
            <h3>Move & Deliver</h3>
            <p>
              Coordinate the details, confirm the route, and get the RV moved
              safely to the next destination.
            </p>
          </article>
        </div>
      </section>

      <section className={styles.splitSection}>
        <div className={styles.glassPanel}>
          <p className={styles.kicker}>WHO IT’S FOR</p>
          <h2>Built for travelers, hosts, and providers.</h2>

          <div className={styles.audienceGrid}>
            {audienceCards.map((card) => (
              <article className={styles.audienceCard} key={card.title}>
                <h3>{card.title}</h3>
                <p>{card.text}</p>
              </article>
            ))}
          </div>
        </div>

        <div className={styles.imagePanel}>
          <div className={styles.imagePanelOverlay}>
            <p>REAL RV MOVEMENT</p>
            <h2>From parked to delivered.</h2>
            <span>
              Long-distance moves, campsite delivery, team housing support, and
              weekend help from people already on the road.
            </span>
          </div>
        </div>
      </section>

      <section id="providers" className={styles.providerSection}>
        <div className={styles.providerFormCard}>
          <p className={styles.kicker}>JOIN THE NETWORK</p>
          <h2>Become a Transport Provider</h2>
          <p>
            Businesses, hotshot drivers, independent haulers, and trusted
            community helpers can submit basic provider information here.
          </p>

          <form className={styles.form}>
            <div className={styles.formGrid}>
              <input placeholder="Your Name" />
              <input placeholder="Email Address" />
              <input placeholder="Company (optional)" />
              <input placeholder="Service Area (e.g. Texas / Nationwide)" />
            </div>

            <textarea placeholder="What services do you offer? Example: RV hauling, fifth wheel transport, bumper pull, hotshot, weekend moves, route availability..." />

            <button type="submit" className={styles.primaryBtn}>
              Submit Provider Info
            </button>
          </form>
        </div>

        <aside className={styles.trustCard}>
          <div className={styles.trustIcon}>🛡️</div>
          <h2>Safety. Trust. Reliability.</h2>
          <p>
            The goal is to build a transport network where people can compare
            options, review provider details, and connect with confidence.
          </p>

          <ul>
            <li>Insurance details</li>
            <li>Business or independent provider listings</li>
            <li>Service areas and route availability</li>
            <li>Future reviews and verification badges</li>
          </ul>
        </aside>
      </section>

      <section className={styles.ctaSection}>
        <div>
          <p className={styles.kicker}>NEXT RVNB LAYER</p>
          <h2>Need an RV moved?</h2>
          <p>
            Start with a transport request and help RVNB shape the network around
            real demand.
          </p>
        </div>

        <Link href="/transport-network/request" className={styles.primaryBtn}>
          Request Transport
        </Link>
      </section>
    </main>
  );
}