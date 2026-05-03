import Link from "next/link";
import type { CSSProperties } from "react";
import styles from "./page.module.css";
import HomeQuickSearchBar from "./components/homequicksearchbar";
import FeaturedListingsPreview from "./components/featuredlistingspreview";
import AuthNav from "./components/authnav";
import EcosystemNav from "./components/ecosystemnav";

export default function Home() {
  return (
    <main className={styles.page}>
      {/* Top Navigation */}
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <Link href="/" className={styles.brand} aria-label="RVNB Home">
            {/* ✅ LOGO ICON (image scales, container stays stable) */}
            <img
              src="/rvnb-logo-icon.png"
              alt="RVNB"
              className={styles.brandIcon}
              width={180}
              height={72}
            />
          </Link>

          <nav className={styles.nav} aria-label="Primary">
            <Link className={styles.navLink} href="/listings">
              Listings
            </Link>

            <Link className={styles.navLink} href="/request-spot">
              Request Spot
            </Link>

            <Link className={styles.navLink} href="/requests">
              Open Requests
            </Link>

            <AuthNav
              navLinkClassName={styles.navLink}
              navCtaClassName={styles.navCta}
              navLogoutClassName={styles.navLink}
            />
          </nav>
        </div>
      </header>

      {/* 1) HERO */}
      <section
        className={styles.hero}
        style={
          {
            "--hero-bg-url": "url('/rvnb-home-bg.png')",
          } as CSSProperties
        }
      >
        <div className={styles.heroBg} aria-hidden="true" />
        <div className={styles.heroOverlay} aria-hidden="true" />
        {/* Optional grain */}
        {/* <div className={styles.heroGrain} aria-hidden="true" /> */}

        <div className={styles.heroInner}>
          <p className={styles.heroKicker}>
            Nationwide RV stays • Built for real RV life
          </p>

          <h1 className={styles.title}>RVNB</h1>

          <p className={styles.subtitle}>
            Freedom doesn’t need a hotel key. Find safe, host-backed RV spots
            across the country — or request exactly what you need and let the
            RVNB ecosystem help connect the road.
          </p>

          <div className={styles.ctaRow}>
            <Link href="/search" className={styles.primaryCta}>
              Find RV Spots
            </Link>

            <Link href="/request-spot" className={styles.secondaryCta}>
              Request a Spot
            </Link>

            <Link href="/host" className={styles.tertiaryCta}>
              List Your Spot
            </Link>
          </div>

          <p className={styles.heroNote}>
            Search available spots, request custom stays, and connect with the
            RV services built around the journey.
          </p>
        </div>
      </section>

      {/* 2–5) SUNLIGHT BAND (now includes Quick Search + Ecosystem Nav at the top) */}
      <div className={styles.sunWrap} role="region" aria-label="Sunlight band">
        {/* ✅ QUICK SEARCH */}
        <section className={styles.quickSearchSection} aria-label="Quick search">
          <div className={styles.quickSearchBubble}>
            <HomeQuickSearchBar />
          </div>
        </section>

        {/* ✅ RVNB ECOSYSTEM NAV */}
        <EcosystemNav active="home" />

        {/* 3) FEATURED LISTINGS PREVIEW */}
        <section className={styles.section} aria-label="Featured listings">
          <div className={styles.container}>
            <div className={styles.sectionHeader}>
              <div>
                <h2 className={styles.sectionTitle}>Featured Spots</h2>
                <p className={styles.sectionSub}>
                  A few places to start — or request a custom RV spot if nothing
                  matches your trip yet.
                </p>
              </div>

              <Link href="/listings" className={styles.sectionAction}>
                View All Listings
              </Link>
            </div>

            <FeaturedListingsPreview limitCount={3} />
          </div>
        </section>

        {/* 4) ECOSYSTEM EXPANSION */}
        <section className={styles.section} aria-label="Ecosystem expansion">
          <div className={styles.container}>
            <div className={styles.sectionHeader}>
              <div>
                <h2 className={styles.sectionTitle}>
                  Built to Become an Ecosystem
                </h2>
                <p className={styles.sectionSub}>
                  RVNB is positioned to support the entire RV lifestyle — not
                  just parking.
                </p>
              </div>
            </div>

            <div className={styles.cardGrid}>
              <Link
                href="/request-spot"
                className={styles.cardLink}
                aria-label="Request a custom RV spot"
              >
                <div className={styles.card}>
                  <div className={styles.cardTop}>
                    <h3 className={styles.cardTitle}>📍 Request a Spot</h3>
                    <span className={styles.badge}>Live</span>
                  </div>
                  <p className={styles.cardBody}>
                    Need a specific location, longer stay, work housing, or
                    multiple RV spots? Post what you need and create demand
                    hosts can respond to.
                  </p>
                  <span className={styles.cardMuted}>
                    Built for travelers, workers, and team housing
                  </span>
                </div>
              </Link>

              <Link
                href="/transport"
                className={styles.cardLink}
                aria-label="Transport Network (Coming Soon)"
              >
                <div className={styles.card}>
                  <div className={styles.cardTop}>
                    <h3 className={styles.cardTitle}>🚛 Transport Network</h3>
                    <span className={styles.badge}>Coming Soon</span>
                  </div>
                  <p className={styles.cardBody}>
                    Hotshot driver listings + booking lanes for moving rigs,
                    trailers, and RVs safely between locations.
                  </p>
                  <span className={styles.cardMuted}>
                    Future: driver accounts, dispatch, tracking
                  </span>
                </div>
              </Link>

              <Link
                href="/insurance"
                className={styles.cardLink}
                aria-label="Insurance Directory (Coming Soon)"
              >
                <div className={styles.card}>
                  <div className={styles.cardTop}>
                    <h3 className={styles.cardTitle}>🛡 Insurance Directory</h3>
                    <span className={styles.badge}>Coming Soon</span>
                  </div>
                  <p className={styles.cardBody}>
                    Compare RV insurance options, specialized coverage, and
                    trusted providers built for RV life.
                  </p>
                  <span className={styles.cardMuted}>
                    Future: affiliate lanes, verified partners
                  </span>
                </div>
              </Link>
            </div>
          </div>
        </section>

        {/* 5) HOW IT WORKS */}
        <section className={styles.section} aria-label="How it works">
          <div className={styles.container}>
            <div className={styles.sectionHeader}>
              <div>
                <h2 className={styles.sectionTitle}>How It Works</h2>
                <p className={styles.sectionSub}>
                  Simple, familiar, and built for both direct bookings and
                  request-based RV stays.
                </p>
              </div>
            </div>

            <div className={styles.stepsGrid}>
              <div className={styles.step}>
                <div className={styles.stepNum}>1</div>
                <h3 className={styles.stepTitle}>Search or Request</h3>
                <p className={styles.stepBody}>
                  Browse available spots, search by location, or submit a custom
                  request when your trip needs something specific.
                </p>
              </div>

              <div className={styles.step}>
                <div className={styles.stepNum}>2</div>
                <h3 className={styles.stepTitle}>Connect with Hosts</h3>
                <p className={styles.stepBody}>
                  Travelers find available stays, while hosts can view open
                  requests and discover real demand in their area.
                </p>
              </div>

              <div className={styles.step}>
                <div className={styles.stepNum}>3</div>
                <h3 className={styles.stepTitle}>Park &amp; Enjoy</h3>
                <p className={styles.stepBody}>
                  Arrive, park, and live the RV life with a platform designed to
                  grow around the full journey.
                </p>
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* 6) COMMUNITY STRIP */}
      <section className={styles.strip} aria-label="Community positioning">
        <div className={styles.container}>
          <div className={styles.stripInner}>
            <div>
              <h2 className={styles.stripTitle}>
                Built for Hosts. Built for Travelers. Built for Growth.
              </h2>
              <p className={styles.stripBody}>
                RVNB is designed to expand into requests, transport, insurance,
                community, reviews, and maps — without rebuilding the
                foundation.
              </p>
            </div>

            <div className={styles.stripCtas}>
              <Link href="/request-spot" className={styles.stripBtnPrimary}>
                Request a Spot
              </Link>

              <Link href="/requests" className={styles.stripBtnSecondary}>
                Browse Open Requests
              </Link>

              <Link href="/host" className={styles.stripBtnSecondary}>
                Become a Host
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* 7) FOOTER */}
      <footer className={styles.footer}>
        <div className={styles.container}>
          <div className={styles.footerTop}>
            <div className={styles.footerBrand}>
              <div className={styles.footerBrandMark}>RVNB</div>
              <div className={styles.footerBrandSub}>
                Recreational Vehicle Nationwide Booking
              </div>
              <div className={styles.footerMeta}>Built with Next.js + Firebase</div>
            </div>
          </div>

          <div className={styles.footerBottom}>
            <span>© {new Date().getFullYear()} RVNB</span>
            <span className={styles.footerBottomMuted}>
              Routes stay stable as features expand.
            </span>
          </div>
        </div>
      </footer>
    </main>
  );
}