import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import TypingLines from "../components/TypingLines";
import { getPlatformPulse, type PlatformPulse } from "../../../services/PlatformService";
import "../styles/Home.css";

function Home() {
  const navigate = useNavigate();
  const [pulse, setPulse] = useState<PlatformPulse | null>(null);

  useEffect(() => {
    let mounted = true;
    const refresh = async () => {
      try {
        const nextPulse = await getPlatformPulse();
        if (mounted) setPulse(nextPulse);
      } catch (error) {
        console.error("Could not refresh Developer Pulse", error);
      }
    };

    void refresh();
    const timer = window.setInterval(() => void refresh(), 15000);
    return () => {
      mounted = false;
      window.clearInterval(timer);
    };
  }, []);

  const formatPulse = (value: number | undefined) => {
    if (typeof value !== "number") return "—";
    return new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(value);
  };

  const activeCells = {
    /* MAX */
    1: "max",
    7: "max",
    9: "max",
    13: "max",
    17: "max",
    19: "max",
    21: "max",
    25: "max",
    27: "max",
    33: "max",
    35: "max",
    39: "max",
    41: "max",
    45: "max",
    47: "max",
    51: "max",
    53: "max",
    57: "max",
    59: "max",
    65: "max",
    71: "max",
    /* LOW (value - 1) */
    6: "low",
    8: "low",
    12: "low",
    16: "low",
    18: "low",
    20: "low",
    24: "low",
    26: "low",
    32: "low",
    34: "low",
    38: "low",
    40: "low",
    44: "low",
    46: "low",
    50: "low",
    52: "low",
    58: "low",
    64: "low",
    /* LOW (value + 1) */
    2: "low",
    10: "low",
    14: "low",
    28: "low",
    42: "low",
    48: "low",
    54: "low",
    60: "low",
    66: "low",
    72: "low",
  };

  const motivations = [
    "Push yourself, because no one else will.",
    "Great things never come from comfort zones.",
    "Dream it. Wish it. Do it.",
    "Stay focused and never give up.",
    "Success doesn't just find you — you create it.",
    "Discipline beats motivation every time.",
    "Small, consistent commits beat occasional bursts of effort.",
  ];

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
            className="cta-btn hero-underline-btn"
            type="button"
            onClick={() => navigate("/signup")}
          >
            Start building
          </button>

        </div>
      </section>
      <section className="cards" aria-label="DevArena highlights">
        <div className="home-card-row">
          <article className="card">
          <div className="consistency-card">
            <div className="consistency-header">
              <h3>Consistency</h3>
              <span className="streak">22 week streak</span>
            </div>

            <div className="heatmap">
              {Array.from({ length: 22 }).map((_, week) => (
                <div className="heatmap-column" key={week}>
                  {Array.from({ length: 7 }).map((_, day) => {
                    const dayNumber = week * 7 + day + 1;
                    const patternDay = ((dayNumber - 1) % 77) + 1;

                    const level =
                      activeCells[patternDay as keyof typeof activeCells] ||
                      "empty";

                    return (
                      <div
                        key={dayNumber}
                        className={`heat-cell ${level}`}
                        title={`Day ${dayNumber}`}
                      />
                    );
                  })}
                </div>
              ))}
            </div>

            <div className="heatmap-footer">
              <span>Less</span>

              <div className="legend">
                <div className="legend-box empty"></div>
                <div className="legend-box low"></div>
                <div className="legend-box medium"></div>
                <div className="legend-box high"></div>
                <div className="legend-box max"></div>
              </div>

              <span>More</span>
            </div>

            <button
              className="cta-btn secondary feature-underline-btn"
              type="button"
              onClick={() => navigate("/about")}
            >
              Explore features
            </button>
          </div>
        </article>

        <article className="motivation-card">
          <blockquote className="motivation-quote">
            “{motivations[Math.floor(Math.random() * motivations.length)]}”
          </blockquote>

          <div className="motivation-footer">
            <span>Keep building</span>
          </div>
          </article>
        </div>

        <article className="pulse-card">
          <div className="pulse-top">
            <p className="pulse-label">Our Developer Pulse</p>
          </div>

          <div className="pulse-stats">
            <div className="pulse-stat">
              <h2>{formatPulse(pulse?.projectsShared)}</h2>
              <span>Projects Shared</span>
            </div>

            <div className="pulse-stat">
              <h2>{formatPulse(pulse?.logsCreated)}</h2>
              <span>Logs Created</span>
            </div>

            <div className="pulse-stat">
              <h2>{formatPulse(pulse?.developers)}</h2>
              <span>Developers Registered</span>
            </div>
          </div>

          <p className="pulse-footer">
            Builders worldwide are creating, learning, and shipping in real
            time.
          </p>
        </article>
      </section>
    </main>
  );
}

export default Home;
