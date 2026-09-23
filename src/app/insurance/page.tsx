"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import styles from "./page.module.css";

type HelpDetail = {
  definition: string;
  example: string;
  note: string;
};

type CoverageItem = {
  id: string;
  title: string;
  summary: string;
  help: HelpDetail;
};

const COVERAGE_ITEMS: readonly CoverageItem[] = [
  {
    id: "liability",
    title: "Bodily Injury & Property Damage Liability",
    summary: "Core legal responsibility protection for injuries or property damage caused to third parties.",
    help: {
      definition: "Covers legal defense and settlement costs if you are found legally liable for injuring someone or damaging their property in an accident.",
      example: "Paying medical bills and vehicle repair costs for another motorist after an at-fault highway collision.",
      note: "Mandatory minimum limits vary by state and rarely provide sufficient protection for catastrophic claims on large rigs.",
    },
  },
  {
    id: "collision",
    title: "Collision Coverage",
    summary: "Repairs or replaces your RV if it collides with another vehicle, obstacle, or rolls over.",
    help: {
      definition: "Pays to repair or replace your RV after an impact with another vehicle, guardrail, rock, tree, or single-vehicle rollover.",
      example: "Repairing front-end fiberglass and chassis damage to a motorhome after sliding on black ice into a highway barrier.",
      note: "Applies regardless of fault and is subject to your selected collision deductible.",
    },
  },
  {
    id: "comprehensive",
    title: "Comprehensive (Other-Than-Collision)",
    summary: "Protection against theft, vandalism, hail, fire, windshield damage, and animal strikes.",
    help: {
      definition: "Protects against direct physical damage from non-collision events including severe weather, fire, flood, theft, and falling branches.",
      example: "Repairing extensive roof panel, vent, and solar equipment damage resulting from a severe golf-ball-sized hailstorm at a campground.",
      note: "Windshield and glass repair deductibles may be governed by specific state insurance statutes.",
    },
  },
  {
    id: "uninsured_motorist",
    title: "Uninsured / Underinsured Motorist",
    summary: "Safeguards you and your passengers if struck by a driver who lacks adequate insurance.",
    help: {
      definition: "Compensates for medical costs, lost income, and in some jurisdictions property damage if an at-fault driver has no insurance or limits below your actual damages.",
      example: "Covering hospital copays and trailer repair costs after a hit-and-run driver strikes your rear bumper in heavy traffic.",
      note: "Availability, mandatory offering requirements, and coverage for property damage vary by state.",
    },
  },
  {
    id: "med_pay_pip",
    title: "Medical Payments / Personal Injury Protection",
    summary: "Immediate medical expense and rehabilitation support for you and passengers regardless of fault.",
    help: {
      definition: "Provides no-fault payment for necessary medical, hospital, surgical, and funeral expenses for passengers injured while in or entering your RV.",
      example: "Covering ambulance transport fees and emergency room copayments for family members following a road incident.",
      note: "Personal Injury Protection (PIP) is statutory in no-fault states; Medical Payments (MedPay) is optional in tort states.",
    },
  },
  {
    id: "personal_belongings",
    title: "Personal Belongings & Contents",
    summary: "Coverage for clothing, electronics, camping gear, and appliances carried in your RV.",
    help: {
      definition: "Protects personal property stored in or around the RV against covered perils like theft, fire, or collision damage.",
      example: "Reimbursing the cost of stolen laptops, high-end outdoor cooking gear, and camping equipment taken from a locked pass-through storage bay.",
      note: "Standard limits are often capped at $1,000–$3,000 unless higher endorsement limits or scheduled personal property floaters are added.",
    },
  },
  {
    id: "attached_accessories",
    title: "Attached Accessories & Custom Equipment",
    summary: "Protection for aftermarket solar systems, awnings, satellite dishes, and leveling jacks.",
    help: {
      definition: "Covers permanently installed aftermarket additions that were not part of the original manufacturer base vehicle.",
      example: "Replacing an expensive motorized patio awning, custom lithium battery bank, and roof solar array torn off by sudden canyon wind shear.",
      note: "Base policies often limit attached accessory coverage to $1,000 unless higher itemized endorsements are declared.",
    },
  },
  {
    id: "roadside_heavy_towing",
    title: "Specialized RV Roadside & Heavy Towing",
    summary: "Emergency dispatch, tire changes, lockout assistance, and heavy-duty commercial towing.",
    help: {
      definition: "Specialized 24/7 roadside assistance providing commercial heavy-wrecker towing and mechanical assistance sized specifically for RV dimensions and weight.",
      example: "Dispatching a 50-ton heavy-duty wrecker to tow a 42-foot Class A diesel pusher 85 miles to the nearest certified chassis repair center.",
      note: "Standard automotive club roadside memberships frequently exclude heavy diesel pushers, tandem axles, and extended towing mileage.",
    },
  },
  {
    id: "emergency_expenses",
    title: "Emergency Expenses & Lodging",
    summary: "Reimbursement for hotels, food, and temporary transit if your RV becomes uninhabitable.",
    help: {
      definition: "Pays for emergency hotel accommodations, meal expenses, and temporary transportation if a covered incident leaves your rig unusable far from home.",
      example: "Paying hotel and meal costs for four days while an axle repair is completed after a collision 500 miles from your home city.",
      note: "Usually triggers only when a covered loss occurs at least 50 to 100 miles away from your declared primary residence.",
    },
  },
  {
    id: "vacation_liability",
    title: "Vacation / Campsite Liability",
    summary: "Premises liability coverage while your parked and unhitched RV is used as a temporary residence.",
    help: {
      definition: "Provides premises liability defense and medical payment coverage when your RV is parked at a campsite, RV park, or private property used as a temporary vacation site.",
      example: "Paying medical bills and legal defense if a visiting campground guest trips on your entry stairs and suffers a sprained ankle.",
      note: "Intended for temporary vacation stays and seasonal camping; does not cover permanent residence or business operations.",
    },
  },
  {
    id: "full_timer_liability",
    title: "Full-Timer Liability Package",
    summary: "Comprehensive personal and premises liability for owners who live in their RV year-round.",
    help: {
      definition: "A policy endorsement functioning like homeowners liability, covering personal liability, premises liability, and loss assessments for full-time RVers without a stationary house.",
      example: "Providing continuous liability protection if your dog injures someone at an RV resort or accidental property damage occurs outside the vehicle.",
      note: "Crucial for full-timers: standard recreational policies frequently deny claims if the carrier discovers the RV is your primary year-round residence.",
    },
  },
  {
    id: "total_loss_options",
    title: "Total Loss Settlement Options",
    summary: "Agreed Value, Total Loss Replacement, or Actual Cash Value settlement methods.",
    help: {
      definition: "Defines the valuation formula used if your RV is declared a total loss: Actual Cash Value (depreciated market value), Agreed Value (fixed declared amount), or Total Loss Replacement (brand-new model).",
      example: "Receiving a brand-new current model-year fifth wheel under Total Loss Replacement rather than a depreciated payout after a total fire loss.",
      note: "Total Loss Replacement is generally available only for RVs in their first 1 to 5 model years; Agreed Value requires appraisal or bill-of-sale documentation.",
    },
  },
  {
    id: "storage_layup",
    title: "Storage & Seasonal Lay-Up",
    summary: "Reduced premiums by suspending road risks while your RV is safely stored for winter.",
    help: {
      definition: "A policy endorsement that suspends road collision and driving liability coverage during designated non-use winter storage months, keeping comprehensive coverage active.",
      example: "Saving up to 40% on annual premiums while a motorhome is securely winterized inside an indoor facility from November through March.",
      note: "The RV cannot be operated or moved on public roads during the declared lay-up period without notifying the insurer first.",
    },
  },
  {
    id: "pet_protection",
    title: "Pet Injury Protection",
    summary: "Veterinary medical expense coverage for traveling pets injured in a covered accident.",
    help: {
      definition: "Reimburses necessary veterinary care, emergency surgery, or related expenses if a domestic cat or dog traveling inside your RV is injured during a covered collision.",
      example: "Reimbursing $1,500 in veterinary medical costs after an accident jostles a family dog traveling in the motorhome cabin.",
      note: "Subject to per-incident dollar limits (typically $500–$2,000) and usually restricted to domestic household pets.",
    },
  },
] as const;

