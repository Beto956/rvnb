"use client";

import Link from "next/link";
import styles from "./page.module.css";

export default function TransportNetworkPage() {
  return (
    <div className={styles.page}>
      {/* HERO */}
      <section className={styles.hero}>
        <div className={styles.heroBackdrop} />
        <div className={styles.heroGridGlow} />
        <div className={styles.heroNoise} />

        {/* Floating route indicators */}
        <div className={styles.routePulseOne} />
        <div className={styles.routePulseTwo} />
        <div className={styles.routePulseThree} />

        <div className={styles.heroInner}>
          {/* TOP TAG */}
          <div className={styles.heroTopline}>
            <span className={styles.liveBadge}>LIVE NETWORK</span>

            <div className={styles.liveStats}>
              <span>247 Active Routes</span>
              <span>61 Providers Online</span>
              <span>19 Weekend Drivers Available</span>
            </div>
          </div>

          {/* MAIN HERO */}
          <div className={styles.heroContent}>
            <div className={styles.heroText}>
              <p className={styles.kicker}>RVNB TRANSPORT ECOSYSTEM</p>

              <h1 className={styles.heroTitle}>
                Move RVs through a real-world transport network built for RV life.
              </h1>

              <p className={styles.heroSubtitle}>
                Connect with verified transport businesses, independent hotshot
                drivers, and trusted RV travelers already moving across the country.
                From workforce relocation to weekend help, RVNB creates a living
                transport ecosystem designed specifically for RV movement.
              </p>

              <div className={styles.heroActions}>
                <Link
                  href="/transport-network/request"
                  className={styles.primaryBtn}
                >
                  Request Transport
                </Link>

                <a href="#providers" className={styles.secondaryBtn}>
                  Become a Provider
                </a>
              </div>

              <div className={styles.heroTrustRow}>
                <div className={styles.trustItem}>
                  <strong>Business Providers</strong>
                  <span>Commercial transport companies</span>
                </div>

                <div className={styles.trustItem}>
                  <strong>Community Drivers</strong>
                  <span>Independent RV movement help</span>
                </div>

                <div className={styles.trustItem}>
                  <strong>Route Visibility</strong>
                  <span>Movement coordination nationwide</span>
                </div>
              </div>
            </div>

            {/* RIGHT VISUAL */}
            <div className={styles.heroVisual}>
              <div className={styles.transportHud}>
                <div className={styles.hudTop}>
                  <div className={styles.hudLive}>
                    <span className={styles.liveDot} />
                    <p>ACTIVE TRANSPORT FLOW</p>
                  </div>

                  <div className={styles.hudStatus}>
                    <span>Nationwide</span>
                  </div>
                </div>

                <div className={styles.routeFlow}>
                  <div className={styles.routePoint}>
                    <div className={styles.routeMarker} />

                    <div>
                      <p>PICKUP</p>
                      <strong>Dallas, Texas</strong>
                    </div>
                  </div>

                  <div className={styles.routeConnector}>
                    <div className={styles.routeLine} />
                    <div className={styles.routeTravelDot} />
                  </div>

                  <div className={styles.routePoint}>
                    <div className={styles.routeMarker} />

                    <div>
                      <p>DROP OFF</p>
                      <strong>Phoenix, Arizona</strong>
                    </div>
                  </div>
                </div>

                <div className={styles.transportMetrics}>
                  <div className={styles.metricCard}>
                    <small>RIG TYPE</small>
                    <strong>5th Wheel</strong>
                  </div>

                  <div className={styles.metricCard}>
                    <small>TRANSPORT</small>
                    <strong>Verified</strong>
                  </div>

                  <div className={styles.metricCard}>
                    <small>STATUS</small>
                    <strong>In Progress</strong>
                  </div>
                </div>

                <div className={styles.hudProviders}>
                  <div className={styles.providerBubble}>
                    <span className={styles.providerAvatar}>TX</span>

                    <div>
                      <strong>Lone Star RV Transport</strong>
                      <p>Commercial Provider</p>
                    </div>
                  </div>

                  <div className={styles.providerBubble}>
                    <span className={styles.providerAvatar}>RV</span>

                    <div>
                      <strong>Weekend Route Driver</strong>
                      <p>Community Assistance</p>
                    </div>
                  </div>
                </div>

                <div className={styles.hudFooter}>
                  <span>6 Active Drivers Near Route</span>
                  <span>ETA Visibility Enabled</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SERVICE BAND */}
      <section className={styles.serviceBand}>
        <div className={styles.serviceCard}>
          <div className={styles.serviceIcon}>🚛</div>

          <h3>Commercial Transport</h3>

          <p>
            Connect with established RV transport companies and logistics
            providers operating nationwide.
          </p>
        </div>

        <div className={styles.serviceCard}>
          <div className={styles.serviceIcon}>🛻</div>

          <h3>Independent Hotshot Drivers</h3>

          <p>
            Discover trusted independent drivers already moving through your route
            corridor.
          </p>
        </div>

        <div className={styles.serviceCard}>
          <div className={styles.serviceIcon}>🌎</div>

          <h3>Route-Based Coordination</h3>

          <p>
            Align RV movement with real travel patterns and transport
            opportunities.
          </p>
        </div>

        <div className={styles.serviceCard}>
          <div className={styles.serviceIcon}>🏕️</div>

          <h3>RV Lifestyle Movement</h3>

          <p>
            Built around workforce relocation, snowbird travel, campground
            movement, and real RV culture.
          </p>
        </div>
      </section>

      {/* MARKETPLACE */}
      <section className={styles.marketplaceSection}>
        <div className={styles.sectionIntro}>
          <h2>Transport movement becomes visible opportunity.</h2>

          <p>
            RVNB allows transport requests, route visibility, and provider
            availability to coexist inside one ecosystem. Businesses, independent
            drivers, and RV travelers can all participate in movement coordination.
          </p>
        </div>

        <div className={styles.marketplaceGrid}>
          <div className={styles.bigPanel}>
            <span className={styles.panelLabel}>ACTIVE NETWORK</span>

            <h3>Real movement happening across the country.</h3>

            <p>
              Instead of isolated requests disappearing into private inboxes,
              transport movement becomes visible. Drivers can discover routes.
              Businesses can monitor opportunities. RV owners can coordinate
              transport through an active ecosystem.
            </p>

            <div className={styles.providerPreviewList}>
              <div className={styles.providerPreviewCard}>
                <div>
                  <strong>Texas → Colorado</strong>
                  <span>Class A relocation • Workforce housing</span>
                </div>

                <a href="#">View Route</a>
              </div>

              <div className={styles.providerPreviewCard}>
                <div>
                  <strong>Arizona → Florida</strong>
                  <span>Seasonal snowbird movement</span>
                </div>

                <a href="#">View Route</a>
              </div>

              <div className={styles.providerPreviewCard}>
                <div>
                  <strong>Louisiana → Utah</strong>
                  <span>5th wheel transport assistance</span>
                </div>

                <a href="#">View Route</a>
              </div>
            </div>
          </div>

          <div className={styles.sidePanel}>
            <span className={styles.panelLabel}>LIVE INSIGHT</span>

            <h3>Movement visibility changes logistics.</h3>

            <p>
              RV transport is not traditional freight. It is tied to travel,
              lifestyle, work movement, campground availability, and route timing.
            </p>

            <div className={styles.routeMiniCard}>
              <span>LIVE CORRIDOR</span>

              <strong>Dallas → Phoenix</strong>

              <p>
                4 providers currently operating inside this route window.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className={styles.section}>
        <div className={styles.centerIntro}>
          <h2>How the network operates.</h2>

          <p>
            RVNB combines provider infrastructure, route visibility, and community
            movement into one scalable transport ecosystem.
          </p>
        </div>

        <div className={styles.steps}>
          <div className={styles.stepCard}>
            <span>1</span>

            <h3>Create a movement request</h3>

            <p>
              Submit your pickup location, destination, RV type, timeline, and
              transport needs.
            </p>
          </div>

          <div className={styles.stepCard}>
            <span>2</span>

            <h3>Providers and drivers respond</h3>

            <p>
              Businesses and independent drivers operating near your route can
              review and respond.
            </p>
          </div>

          <div className={styles.stepCard}>
            <span>3</span>

            <h3>Coordinate transport</h3>

            <p>
              Finalize logistics, timing, route coordination, and movement
              visibility through the network.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}