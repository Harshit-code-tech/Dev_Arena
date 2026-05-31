import { memo, useState, useCallback, useRef, useEffect } from "react";

export type BreakingChange = {
  area: string;
  description: string;
};

export type UpdateEntry = {
  id: string;
  date: string;
  title: string;
  summary: string;
  releaseTag?: string;
  version?: string;
  status?: string;
  // Expanded content
  mediaUrl?: string;
  mediaType?: "image" | "video" | "gif";
  mediaCaption?: string;
  breakingChanges?: BreakingChange[];
  changelogSpecs?: string[];
};

type TimelineCardProps = {
  entry: UpdateEntry;
  isExpanded: boolean;
  onToggle: (id: string) => void;
  isLatest: boolean;
};

const tagClass: Record<string, string> = {
  New: "tag--new",
  Improvement: "tag--improvement",
  Fix: "tag--fix",
  Beta: "tag--beta",
  Performance: "tag--performance",
  Accessibility: "tag--accessibility",
  Security: "tag--security",
  Infrastructure: "tag--infrastructure",
};

const statusClass: Record<string, string> = {
  Released: "tag--released",
  Beta: "tag--beta",
  Draft: "tag--draft",
};

const TimelineCard = memo(function TimelineCard({
  entry,
  isExpanded,
  onToggle,
  isLatest,
}: TimelineCardProps) {
  const detailsRef = useRef<HTMLDivElement>(null);
  const handleToggle = useCallback(() => onToggle(entry.id), [onToggle, entry.id]);

  useEffect(() => {
    const el = detailsRef.current;
    if (!el) return;
    if (isExpanded) {
      el.style.maxHeight = el.scrollHeight + "px";
      el.style.opacity = "1";
    } else {
      el.style.maxHeight = "0px";
      el.style.opacity = "0";
    }
  }, [isExpanded]);

  const hasDetails =
    entry.changelogSpecs?.length ||
    entry.breakingChanges?.length ||
    entry.mediaUrl;

  return (
    <article
      className={`timeline-item${isExpanded ? " expanded" : ""}${isLatest ? " latest" : ""}`}
      aria-expanded={hasDetails ? isExpanded : undefined}
    >
      <div className="timeline-node" aria-hidden="true">
        <span className="timeline-dot" />
        {isLatest && <span className="timeline-pulse" />}
      </div>

      <div
        className="timeline-card"
        onClick={hasDetails ? handleToggle : undefined}
        onKeyDown={hasDetails ? (e) => (e.key === "Enter" || e.key === " ") && handleToggle() : undefined}
        role={hasDetails ? "button" : undefined}
        tabIndex={hasDetails ? 0 : undefined}
        aria-label={hasDetails ? `Read full details for ${entry.title}` : undefined}
      >
        {/* Header row */}
        <div className="card-header">
          <div className="timeline-meta">
            {isLatest && <span className="meta-latest">Latest</span>}
            <time dateTime={entry.date} className="meta-date">{entry.date}</time>
            {entry.version && (
              <>
                <span className="meta-sep" aria-hidden="true" />
                <span className="meta-version">{entry.version}</span>
              </>
            )}
          </div>

          {hasDetails && (
            <div className="card-chevron" aria-hidden="true">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M4 6L8 10L12 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          )}
        </div>

        <h2 className="card-title">{entry.title}</h2>
        <p className="card-summary">{entry.summary}</p>

        {/* Tags */}
        <div className="timeline-tags">
          {entry.releaseTag && (
            <span className={`timeline-tag ${tagClass[entry.releaseTag] ?? "tag--default"}`}>
              {entry.releaseTag}
            </span>
          )}
          {entry.status && entry.status !== "Released" && (
            <span className={`timeline-tag ${statusClass[entry.status] ?? ""}`}>
              {entry.status}
            </span>
          )}
        </div>

        {/* Expandable drawer */}
        {hasDetails && (
          <div
            ref={detailsRef}
            className="card-details"
            aria-hidden={!isExpanded}
            style={{ maxHeight: 0, opacity: 0 }}
          >
            <div className="card-details-inner">
              <div className="details-divider" />

              {/* Media preview — only shown if a URL is provided */}
              {entry.mediaUrl && (
                <div className="detail-media">
                  {entry.mediaType === "video" ? (
                    <video
                      src={entry.mediaUrl}
                      className="media-asset"
                      controls
                      muted
                      playsInline
                      aria-label={entry.mediaCaption ?? "Feature preview"}
                    />
                  ) : (
                    <img
                      src={entry.mediaUrl}
                      alt={entry.mediaCaption ?? "Feature preview"}
                      className="media-asset"
                      loading="lazy"
                    />
                  )}
                  {entry.mediaCaption && (
                    <p className="media-caption">{entry.mediaCaption}</p>
                  )}
                </div>
              )}

              {/* Breaking changes */}
              {entry.breakingChanges?.length ? (
                <div className="specs-block specs-block--breaking">
                  <h3 className="specs-heading">
                    <span className="specs-badge specs-badge--breaking">⚠ Breaking change</span>
                  </h3>
                  <ul className="specs-list">
                    {entry.breakingChanges.map((bc, i) => (
                      <li key={i} className="specs-item">
                        <span className="specs-area">{bc.area}</span>
                        <span className="specs-desc">{bc.description}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {/* Changelog items */}
              {entry.changelogSpecs?.length ? (
                <div className="specs-block">
                  <h3 className="specs-heading">
                    <span className="specs-badge">What's included</span>
                  </h3>
                  <ul className="specs-list">
                    {entry.changelogSpecs.map((spec, i) => (
                      <li key={i} className="specs-item specs-item--plain">{spec}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          </div>
        )}
      </div>
    </article>
  );
});

type UpdatesTimelineProps = {
  entries: UpdateEntry[];
  isFirstPage?: boolean;
};

function UpdatesTimeline({ entries, isFirstPage = false }: UpdatesTimelineProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const handleToggle = useCallback((id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  }, []);

  return (
    <div className="updates-timeline" role="feed" aria-label="Product changelog">
      <div className="timeline-track" aria-hidden="true" />
      {entries.map((entry, index) => (
        <TimelineCard
          key={entry.id}
          entry={entry}
          isExpanded={expandedId === entry.id}
          onToggle={handleToggle}
          isLatest={isFirstPage && index === 0}
        />
      ))}
    </div>
  );
}

export default UpdatesTimeline;
