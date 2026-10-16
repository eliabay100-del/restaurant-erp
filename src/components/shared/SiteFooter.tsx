/**
 * Slim "Powered by Amba Solutions" bar rendered under every page.
 * Lives in the root [locale] layout so it covers POS, dashboard, and auth screens.
 * A fixed-height bar (see --footer-height in globals.css) — full-height layouts
 * subtract it so nothing scrolls or gets covered.
 */
export default function SiteFooter() {
  return (
    <footer className="site-footer">
      <span>Powered by</span>
      <a href="https://amba.site.je" target="_blank" rel="noopener noreferrer">
        Amba Solutions
      </a>
    </footer>
  );
}
