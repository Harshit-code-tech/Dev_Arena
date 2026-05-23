import { useNavigate } from "react-router-dom";

import TypingLines from "../components/TypingLines";
import "../styles/home.css";

function Home() {
  const navigate = useNavigate();
  return (
    <main className="home-page">
      <section className="hero">
        <div>
          <img src="/img.png" alt="DevArena logo" className="logo_da" />
        </div>

        <p className="eyebrow">Developer growth platform</p>

        <h1>
          <TypingLines />
        </h1>

        <p className="hero-copy">
          DevArena helps developers practice, showcase projects, write better
          technical content, and grow with a community built around progress.
        </p>

        <div className="hero-actions">
          <button
            className="cta-btn"
            type="button"
            onClick={() => navigate("/signup")}
          >
            Start building
          </button>

          <button
            className="cta-btn secondary"
            type="button"
            onClick={() => navigate("/about")}
          >
            Explore features
          </button>
        </div>
      </section>
      <section className="cards" aria-label="DevArena highlights">
        <article className="card">
          <h3>Today</h3>
          <div className="inner">
            <p>Challenge streak</p>
            <h2>14 days</h2>
          </div>
        </article>

        <article className="card">
          <h3>Motivation</h3>
          <div className="inner">
            <p className="quote">
              Small, consistent commits beat occasional bursts of effort.
            </p>
            <button className="new-btn" type="button">
              New quote
            </button>
          </div>
        </article>

        <article className="card">
          <h3>Next move</h3>
          <div className="inner">
            <p>Recommended action</p>
            <h2>Ship a project</h2>
          </div>
        </article>
      </section>
    </main>
  );
}

export default Home;
