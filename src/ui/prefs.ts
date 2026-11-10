import { playPreview, unlockAudio } from "../device/feedback";
import { loadPref, savePref } from "../game/storage";
import { ICONS } from "./icons";

/*
 * Preferenze salvate nel browser: tema (automatico, chiaro, scuro) e suono di fine tempo.
 * Le chiavi vanno d'accordo con lo script in testa a index.html, che applica il tema prima del disegno.
 */

// ---------- Tema ----------

const THEME_KEY = "rimosso-theme";
const THEMES = ["auto", "light", "dark"] as const;
type Theme = (typeof THEMES)[number];

const THEME_LABELS: Record<Theme, string> = {
  auto: "Tema automatico (come il sistema)",
  light: "Tema chiaro",
  dark: "Tema scuro",
};

/** Colore della barra del browser, uguale allo sfondo della pagina. */
const BAR_COLORS = { light: "#e9ecf1", dark: "#12151c" };

function applyTheme(theme: Theme): void {
  const root = document.documentElement;
  if (theme === "auto") delete root.dataset.theme;
  else root.dataset.theme = theme;
  document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]').forEach((m) => {
    const scheme = m.media.includes("dark") ? "dark" : "light";
    m.content = BAR_COLORS[theme === "auto" ? scheme : theme];
  });
}

export function initThemeToggle(button: HTMLButtonElement): void {
  let theme = loadPref(THEME_KEY, THEMES, "auto");
  const paint = () => {
    const next = THEMES[(THEMES.indexOf(theme) + 1) % THEMES.length];
    button.innerHTML = ICONS[theme];
    button.title = `${THEME_LABELS[theme]}. Tocca per: ${THEME_LABELS[next].toLowerCase()}`;
    button.setAttribute("aria-label", button.title);
  };
  applyTheme(theme);
  paint();
  button.addEventListener("click", () => {
    theme = THEMES[(THEMES.indexOf(theme) + 1) % THEMES.length];
    savePref(THEME_KEY, theme);
    applyTheme(theme);
    paint();
  });
}

// ---------- Suono ----------

const SOUND_KEY = "rimosso-sound";
let soundOn = loadPref(SOUND_KEY, ["on", "off"] as const, "on") === "on";
const listeners = new Set<(on: boolean) => void>();

export const isSoundOn = (): boolean => soundOn;

export function setSound(on: boolean): void {
  soundOn = on;
  savePref(SOUND_KEY, on ? "on" : "off");
  if (on) {
    // Siamo dentro un clic: è il momento buono per sbloccare l'audio.
    unlockAudio();
    playPreview();
  }
  listeners.forEach((f) => f(on));
}

export function onSoundChange(f: (on: boolean) => void): void {
  listeners.add(f);
}

export function initSoundToggle(button: HTMLButtonElement): void {
  const paint = (on: boolean) => {
    button.innerHTML = on ? ICONS.soundOn : ICONS.soundOff;
    button.title = on ? "Suono di fine tempo attivo" : "Suono di fine tempo disattivato";
    button.setAttribute("aria-label", "Suono di fine tempo");
    button.setAttribute("aria-pressed", String(on));
  };
  paint(soundOn);
  onSoundChange(paint);
  button.addEventListener("click", () => setSound(!soundOn));
}
