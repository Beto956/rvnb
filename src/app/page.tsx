import Link from "next/link";
import Image from "next/image";
import styles from "./page.module.css";
import HomeQuickSearchBar from "./components/homequicksearchbar";
import FeaturedListingsPreview from "./components/featuredlistingspreview";
import AuthNav from "./components/authnav";
import EcosystemNav from "./components/ecosystemnav";

const journeyCards = [
  {
    title: "Find a stay",
    text: "Search RV-ready spots by location, hookups, rig fit, and price.",
    href: "/search",
    cta: "Start searching",
    tone: "blue",
  },
  {
    title: "Request a spot",
    text: "Tell RVNB what you need when the right stay is not listed yet.",
    href: "/request-spot",
    cta: "Create request",
    tone: "cyan",
  },
  {
    title: "List a property",
    text: "Open your land, driveway, or RV space to real traveler demand.",
    href: "/host",
    cta: "Host on RVNB",
    tone: "gold",
  },
] as const;

const platformCards = [
  {
    title: "Open RV demand",
    label: "Live",
    href: "/requests",
    text: "Hosts can review traveler requests, work stays, team housing needs, and location-based RV demand.",
    meta: "Traveler requests and host opportunities",
  },
  {
    title: "Transport network",
    label: "Live intake",
    href: "/transport",
    text: "RV owners and transport providers can submit requests or join the early transport network.",
    meta: "Move RVs, trailers, and equipment",
  },
  {
    title: "Insurance coverage",
    label: "Guides and intake",
    href: "/insurance",
    text: "Explore RV coverage considerations and submit information for future provider follow-up as the directory develops.",
    meta: "Coverage exploration now, matching still developing",
  },
] as const;