export default function InsurancePage() {
  const [activeHelpId, setActiveHelpId] = useState<string | null>(null);
  const [showAllCoverage, setShowAllCoverage] = useState(false);

  // Close help popover on click outside or escape
  useEffect(() => {
    function handleGlobalClick(event: MouseEvent) {
      if (activeHelpId && !(event.target as HTMLElement).closest(`.${styles.helpWrapper}`)) {
        setActiveHelpId(null);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setActiveHelpId(null);
      }
    }
    document.addEventListener("mousedown", handleGlobalClick);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleGlobalClick);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [activeHelpId]);

  const displayedCoverageItems = showAllCoverage
    ? COVERAGE_ITEMS
    : COVERAGE_ITEMS.slice(0, 8);

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        {/* TOP NAVIGATION */}
        <nav className={styles.topNav} aria-label="Insurance navigation">
          <Link href="/" className={styles.backLink}>
            ← Back to RVNB Hub
          </Link>
          <div className={styles.navLinks}>
            <Link href="/transport" className={styles.altLink}>
              🚛 Transport Network
            </Link>
            <Link href="/listings" className={styles.altLink}>
              📍 RV Listings
            </Link>
          </div>
        </nav>

        {/* HERO SECTION */}
        <header className={styles.hero}>
          <div className={styles.heroGlow} aria-hidden="true" />
          <div className={styles.heroInner}>
            <div className={styles.heroCopy}>
              <div className={styles.badge}>
                <span className={styles.badgeDot} aria-hidden="true" />
                <span>RVNB INSURANCE NETWORK</span>
              </div>
              <p className={styles.kicker}>SPECIALIZED RV PROTECTION</p>
              <h1>Coverage built around the way you RV.</h1>
              <p className={styles.heroLead}>
                Explore RV-focused coverage considerations, prepare your rig information, and connect with licensed insurance professionals serving your state.
              </p>
              <div className={styles.heroActions}>
                <Link className={styles.primaryButton} href="/insurance/request">
                  Explore RV Coverage
                </Link>
                <Link className={styles.secondaryButton} href="/insurance/agent">
                  I’m an Insurance Professional
                </Link>
              </div>
            </div>

            {/* EXAMPLE COVERAGE PREVIEW PANEL */}
            <div className={styles.previewPanel} aria-label="Example coverage considerations">
              <div className={styles.previewHeader}>
                <span className={styles.previewStatus}>
                  <span className={styles.badgeDot} aria-hidden="true" />
                  <span>Coverage Considerations Preview</span>
                </span>
                <span>Illustrative Example</span>
              </div>
              <div className={styles.previewItems}>
                <div className={styles.previewItem}>
                  <div>
                    <span className={styles.previewItemTitle}>Motorhome or Towable</span>
                  </div>
                  <span className={styles.previewItemTag}>Chassis + Living Space</span>
                </div>
                <div className={styles.previewItem}>
                  <div>
                    <span className={styles.previewItemTitle}>Weekend, Seasonal, or Full-Time Use</span>
                  </div>
                  <span className={styles.previewItemTag}>Lifestyle Aligned</span>
                </div>
                <div className={styles.previewItem}>
                  <div>
                    <span className={styles.previewItemTitle}>Personal Belongings & Custom Upgrades</span>
                  </div>
                  <span className={styles.previewItemTag}>Solar, Awnings, Gear</span>
                </div>
                <div className={styles.previewItem}>
                  <div>
                    <span className={styles.previewItemTitle}>Roadside & Heavy-Duty Recovery</span>
                  </div>
                  <span className={styles.previewItemTag}>Commercial Wrecker Dispatch</span>
                </div>
              </div>
              <div className={styles.previewFooter}>
                <span>Independent policy comparison</span>
                <span>Direct licensed agent connection</span>
              </div>
            </div>
          </div>
        </header>

        {/* TWO AUDIENCE PATHS */}
        <section className={styles.audienceSection} aria-label="Insurance paths">
          <article className={styles.audienceCard}>
            <div>
              <div className={styles.audienceIconBox} aria-hidden="true">
                <ShieldIcon />
              </div>
              <h3>For RV Owners</h3>
              <p>
                Get clarity on specialized RV protections before you speak with an agent.
              </p>
              <ul className={styles.audienceFeatures}>
                <li>Describe your RV classification and travel schedule</li>
                <li>Understand vacation liability, full-timer packages, and custom riders</li>
                <li>Connect with appropriately licensed agents in your home state</li>
                <li>Compare settlement methods: Total Loss Replacement vs. Agreed Value</li>
                <li>Prepare accurate vehicle and usage details for clearer quotes</li>
              </ul>
            </div>
            <Link className={styles.primaryButton} href="/insurance/request">
              Find Coverage for My RV →
            </Link>
          </article>

          <article className={styles.audienceCard}>
            <div>
              <div className={styles.audienceIconBox} aria-hidden="true">
                <BriefcaseIcon />
              </div>
              <h3>For Insurance Professionals</h3>
              <p>
                Introduce your agency, licensing footprint, and RV specialty programs.
              </p>
              <ul className={styles.audienceFeatures}>
                <li>Build an agency profile highlighting RV market experience</li>
                <li>Showcase state resident and non-resident licenses</li>
                <li>Feature specialized programs for full-timers, motorhomes, and custom rigs</li>
                <li>Explain policy strengths, underwriting appetite, and service lanes</li>
                <li>Receive early onboarding priority as carrier partnerships expand</li>
              </ul>
            </div>
            <Link className={styles.secondaryButton} href="/insurance/agent">
              Join the Insurance Network →
            </Link>
          </article>
        </section>

        {/* RV AND USAGE TYPES */}
        <section className={styles.section} aria-labelledby="types-heading">
          <div className={styles.sectionIntro}>
            <p className={styles.kicker}>RV CLASSIFICATIONS & TRAVEL PATTERNS</p>
            <h2 id="types-heading">Coverage tailored across rig classes and lifestyle profiles.</h2>
            <p>
              RV policies differ significantly from standard automobile contracts. Availability, rates, and coverage terms depend on vehicle weight, motorization, and how often you travel.
            </p>
          </div>

          <div className={styles.categoryGrid}>
            <article className={styles.categoryCard}>
              <h3>Motorized Rigs</h3>
              <p>Class A luxury coaches, Class B camper vans, and Class C cab-overs combining road collision with dwelling protection.</p>
            </article>
            <article className={styles.categoryCard}>
              <h3>Towable Campers</h3>
              <p>Travel trailers, fifth wheels, toy haulers, pop-ups, and truck campers requiring separate physical damage riders.</p>
            </article>
            <article className={styles.categoryCard}>
              <h3>Specialty & Park Models</h3>
              <p>Vintage restorations, high-value custom rigs, overland conversions, and stationary destination park models.</p>
            </article>
            <article className={styles.categoryCard}>
              <h3>Occasional & Weekend</h3>
              <p>Recreational weekend camping and short vacation getaways with seasonal roadside and campsite premises liability.</p>
            </article>
            <article className={styles.categoryCard}>
              <h3>Full-Time RV Living</h3>
              <p>Year-round living packages providing comprehensive personal liability, loss assessments, and complete contents coverage.</p>
            </article>
            <article className={styles.categoryCard}>
              <h3>Seasonal & Stored</h3>
              <p>Snowbird migration corridors and seasonal storage lay-up options that lower premium during winter non-use periods.</p>
            </article>
          </div>
        </section>

        {/* COVERAGE CONSIDERATIONS WITH EXPANDABLE ACCORDION & POPOVERS */}
        <section className={styles.section} aria-labelledby="coverage-heading">
          <div className={styles.sectionIntro}>
            <p className={styles.kicker}>COVERAGE CONSIDERATIONS</p>
            <h2 id="coverage-heading">Coverage options to ask your agent about.</h2>
            <p>
              Policies are customizable. Review common coverage components and select the <span className={styles.helpBadgeInline}>?</span> on any card to see a plain-language definition and example.
            </p>
          </div>

          <div className={styles.coverageGrid}>
            {displayedCoverageItems.map((item) => (
              <article key={item.id} className={styles.coverageCard}>
                <div>
                  <div className={styles.coverageHeader}>
                    <h3>{item.title}</h3>
                    <div className={styles.helpWrapper}>
                      <button
                        type="button"
                        className={`${styles.helpButton} ${activeHelpId === item.id ? styles.helpButtonActive : ""}`}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setActiveHelpId((curr) => (curr === item.id ? null : item.id));
                        }}
                        aria-label={`Learn more about ${item.title}`}
                        aria-expanded={activeHelpId === item.id}
                      >
                        <span aria-hidden="true">?</span>
                      </button>

                      {activeHelpId === item.id && (
                        <div
                          role="region"
                          aria-label={`${item.title} definition and example`}
                          className={styles.helpPopover}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className={styles.helpPopoverHeader}>
                            <span className={styles.helpPopoverTitle}>{item.title}</span>
                            <button
                              type="button"
                              className={styles.helpCloseButton}
                              onClick={() => setActiveHelpId(null)}
                              aria-label={`Close ${item.title} help`}
                            >
                              ✕
                            </button>
                          </div>
                          <p className={styles.helpDefinition}>{item.help.definition}</p>
                          <span className={styles.helpExample}>
                            <strong>Example:</strong> {item.help.example}
                          </span>
                          <span className={styles.helpClarification}>
                            <strong>Note:</strong> {item.help.note}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                  <p>{item.summary}</p>
                </div>
              </article>
            ))}
          </div>

          <div className={styles.toggleExpandRow}>
            <button
              type="button"
              className={styles.toggleExpandBtn}
              onClick={() => setShowAllCoverage((prev) => !prev)}
              aria-expanded={showAllCoverage}
            >
              <span>{showAllCoverage ? "Show Fewer Topics" : "View All 14 Coverage Considerations"}</span>
              <span className={`${styles.toggleExpandArrow} ${showAllCoverage ? styles.toggleExpandArrowOpen : ""}`} aria-hidden="true">
                ▼
              </span>
            </button>
          </div>
        </section>

        {/* PREPARE FOR A BETTER CONVERSATION CHECKLIST */}
        <section className={styles.section} aria-labelledby="checklist-heading">
          <div className={styles.sectionIntro}>
            <p className={styles.kicker}>OWNER PREPARATION</p>
            <h2 id="checklist-heading">Prepare for a better conversation.</h2>
            <p>
              Having your rig specifications, travel habits, and equipment records ready helps licensed agents provide accurate rate indications and avoid coverage gaps.
            </p>
          </div>

          <div className={styles.checklistGrid}>
            {[
              "RV Year, Make, Model & 17-Digit VIN",
              "Chassis Class or Towable Trailer Classification",
              "Estimated Market Value or Purchase Invoice",
              "Lienholder / Financing Information (if applicable)",
              "Primary Garaging or Storage ZIP Code",
              "States and Corridors of Planned Travel",
              "Annual Estimated Travel Mileage",
              "Usage Classification (Recreational, Seasonal, or Full-Time)",
              "Listed Drivers, Ages & Motor Vehicle Records",
              "Itemized List of Permanently Attached Upgrades",
              "Estimated Replacement Value of Personal Contents",
              "Previous Insurance History & Loss Run Records",
            ].map((checkItem) => (
              <div key={checkItem} className={styles.checklistItem}>
                <span className={styles.checkIcon} aria-hidden="true">✓</span>
                <span>{checkItem}</span>
              </div>
            ))}
          </div>
        </section>

        {/* HOW IT WORKS (5 STEPS) */}
        <section className={styles.section} aria-labelledby="how-it-works-heading">
          <div className={styles.sectionIntro}>
            <p className={styles.kicker}>MARKETPLACE PROCESS</p>
            <h2 id="how-it-works-heading">How RVNB Insurance connects travelers with coverage.</h2>
            <p>
              We are designing a transparent connection workflow between rig owners and state-licensed insurance specialists.
            </p>
          </div>

          <div className={styles.stepsGrid}>
            <article className={styles.stepCard}>
              <span className={styles.stepNumber}>01</span>
              <h3>Describe Your Rig</h3>
              <p>Share your vehicle type, valuation, travel frequency, and primary storage state.</p>
            </article>
            <article className={styles.stepCard}>
              <span className={styles.stepNumber}>02</span>
              <h3>Review Needs</h3>
              <p>Identify important endorsements like full-timer liability, solar riders, or heavy towing.</p>
            </article>
            <article className={styles.stepCard}>
              <span className={styles.stepNumber}>03</span>
              <h3>Match Specialists</h3>
              <p>Connect with licensed agents with appointed carriers serving your state.</p>
            </article>
            <article className={styles.stepCard}>
              <span className={styles.stepNumber}>04</span>
              <h3>Compare Options</h3>
              <p>Review comprehensive policy disclosures, exclusions, and settlement types.</p>
            </article>
            <article className={styles.stepCard}>
              <span className={styles.stepNumber}>05</span>
              <h3>Bind Directly</h3>
              <p>Complete formal underwriting and bind coverage directly with the licensed provider.</p>
            </article>
          </div>
        </section>

        {/* TRUST AND MARKETPLACE STANDARDS WITH AUTHORITATIVE RESOURCE LINKS */}
        <section className={styles.section} aria-labelledby="trust-heading">
          <div className={styles.sectionIntro}>
            <p className={styles.kicker}>STANDARDS & CONSUMER PROTECTION</p>
            <h2 id="trust-heading">Built on licensing, transparency, and verified credentials.</h2>
            <p>
              Insurance is a regulated industry. We believe travelers deserve clear disclosures, transparent carrier appointments, and verified state licensing.
            </p>
          </div>

          <div className={styles.trustPanel}>
            <div>
              <p className={styles.kicker}>PROFESSIONAL EXPECTATIONS</p>
              <ul className={styles.trustList}>
                <li><strong>Verified Producer Credentials:</strong> Individual or agency National Producer Number (NPN) and state license status.</li>
                <li><strong>Clear Promoted Disclosures:</strong> Any sponsored listings or promoted agency placements are explicitly labeled.</li>
                <li><strong>Appropriate Appointments:</strong> Authorized carrier representations suited for specific rig types and weight classes.</li>
                <li><strong>No Deceptive Claims:</strong> Realistic policy terms without unsubstantiated discounts, guarantees, or false pricing claims.</li>
                <li><strong>Direct Policy Issuance:</strong> Policies are underwritten, issued, and serviced directly by licensed carriers and agencies.</li>
              </ul>
            </div>

            <div className={styles.resourcesBox}>
              <strong>Authoritative Consumer Resources</strong>
              <a
                href="https://www.tdi.texas.gov/tips/rv-insurance-coverage.html"
                target="_blank"
                rel="noopener noreferrer"
                className={styles.resourceLink}
              >
                <span>Texas TDI: RV Insurance Guidance</span>
                <span aria-hidden="true">↗</span>
              </a>
              <a
                href="https://content.naic.org/consumer"
                target="_blank"
                rel="noopener noreferrer"
                className={styles.resourceLink}
              >
                <span>NAIC: Consumer Insurance Hub</span>
                <span aria-hidden="true">↗</span>
              </a>
              <a
                href="https://content.naic.org/article/consumer-insight-how-choose-insurance-agent"
                target="_blank"
                rel="noopener noreferrer"
                className={styles.resourceLink}
              >
                <span>NAIC: How to Choose an Agent</span>
                <span aria-hidden="true">↗</span>
              </a>
              <a
                href="https://nipr.com/licensing-center"
                target="_blank"
                rel="noopener noreferrer"
                className={styles.resourceLink}
              >
                <span>NIPR: Producer Licensing Center</span>
                <span aria-hidden="true">↗</span>
              </a>
            </div>
          </div>
        </section>

        {/* FUTURE SPECIALIZED POLICY SHOWCASE */}
        <section className={styles.section} aria-labelledby="showcase-heading">
          <div className={styles.sectionIntro}>
            <p className={styles.kicker}>FUTURE MARKETPLACE PREVIEW</p>
            <h2 id="showcase-heading">How specialized coverage programs will appear.</h2>
            <p>
              Illustrative preview of future agent-promoted policy cards. RVNB will feature clear disclosures and verified state licensing badges.
            </p>
          </div>

          <div className={styles.showcaseGrid}>
            <article className={styles.showcaseCard}>
              <div>
                <div className={styles.showcaseHeader}>
                  <span className={styles.showcaseBadge}>Full-Timer Package</span>
                  <span className={styles.showcaseSponsored}>Example Program</span>
                </div>
                <h3>Full-Timer Residential Shield</h3>
                <p>Designed for year-round fifth-wheel and motorhome owners requiring continuous premises liability and full contents replacement.</p>
              </div>
              <div className={styles.showcaseDetails}>
                <span><strong>Target:</strong> Full-time RV dwellers</span>
                <span><strong>Key Focus:</strong> Personal liability & replacement cost</span>
                <span><strong>Status:</strong> Details coming soon</span>
              </div>
            </article>

            <article className={styles.showcaseCard}>
              <div>
                <div className={styles.showcaseHeader}>
                  <span className={styles.showcaseBadge}>Agreed Value Coach</span>
                  <span className={styles.showcaseSponsored}>Example Program</span>
                </div>
                <h3>Motorhome Total Loss Protection</h3>
                <p>Tailored for high-end Class A and Class C motorhomes with declared agreed-value settlement and heavy towing dispatch.</p>
              </div>
              <div className={styles.showcaseDetails}>
                <span><strong>Target:</strong> Class A & Class C motorized</span>
                <span><strong>Key Focus:</strong> Agreed value & commercial towing</span>
                <span><strong>Status:</strong> Details coming soon</span>
              </div>
            </article>

            <article className={styles.showcaseCard}>
              <div>
                <div className={styles.showcaseHeader}>
                  <span className={styles.showcaseBadge}>Adventure & Overland</span>
                  <span className={styles.showcaseSponsored}>Example Program</span>
                </div>
                <h3>Custom Rig & Attached Gear</h3>
                <p>Tailored for custom camper van conversions, toy haulers, and high-value off-grid solar and suspension upgrades.</p>
              </div>
              <div className={styles.showcaseDetails}>
                <span><strong>Target:</strong> Custom vans & overland trailers</span>
                <span><strong>Key Focus:</strong> Aftermarket accessory endorsements</span>
                <span><strong>Status:</strong> Details coming soon</span>
              </div>
            </article>
          </div>

          <p className={styles.showcasePrinciple}>
            Marketplace Principle: Promoted placement will be clearly labeled and will not replace suitability, licensing, or policy review.
          </p>
        </section>

        {/* OWNER PREVIEW CTA SECTION */}
        <section className={styles.previewCtaSection} id="owners" aria-labelledby="owner-preview-heading">
          <div className={styles.ownerCtaCard}>
            <div className={styles.ctaCardCopy}>
              <p className={styles.kicker}>FOR RV OWNERS</p>
              <h2 id="owner-preview-heading">Ready to explore coverage for your RV?</h2>
              <p>
                Tell us about your rig, how you use it, and the coverage topics that matter to you. We’ll help you prepare the details to match with licensed professionals in your state.
              </p>
              <div className={styles.ctaSummarySteps}>
                <div className={styles.ctaStepItem}>
                  <span className={styles.ctaStepNum}>1</span>
                  <span>About your RV</span>
                </div>
                <div className={styles.ctaStepItem}>
                  <span className={styles.ctaStepNum}>2</span>
                  <span>Usage and travel</span>
                </div>
                <div className={styles.ctaStepItem}>
                  <span className={styles.ctaStepNum}>3</span>
                  <span>Coverage interests</span>
                </div>
                <div className={styles.ctaStepItem}>
                  <span className={styles.ctaStepNum}>4</span>
                  <span>Contact and review</span>
                </div>
              </div>
              <div className={styles.ctaActionWrap}>
                <Link className={styles.primaryButton} href="/insurance/request">
                  Find Coverage for My RV →
                </Link>
                <p className={styles.ctaDisclaimerNote}>
                  This early-access request is not an insurance application, quote, binder, or guarantee of coverage.
                </p>
              </div>
            </div>

            <div className={styles.previewPanel} aria-label="Owner request preview">
              <div className={styles.previewHeader}>
                <span className={styles.previewStatus}>
                  <span className={styles.badgeDot} aria-hidden="true" />
                  <span>Interactive 3-Step Intake</span>
                </span>
                <span>3 min</span>
              </div>
              <div className={styles.previewItems}>
                <div className={styles.previewItem}>
                  <div><span className={styles.previewItemTitle}>Step 1: Your RV Details</span></div>
                  <span className={styles.previewItemTag}>Class & State</span>
                </div>
                <div className={styles.previewItem}>
                  <div><span className={styles.previewItemTitle}>Step 2: Coverage Topics</span></div>
                  <span className={styles.previewItemTag}>Needs & Upgrades</span>
                </div>
                <div className={styles.previewItem}>
                  <div><span className={styles.previewItemTitle}>Step 3: Contact & Review</span></div>
                  <span className={styles.previewItemTag}>Confirm & Submit</span>
                </div>
              </div>
              <div className={styles.previewFooter}>
                <span>Free step preview enabled</span>
                <span>Draft auto-saved</span>
              </div>
            </div>
          </div>
        </section>

        {/* PROFESSIONAL PREVIEW CTA SECTION */}
        <section className={styles.previewCtaSection} id="professionals" aria-labelledby="pro-preview-heading">
          <div className={styles.proCtaCard}>
            <div className={styles.ctaCardCopy}>
              <p className={styles.kicker}>FOR LICENSED PROFESSIONALS</p>
              <h2 id="pro-preview-heading">Bring your RV insurance expertise to RVNB.</h2>
              <p>
                Licensed agents and agencies can express interest in joining RVNB’s developing insurance network to present eligible policy categories to active RV travelers.
              </p>
              <div className={styles.ctaSummarySteps}>
                <div className={styles.ctaStepItem}>
                  <span className={`${styles.ctaStepNum} ${styles.proStepNum}`}>1</span>
                  <span>Professional profile</span>
                </div>
                <div className={styles.ctaStepItem}>
                  <span className={`${styles.ctaStepNum} ${styles.proStepNum}`}>2</span>
                  <span>Licensing & states</span>
                </div>
                <div className={styles.ctaStepItem}>
                  <span className={`${styles.ctaStepNum} ${styles.proStepNum}`}>3</span>
                  <span>RV specialties</span>
                </div>
                <div className={styles.ctaStepItem}>
                  <span className={`${styles.ctaStepNum} ${styles.proStepNum}`}>4</span>
                  <span>Final review</span>
                </div>
              </div>
              <div className={styles.ctaActionWrap}>
                <Link className={styles.secondaryButton} href="/insurance/agent">
                  Join as an Insurance Professional →
                </Link>
                <p className={styles.ctaDisclaimerNote}>
                  Submitting professional interest does not guarantee approval, promotion, leads, or marketplace access.
                </p>
              </div>
            </div>

            <div className={styles.previewPanel} aria-label="Professional onboarding preview">
              <div className={styles.previewHeader}>
                <span className={styles.previewStatus}>
                  <span className={styles.badgeDot} aria-hidden="true" />
                  <span>Agent Intake Workflow</span>
                </span>
                <span>Licensed Producers</span>
              </div>
              <div className={styles.previewItems}>
                <div className={styles.previewItem}>
                  <div><span className={styles.previewItemTitle}>Step 1: Producer Info</span></div>
                  <span className={styles.previewItemTag}>Agent & Agency</span>
                </div>
                <div className={styles.previewItem}>
                  <div><span className={styles.previewItemTitle}>Step 2: Licensing Footprint</span></div>
                  <span className={styles.previewItemTag}>Resident & Non-Resident</span>
                </div>
                <div className={styles.previewItem}>
                  <div><span className={styles.previewItemTitle}>Step 3: Specialty Programs</span></div>
                  <span className={styles.previewItemTag}>Full-Timer, Coach, Gear</span>
                </div>
              </div>
              <div className={styles.previewFooter}>
                <span>Producer credentials review</span>
                <span>Verified appointments</span>
              </div>
            </div>
          </div>
        </section>

        {/* FREQUENTLY ASKED QUESTIONS */}
        <section className={styles.section} aria-labelledby="faq-heading">
          <div className={styles.sectionIntro}>
            <p className={styles.kicker}>FREQUENTLY ASKED QUESTIONS</p>
            <h2 id="faq-heading">Understanding RV insurance considerations.</h2>
            <p>Educational answers to common questions about specialized recreational vehicle protection.</p>
          </div>

          <div className={styles.faqGrid}>
            <article className={styles.faqCard}>
              <h3>Does RVNB sell or underwrite insurance?</h3>
              <p>No. RVNB is not an insurance carrier, underwriter, or licensed agency. We provide educational resources and are developing a connection marketplace for independent licensed insurance professionals.</p>
            </article>

            <article className={styles.faqCard}>
              <h3>Can RVNB guarantee that I qualify for coverage?</h3>
              <p>No. All policy eligibility, rate determinations, underwriting approvals, and binding decisions are made exclusively by licensed insurance carriers and their authorized agents.</p>
            </article>

            <article className={styles.faqCard}>
              <h3>Is an RV policy different from a standard auto policy?</h3>
              <p>Yes. A personal auto policy typically covers driving liability and basic collision, but excludes living space premises liability, full contents replacement, attached awnings, and total loss replacement.</p>
            </article>

            <article className={styles.faqCard}>
              <h3>What should full-time RV users ask about?</h3>
              <p>Full-timers should ask about specialized Full-Timer Liability packages (equivalent to homeowner personal liability), medical payments, loss assessments, and agreed-value settlements.</p>
            </article>

            <article className={styles.faqCard}>
              <h3>Can I insure personal belongings and custom equipment?</h3>
              <p>Yes. Most dedicated RV insurers offer endorsements for personal effects, custom solar systems, lithium batteries, aftermarket suspension, and interior cabinetry up to specified limits.</p>
            </article>

            <article className={styles.faqCard}>
              <h3>How will agents and agencies be verified?</h3>
              <p>Future marketplace standards will require agents to provide active National Producer Numbers (NPN), verified resident and non-resident state licenses, and authorized carrier appointments.</p>
            </article>

            <article className={styles.faqCard}>
              <h3>Will promoted policies be labeled?</h3>
              <p>Yes. In accordance with consumer protection standards, any sponsored agency listings or featured policy programs will be clearly labeled as promoted content.</p>
            </article>

            <article className={styles.faqCard}>
              <h3>Can coverage vary by state?</h3>
              <p>Yes. Insurance regulations, mandatory minimum liability limits, no-fault PIP rules, and policy form terms vary by your declared garaging, registration, and storage state.</p>
            </article>

            <article className={styles.faqCard}>
              <h3>What happens after I submit early interest?</h3>
              <p>Your information is saved for future launch notifications. When licensed matching opens in your area, you will receive an invitation to explore verified agent options.</p>
            </article>
          </div>
        </section>

        {/* LEGAL & REGULATORY DISCLAIMERS */}
        <footer className={styles.footerDisclaimer}>
          <strong>Regulatory Disclosures & Legal Boundaries</strong>
          <p>
            RVNB is not currently an insurance carrier, underwriter, broker, or licensed insurance agency. All content and tools provided on this page are strictly for educational and informational purposes and do not constitute insurance, legal, financial, or tax advice. Coverage options, limits, terms, exclusions, pricing, and eligibility vary by insurer, policy form, state jurisdiction, vehicle specifications, and individual driving history. Submitting an early-access inquiry does not constitute an insurance application, quote, binder, policy issuance, or guarantee of coverage. Prospective policyholders should review official carrier policy documents and verify producer licenses with their respective state department of insurance.
          </p>
        </footer>
      </div>
    </main>
  );
}

function ShieldIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

function BriefcaseIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect width="20" height="14" x="2" y="7" rx="2" ry="2" />
      <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
    </svg>
  );
}
