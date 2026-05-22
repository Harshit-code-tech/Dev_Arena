import { useNavigate } from "react-router-dom";
import "../styles/about.css";

function about() {
  const navigate = useNavigate();
  return (
    <main className="about-page">
        <div className="about-wrap">
          <div className="about-hero">
            <h1>
              Building the future of
              <br />
              developer collaboration
            </h1>
            <p>
              DevArena is an AI-powered social media management platform built
              for developers, creators, and teams who want to grow their online
              presence without the manual grind. We combine smart scheduling,
              analytics, and community tools — all in one clean interface.
            </p>
          </div>

          <div className="about-grid">
            <div className="about-feature">
              <div className="icon">⚡</div>
              <h3>AI-powered scheduling</h3>
              <p>
                Our AI picks the perfect time to post based on your audience's
                activity patterns.
              </p>
            </div>
            <div className="about-feature">
              <div className="icon">📊</div>
              <h3>Deep analytics</h3>
              <p>
                Understand what's working with post-level performance breakdowns
                across all platforms.
              </p>
            </div>
            <div className="about-feature">
              <div className="icon">🤝</div>
              <h3>Community first</h3>
              <p>
                Connect with other developers, share your journey, and grow
                together as a community.
              </p>
            </div>
            <div className="about-feature">
              <div className="icon">🔒</div>
              <h3>Privacy focused</h3>
              <p>
                Your data stays yours. We never sell your information to third
                parties. Ever.
              </p>
            </div>
            <div className="about-feature">
              <div className="icon">🌍</div>
              <h3>Built for everyone</h3>
              <p>
                From solo indie hackers to large engineering teams — DevArena
                scales with you.
              </p>
            </div>
            <div className="about-feature">
              <div className="icon">🚀</div>
              <h3>Rapid development</h3>
              <p>
                We ship new features every week based directly on community
                feedback and requests.
              </p>
            </div>
          </div>

          <div className="support-banner">
            <h3>Need help or have questions?</h3>
            <p>
              Our support team is available 24/7. Browse our FAQs, send us a
              message, or chat live.
            </p>
            <button className="support-btn" onClick={() => navigate('/support')}>
              Go to support →
            </button>
          </div>
        </div>
    </main>
  );
}
export default about;
