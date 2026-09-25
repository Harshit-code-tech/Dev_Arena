import { useState, useEffect, useCallback, useRef } from "react";
import UpdatesTimeline from "../components/UpdatesTimeline";
import Pagination from "../../../shared/components/Pagination";
import PageLoader from "../../../shared/components/Skeletons/PageLoader";
import {
  getReleasePageViewModel,
  type UpdateEntry,
} from "../../../services/ReleaseService";
import "../styles/Updates.css";

function Updates() {
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [pageEntries, setPageEntries] = useState<UpdateEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const scrollWindowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setLoadError("");

    getReleasePageViewModel(page)
      .then((viewModel) => {
        if (!active) return;
        setPageEntries(viewModel.entries);
        setTotalPages(viewModel.totalPages);
        scrollWindowRef.current?.scrollTo({ top: 0, behavior: "smooth" });
      })
      .catch((error) => {
        if (!active) return;
        console.error("Failed to fetch releases:", error);
        setLoadError("Release history could not be loaded.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [page]);

  const handlePageChange = useCallback((nextPage: number) => {
    setPage(nextPage);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  if (loading && pageEntries.length === 0) {
    return <PageLoader variant="updates" />;
  }

  return (
    <main className="updates-page animated-page">
      <div className="updates-layout">
        <header className="hero-updates">
          <span className="eyebrow" aria-label="Section label">
            Changelog
          </span>
          <h1>Everything that's new</h1>
          <p>
            Every improvement, fix, and new feature — documented as it ships.
            The latest release is always at the top.
          </p>
        </header>

        <section className="updates-feed-panel" aria-label="Release history">
          <div className={`updates-scroll-window${loading ? " is-loading" : ""}`} ref={scrollWindowRef} aria-busy={loading}>
            {loadError ? (
              <div className="updates-load-error" role="alert">{loadError}</div>
            ) : loading ? (
              <div className="updates-inline-skeleton" aria-hidden="true">
                {Array.from({ length: 3 }, (_, index) => <span key={index} />)}
              </div>
            ) : (
              <UpdatesTimeline entries={pageEntries} isFirstPage={page === 1} />
            )}
          </div>

          <Pagination
            currentPage={page}
            totalPages={totalPages}
            onPageChange={handlePageChange}
          />
        </section>
      </div>
    </main>
  );
}

export default Updates;
