import { useState, useEffect, useCallback } from "react";
import UpdatesTimeline from "../components/UpdatesTimeline";
import Pagination from "../../../shared/components/Pagination";
import {
  getReleasePageViewModel,
  type UpdateEntry,
} from "../../../services/ReleaseService";
import "../styles/Updates.css";

function Updates() {
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [pageEntries, setPageEntries] = useState<UpdateEntry[]>([]);

  useEffect(() => {
    getReleasePageViewModel(page)
      .then((viewModel) => {
        setPageEntries(viewModel.entries);
        setTotalPages(viewModel.totalPages);
      })
      .catch((err) => console.error("Failed to fetch releases:", err));
  }, [page]);

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
