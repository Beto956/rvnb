"use client";

import Link from "next/link";
import styles from "./page.module.css";

const heroStats = [
  {
    label: "Transport Types",
    value: "RV • Trailer • Rig",
    text: "Built for real movement needs, from campsite delivery to long-distance relocation.",
  },
  {
    label: "Provider Network",
    value: "Businesses + Drivers",
    text: "Designed for hotshot drivers, transport companies, and trusted community helpers.",
  },
  {
    label: "Future Matching",
    value: "Routes + Requests",
    text: "A future-ready system for matching open requests with active route availability.",
  },
];

const transportServices = [
  {
    icon: "🚚",
    title: "RV & Rig Relocation",
    text: "Move motorhomes, fifth wheels, travel trailers, toy haulers, and rigs between cities, states, campgrounds, or job sites.",
  },
  {
    icon: "🧭",
    title: "Route-Based Logistics",
    text: "Help match people needing transport with providers already traveling in the same direction or service region.",
  },
  {
    icon: "🔧",
    title: "Setup Support",
    text: "Support future campsite delivery, leveling, parking, hookup assistance, and basic arrival coordination.",
  },
  {
    icon: "🤝",
    title: "Community Helpers",
    text: "Allow trusted locals, weekend helpers, and experienced RV owners to offer help when available.",
  },
];

const providerTypes = [
  {
    title: "Transport Businesses",
    text: "Professional RV transport companies, insured operators, and hauling businesses can list service areas and contact links.",
  },
  {
    title: "Hotshot Drivers",
    text: "Independent drivers can showcase trailer capability, route availability, regions served, and business contact info.",
  },
  {
    title: "Weekend Helpers",
    text: "Experienced RVers who are available on weekends or out of good faith can connect with people who need help moving a rig.",
  },
];

const openRequestExamples = [
  {
    route: "Mission, TX → Houston, TX",
    rig: "Travel Trailer • 32 ft",
    timeline: "Flexible weekend move",
    tag: "Weekend Help",
  },
  {
    route: "Austin, TX → San Antonio, TX",
    rig: "Fifth Wheel • 38 ft",
    timeline: "Needs quote this week",
    tag: "Hotshot",
  },
  {
    route: "Odessa, TX → Job Site Housing",
    rig: "3 worker rigs",
    timeline: "Employer/team move",
    tag: "Crew Support",
  },
];

const trustItems = [
  "Insurance details and provider documentation",
  "Business websites, phone numbers, and contact links",
  "Service areas, trailer types, and route availability",
  "Future reviews, ratings, and verification badges",
];

