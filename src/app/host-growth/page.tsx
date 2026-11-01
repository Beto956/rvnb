import Image from "next/image";
import Link from "next/link";
import GrowthInterestForm from "./interest-form";
import styles from "./hostgrowth.module.css";

export const metadata = {
  title: "Host Growth Program | RVNB",
  description: "A proposed RVNB-funded pilot for practical host-property improvements. No funding is guaranteed.",
};

export default function HostGrowthPage() {
  return <main className={styles.page}>
    <div className={styles.container}>
      <header className={styles.header}>
        <Link href="/" className={styles.brand} aria-label="RVNB Home">
          <Image src="/rvnb-logo-icon.png" alt="RVNB" width={2000} height={1333} sizes="320px" />
        </Link>
        <nav aria-label="Host Growth navigation"><Link href="/listings">Find a stay</Link><Link href="/host">Host dashboard</Link></nav>
      </header>
      <section className={styles.hero} aria-labelledby="growth-heading">
        <p className={styles.eyebrow}>RVNB Host Growth Program</p>
        <h1 id="growth-heading">Grow your hosting potential.</h1>
        <p className={styles.status}>Pilot in development — register your interest.</p>
        <p>RVNB is exploring support for practical improvements at promising host properties, funded from RVNB&apos;s own money. This is not a government grant or an invitation to outside investment.</p>
        <p>The planning assumption for the first pilot is one selected property, up to $500 total. No funding has been awarded, reserved, or guaranteed. Proposed amounts and program details remain under development, not approved financial commitments.</p>
        <a href="#register-interest" className={styles.primary}>Explore interest registration</a>
      </section>
      <section className={styles.section} aria-labelledby="improvements-heading">
        <p className={styles.eyebrow}>Practical possibilities</p>
        <h2 id="improvements-heading">Small improvements, considered carefully.</h2>
        <ul className={styles.examples}><li>Better Wi-Fi coverage</li><li>Entrance signage</li><li>Professional listing photography</li><li>Approved site preparation</li></ul>
        <p>Structural, electrical, plumbing, and other regulated work require appropriate professional review and approvals. Hosts must have authority to make proposed property improvements.</p>
      </section>
      <section className={styles.section} aria-labelledby="options-heading">
        <h2 id="options-heading">What RVNB is exploring</h2>
        <div className={styles.grid}>
          <article className={styles.panel}><p className={styles.eyebrow}>Proposed pilot option</p><h3>Improvement Awards</h3><p>Proposed nonrepayable support for an approved project. An award would require a separate written offer and accepted terms before funding.</p></article>
          <article className={styles.panel}><p className={styles.muted}>Planned; not currently available</p><h3>Repayable Funding</h3><p>A possible future option. RVNB is not offering loans, making credit decisions, or collecting repayments through this registration.</p></article>
          <article className={styles.panel}><p className={styles.muted}>Planned; not currently available</p><h3>Combined Support</h3><p>A possible future combination of support types. No combined award or financing is currently available.</p></article>
        </div>
      </section>
      <section className={styles.panel} aria-labelledby="selection-heading">
        <h2 id="selection-heading">Selection considerations</h2>
        <p>RVNB may consider property permission, traveler demand, project feasibility, cost, and readiness to host. These considerations are not automatic eligibility or approval criteria.</p>
        <h3>A proposed process</h3>
        <ol className={styles.steps}><li>Register interest</li><li>RVNB reviews</li><li>Selected applicants may be contacted</li><li>Any support requires a separate written offer</li></ol>
        <p>There is no guaranteed response time. Registration does not promise a review decision, contact, or support.</p>
      </section>
      <section className={styles.section} aria-labelledby="recognition-heading">
        <h2 id="recognition-heading">Hosting quality, without review incentives</h2>
        <p>RVNB is also exploring recognition for consistent hosting quality. Cash rewards, automatic eligibility, ranking advantages, and a Host Excellence badge are not active. No rating, review-count, or time thresholds are finalized.</p>
        <p>Recognition must never incentivize positive guest reviews, review removal, or rating manipulation. Participation does not improve review scores, establish property verification, or guarantee bookings.</p>
      </section>
      <section className={styles.panel} aria-labelledby="faq-heading">
        <h2 id="faq-heading">Frequently asked questions</h2>
        <details><summary>Is registration a funding application or approval?</summary><p>No. It is an expression of interest, not a funding application, approval, loan offer, or contract. No funding is guaranteed or reserved by submitting.</p></details>
        <details><summary>Do I need reviews or a public member profile?</summary><p>No. Sign-in is required, but existing reviews and a published public profile are not. You may select an owned listing or give a general city and state or region for a proposed property.</p></details>
        <details><summary>Does registration authorize payments or deductions?</summary><p>No. Registration does not authorize repayment deductions or access to financial accounts. Any future award or financing requires separate terms accepted before funding.</p></details>
        <details><summary>Why is submission paused?</summary><p>A privacy notice covering this collection has not yet been approved. Submission is disabled until that dependency is resolved. No registration information is sent by this form while it is paused.</p></details>
      </section>
      <section id="register-interest" className={styles.panel} aria-labelledby="register-heading">
        <h2 id="register-heading">Register your interest</h2>
        <p>One registration per owned listing, plus one proposed-property registration per account for this pilot. Do not include precise home addresses, bank details, SSNs, identity documents, deeds, or credit information.</p>
        <GrowthInterestForm />
      </section>
      <aside className={styles.notices} aria-label="Program notices">
        <h2>Program notices</h2>
        <p>Registration is an expression of interest, not a funding application, approval, loan offer, or contract. No funding is guaranteed or reserved by submitting. Proposed amounts and program details remain under development.</p>
        <p>Any future award or financing requires separate terms accepted before funding. Hosts must have authority to make proposed property improvements. Registration does not authorize repayment deductions or access to financial accounts.</p>
        <p>Participation does not improve review scores, establish property verification, or guarantee bookings. Cancellation, repayment, default, tax, and legal provisions have not been published as finalized terms.</p>
      </aside>
    </div>
  </main>;
}
