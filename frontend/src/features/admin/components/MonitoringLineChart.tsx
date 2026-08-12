import { useMemo, useState } from "react";

type Point = { at: string; value: number };

type Props = {
  data: Point[];
  hours: number;
  ariaLabel: string;
  emptyMessage?: string;
  valueLabel?: string;
  compact?: boolean;
};

function niceMaximum(value: number) {
  if (value <= 1) return 2;
  const padded = value * 1.15;
  const magnitude = 10 ** Math.floor(Math.log10(padded));
  const normalized = padded / magnitude;
  const step = normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  return Math.max(2, step * magnitude);
}

function tickLabel(value: string, hours: number) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  if (hours <= 24) return new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: hours <= 1 ? "2-digit" : undefined }).format(date);
  if (hours <= 168) return new Intl.DateTimeFormat(undefined, { weekday: "short", hour: "numeric" }).format(date);
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(date);
}


function smoothPath(points: Array<{ x: number; y: number }>) {
  if (points.length === 0) return "";
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
  let path = `M ${points[0].x} ${points[0].y}`;
  for (let index = 0; index < points.length - 1; index += 1) {
    const current = points[index];
    const next = points[index + 1];
    const previous = points[index - 1] || current;
    const afterNext = points[index + 2] || next;
    const controlOneX = current.x + (next.x - previous.x) / 6;
    const controlOneY = current.y + (next.y - previous.y) / 6;
    const controlTwoX = next.x - (afterNext.x - current.x) / 6;
    const controlTwoY = next.y - (afterNext.y - current.y) / 6;
    path += ` C ${controlOneX} ${controlOneY}, ${controlTwoX} ${controlTwoY}, ${next.x} ${next.y}`;
  }
  return path;
}

function exactLabel(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date);
}

export default function MonitoringLineChart({ data, hours, ariaLabel, emptyMessage = "No data exists for this period yet.", valueLabel = "users", compact = false }: Props) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const chart = useMemo(() => {
    const safe = data.map((item) => ({ ...item, value: Math.max(0, Number(item.value) || 0) }));
    const maxValue = Math.max(0, ...safe.map((item) => item.value));
    const scaleMax = niceMaximum(maxValue);
    const width = 1000;
    const height = compact ? 210 : 280;
    const left = 52;
    const right = 16;
    const top = 18;
    const bottom = 40;
    const plotWidth = width - left - right;
    const plotHeight = height - top - bottom;
    const points = safe.map((item, index) => {
      const x = left + (safe.length <= 1 ? plotWidth / 2 : (index / (safe.length - 1)) * plotWidth);
      const y = top + plotHeight - (item.value / scaleMax) * plotHeight;
      return { ...item, x, y };
    });
    const line = smoothPath(points);
    const area = points.length > 0
      ? `${line} L ${points[points.length - 1].x} ${top + plotHeight} L ${points[0].x} ${top + plotHeight} Z`
      : "";
    return { safe, scaleMax, width, height, left, right, top, bottom, plotWidth, plotHeight, points, line, area };
  }, [compact, data]);

  if (chart.safe.length === 0) return <p className="admin-monitor-empty">{emptyMessage}</p>;

  const labelIndexes = Array.from(new Set([0, Math.floor((chart.points.length - 1) * 0.25), Math.floor((chart.points.length - 1) * 0.5), Math.floor((chart.points.length - 1) * 0.75), chart.points.length - 1])).filter((index) => index >= 0);
  const active = activeIndex === null ? null : chart.points[activeIndex];

  return <div className={`admin-monitor-chart${compact ? " is-compact" : ""}`} role="img" aria-label={ariaLabel}>
    <svg viewBox={`0 0 ${chart.width} ${chart.height}`} preserveAspectRatio="none">
      <title>{ariaLabel}</title>
      {[0, 0.5, 1].map((ratio) => {
        const y = chart.top + chart.plotHeight * ratio;
        return <line key={ratio} x1={chart.left} x2={chart.width - chart.right} y1={y} y2={y} className="admin-monitor-grid-line" />;
      })}
      {chart.area && <path d={chart.area} className="admin-monitor-area" />}
      {chart.line && <path d={chart.line} className="admin-monitor-line" />}
      {chart.points.map((point, index) => <g key={`${point.at}-${index}`}>
        <circle cx={point.x} cy={point.y} r="4" className={`admin-monitor-point${activeIndex === index ? " is-active" : ""}`} />
        <circle
          cx={point.x}
          cy={point.y}
          r="16"
          className="admin-monitor-hit"
          tabIndex={0}
          onMouseEnter={() => setActiveIndex(index)}
          onMouseLeave={() => setActiveIndex(null)}
          onFocus={() => setActiveIndex(index)}
          onBlur={() => setActiveIndex(null)}
        />
      </g>)}
    </svg>
    <div className="admin-monitor-y-labels" aria-hidden="true">
      <span>{chart.scaleMax}</span><span>{Math.round(chart.scaleMax / 2)}</span><span>0</span>
    </div>
    <div className="admin-monitor-x-labels" aria-hidden="true">
      {labelIndexes.map((index) => <span key={`${chart.points[index].at}-${index}`} style={{ left: `${(chart.points[index].x / chart.width) * 100}%` }}>{tickLabel(chart.points[index].at, hours)}</span>)}
    </div>
    {active && <div className="admin-monitor-tooltip" style={{ left: `${(active.x / chart.width) * 100}%`, top: `${(active.y / chart.height) * 100}%` }}>
      <strong>{active.value}</strong>
      <span>{valueLabel}</span>
      <small>{exactLabel(active.at)}</small>
    </div>}
  </div>;
}
