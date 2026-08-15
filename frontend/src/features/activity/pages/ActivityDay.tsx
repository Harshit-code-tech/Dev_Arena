import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { useNavigate, useParams } from "react-router-dom";
import toast from "react-hot-toast";

import PageLoader from "../../../shared/components/Skeletons/PageLoader";
import HistoryExportButton from "../../../shared/components/HistoryExportButton";
import LiveDateTime from "../../../shared/components/LiveDateTime";
import { downloadHistoryPdf } from "../../../services/PdfExportService";
import { getDayActivity, type DayActivity } from "../../../services/ActivityService";
import { displayActivityDateTime } from "../../../services/TrackingService";
import "../styles/ActivityDay.css";

function readableDateParts(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const value = new Date(year, month - 1, day);

  return {
    weekday: new Intl.DateTimeFormat("en-IN", { weekday: "long" }).format(value),
    calendarDate: new Intl.DateTimeFormat("en-IN", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(value),
  };
}

export default function ActivityDay() {
  const { date = "" } = useParams();
  const navigate = useNavigate();
  const [activity, setActivity] = useState<DayActivity | null>(null);
  const [loading, setLoading] = useState(true);

  const validDate = useMemo(() => /^\d{4}-\d{2}-\d{2}$/.test(date), [date]);

  useEffect(() => {
    if (!validDate) {
      setLoading(false);
      return;
    }
    let mounted = true;
    void getDayActivity(date)
      .then((data) => {
        if (mounted) setActivity(data);
      })
      .catch((error) => {
        toast.error(error instanceof Error ? error.message : "Activity details could not be loaded.");
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [date, validDate]);

  async function exportDayHistory() {
    if (!activity) throw new Error("Daily activity is still loading.");
    await downloadHistoryPdf({
      filename: `devarena-activity-${activity.date}.pdf`,
      title: `Daily Activity - ${activity.date}`,
      subtitle: `${activity.totalActivities} activities, ${activity.totalPoints} points, ${activity.sections.filter((section) => section.items.length > 0).length} active categories.`,
      sections: activity.sections.map((section) => ({
        title: section.title,
        rows: section.items.slice(0, 10).map((item) => ({
          title: item.title,
          details: [item.description, ...item.metadata, section.key === "challenges" ? `Week: ${new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(item.occurredAt))}` : `Time: ${displayActivityDateTime(item.occurredAt)}`, item.link],
        })),
      })),
    });
  }

  if (loading) return <PageLoader variant="activity" />;

  if (!validDate || !activity) {
    return (
      <main className="activity-day-page animated-page">
        <section className="activity-day-error">
          <p>Activity archive</p>
          <h1>Date unavailable</h1>
          <span>The requested activity day could not be loaded.</span>
          <button type="button" className="dev-back-button" onClick={() => navigate(-1)}><span aria-hidden="true">←</span><span>Back</span></button>
        </section>
      </main>
    );
  }

  const formattedDate = readableDateParts(activity.date);

  return (
    <main className="activity-day-page animated-page">
      <header className="activity-day-hero page-reveal">
        <div>
          <button type="button" className="activity-day-back dev-back-button" onClick={() => navigate(-1)}><span aria-hidden="true">←</span><span>Back</span></button>
          <p>Daily evidence archive</p>
          <h1 className="activity-day-date">
            <span className="activity-day-weekday">{formattedDate.weekday}</span>
            <span className="activity-day-calendar-date">{formattedDate.calendarDate}</span>
          </h1>
        </div>
        <div className="activity-day-hero-side">
          <HistoryExportButton onExport={exportDayHistory} label="Export day PDF" />
          <div className="activity-day-summary" aria-label="Daily activity summary">
          <article><span>Total activities</span><strong>{activity.totalActivities}</strong></article>
          <article><span>Points earned</span><strong>{activity.totalPoints}</strong></article>
          <article><span>Categories active</span><strong>{activity.sections.filter((section) => section.items.length > 0).length}</strong></article>
          </div>
        </div>
      </header>

      <section className="activity-day-guide page-reveal" style={{ "--reveal-order": 1 } as CSSProperties}>
        <span>How to read this day</span>
        <p>Every section stays visible so missing work is as clear as completed work. Proof links open in a new tab and all times use your local timezone.</p>
      </section>

      <div className="activity-day-sections">
        {activity.sections.map((section, index) => (
          <section className="activity-day-section page-reveal" style={{ "--reveal-order": index + 2 } as CSSProperties} key={section.key}>
            <header>
              <div><p>{String(index + 1).padStart(2, "0")} / Evidence group</p><h2>{section.title}</h2></div>
              <span>Latest {Math.min(section.items.length, 10)} / {section.items.length}</span>
            </header>

            {section.items.length === 0 ? (
              <div className="activity-day-empty">
                <strong>No activities that day</strong>
                <span>This category has no recorded evidence for the selected date.</span>
              </div>
            ) : (
              <div className="activity-day-list">
                {section.items.slice(0, 10).map((item) => (
                  <article key={item.id}>
                    <div className="activity-day-item-copy">
                      <h3>{item.title}</h3>
                      {item.description && <p>{item.description}</p>}
                      <div className="activity-day-tags">
                        {item.metadata.map((entry) => <span key={entry}>{entry}</span>)}
                      </div>
                    </div>
                    <div className="activity-day-item-meta">
                      <LiveDateTime value={item.occurredAt} mode={section.key === "challenges" ? "date" : "smart"} />
                      {item.link && <a href={item.link} target="_blank" rel="noreferrer">Open proof ↗</a>}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        ))}
      </div>
    </main>
  );
}
