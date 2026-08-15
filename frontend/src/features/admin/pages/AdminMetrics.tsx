import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import AnimatedSelect from "../../../shared/components/AnimatedSelect";
import MonitoringLineChart from "../components/MonitoringLineChart";
import { AdminApi, type AdminMetricsPayload } from "../../../services/AdminService";
import "../styles/Admin.css";

const ranges = [
  { value: "1", label: "Last hour" },
  { value: "24", label: "Last 24 hours" },
  { value: "168", label: "Last 7 days" },
  { value: "720", label: "Last 30 days" },
];

const summaryLabels: Array<[string, string]> = [
  ["onlineNow", "Online now"],
  ["activeLastFiveMinutes", "Active last 5 min"],
  ["activeToday", "Active today"],
  ["totalUsers", "Total users"],
  ["newUsers", "New accounts"],
  ["messages", "Direct messages"],
  ["projects", "Projects created"],
  ["dsaLogs", "DSA logs"],
  ["tournamentRegistrations", "Tournament registrations"],
  ["githubConnectedUsers", "GitHub connected users"],
  ["pendingJudging", "Pending judging"],
  ["openFeedback", "Open feedback"],
];

function metric(payload: AdminMetricsPayload | null, key: string) {
  return Number(payload?.summary?.[key]) || 0;
}

export default function AdminMetrics() {
  const navigate = useNavigate();
  const [hours, setHours] = useState("24");
  const [payload, setPayload] = useState<AdminMetricsPayload | null>(null);
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setMessage("");
    void (async () => {
      try {
        const access = await AdminApi.access();
        if (cancelled) return;
        setAllowed(access.allowed);
        if (!access.allowed) return;
        const data = await AdminApi.metrics(Number(hours));
        if (!cancelled) setPayload(data);
      } catch (reason) {
        if (!cancelled) setMessage(reason instanceof Error ? reason.message : "DevArena metrics could not be loaded.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [hours]);

  const charts = useMemo(() => {
    const series = payload?.series || [];
    return [
      { title: "Active users", eyebrow: "Concurrency", key: "activeUsers" as const, label: "active users" },
      { title: "New accounts", eyebrow: "Growth", key: "newUsers" as const, label: "new accounts" },
      { title: "Direct messages", eyebrow: "Messaging", key: "messages" as const, label: "messages" },
      { title: "Projects created", eyebrow: "Projects", key: "projects" as const, label: "projects" },
      { title: "DSA activity", eyebrow: "Practice", key: "dsaLogs" as const, label: "DSA logs" },
      { title: "Tournament activity", eyebrow: "Competition", key: "tournamentActivity" as const, label: "events" },
      { title: "GitHub webhook activity", eyebrow: "GitHub", key: "githubEvents" as const, label: "webhook deliveries" },
    ].map((chart) => ({ ...chart, data: series.map((item) => ({ at: item.at, value: Number(item[chart.key]) || 0 })) }));
  }, [payload]);

  if (allowed === false) return <main className="admin-page"><section className="admin-denied"><p>Protected system area</p><h1>Administrator access required.</h1><span>This metrics view is restricted to DevArena administrators.</span></section></main>;

  return <main className="admin-page admin-metrics-page">
    <header className="admin-metrics-hero">
      <button type="button" className="admin-underline-action dev-back-button" onClick={() => navigate("/admin")}><span aria-hidden="true">←</span><span>Back</span></button>
      <div>
        <p>DevArena monitoring</p>
        <h1>All metrics</h1>
        <span>Operational and product signals only. Direct-message content and private repository details never appear here.</span>
      </div>
      <AnimatedSelect value={hours} onChange={setHours} options={ranges} />
    </header>

    {message && <div className="admin-message" role="status">{message}</div>}
    {loading && !payload && <section className="admin-loading">Loading DevArena metrics…</section>}

    {payload && <>
      <section className="admin-metrics admin-metrics-wide">
        {summaryLabels.map(([key, label]) => <article key={key}><span>{label}</span><strong>{metric(payload, key)}</strong></article>)}
      </section>

      <section className="admin-metric-chart-grid">
        {charts.map((chart) => <article className="admin-panel admin-metric-chart-card" key={chart.key}>
          <header><p>{chart.eyebrow}</p><h2>{chart.title}</h2></header>
          <MonitoringLineChart data={chart.data} hours={Number(hours)} ariaLabel={`${chart.title} over the selected period`} valueLabel={chart.label} compact />
        </article>)}
      </section>

      <section className="admin-panel admin-health-strip">
        <header><p>System health</p><h2>Operational signals</h2></header>
        <div className="admin-health-items">
          <span>Database latency <strong>{metric(payload, "databaseLatencyMs")} ms</strong></span>
          <span>GitHub failures <strong>{metric(payload, "githubFailures")}</strong></span>
          <span>Refresh jobs <strong>{metric(payload, "refreshJobs")}</strong></span>
          <span>Realtime events / hour <strong>{metric(payload, "realtimeEventsLastHour")}</strong></span>
        </div>
      </section>
    </>}
  </main>;
}
