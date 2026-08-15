import { useNavigate } from "react-router-dom";

const exploreLinks = [
  { label: "Home", path: "/" },
  { label: "About", path: "/about" },
  { label: "Updates", path: "/updates" },
  { label: "Support", path: "/support" },
];

const accountLinks = [
  { label: "Log in", path: "/login" },
  { label: "Create account", path: "/signup" },
];

export default function Footer() {
  const navigate = useNavigate();

  const navigateToTop = (path: string) => {
    navigate(path);
    window.requestAnimationFrame(() => {
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    });
  };

  return (
    <footer className="site-footer">
      <div className="site-footer-inner">
        <section>
          <h2 className="site-footer-brand"><span className="site-footer-brand-dev">Dev</span><span className="site-footer-brand-arena">Arena</span></h2>
          <p className="site-footer-copy">
            A mission control platform for consistent developer growth,
            technical publishing, project building, and measurable progress.
          </p>
        </section>

        <section>
          <h3>Explore</h3>
          <nav aria-label="Footer explore navigation">
            {exploreLinks.map((link) => (
              <button key={link.path} type="button" onClick={() => navigateToTop(link.path)}>
                {link.label}
              </button>
            ))}
          </nav>
        </section>

        <section>
          <h3>Account</h3>
          <nav aria-label="Footer account navigation">
            {accountLinks.map((link) => (
              <button key={link.path} type="button" onClick={() => navigate(link.path)}>
                {link.label}
              </button>
            ))}
          </nav>
        </section>
      </div>

      <div className="site-footer-bottom">
        <span className="site-footer-legal">© {new Date().getFullYear()} DevArena</span>
        <span className="site-footer-legal-links">
          <button className="site-footer-legal-link" type="button" onClick={() => navigateToTop("/terms")}>Terms</button>
          <button className="site-footer-legal-link" type="button" onClick={() => navigateToTop("/privacy")}>Privacy</button>
          <span className="site-footer-legal">Built for developers who keep shipping.</span>
        </span>
      </div>
    </footer>
  );
}
