import { useLocation } from "react-router-dom";
import "../../styles/PageLoader.css";

type LoaderVariant =
  | "landing"
  | "auth"
  | "dashboard"
  | "dsa"
  | "projects"
  | "profile"
  | "settings"
  | "friends"
  | "player-hub"
  | "updates"
  | "support"
  | "about"
  | "list"
  | "activity"
  | "default";

function variantFromPath(pathname: string): LoaderVariant {
  if (pathname === "/") return "landing";
  if (pathname === "/login" || pathname === "/signup" || pathname === "/choose-username") return "auth";
  if (pathname.includes("dashboard")) return "dashboard";
  if (pathname.includes("dsa")) return "dsa";
  if (pathname.includes("projects")) return "projects";
  if (pathname.includes("profile")) return "profile";
  if (pathname.includes("settings")) return "settings";
  if (pathname.includes("friends") || pathname.includes("players")) return "friends";
  if (pathname.includes("player-hub")) return "player-hub";
  if (pathname.includes("updates")) return "updates";
  if (pathname.includes("support")) return "support";
  if (pathname.includes("about")) return "about";
  if (pathname.includes("activity/")) return "activity";
  if (pathname.includes("leaderboard") || pathname.includes("tournaments") || pathname.includes("admin")) return "list";
  return "default";
}

export default function PageLoader({ variant }: { variant?: LoaderVariant }) {
  const location = useLocation();
  const resolved = variant || variantFromPath(location.pathname);

  return (
    <div className={`page-loader page-loader--${resolved}`} aria-label="Loading page" aria-live="polite">
      <span className="sr-loader-text">Loading</span>
      <LoaderLayout variant={resolved} />
    </div>
  );
}

function LoaderLayout({ variant }: { variant: LoaderVariant }) {
  if (variant === "auth") {
    return <div className="sk-auth"><div className="sk-auth-form"><SkLine w="28%" /><SkLine h={58} /><SkLine w="55%" /><SkLine h={48} /><SkLine h={48} /><SkLine h={44} /></div><div className="sk-auth-visual"><SkBlock className="sk-illustration" /><SkLine w="68%" h={38} /><SkLine w="78%" /></div></div>;
  }
  if (variant === "landing") {
    return <><div className="sk-hero"><SkLine w="22%" /><SkLine w="68%" h={72} /><SkLine w="52%" /><SkLine w="18%" h={42} /></div><div className="sk-two"><SkBlock /><SkBlock /></div></>;
  }
  if (variant === "dashboard") {
    return <><LoaderHeader /><div className="sk-dashboard-top"><SkBlock /><SkBlock /></div><div className="sk-dashboard-insights"><div><SkLine w="30%" /><div className="sk-heatmap">{Array.from({ length: 112 }, (_, i) => <i key={i} />)}</div></div><div className="sk-leader-list">{Array.from({ length: 3 }, (_, i) => <SkLine key={i} h={44} />)}</div></div></>;
  }
  if (variant === "dsa" || variant === "projects") {
    const summaryCount = variant === "dsa" ? 5 : 4;
    return <><LoaderHeader /><div className="sk-tabs"><SkLine w="18%" /><SkLine w="18%" /><SkLine w="18%" /></div><div className="sk-summary-row">{Array.from({ length: summaryCount }, (_, i) => <SkBlock key={i} />)}</div><div className="sk-tracking-main"><SkBlock className="sk-form" /><div className="sk-list">{Array.from({ length: 2 }, (_, i) => <SkLine key={i} h={76} />)}</div></div></>;
  }
  if (variant === "profile") {
    return <><div className="sk-profile-head"><span className="sk-circle" /><div><SkLine w="45%" h={42} /><SkLine w="30%" /></div><div className="sk-profile-stats">{Array.from({ length: 3 }, (_, i) => <SkBlock key={i} />)}</div></div><SkBlock className="sk-profile-heatmap" /><div className="sk-two"><SkBlock /><SkBlock /></div></>;
  }
  if (variant === "settings") {
    return <><LoaderHeader /><div className="sk-settings">{Array.from({ length: 6 }, (_, index) => <div className="sk-settings-section" key={index}><div><SkLine w="26%" /><SkLine w="46%" h={36} /></div><div className="sk-settings-lines"><SkLine /><SkLine /><SkLine w="70%" /></div></div>)}</div></>;
  }
  if (variant === "friends") {
    return <><LoaderHeader /><div className="sk-two"><SkBlock className="sk-tall" /><SkBlock className="sk-tall" /></div><div className="sk-two"><SkBlock /><SkBlock /></div><div className="sk-list">{Array.from({ length: 4 }, (_, i) => <SkLine key={i} h={74} />)}</div></>;
  }
  if (variant === "player-hub") {
    return <><LoaderHeader /><div className="sk-player-hub"><span className="sk-player-orbit" /><div><SkLine w="24%" /><SkLine w="88%" h={54} /><SkLine w="72%" /><SkLine w="58%" /></div></div></>;
  }
  if (variant === "updates") {
    return <div className="sk-public-split"><div><SkLine w="30%" /><SkLine w="85%" h={70} /><SkLine w="75%" /></div><div className="sk-list">{Array.from({ length: 3 }, (_, i) => <SkBlock key={i} className="sk-update-card" />)}</div></div>;
  }
  if (variant === "support") {
    return <><LoaderHeader /><div className="sk-public-split"><div className="sk-list">{Array.from({ length: 6 }, (_, i) => <SkLine key={i} h={58} />)}</div><SkBlock className="sk-support-form" /></div></>;
  }
  if (variant === "about") {
    return <><LoaderHeader /><div className="sk-four">{Array.from({ length: 4 }, (_, i) => <SkBlock key={i} />)}</div><SkBlock className="sk-wide" /></>;
  }
  if (variant === "activity") {
    return <><LoaderHeader /><div className="sk-summary-row">{Array.from({ length: 3 }, (_, i) => <SkBlock key={i} />)}</div><div className="sk-list">{Array.from({ length: 6 }, (_, i) => <SkBlock key={i} className="sk-activity-section" />)}</div></>;
  }
  if (variant === "list") {
    return <><LoaderHeader /><div className="sk-list">{Array.from({ length: 7 }, (_, i) => <SkLine key={i} h={68} />)}</div></>;
  }
  return <><LoaderHeader /><div className="sk-two"><SkBlock /><SkBlock /></div><SkBlock className="sk-wide" /></>;
}

function LoaderHeader() {
  return <div className="sk-page-header"><div><SkLine w="24%" /><SkLine w="58%" h={58} /></div><SkLine w="36%" /></div>;
}

function SkLine({ w = "100%", h = 16 }: { w?: string; h?: number }) {
  return <span className="sk-line" style={{ width: w, height: h }} />;
}

function SkBlock({ className = "" }: { className?: string }) {
  return <span className={`sk-block ${className}`} />;
}
