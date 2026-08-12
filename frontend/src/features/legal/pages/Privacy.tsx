import { Link } from "react-router-dom";
import "../styles/LegalPages.css";

const EFFECTIVE_DATE = "2 August 2026";

export default function Privacy() {
  const contactEmail = String(import.meta.env.VITE_LEGAL_CONTACT_EMAIL || "").trim();

  return (
    <main className="legal-page">
      <header className="legal-hero">
        <p>Legal / Data use</p>
        <h1>Privacy Policy</h1>
        <span>Effective {EFFECTIVE_DATE}</span>
      </header>

      <div className="legal-layout">
        <aside className="legal-summary" aria-label="Privacy summary">
          <h2>Your data at a glance</h2>
          <p>
            DevArena uses account, activity, project, social, and technical data to provide
            developer tracking, rankings, players, shared projects, security, and support.
          </p>
          <div className="legal-fact-grid">
            <span><strong>No sale</strong> of personal data</span>
            <span><strong>No ad profiling</strong> in the current product</span>
            <span><strong>Public by choice</strong> for shared projects</span>
            <span><strong>Account controls</strong> in Settings</span>
          </div>
        </aside>

        <article className="legal-document">
          <section>
            <h2>1. Scope and operator</h2>
            <p>
              This policy explains how the operator of DevArena collects, uses, stores,
              discloses, and protects personal data when you visit the public website, create
              an account, use developer-tracking features, interact with players, share a
              project, contact support, or use authentication providers.
            </p>
            <p>
              For privacy questions, use the <Link to="/support">Support page</Link>
              {contactEmail ? <> or email <a href={`mailto:${contactEmail}`}>{contactEmail}</a></> : null}.
            </p>
          </section>

          <section>
            <h2>2. Data DevArena collects</h2>
            <h3>Account and identity data</h3>
            <ul>
              <li>name, permanent username, email address, profile photo or initials preference;</li>
              <li>Google/GitHub/Firebase account identifiers and basic profile data returned by the chosen provider;</li>
              <li>password hash for email accounts, email-verification state, hashed OTP/reset metadata, and authentication/session tokens;</li>
              <li>the date and version of the Terms of Service and Privacy Policy accepted for new accounts.</li>
            </ul>

            <h3>Developer activity and project data</h3>
            <ul>
              <li>Quick Logs, DSA entries, revision and learning logs, Fullstack activity, time spent, notes, complexity details, and proof links;</li>
              <li>project titles, descriptions, domains, status, work sessions, milestones, completion data, share settings, and public share links;</li>
              <li>Arena Score, Season Points, streaks, active days, ranks, leaderboard position, and scoring events.</li>
            </ul>

            <h3>Player and communication data</h3>
            <ul>
              <li>player searches, requests, connections, email invitations, notification state, and friendship duration;</li>
              <li>support messages, reports, feedback, and related correspondence.</li>
            </ul>

            <h3>Technical and security data</h3>
            <ul>
              <li>IP address, device/browser information, request timestamps, server and security logs, error records, and rate-limit events;</li>
              <li>cookies or local-storage values needed for authentication, trusted-device state, preferences, and route/session continuity.</li>
            </ul>
          </section>

          <section>
            <h2>3. Where data comes from</h2>
            <p>
              Data comes directly from you, from activity created through DevArena, from
              connected authentication providers, from people who invite or connect with you,
              and automatically from your browser, device, and server requests.
            </p>
          </section>

          <section>
            <h2>4. How DevArena uses data</h2>
            <ul>
              <li>create and secure accounts; authenticate email, Google, and GitHub users;</li>
              <li>provide logs, projects, players, notifications, sharing, rankings, streaks, and score calculations;</li>
              <li>send OTPs, security messages, invitations, requested notifications, and service communications;</li>
              <li>prevent duplicate or abusive logging, spam, fraud, account takeover, and manipulation of ranks;</li>
              <li>operate, troubleshoot, measure, improve, back up, and protect the platform;</li>
              <li>respond to support, rights requests, disputes, legal process, and security incidents;</li>
              <li>comply with applicable law and enforce the Terms of Service.</li>
            </ul>
          </section>

          <section>
            <h2>5. What other people can see</h2>
            <ul>
              <li>Your username, name, profile photo/initials, technology tags, score, rank, and leaderboard position may be visible to other signed-in users.</li>
              <li>Connected players may see additional relationship information and, where the interface permits, your email address.</li>
              <li>A project becomes publicly accessible only when you enable sharing; anyone with the link may copy or redistribute visible information.</li>
              <li>Proof links lead to external services and may expose whatever those services make public.</li>
            </ul>
            <p>
              Do not submit secrets, private keys, passwords, confidential employer/client
              information, medical data, government identifiers, or another person&apos;s personal
              data unless you have a lawful and necessary reason.
            </p>
          </section>

          <section>
            <h2>6. Legal grounds and consent</h2>
            <p>
              DevArena processes data to perform the service you request, based on your
              consent where required, for security and prevention of misuse, and to comply
              with legal obligations. Optional notifications and public project sharing can be
              changed through Settings or the relevant project controls.
            </p>
            <p>
              Withdrawing optional consent does not affect processing already lawfully carried
              out. Some core account data is necessary to provide the service; deleting it may
              require closure of the account.
            </p>
          </section>

          <section>
            <h2>7. Service providers and disclosures</h2>
            <p>DevArena may disclose data only as reasonably necessary to:</p>
            <ul>
              <li>Google, GitHub, and Firebase for social authentication and identity synchronisation;</li>
              <li>Cloudinary for profile-image storage;</li>
              <li>PostgreSQL/Neon or replacement database infrastructure for application data;</li>
              <li>email-delivery and SMTP providers for OTPs, invitations, and requested notices;</li>
              <li>hosting, logging, security, backup, and infrastructure providers;</li>
              <li>professional advisers, law-enforcement bodies, regulators, courts, or affected parties where legally required or necessary to protect rights and safety;</li>
              <li>a successor organisation during a merger, financing, restructuring, or transfer, subject to appropriate safeguards and notice where required.</li>
            </ul>
            <p>DevArena does not sell personal data and does not currently use personal data for third-party behavioural advertising.</p>
          </section>

          <section>
            <h2>8. International processing</h2>
            <p>
              Authentication, image, database, email, and hosting providers may process data
              in India or other countries. DevArena will use contractual, technical, and
              organisational safeguards required by applicable law and will review provider
              locations and restrictions before production deployment.
            </p>
          </section>

          <section>
            <h2>9. Retention</h2>
            <p>
              Account and activity data is generally retained while your account is active and
              as needed to provide the service. Deleted data may remain temporarily in backups,
              security records, fraud-prevention records, legal holds, and transaction or system
              logs. Security and processing logs may be retained for periods required by
              applicable cybersecurity and data-protection rules.
            </p>
            <p>
              Retention periods are reviewed by data category. DevArena will erase or anonymise
              personal data when it is no longer needed for the stated purpose, unless continued
              retention is required for security, legal compliance, dispute resolution, or backups.
            </p>
          </section>

          <section>
            <h2>10. Security</h2>
            <p>
              DevArena uses measures such as password hashing, access controls, rate limiting,
              authentication tokens, mandatory email verification for password accounts, provider security controls, monitoring,
              and backups. No service can guarantee absolute security. Users should use a unique
              password, protect their email/social accounts, and report suspected compromise.
            </p>
          </section>

          <section>
            <h2>11. Your choices and rights</h2>
            <p>Depending on applicable law, you may be able to:</p>
            <ul>
              <li>access or download your account data;</li>
              <li>correct your name, email, profile photo, preferences, and inaccurate personal data;</li>
              <li>make shared projects private and manage notification choices;</li>
              <li>withdraw optional consent;</li>
              <li>request deletion of your account and associated data, subject to lawful retention;</li>
              <li>raise a grievance, nominate another person where applicable, or complain to the competent authority.</li>
            </ul>
            <p>DevArena may verify identity before completing a rights request.</p>
          </section>

          <section>
            <h2>12. Children</h2>
            <p>
              DevArena is not intended for children under 18 and does not knowingly create
              child accounts. If you believe a child has submitted personal data, contact
              DevArena so the account and data can be reviewed and removed where appropriate.
            </p>
          </section>

          <section>
            <h2>13. Data breaches and incident response</h2>
            <p>
              DevArena will investigate suspected breaches, contain and remediate them, preserve
              necessary evidence, and notify affected people and authorities where applicable law
              requires. Notices may describe the incident, likely effects, protective steps, and
              a contact for questions.
            </p>
          </section>

          <section>
            <h2>14. Policy changes</h2>
            <p>
              This policy may change as DevArena adds features, providers, or legal obligations.
              Material changes will be communicated through the platform, email, or an updated
              effective date. Fresh consent will be requested where required.
            </p>
          </section>

          <section>
            <h2>15. Contact and grievance handling</h2>
            <p>
              Submit privacy, access, correction, deletion, security, or grievance requests through
              the <Link to="/support">Support page</Link>
              {contactEmail ? <> or <a href={`mailto:${contactEmail}`}>{contactEmail}</a></> : null}.
              Include enough information to identify the account and request, but never send your
              password, one-time verification code, private key, or access token.
            </p>
          </section>
        </article>
      </div>
    </main>
  );
}
