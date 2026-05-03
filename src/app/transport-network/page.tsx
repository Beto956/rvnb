"use client";

import Link from "next/link";
import styles from "./page.module.css";

export default function TransportNetworkPage() {
  return (
    <div className={styles.page}>
      {/* HERO */}
      <section className={styles.hero}>
        <div className={styles.heroOverlay} />

        <div className={styles.heroContent}>
          <p className={styles.kicker}>RVNB ECOSYSTEM</p>

          <h1 className={styles.title}>
            Transport <span>Network</span>
          </h1>

          <p className={styles.subtitle}>
            Move RVs, trailers, and rigs with trusted drivers and route-based logistics —
            built for real RV life.
          </p>

          <div className={styles.actions}>
            <Link href="/transport-network/request" className={styles.primaryBtn}>
              Request Transport
            </Link>

            <a href="#providers" className={styles.secondaryBtn}>
              Become a Provider
            </a>
          </div>
        </div>
      </section>

      {/* SERVICES */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>What You Can Do</h2>

        <div className={styles.grid}>
          <div className={styles.card}>
            <h3>RV Relocation</h3>
            <p>
              Move your rig between cities, states, or job sites without the stress
              of driving it yourself.
            </p>
          </div>

          <div className={styles.card}>
            <h3>Driver Matching</h3>
            <p>
              Connect with experienced drivers who understand RV handling, towing,
              and long-haul logistics.
            </p>
          </div>

          <div className={styles.card}>
            <h3>Route-Based Logistics</h3>
            <p>
              Align transport with driver routes to reduce cost and improve
              efficiency across the network.
            </p>
          </div>

          <div className={styles.card}>
            <h3>Workforce Transport</h3>
            <p>
              Support team housing and job-based travel by coordinating RV movement
              for crews and employers.
            </p>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>How It Works</h2>

        <div className={styles.steps}>
          <div className={styles.step}>
            <span>1</span>
            <h4>Submit a Request</h4>
            <p>Tell us where your RV needs to go and your timeline.</p>
          </div>

          <div className={styles.step}>
            <span>2</span>
            <h4>Get Matched</h4>
            <p>Drivers and providers review and respond to your request.</p>
          </div>

          <div className={styles.step}>
            <span>3</span>
            <h4>Move & Deliver</h4>
            <p>Your RV gets transported safely and efficiently.</p>
          </div>
        </div>
      </section>

      {/* PROVIDER FORM */}
      <section id="providers" className={styles.section}>
        <h2 className={styles.sectionTitle}>Become a Transport Provider</h2>

        <form className={styles.form}>
          <input placeholder="Your Name" />
          <input placeholder="Email Address" />
          <input placeholder="Company (optional)" />
          <input placeholder="Service Area (e.g. Texas / Nationwide)" />

          <textarea placeholder="What services do you offer?" />

          <button type="submit" className={styles.primaryBtn}>
            Submit Provider Info
          </button>
        </form>
      </section>
    </div>
  );
}