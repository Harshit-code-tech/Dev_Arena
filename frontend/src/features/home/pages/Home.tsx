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
    "Talk is cheap. Show me the code. Or at least a passing test.",
    "Your code works on your machine? Cool, we're not shipping your laptop.",
    "There are two hard things in CS: cache invalidation, naming things, and getting you to log code.",
    "Git commit -m 'fixed stuff' is not an architecture, bro.",
    "If you spent as much time coding as you do tweaking your VS Code theme, you'd be #1.",
    "Eat, sleep, leetcode, repeat. (Okay maybe take a shower too).",
    "Rome wasn't built in a day, but at least their engineers pushed to main.",
    "99 little bugs in the code, fix one bug, 127 little bugs in the code.",
  ];

  return (
    <main className="home-page">
      <section className="hero">
        <p className="eyebrow">Where Code Talks &amp; Excuses Die</p>

        <h1>
          <TypingLines />
        </h1>

        <p className="hero-copy">
          DevArena is where competitive developers build real projects, grind DSA,
          roast their friends' streaks, and settle who's actually shipping code.
        </p>

        <div className="hero-actions">
          <button
            className="cta-btn hero-underline-btn"
            type="button"
            onClick={() => navigate("/signup")}
          >
            Enter the Arena ⚔️
          </button>

        </div>
      </section>
      <section className="cards" aria-label="DevArena highlights">
        <div className="home-card-row">
          <article className="consistency-card">
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