export default function Home() {
  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <Link href="/" className={styles.brand} aria-label="RVNB Home">
            <Image
              src="/rvnb-logo-icon.png"
              alt="RVNB"
              className={styles.brandIcon}
              width={180}
              height={72}
            />
            <span className={styles.brandText}>RVNB</span>
          </Link>

          <nav className={styles.nav} aria-label="Primary">
            <Link className={styles.navLink} href="/listings">
              Listings
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

      <section className={styles.hero} aria-labelledby="home-hero-title">
        <div className={styles.heroBg} aria-hidden="true" />
        <div className={styles.heroShade} aria-hidden="true" />

        <div className={styles.heroInner}>
          <div className={styles.heroCopy}>
            <p className={styles.kicker}>RV stays, host land, and road-life services</p>
            <h1 id="home-hero-title" className={styles.title}>
              Find your next RV stay. Share a place for someone else&apos;s.
            </h1>
            <p className={styles.subtitle}>
              RVNB connects travelers looking for practical RV stays with hosts who have usable space, plus a growing hub for requests, transport, insurance guidance, and community.
            </p>

            <div className={styles.heroActions} aria-label="Primary RVNB actions">
              <Link href="/search" className={styles.primaryCta}>
                Find a stay
              </Link>
              <Link href="/request-spot" className={styles.secondaryCta}>
                Request a spot
              </Link>
              <Link href="/host" className={styles.tertiaryCta}>
                List a property
              </Link>
            </div>
          </div>

          <aside className={styles.heroPanel} aria-label="RVNB quick paths">
            <div className={styles.panelTopline}>Choose your next step</div>
            <div className={styles.journeyGrid}>
              {journeyCards.map((card) => (
                <Link
                  key={card.href}
                  href={card.href}
                  className={`${styles.journeyCard} ${styles[card.tone]}`}
                >
                  <span className={styles.journeyTitle}>{card.title}</span>
                  <span className={styles.journeyText}>{card.text}</span>
                  <span className={styles.journeyCta}>{card.cta} -&gt;</span>
                </Link>
              ))}
            </div>
          </aside>
        </div>
      </section>

      <section className={styles.searchBand} aria-label="Quick RV stay search">
        <div className={styles.container}>
          <div className={styles.quickSearchShell}>
            <HomeQuickSearchBar />
          </div>
        </div>
      </section>

      <EcosystemNav />

      <section className={styles.section} aria-labelledby="featured-heading">
        <div className={styles.container}>
          <div className={styles.sectionHeader}>
            <div>
              <p className={styles.sectionKicker}>Browse available listings</p>
              <h2 id="featured-heading" className={styles.sectionTitle}>Featured RV stays</h2>
            </div>
            <Link href="/listings" className={styles.sectionAction}>View all listings</Link>
          </div>
          <FeaturedListingsPreview limitCount={3} />
        </div>
      </section>

      <section className={styles.platformSection} aria-labelledby="platform-heading">
        <div className={styles.container}>
          <div className={styles.platformIntro}>
            <p className={styles.sectionKicker}>One RVNB platform</p>
            <h2 id="platform-heading" className={styles.sectionTitle}>More than a listing board</h2>
            <p className={styles.sectionSub}>
              RVNB keeps the stay workflow central while building adjacent tools around how RV travelers and hosts actually plan, move, insure, and connect.
            </p>
          </div>

          <div className={styles.platformGrid}>
            {platformCards.map((card) => (
              <Link key={card.href} href={card.href} className={styles.platformCard}>
                <span className={styles.platformLabel}>{card.label}</span>
                <span className={styles.platformTitle}>{card.title}</span>
                <span className={styles.platformText}>{card.text}</span>
                <span className={styles.platformMeta}>{card.meta}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className={styles.howSection} aria-labelledby="how-heading">
        <div className={styles.container}>
          <div className={styles.sectionHeader}>
            <div>
              <p className={styles.sectionKicker}>How RVNB works</p>
              <h2 id="how-heading" className={styles.sectionTitle}>Simple paths for travelers and hosts</h2>
            </div>
          </div>

          <div className={styles.stepsGrid}>
            <article className={styles.step}>
              <span className={styles.stepNum}>01</span>
              <h3 className={styles.stepTitle}>Search or request</h3>
              <p className={styles.stepBody}>Travelers can browse available listings or submit a request when they need a specific location, date range, or setup.</p>
            </article>
            <article className={styles.step}>
              <span className={styles.stepNum}>02</span>
              <h3 className={styles.stepTitle}>Hosts review demand</h3>
              <p className={styles.stepBody}>Hosts can create listings, review incoming booking requests, and use open demand to understand where travelers need space.</p>
            </article>
            <article className={styles.step}>
              <span className={styles.stepNum}>03</span>
              <h3 className={styles.stepTitle}>Build around the stay</h3>
              <p className={styles.stepBody}>Transport, coverage guidance, community, reviews, and maps stay connected to the core RV stay experience.</p>
            </article>
          </div>
        </div>
      </section>

      <section className={styles.finalBand} aria-label="Start using RVNB">
        <div className={styles.container}>
          <div className={styles.finalInner}>
            <div>
              <p className={styles.sectionKicker}>Ready when you are</p>
              <h2 className={styles.finalTitle}>Start with a stay. Grow into the road-life hub.</h2>
            </div>
            <div className={styles.finalActions}>
              <Link href="/search" className={styles.primaryCta}>Find a stay</Link>
              <Link href="/host" className={styles.secondaryCta}>Become a host</Link>
            </div>
          </div>
        </div>
      </section>

      <footer className={styles.footer}>
        <div className={styles.container}>
          <div className={styles.footerInner}>
            <div>
              <div className={styles.footerBrandMark}>RVNB</div>
              <div className={styles.footerBrandSub}>Recreational Vehicle Nationwide Booking</div>
            </div>
            <div className={styles.footerMeta}>© {new Date().getFullYear()} RVNB - Built for travelers, hosts, and the road ahead.</div>
          </div>
        </div>
      </footer>
    </main>
  );
}
