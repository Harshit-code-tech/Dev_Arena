import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import TypingLines from "../components/TypingLines";
import { getPlatformPulse, type PlatformPulse } from "../../../services/PlatformService";
import "../styles/Home.css";

const MOTIVATIONS = [
  "Consistent practice turns difficult problems into familiar patterns.",
  "Build for real environments, test carefully, and keep improving the details.",
  "Strong developers improve through deliberate practice, clear thinking, and regular reflection.",
  "Clear commits and thoughtful architecture make good work easier to maintain.",
  "Protect focused development time and let steady progress compound.",
  "Balance practice, projects, and rest so you can improve sustainably.",
  "Large projects are built one meaningful milestone at a time.",
  "Debugging is part of engineering: isolate the issue, learn from it, and move forward.",
];

const PAGE_MOTIVATION = MOTIVATIONS[Math.floor(Math.random() * MOTIVATIONS.length)];

function Home() {
  const navigate = useNavigate();
  const [pulse, setPulse] = useState<PlatformPulse | null>(null);
  const heroRef = useRef<HTMLElement | null>(null);
  const highlightsRef = useRef<HTMLDivElement | null>(null);
  const pulseRef = useRef<HTMLElement | null>(null);
  const resetFrameRef = useRef(0);

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

  useLayoutEffect(() => {
    const root = document.documentElement;
    const body = document.body;
    const scrollingElement = document.scrollingElement;
    const previousRootBehavior = root.style.scrollBehavior;
    const previousBodyBehavior = body.style.scrollBehavior;
    const previousRestoration =
      "scrollRestoration" in window.history ? window.history.scrollRestoration : null;

    root.style.scrollBehavior = "auto";
    body.style.scrollBehavior = "auto";
    if ("scrollRestoration" in window.history) {
      window.history.scrollRestoration = "manual";
    }

    const resetToFirstSection = () => {
      window.scrollTo(0, 0);
      scrollingElement?.scrollTo(0, 0);
    };

    // Always enter the public landing route at section 1. Repeating the reset
    // for two frames prevents late layout/restoration work from reopening the
    // page at an old section before the user has interacted with it.
    const handlePageShow = () => resetToFirstSection();
    window.addEventListener("pageshow", handlePageShow);

    resetToFirstSection();
    const firstFrame = window.requestAnimationFrame(() => {
      resetToFirstSection();
      const secondFrame = window.requestAnimationFrame(() => {
        resetToFirstSection();
        root.style.scrollBehavior = previousRootBehavior;
        body.style.scrollBehavior = previousBodyBehavior;
      });
      resetFrameRef.current = secondFrame;
    });
    resetFrameRef.current = firstFrame;

    return () => {
      window.removeEventListener("pageshow", handlePageShow);
      window.cancelAnimationFrame(resetFrameRef.current);
      root.style.scrollBehavior = previousRootBehavior;
      body.style.scrollBehavior = previousBodyBehavior;
      if (previousRestoration !== null && "scrollRestoration" in window.history) {
        window.history.scrollRestoration = previousRestoration;
      }
    };
  }, []);

  useEffect(() => {
    document.documentElement.classList.add("landing-paging-active");
    document.body.classList.add("landing-paging-active");

    let currentIndex = 0;
    let wheelGestureActive = false;
    let wheelQuietTimer = 0;
    let lastWheelAt = 0;

    const getSections = () =>
      [
        heroRef.current,
        highlightsRef.current,
        pulseRef.current,
        document.querySelector<HTMLElement>(".site-footer"),
      ].filter((section): section is HTMLElement => Boolean(section));

    const sectionTop = (section: HTMLElement) =>
      Math.max(0, Math.round(section.getBoundingClientRect().top + window.scrollY));

    const goToSection = (index: number) => {
      const sections = getSections();
      if (sections.length === 0) return;

      const nextIndex = Math.max(0, Math.min(index, sections.length - 1));
      currentIndex = nextIndex;

      window.scrollTo({
        top: sectionTop(sections[nextIndex]),
        left: 0,
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "auto"
          : "smooth",
      });
    };

    const unlockWheelWhenGestureEnds = () => {
      window.clearTimeout(wheelQuietTimer);
      wheelQuietTimer = window.setTimeout(() => {
        const quietFor = performance.now() - lastWheelAt;
        if (quietFor < 180) {
          unlockWheelWhenGestureEnds();
          return;
        }
        wheelGestureActive = false;
      }, 180);
    };

    const handleWheel = (event: WheelEvent) => {
      if (event.ctrlKey) return;

      // Normalize wheels that report movement in lines/pages instead of pixels.
      const unit = event.deltaMode === WheelEvent.DOM_DELTA_LINE
        ? 16
        : event.deltaMode === WheelEvent.DOM_DELTA_PAGE
          ? window.innerHeight
          : 1;
      const deltaX = event.deltaX * unit;
      const deltaY = event.deltaY * unit;

      // Horizontal trackpad movement should not turn pages.
      if (Math.abs(deltaX) > Math.abs(deltaY)) return;

      // The landing page is controlled entirely here. Preventing native wheel
      // scrolling removes the race between browser scroll-snap and JS paging.
      event.preventDefault();

      if (Math.abs(deltaY) < 4) return;

      lastWheelAt = performance.now();
      unlockWheelWhenGestureEnds();

      // Trackpads emit many momentum wheel events for one physical gesture.
      // Only the first meaningful event is allowed to change the section.
      if (wheelGestureActive) return;
      wheelGestureActive = true;

      const direction = deltaY > 0 ? 1 : -1;
      const sections = getSections();
      if (sections.length === 0) return;

      const nextIndex = currentIndex + direction;
      if (nextIndex < 0 || nextIndex >= sections.length) return;

      goToSection(nextIndex);
    };

    const syncIndexToViewport = () => {
      if (wheelGestureActive) return;

      const sections = getSections();
      if (sections.length === 0) return;

      const scrollTop = window.scrollY;
      let nearestIndex = 0;
      let nearestDistance = Number.POSITIVE_INFINITY;

      sections.forEach((section, index) => {
        const distance = Math.abs(sectionTop(section) - scrollTop);
        if (distance < nearestDistance) {
          nearestDistance = distance;
          nearestIndex = index;
        }
      });

      currentIndex = nearestIndex;
    };

    // Capture the wheel before other page listeners can perform native scroll.
    window.addEventListener("wheel", handleWheel, { passive: false, capture: true });
    window.addEventListener("scrollend", syncIndexToViewport);

    return () => {
      window.removeEventListener("wheel", handleWheel, { capture: true });
      window.removeEventListener("scrollend", syncIndexToViewport);
      window.clearTimeout(wheelQuietTimer);
      document.documentElement.classList.remove("landing-paging-active");
      document.body.classList.remove("landing-paging-active");
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

  return (
    <main className="home-page">
      <section ref={heroRef} className="hero landing-snap-section">
        <p className="eyebrow">Build · Practice · Improve</p>

        <h1>
          <TypingLines />
        </h1>

        <p className="hero-copy">
          DevArena is where developers build real projects, practice DSA,
          track meaningful progress, and grow alongside a focused technical community.
        </p>

        <div className="hero-actions">
          <button
            className="cta-btn hero-underline-btn"
            type="button"
            onClick={() => navigate("/signup")}
          >
            Start Building
          </button>

        </div>
      </section>
      <section className="cards" aria-label="DevArena highlights">
        <div ref={highlightsRef} className="home-card-row landing-snap-section">
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
              “{PAGE_MOTIVATION}”
            </blockquote>

            <div className="motivation-footer">
              <span>Keep building</span>
            </div>
          </article>
        </div>

        <article ref={pulseRef} className="pulse-card landing-snap-section">
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
