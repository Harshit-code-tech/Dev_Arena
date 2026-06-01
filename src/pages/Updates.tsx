import { useState, useEffect, useCallback } from "react";
import UpdatesTimeline, { type UpdateEntry } from "../components/UpdatesTimeline";
import Pagination from "../components/Pagination";
import "../styles/updates.css";

const PER_PAGE = 5;

function Updates() {
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [pageEntries, setPageEntries] = useState<UpdateEntry[]>([]);

  useEffect(() => {
    fetch(`/api/releases?page=${page}&limit=${PER_PAGE}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          const mappedEntries: UpdateEntry[] = data.data.map((release: any) => ({
            id: release.id,
            date: new Date(release.releasedAt).toLocaleDateString("en-US", {
              month: "short",
              day: "2-digit",
              year: "numeric",
            }),
            title: release.title,
            summary: release.summary,
            releaseTag: release.releaseTag,
            version: release.version,
            status: release.status,
            changelogSpecs: release.changelogSpecs,
          }));
          setPageEntries(mappedEntries);
          setTotalPages(data.pagination.totalPages || 1);
        }
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
