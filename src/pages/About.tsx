import { useNavigate } from "react-router-dom";
import "../styles/About.css";

import Cards from "../components/Cards";

function about() {
  const navigate = useNavigate();
  return (
    <main className="about-page">
        <div className="about-wrap">
          <div className="about-hero">
            <h1>
              Building the future of
              <br />
              developer collaboration.
            </h1>
            <p>
              DevArena is a community-driven platform where developers practice skills, showcase projects, write technical content, and grow through real-world learning. Unlike traditional coding platforms, DevArena combines collaboration, visibility, and progress tracking to help developers build stronger portfolios, improve consistently, and stand out in the tech community.
            </p>
          </div>

          <div className="about-grid">
            <Cards /> 
          </div>

          <div className="support-banner">
            <h3>Need help or have questions?</h3>
            <p>
              Our support team is available 24/7. Browse our FAQs, send us a
              message, or chat live.
            </p>
            <button className="support-btn" onClick={() => navigate('/Support')}>
              Go to support →
            </button>
          </div>
        </div>
    </main>
  );
}
export default about;
