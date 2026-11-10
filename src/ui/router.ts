const VIEWS = ["partita", "carte", "regole", "soluzioni"] as const;
type View = (typeof VIEWS)[number];

/** Le quattro sezioni si scelgono con l'hash dell'indirizzo (#partita, #carte, …). */
export function initRouter(): void {
  const route = () => {
    const hash = location.hash.slice(1);
    const view: View = (VIEWS as readonly string[]).includes(hash) ? (hash as View) : "partita";
    document.querySelectorAll<HTMLElement>("main section").forEach((s) => (s.hidden = s.dataset.view !== view));
    document.querySelectorAll<HTMLElement>("nav.tabs a").forEach((a) => {
      if (a.dataset.view === view) a.setAttribute("aria-current", "page");
      else a.removeAttribute("aria-current");
    });
  };
  window.addEventListener("hashchange", route);
  route();
}
