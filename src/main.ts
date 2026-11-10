import "./styles/fonts.css";
import "./styles/main.css";
import "./styles/app.css";

import { initDeckView } from "./ui/deck-view";
import { byId } from "./ui/dom";
import { initGameView } from "./ui/game-view";
import { initThemeToggle, initSoundToggle } from "./ui/prefs";
import { initRouter } from "./ui/router";
import { renderSolutions } from "./ui/solutions-view";

initThemeToggle(byId<HTMLButtonElement>("themeToggle"));
initSoundToggle(byId<HTMLButtonElement>("soundToggle"));
initDeckView();
renderSolutions();
initRouter();
initGameView();
