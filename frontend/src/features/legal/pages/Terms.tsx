import { Link } from "react-router-dom";
import "../styles/LegalPages.css";

const EFFECTIVE_DATE = "2 August 2026";

export default function Terms() {
  return (
    <main className="legal-page">
      <header className="legal-hero">
        <p>Legal / Platform rules</p>
        <h1>Terms of Service</h1>
        <span>Effective {EFFECTIVE_DATE}</span>
      </header>

      <div className="legal-layout">
        <aside className="legal-summary" aria-label="Terms summary">
          <h2>Before you use DevArena</h2>
          <p>
            DevArena is a developer-growth platform for logging work, building projects,
            connecting with players, and comparing progress. These terms explain the
            rules, risks, and responsibilities attached to that use.
          </p>
          <nav>
            <a href="#eligibility">Eligibility</a>
            <a href="#accounts">Accounts</a>
            <a href="#content">Your content</a>
            <a href="#conduct">Acceptable use</a>
            <a href="#scores">Scores and rankings</a>
            <a href="#risk">Risk and liability</a>
            <a href="#contact">Contact</a>
          </nav>
        </aside>

        <article className="legal-document">
          <section>
            <h2>1. Agreement</h2>
            <p>
              By creating an account, using social sign-in to create an account, or
              otherwise using DevArena, you agree to these Terms of Service and the
              <Link to="/privacy"> Privacy Policy</Link>. If you do not agree, do not
              create or use an account.
            </p>
            <p>
              DevArena may be operated as an early-stage or preview service. Features,
              scoring rules, availability, and limits may change as the platform develops.
            </p>
          </section>

          <section id="eligibility">
            <h2>2. Eligibility and age</h2>
            <p>
              DevArena is intended for people who are at least 18 years old. By creating
              an account, you confirm that you are 18 or older and legally capable of
              entering into these terms. Do not create an account for a child or submit a
              child&apos;s personal data.
            </p>
          </section>

          <section id="accounts">
            <h2>3. Accounts, usernames, and security</h2>
            <ul>
              <li>You must provide accurate account information and keep it current.</li>
              <li>Your permanent username must be unique and may contain lowercase letters, numbers, dots, and underscores.</li>
              <li>You are responsible for protecting your password, social-login account, email account, and one-time verification codes.</li>
              <li>Do not share access tokens, recovery codes, private keys, API keys, or passwords in logs, projects, proof links, or support messages.</li>
              <li>Notify DevArena through the Support page if you believe your account has been compromised.</li>
            </ul>
          </section>

          <section id="content">
            <h2>4. Your content and project sharing</h2>
            <p>
              You keep ownership of content you submit, including logs, notes, project
              descriptions, milestones, links, and profile information. You grant DevArena
              a limited, non-exclusive licence to host, process, reproduce, and display that
              content only as needed to operate, secure, improve, and provide the service.
            </p>
            <p>
              Content marked public or shared through a project link may be viewed by
              others. You are responsible for confirming that shared repositories, screenshots,
              demo links, and descriptions do not expose confidential information, third-party
              personal data, copyrighted material you cannot use, or security credentials.
            </p>
            <p>
              You may remove or make content private where the product provides that control,
              subject to limited retention required for security, legal compliance, dispute
              handling, backups, and fraud prevention.
            </p>
          </section>

          <section id="conduct">
            <h2>5. Acceptable use</h2>
            <p>You must not use DevArena to:</p>
            <ul>
              <li>break any law, violate intellectual-property rights, or invade another person&apos;s privacy;</li>
              <li>harass, threaten, impersonate, dox, discriminate against, or exploit another person;</li>
              <li>upload malware, malicious scripts, stolen credentials, illegal content, or instructions intended to harm systems or people;</li>
              <li>spam invitations, scrape personal data, bypass rate limits, probe security without written permission, or automate abusive activity;</li>
              <li>fabricate activity, manipulate scores, create duplicate accounts, or misrepresent work to gain leaderboard position;</li>
              <li>publish private source code, employer/client secrets, examination answers, or material subject to confidentiality obligations.</li>
            </ul>
            <p>
              DevArena may remove content, reverse points, restrict features, suspend an
              account, preserve evidence, or report conduct where reasonably necessary to
              protect users, the platform, or comply with law.
            </p>
          </section>

          <section id="scores">
            <h2>6. Logs, scores, ranks, and leaderboards</h2>
            <p>
              Activity scores and ranks are motivational platform features, not verified
              professional qualifications, employment credentials, academic marks, or proof
              that work was completed. Most activity is self-reported. DevArena may adjust
              scoring rules, correct calculation errors, remove abusive entries, or rebuild
              scores when necessary.
            </p>
          </section>

          <section>
            <h2>7. Third-party services</h2>
            <p>
              DevArena may rely on Google, GitHub, Firebase, Cloudinary, database hosts,
              email-delivery providers, and hosting infrastructure. Their services and links
              are governed by their own terms and privacy practices. DevArena is not
              responsible for third-party outages, account decisions, repository content, or
              external sites reached through user-submitted links.
            </p>
          </section>

          <section>
            <h2>8. Service availability and changes</h2>
            <p>
              The service is provided on an “as available” basis. DevArena may change,
              pause, limit, or discontinue features; carry out maintenance; or remove data
              that violates these terms. Reasonable efforts may be made to protect and restore
              data, but uninterrupted availability and permanent storage are not guaranteed.
              Keep independent copies of important project information.
            </p>
          </section>

          <section>
            <h2>9. Account suspension and deletion</h2>
            <p>
              You may request account deletion through Settings, subject to identity checks
              and lawful retention. DevArena may suspend or terminate access for material or
              repeated violations, security threats, fraud, unlawful conduct, or risks to other
              users. Where practical, notice and an opportunity to appeal may be provided.
            </p>
          </section>

          <section id="risk">
            <h2>10. Important risk disclosures</h2>
            <ul>
              <li>Public usernames, scores, ranks, profile details, and shared projects can be copied or indexed by others.</li>
              <li>External proof links may reveal repository history, identity, employer details, or confidential information.</li>
              <li>No online service is completely secure; account compromise, data loss, software defects, and outages remain possible.</li>
              <li>DevArena does not provide legal, employment, academic, cybersecurity, financial, or professional advice.</li>
              <li>Use of rankings or self-reported activity for hiring or assessment is at the evaluator&apos;s own risk.</li>
            </ul>
          </section>

          <section>
            <h2>11. Disclaimers and limitation of liability</h2>
            <p>
              To the maximum extent permitted by applicable law, DevArena is provided without
              warranties of merchantability, fitness for a particular purpose, non-infringement,
              uninterrupted operation, or guaranteed accuracy. DevArena is not liable for
              indirect, incidental, special, consequential, exemplary, or punitive losses,
              lost opportunities, lost profits, reputational loss, or loss caused by user content,
              external links, account misuse, or third-party services.
            </p>
            <p>
              Nothing in these terms excludes liability that cannot legally be excluded, or
              limits mandatory consumer or data-protection rights.
            </p>
          </section>

          <section>
            <h2>12. Responsibility for claims</h2>
            <p>
              You are responsible for losses and claims caused by your unlawful content,
              infringement of third-party rights, misuse of the platform, or material breach
              of these terms. This does not require you to cover losses caused by DevArena&apos;s
              own unlawful conduct or negligence where applicable law says otherwise.
            </p>
          </section>

          <section>
            <h2>13. Governing law and disputes</h2>
            <p>
              These terms are governed by the laws of India. Courts having jurisdiction over
              the operator&apos;s principal place of business in India will have jurisdiction,
              subject to any mandatory consumer forum, statutory complaint mechanism, or
              other right that applicable law gives you.
            </p>
          </section>

          <section>
            <h2>14. Changes to these terms</h2>
            <p>
              Material changes will be communicated through the platform, email, or an updated
              effective date. Where fresh consent is legally required, DevArena will request it
              before the relevant processing or feature continues.
            </p>
          </section>

          <section id="contact">
            <h2>15. Contact and complaints</h2>
            <p>
              Use the <Link to="/support">Support page</Link> for account, content, privacy,
              security, or legal questions. DevArena may ask for information reasonably needed
              to verify your identity and investigate the request, but will never ask for your
              password, one-time verification code, private key, or access token.
            </p>
          </section>
        </article>
      </div>
    </main>
  );
}
