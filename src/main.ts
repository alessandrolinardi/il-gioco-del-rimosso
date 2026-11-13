import "./styles/fonts.css";
import "./styles/main.css";
import "./styles/app.css";

import { initDeckView } from "./ui/deck-view";
import { byId } from "./ui/dom";
import { initGameView } from "./ui/game-view";
import { initThemeToggle, initSoundToggle } from "./ui/prefs";
import { initRouter } from "./ui/router";
import { renderSolutions } from "./ui/solutions-view";
import { registerSW } from "virtual:pwa-register";

/*
 * Aggiornamenti dell'app installata: appena una nuova versione è pronta la pagina si
 * ricarica da sola (la partita in corso è salvata e riprende). Quando l'app torna in
 * primo piano controlla se ce n'è una nuova: sul telefono può restare aperta per giorni.
 */
registerSW({
  immediate: true,
  onRegisteredSW(_url, registration) {
    if (!registration) return;
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") registration.update().catch(() => {});
    });
  },
});

initThemeToggle(byId<HTMLButtonElement>("themeToggle"));
initSoundToggle(byId<HTMLButtonElement>("soundToggle"));
initDeckView();
renderSolutions();
initRouter();
initGameView();
