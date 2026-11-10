import { cardById, type Card, type Level } from "../data/cards";
import { buildDeck, type Rng } from "./deck";
import { remainingMs, TURN_MS } from "./timer";

/*
 * Stato della partita e regole. Tutte le funzioni sono pure: ricevono uno stato
 * e ne restituiscono uno nuovo, senza toccare la pagina, l'orologio o il salvataggio.
 */

export type Phase = "setup" | "ready" | "playing" | "result" | "end";
export type Outcome = "ok" | "taboo" | "pass" | "time";

export interface Settings {
  nTeams: number;
  names: string[];
  levels: Level[];
  target: number;
  weighted: boolean;
}

export interface Team {
  name: string;
  score: number;
}

export interface LastResult {
  outcome: Outcome;
  /** Punti assegnati (o tolti) alla squadra. */
  delta: number;
  teamIndex: number;
  /** Tempo che restava quando il turno è stato chiuso. */
  remainingMs: number;
}

export interface GameState {
  phase: Phase;
  settings: Settings;
  teams: Team[];
  /** Id delle carte ancora da giocare; si pesca dalla fine. */
  deck: number[];
  /** Numero di carte già giocate: indica anche di chi è il turno. */
  turn: number;
  cardId: number | null;
  endAt: number | null;
  last: LastResult | null;
}

export const TEAM_COUNTS = [2, 3, 4] as const;
export const MIN_TARGET = 3;
export const DEFAULT_TARGET = 15;
/** Dopo un annullamento il descrittore ha almeno 5 secondi per finire. */
export const UNDO_MIN_MS = 5_000;
export const TABOO_PENALTY = -1;

export const DEFAULT_SETTINGS: Settings = {
  nTeams: 2,
  names: ["Es", "Super-Io", "Io", "Preconscio"],
  levels: [1, 2, 3],
  target: DEFAULT_TARGET,
  weighted: false,
};

export const defaultTeamName = (i: number): string => `Squadra ${i + 1}`;

/** Normalizza il punteggio obiettivo scritto dall'utente (minimo 3, default 15). */
export function normalizeTarget(value: number): number {
  return Math.max(MIN_TARGET, Math.round(value) || DEFAULT_TARGET);
}

export function newSetup(settings: Settings = DEFAULT_SETTINGS): GameState {
  return {
    phase: "setup",
    settings: { ...settings, names: [...settings.names], levels: [...settings.levels] },
    teams: [],
    deck: [],
    turn: 0,
    cardId: null,
    endAt: null,
    last: null,
  };
}

export function startGame(settings: Settings, cards: readonly Card[], rng: Rng = Math.random): GameState {
  if (!settings.levels.length) throw new Error("Seleziona almeno un livello di difficoltà.");
  const teams = Array.from({ length: settings.nTeams }, (_, i) => ({
    name: settings.names[i] || defaultTeamName(i),
    score: 0,
  }));
  return {
    ...newSetup(settings),
    phase: "ready",
    teams,
    deck: buildDeck(cards, settings.levels, rng),
  };
}

export const currentTeamIndex = (s: GameState): number => s.turn % s.teams.length;

/** Valore di una carta indovinata: sempre 1, oppure il livello con il punteggio pesato. */
export const cardPoints = (card: Card, weighted: boolean): number => (weighted ? card.livello : 1);

export function outcomeDelta(outcome: Outcome, card: Card, weighted: boolean): number {
  if (outcome === "ok") return cardPoints(card, weighted);
  if (outcome === "taboo") return TABOO_PENALTY;
  return 0;
}

/** Pesca la carta e fa partire i 60 secondi. */
export function showCard(s: GameState, now: number): GameState {
  if (s.phase !== "ready" || !s.deck.length) return s;
  const deck = s.deck.slice(0, -1);
  return { ...s, deck, cardId: s.deck[s.deck.length - 1], endAt: now + TURN_MS, phase: "playing", last: null };
}

/** Chiude il turno con un esito e aggiorna il punteggio della squadra di turno. */
export function resolveCard(s: GameState, outcome: Outcome, now: number): GameState {
  if (s.phase !== "playing" || s.cardId === null || s.endAt === null) return s;
  const teamIndex = currentTeamIndex(s);
  const delta = outcomeDelta(outcome, cardById(s.cardId), s.settings.weighted);
  return {
    ...s,
    teams: addScore(s.teams, teamIndex, delta),
    last: { outcome, delta, teamIndex, remainingMs: remainingMs(s.endAt, now) },
    phase: "result",
  };
}

/** Annulla l'esito appena dato: toglie i punti e riprende il turno con il tempo che restava. */
export function undoResult(s: GameState, now: number): GameState {
  if (s.phase !== "result" || !s.last) return s;
  const { teamIndex, delta, remainingMs: left } = s.last;
  return {
    ...s,
    teams: addScore(s.teams, teamIndex, -delta),
    endAt: now + Math.max(left, UNDO_MIN_MS),
    phase: "playing",
    last: null,
  };
}

export function standings(s: GameState): { max: number; leaders: Team[] } {
  const max = Math.max(...s.teams.map((t) => t.score));
  return { max, leaders: s.teams.filter((t) => t.score === max) };
}

/**
 * La partita finisce solo a giro completo (ogni squadra ha giocato lo stesso numero
 * di carte), se una sola squadra in testa ha raggiunto l'obiettivo. Con la parità si
 * gioca un altro giro. Se il mazzo è finito, la partita finisce comunque.
 */
export function isGameOver(s: GameState): boolean {
  if (!s.deck.length) return true;
  const roundDone = s.turn % s.teams.length === 0;
  const { max, leaders } = standings(s);
  return roundDone && max >= s.settings.target && leaders.length === 1;
}

/** Passa al turno della squadra successiva, o chiude la partita. */
export function nextTurn(s: GameState): GameState {
  if (s.phase !== "result") return s;
  const next: GameState = { ...s, turn: s.turn + 1, cardId: null, endAt: null, last: null };
  return { ...next, phase: isGameOver(next) ? "end" : "ready" };
}

/** Stesse squadre e impostazioni, punteggi azzerati e mazzo nuovo. */
export function rematch(s: GameState, cards: readonly Card[], rng: Rng = Math.random): GameState {
  return {
    ...s,
    teams: s.teams.map((t) => ({ ...t, score: 0 })),
    deck: buildDeck(cards, s.settings.levels, rng),
    turn: 0,
    cardId: null,
    endAt: null,
    last: null,
    phase: "ready",
  };
}

/** Torna alla schermata iniziale conservando le impostazioni. */
export const backToSetup = (s: GameState): GameState => newSetup(s.settings);

/**
 * Il timer non sopravvive al ricaricamento della pagina: se un turno era in corso,
 * la carta torna in fondo al mazzo (non va persa) e si riparte da «Mostra la carta».
 */
export function restoreAfterReload(s: GameState): GameState {
  if (s.phase !== "playing") return s;
  const deck = s.cardId === null ? s.deck : [s.cardId, ...s.deck];
  return { ...s, deck, cardId: null, endAt: null, last: null, phase: "ready" };
}

function addScore(teams: Team[], index: number, delta: number): Team[] {
  return teams.map((t, i) => (i === index ? { ...t, score: t.score + delta } : t));
}
