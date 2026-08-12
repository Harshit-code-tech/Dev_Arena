import { useSyncExternalStore } from "react";

type DateValue = string | number | Date;
type LiveDateTimeMode = "smart" | "full" | "date" | "time" | "relative";

type LiveDateTimeProps = {
  value: DateValue;
  mode?: LiveDateTimeMode;
  className?: string;
  prefix?: string;
  suffix?: string;
};

const TICK_MS = 60_000;
const listeners = new Set<() => void>();
let snapshot = Math.floor(Date.now() / TICK_MS);
let timer: number | null = null;

const dateFormatter = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" });
const dateTimeFormatter = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});
const timeFormatter = new Intl.DateTimeFormat("en-IN", { hour: "2-digit", minute: "2-digit" });

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (typeof window !== "undefined" && timer === null) {
    timer = window.setInterval(() => {
      snapshot = Math.floor(Date.now() / TICK_MS);
      listeners.forEach((current) => current());
    }, TICK_MS);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && timer !== null) {
      window.clearInterval(timer);
      timer = null;
    }
  };
}

function getSnapshot() { return snapshot; }
function getServerSnapshot() { return 0; }
function toDate(value: DateValue) { return value instanceof Date ? value : new Date(value); }
function sameLocalDay(left: Date, right: Date) {
  return left.getFullYear() === right.getFullYear()
    && left.getMonth() === right.getMonth()
    && left.getDate() === right.getDate();
}

export function formatLiveDateTime(value: DateValue, nowValue = Date.now(), mode: LiveDateTimeMode = "smart") {
  const date = toDate(value);
  if (Number.isNaN(date.getTime())) return "Time unavailable";
  const now = new Date(nowValue);
  if (mode === "date") return dateFormatter.format(date);
  if (mode === "time") return timeFormatter.format(date);
  if (mode === "full" || mode === "relative") return dateTimeFormatter.format(date);
  return sameLocalDay(date, now) ? timeFormatter.format(date) : dateTimeFormatter.format(date);
}

export default function LiveDateTime({ value, mode = "smart", className, prefix, suffix }: LiveDateTimeProps) {
  const tick = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const date = toDate(value);
  const machineValue = Number.isNaN(date.getTime()) ? undefined : date.toISOString();
  const label = formatLiveDateTime(value, tick * TICK_MS || Date.now(), mode);
  return (
    <time className={className} dateTime={machineValue} title={machineValue ? dateTimeFormatter.format(date) : undefined}>
      {prefix}{label}{suffix}
    </time>
  );
}
