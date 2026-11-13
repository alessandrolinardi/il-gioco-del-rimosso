import { CARDS } from "../data/cards";
import type { GameState, Outcome, Phase } from "./game";

/*
 * Salvataggio nel browser (localStorage). Ogni accesso è protetto: in navigazione
 * privata o con i dati del sito bloccati il gioco funziona lo stesso, senza salvare.
 */

type KeyValueStore = Pick<Storage, "getItem" | "setItem">;

const GAME_KEY = "rimosso-game-v3";
const PHASES: readonly Phase[] = ["setup", "ready", "playing", "summary", "end"];
const OUTCOMES: readonly Outcome[] = ["ok", "taboo", "pass", "time"];
const CARD_IDS = new Set(CARDS.map((c) => c.id));

const defaultStore = (): KeyValueStore | undefined => {
  try {
    return globalThis.localStorage;
  } catch {
    return undefined;
  }
};

export function saveGame(state: GameState, store = defaultStore()): void {
  try {
    store?.setItem(GAME_KEY, JSON.stringify(state));
  } catch {
    /* salvataggio non disponibile */
  }
}

export function loadGame(store = defaultStore()): GameState | null {
  try {
    const raw = store?.getItem(GAME_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isGameState(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function loadPref<T extends string>(key: string, allowed: readonly T[], fallback: T, store = defaultStore()): T {
  try {
    const v = store?.getItem(key);
    return allowed.includes(v as T) ? (v as T) : fallback;
  } catch {
    return fallback;
  }
}

export function savePref(key: string, value: string, store = defaultStore()): void {
  try {
    store?.setItem(key, value);
  } catch {
    /* salvataggio non disponibile */
  }
}

const isInt = (v: unknown): v is number => Number.isInteger(v);
const isCardId = (v: unknown): boolean => isInt(v) && CARD_IDS.has(v);

/** Controllo di forma: uno stato salvato rovinato o di una versione diversa viene ignorato. */
function isGameState(v: unknown): v is GameState {
  if (!v || typeof v !== "object") return false;
  const s = v as Record<string, unknown>;
  const st = s.settings as Record<string, unknown> | undefined;
  return (
    PHASES.includes(s.phase as Phase) &&
    !!st &&
    isInt(st.nTeams) &&
    Array.isArray(st.names) &&
    Array.isArray(st.levels) &&
    isInt(st.target) &&
    typeof st.weighted === "boolean" &&
    Array.isArray(s.teams) &&
    s.teams.every((t) => t && typeof t.name === "string" && isInt(t.score)) &&
    (s.phase === "setup" || s.teams.length >= 2) &&
    Array.isArray(s.deck) &&
    s.deck.every(isCardId) &&
    isInt(s.turn) &&
    (s.cardId === null || isCardId(s.cardId)) &&
    (s.phase !== "playing" || (s.cardId !== null && typeof s.endAt === "number")) &&
    Array.isArray(s.plays) &&
    s.plays.every(isPlay)
  );
}

function isPlay(v: unknown): boolean {
  if (!v || typeof v !== "object") return false;
  const p = v as Record<string, unknown>;
  return isCardId(p.cardId) && OUTCOMES.includes(p.outcome as Outcome) && isInt(p.delta);
}
