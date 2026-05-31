import { useMemo, useState, useCallback } from "react";
import UpdatesTimeline, { type UpdateEntry } from "../components/UpdatesTimeline";
import Pagination from "../components/Pagination";
import "../styles/updates.css";

// ---------------------------------------------------------------------------
// Dataset — sorted newest → oldest. Replace with your real API fetch.
// ---------------------------------------------------------------------------

const allUpdates: UpdateEntry[] = [
  {
    id: "update-01",
    date: "May 28, 2026",
    title: "Redesigned release timeline",
    summary:
      "We've completely rebuilt how we communicate product changes. Every release now lives on a clean, scrollable timeline so you can see exactly what's new, what changed, and when — at a glance.",
    releaseTag: "New",
    version: "2.0.1",
    status: "Released",
    changelogSpecs: [
      "Brand-new release timeline replacing the old changelog page",
      "Expandable cards reveal full release notes per update",
      "Keyboard-navigable and screen-reader accessible",
    ],
  },
  {
    id: "update-02",
    date: "May 25, 2026",
    title: "Faster, more reliable draft saving",
    summary:
      "Auto-save now runs every 30 seconds and flags conflicts instantly when two sessions edit the same draft simultaneously. You'll never lose work again.",
    releaseTag: "Improvement",
    version: "2.0.2",
    status: "Released",
    changelogSpecs: [
      "Auto-save with 30-second debounce",
      "Real-time conflict detection with inline warning",
      "Restore any of the last 20 draft versions from the history panel",
    ],
  },
  {
    id: "update-03",
    date: "May 22, 2026",
    title: "Navigation overhaul",
    summary:
      "The site header and mobile menu have been rebuilt from the ground up. Navigation is now faster, cleaner, and works exactly as expected on every device — including iOS Safari.",
    releaseTag: "Improvement",
    version: "2.0.3",
    status: "Released",
    changelogSpecs: [
      "New slide-over mobile menu replaces the old hamburger drawer",
      "Focus stays inside the menu when navigating by keyboard",
      "Fixed overflow and safe-area issues on iOS Safari",
    ],
  },
  {
    id: "update-04",
    date: "May 18, 2026",
    title: "New writing editor — now in beta",
    summary:
      "A completely refreshed editing experience ships today in beta. Write on the left, see a live preview on the right — with slash commands, better table editing, and Markdown shortcuts throughout.",
    releaseTag: "Beta",
    version: "2.0.4",
    status: "Beta",
    changelogSpecs: [
      "Split-pane editor with toggleable live preview",
      "Slash-command palette for headings, images, tables, and embeds",
      "Improved table editing with full keyboard support",
    ],
  },
  {
    id: "update-05",
    date: "May 14, 2026",
    title: "Significantly faster load times",
    summary:
      "Pages load up to 38% faster after route-level code splitting and next-gen image optimisation. The app now delivers only the code each page needs — nothing more.",
    releaseTag: "Performance",
    version: "2.0.5",
    status: "Released",
    changelogSpecs: [
      "Route-level code splitting — initial JS bundle reduced by ~38%",
      "Images now served in AVIF format with JPEG fallback",
      "Critical CSS inlined to eliminate render-blocking requests",
    ],
  },
  {
    id: "update-06",
    date: "May 10, 2026",
    title: "Accessibility improvements across the app",
    summary:
      "We've done a thorough accessibility pass: every interactive element now has a visible focus indicator, colour contrast meets WCAG AA across both themes, and screen readers can navigate every region of the page.",
    releaseTag: "Accessibility",
    version: "2.0.6",
    status: "Released",
    changelogSpecs: [
      "Visible focus rings on all interactive elements",
      "Colour contrast raised to WCAG AA in both light and dark mode",
      "Landmark roles added to all major page sections",
    ],
  },
  {
    id: "update-07",
    date: "May 06, 2026",
    title: "Security updates",
    summary:
      "We've strengthened authentication, added rate-limiting on login endpoints, and resolved four dependency vulnerabilities identified in our latest audit.",
    releaseTag: "Security",
    version: "2.0.7",
    status: "Released",
    changelogSpecs: [
      "Rate limiting applied to login — 10 failed attempts triggers a temporary hold",
      "Four CVEs resolved via dependency updates",
      "Stricter Content-Security-Policy headers now in place",
    ],
  },
  {
    id: "update-08",
    date: "May 02, 2026",
    title: "Mobile layout fixes",
    summary:
      "Several display issues on small screens and tablets have been resolved. Cards, modals, and navigation elements now render correctly at every viewport size.",
    releaseTag: "Fix",
    version: "2.0.8",
    status: "Released",
    changelogSpecs: [
      "Cards no longer clip or overflow on 320px screens",
      "Modals use a bottom-sheet pattern on mobile",
      "All touch targets meet the 44px minimum guideline",
    ],
  },
  {
    id: "update-09",
    date: "Apr 28, 2026",
    title: "Usage analytics — now in beta",
    summary:
      "A new analytics dashboard is available in beta for workspace admins. See page views, session lengths, and your most-visited routes over a rolling 30-day window.",
    releaseTag: "Beta",
    version: "2.0.9",
    status: "Beta",
    changelogSpecs: [
      "Page-view and session tracking (opt-in per workspace)",
      "Admin-only dashboard with 30-day rolling charts",
      "Export data to CSV at any time",
    ],
  },
  {
    id: "update-10",
    date: "Apr 24, 2026",
    title: "Deployment infrastructure upgrade",
    summary:
      "We've migrated our build and deployment pipeline to GitHub Actions with Docker-based builds. Deployments are now faster, more reproducible, and fully zero-downtime.",
    releaseTag: "Infrastructure",
    version: "2.1.0",
    status: "Released",
    changelogSpecs: [
      "CI/CD fully migrated to GitHub Actions",
      "Docker multi-stage builds — image size reduced by 60%",
      "Blue-green deployments for zero downtime releases",
    ],
  },
  // Pad to 50 entries (oldest entries, least recent)
  ...Array.from({ length: 40 }, (_, i) => {
    const n = i + 11;
    const tags = [
      "New", "Improvement", "Fix", "Performance",
      "Accessibility", "Security", "Beta", "Infrastructure",
    ];
    const statuses = ["Released", "Beta", "Released"] as const;
    return {
      id: `update-${n.toString().padStart(2, "0")}`,
      date: `Apr ${(23 - (i % 23)).toString().padStart(2, "0")}, 2026`,
      title: `Release ${n} — stability and polish`,
      summary: `Targeted fixes and quality improvements shipped in response to user feedback, keeping the platform stable and fast for everyone.`,
      releaseTag: tags[i % tags.length],
      version: `2.1.${n}`,
      status: statuses[i % 3],
      changelogSpecs: [
        `Fixed ${(i % 4) + 1} reported issues`,
        "Minor performance optimisations",
        "Copy and label improvements throughout the UI",
      ],
    } satisfies UpdateEntry;
  }),
];

// ---------------------------------------------------------------------------

const PER_PAGE = 5;

function Updates() {
  const [page, setPage] = useState(1);
  const totalPages = Math.ceil(allUpdates.length / PER_PAGE);

  const pageEntries = useMemo(
    () => allUpdates.slice((page - 1) * PER_PAGE, page * PER_PAGE),
    [page]
  );

  const handlePageChange = useCallback((p: number) => {
    setPage(p);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  return (
    <main className="updates-page">
      <header className="hero-updates">
        <span className="eyebrow" aria-label="Section label">Changelog</span>
        <h1>Everything that's new</h1>
        <p>
          Every improvement, fix, and new feature — documented as it ships.
          The latest release is always at the top.
        </p>
      </header>

      <UpdatesTimeline entries={pageEntries} isFirstPage={page === 1} />

      <Pagination
        currentPage={page}
        totalPages={totalPages}
        onPageChange={handlePageChange}
      />
    </main>
  );
}

export default Updates;
