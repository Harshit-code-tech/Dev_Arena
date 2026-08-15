import { memo, useMemo, useCallback } from "react";
import "../styles/Pagination.css";

export type PaginationProps = {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  siblingCount?: number;
  className?: string;
};

const Pagination = memo(function Pagination({
  currentPage,
  totalPages,
  onPageChange,
  siblingCount = 1,
  className = "",
}: PaginationProps) {
  const pageItems = useMemo(() => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }

    const range: Array<number | string> = [1, 2];
    const start = Math.max(3, currentPage - siblingCount);
    const end = Math.min(totalPages - 2, currentPage + siblingCount);

    if (start > 3) range.push("start-ellipsis");
    for (let n = start; n <= end; n++) range.push(n);
    if (end < totalPages - 2) range.push("end-ellipsis");
    range.push(totalPages - 1, totalPages);

    return range.filter((v, i, self) => self.indexOf(v) === i);
  }, [currentPage, totalPages, siblingCount]);

  const goTo = useCallback(
    (page: number) => {
      if (page < 1 || page > totalPages) return;
      onPageChange(page);
    },
    [onPageChange, totalPages]
  );

  const goPrev = useCallback(() => goTo(currentPage - 1), [goTo, currentPage]);
  const goNext = useCallback(() => goTo(currentPage + 1), [goTo, currentPage]);

  return (
    <nav className={`pagination ${className}`.trim()} aria-label="Pagination navigation">
      <button
        type="button"
        className="pagination-nav"
        onClick={goPrev}
        disabled={currentPage === 1}
        aria-label="Previous page"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path d="M10 12L6 8l4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span>Prev</span>
      </button>

      <div className="pagination-pages" role="list">
        {pageItems.map((item) =>
          typeof item === "string" ? (
            <span key={item} className="pagination-ellipsis" aria-hidden="true">
              ···
            </span>
          ) : (
            <button
              key={item}
              type="button"
              role="listitem"
              className={`page-btn${currentPage === item ? " active" : ""}`}
              aria-current={currentPage === item ? "page" : undefined}
              aria-label={`Page ${item}`}
              onClick={() => goTo(item)}
            >
              {item}
            </button>
          )
        )}
      </div>

      <button
        type="button"
        className="pagination-nav"
        onClick={goNext}
        disabled={currentPage === totalPages}
        aria-label="Next page"
      >
        <span>Next</span>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    </nav>
  );
});

export default Pagination;