export default function TransportNetworkPage() {
  return (
    <main className={styles.page}>
      {/* HERO */}
      <section className={styles.hero}>
        <div className={styles.heroBackdrop} />
        <div className={styles.heroGlowOne} />
        <div className={styles.heroGlowTwo} />

        <div className={styles.heroInner}>
          <div className={styles.heroCopy}>
            <p className={styles.kicker}>RVNB TRANSPORT ECOSYSTEM</p>

            <h1 className={styles.heroTitle}>
              Move RVs with real drivers, real businesses, and real people.
            </h1>

            <p className={styles.heroSubtitle}>
              RVNB Transport Network is being built to connect travelers, hosts,
              employers, hotshot drivers, transport companies, and trusted weekend
              helpers in one place.
            </p>

            <div className={styles.heroActions}>
              <Link href="/transport-network/request" className={styles.primaryBtn}>
                Request Transport
              </Link>

              <a href="#providers" className={styles.secondaryBtn}>
                Become a Provider
              </a>

              <a href="#open-requests" className={styles.ghostBtn}>
                View Transport Board
              </a>
            </div>
          </div>

          <div className={styles.heroVisual}>
            <div className={styles.routeCard}>
              <div className={styles.routeHeader}>
                <span className={styles.liveDot} />
                <p>Sample transport lane</p>
              </div>

              <div className={styles.routeMap}>
                <div className={styles.routePoint}>
                  <span />
                  <p>Pickup</p>
                  <strong>South Texas</strong>
                </div>

                <div className={styles.routeLine}>
                  <span />
                </div>

                <div className={styles.routePoint}>
                  <span />
                  <p>Drop-off</p>
                  <strong>RV Site / Job Location</strong>
                </div>
              </div>

              <div className={styles.routeDetails}>
                <div>
                  <small>Rig Type</small>
                  <strong>Travel Trailer</strong>
                </div>

                <div>
                  <small>Move Type</small>
                  <strong>Weekend / Hotshot</strong>
                </div>

                <div>
                  <small>Status</small>
                  <strong>Collecting Providers</strong>
                </div>
              </div>
            </div>

            <div className={styles.floatingBadgeOne}>Hotshot Ready</div>
            <div className={styles.floatingBadgeTwo}>Community Help</div>
          </div>
        </div>

        <div className={styles.heroStats}>
          {heroStats.map((item) => (
            <article className={styles.heroStatCard} key={item.label}>
              <p>{item.label}</p>
              <h3>{item.value}</h3>
              <span>{item.text}</span>
            </article>
          ))}
        </div>
      </section>

      {/* SERVICE BAND */}
      <section className={styles.serviceBand} aria-label="Transport services">
        {transportServices.map((service) => (
          <article className={styles.serviceCard} key={service.title}>
            <div className={styles.serviceIcon}>{service.icon}</div>
            <h3>{service.title}</h3>
            <p>{service.text}</p>
          </article>
        ))}
      </section>

      {/* MARKETPLACE INTRO */}
      <section className={styles.marketplaceSection}>
        <div className={styles.sectionIntro}>
          <p className={styles.kicker}>MORE THAN A FORM</p>
          <h2>A transport marketplace built around real RV movement.</h2>
          <p>
            This section of RVNB can grow into a live directory where customers
            find businesses, independent drivers post availability, and everyday
            RVers connect with people who can safely help move a rig.
          </p>
        </div>

        <div className={styles.marketplaceGrid}>
          <article className={styles.bigPanel}>
            <div className={styles.panelLabel}>Provider Directory Preview</div>
            <h3>Businesses and drivers can live directly on RVNB.</h3>
            <p>
              Provider cards can include contact links, phone numbers, websites,
              service areas, trailer types, verification status, and future ratings.
            </p>

            <div className={styles.providerPreviewList}>
              <div className={styles.providerPreviewCard}>
                <div>
                  <strong>Lone Star RV Transport</strong>
                  <span>Business • Texas / Regional</span>
                </div>
                <Link href="#providers">View profile</Link>
              </div>

              <div className={styles.providerPreviewCard}>
                <div>
                  <strong>Weekend Tow Helper</strong>
                  <span>Community Helper • Local Weekend Moves</span>
                </div>
                <Link href="#providers">View profile</Link>
              </div>

              <div className={styles.providerPreviewCard}>
                <div>
                  <strong>Hotshot Route Driver</strong>
                  <span>Independent Driver • South / Central Texas</span>
                </div>
                <Link href="#providers">View profile</Link>
              </div>
            </div>
          </article>

          <article className={styles.sidePanel}>
            <p className={styles.kicker}>FUTURE FEATURE</p>
            <h3>Route availability.</h3>
            <p>
              Drivers could eventually post where they are headed, what they can
              tow, and when they are available.
            </p>

            <div className={styles.routeMiniCard}>
              <span>Available Route</span>
              <strong>Houston → Dallas</strong>
              <p>Open trailer capacity this weekend.</p>
            </div>
          </article>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className={styles.section}>
        <div className={styles.centerIntro}>
          <p className={styles.kicker}>HOW IT WORKS</p>
          <h2>Simple enough for weekend help. Strong enough for business logistics.</h2>
        </div>

        <div className={styles.steps}>
          <article className={styles.stepCard}>
            <span>1</span>
            <h3>Post the transport need</h3>
            <p>
              Add pickup, drop-off, rig type, size, timeline, budget, and notes
              about access, hookups, or special handling.
            </p>
          </article>

          <article className={styles.stepCard}>
            <span>2</span>
            <h3>Providers review it</h3>
            <p>
              Businesses, hotshot drivers, and trusted helpers can see the open
              request and decide whether they can help.
            </p>
          </article>

          <article className={styles.stepCard}>
            <span>3</span>
            <h3>Connect and coordinate</h3>
            <p>
              The customer can compare options, contact providers, and coordinate
              the safest path forward.
            </p>
          </article>
        </div>
      </section>

      {/* WHO IT IS FOR */}
      <section className={styles.splitSection}>
        <div className={styles.glassPanel}>
          <p className={styles.kicker}>WHO IT’S FOR</p>
          <h2>Three lanes. One transport network.</h2>

          <div className={styles.providerTypeGrid}>
            {providerTypes.map((item) => (
              <article className={styles.providerTypeCard} key={item.title}>
                <h3>{item.title}</h3>
                <p>{item.text}</p>
              </article>
            ))}
          </div>
        </div>

        <div className={styles.storyPanel}>
          <div className={styles.storyOverlay}>
            <p>BUILT BY RVERS, FOR RVERS</p>
            <h2>Not every RV move needs a giant logistics company.</h2>
            <span>
              Sometimes it needs a local driver. Sometimes it needs a real
              business. Sometimes it needs someone nearby with the right truck,
              the right equipment, and the willingness to help.
            </span>
          </div>
        </div>
      </section>

      {/* OPEN REQUEST BOARD */}
      <section id="open-requests" className={styles.boardSection}>
        <div className={styles.boardHeader}>
          <div>
            <p className={styles.kicker}>TRANSPORT BOARD PREVIEW</p>
            <h2>Open movement needs can become visible opportunities.</h2>
            <p>
              This is the direction: customers post what they need moved, and
              providers discover real opportunities by location and route.
            </p>
          </div>

          <Link href="/transport-network/request" className={styles.secondaryBtn}>
            Post a Transport Need
          </Link>
        </div>

        <div className={styles.requestGrid}>
          {openRequestExamples.map((request) => (
            <article className={styles.requestCard} key={request.route}>
              <div className={styles.requestTop}>
                <span>{request.tag}</span>
                <small>Example</small>
              </div>

              <h3>{request.route}</h3>
              <p>{request.rig}</p>

              <div className={styles.requestFooter}>
                <strong>{request.timeline}</strong>
                <Link href="/transport-network/request">Request similar</Link>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* PROVIDER FORM + TRUST */}
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
              <label>
                <span>Your Name</span>
                <input placeholder="John Smith" />
              </label>

              <label>
                <span>Email Address</span>
                <input placeholder="name@email.com" />
              </label>

              <label>
                <span>Company or Display Name</span>
                <input placeholder="Company name or personal listing name" />
              </label>

              <label>
                <span>Provider Type</span>
                <select defaultValue="">
                  <option value="" disabled>
                    Select provider type
                  </option>
                  <option>Transport Business</option>
                  <option>Hotshot Driver</option>
                  <option>Independent Hauler</option>
                  <option>Weekend / Community Helper</option>
                </select>
              </label>

              <label>
                <span>Service Area</span>
                <input placeholder="Texas, Nationwide, South Texas, etc." />
              </label>

              <label>
                <span>Contact Link or Website</span>
                <input placeholder="Website, Facebook page, or business link" />
              </label>
            </div>

            <label>
              <span>What services do you offer?</span>
              <textarea placeholder="Example: fifth wheel transport, bumper pull trailers, campsite delivery, weekend moves, route availability, hotshot work, team housing support..." />
            </label>

            <button type="submit" className={styles.primaryBtn}>
              Submit Provider Info
            </button>
          </form>
        </div>

        <aside className={styles.trustCard}>
          <div className={styles.trustIcon}>🛡️</div>
          <h2>Trust has to be built into the network.</h2>
          <p>
            As this grows, RVNB can organize provider details so customers know
            who they are contacting and what kind of transport support they offer.
          </p>

          <ul>
            {trustItems.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </aside>
      </section>

      {/* CTA */}
      <section className={styles.ctaSection}>
        <div className={styles.ctaContent}>
          <p className={styles.kicker}>RVNB TRANSPORT NETWORK</p>
          <h2>From parked to delivered.</h2>
          <p>
            This is the foundation for connecting RV owners with actual transport
            businesses, hotshot drivers, and trusted people who can help move rigs
            safely and realistically.
          </p>
        </div>

        <div className={styles.ctaActions}>
          <Link href="/transport-network/request" className={styles.primaryBtn}>
            Request Transport
          </Link>

          <a href="#providers" className={styles.secondaryBtn}>
            Join as Provider
          </a>
        </div>
      </section>
    </main>
  );
}