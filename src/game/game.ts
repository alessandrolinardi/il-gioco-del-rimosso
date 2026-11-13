import { cardById, type Card, type Level } from "../data/cards";
import { buildDeck, type Rng } from "./deck";
import { TURN_MS } from "./timer";

/*
 * Stato della partita e regole. Tutte le funzioni sono pure: ricevono uno stato
 * e ne restituiscono uno nuovo, senza toccare la pagina, l'orologio o il salvataggio.
 *
 * Un turno dura 60 secondi: la squadra di turno indovina più carte possibile, una
 * dopo l'altra, poi il dispositivo passa alla squadra successiva.
 */

export type Phase = "setup" | "ready" | "playing" | "summary" | "end";
export type Outcome = "ok" | "taboo" | "pass" | "time";

/** Esiti che il descrittore e il controllore danno durante il turno. */
export type LiveOutcome = Exclude<Outcome, "time">;

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

/** Una carta giocata nel turno in corso, con il suo esito e i punti che ha portato. */
export interface Play {
  cardId: number;
  outcome: Outcome;
  delta: number;
}

export interface GameState {
  phase: Phase;
  settings: Settings;
  teams: Team[];
  /** Id delle carte ancora da giocare; si pesca dalla fine, le carte passate tornano all'inizio. */
  deck: number[];
  /** Numero di turni conclusi: indica anche di chi è il turno. */
  turn: number;
  /** Carta in mano al descrittore durante il turno. */
  cardId: number | null;
  endAt: number | null;
  /** Carte già giocate nel turno in corso, in ordine. */
  plays: Play[];
}

export const TEAM_COUNTS = [2, 3, 4] as const;
export const MIN_TARGET = 5;
export const DEFAULT_TARGET = 25;
export const TABOO_PENALTY = -2;
export const PASS_PENALTY = -1;

export const DEFAULT_SETTINGS: Settings = {
  nTeams: 2,
  names: ["Es", "Super-Io", "Io", "Preconscio"],
  levels: [1, 2, 3],
  target: DEFAULT_TARGET,
  weighted: false,
};

export const defaultTeamName = (i: number): string => `Squadra ${i + 1}`;

/** Normalizza il punteggio obiettivo scritto dall'utente (minimo 5, default 25). */
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
    plays: [],
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
  if (outcome === "pass") return PASS_PENALTY;
  return 0;
}

/** Le carte passate o rimaste in mano allo scadere tornano in fondo al mazzo; le altre escono dal gioco. */
export const returnsToDeck = (outcome: Outcome): boolean => outcome === "pass" || outcome === "time";

/** Punti fatti dalla squadra nel turno in corso. */
export const turnTotal = (s: GameState): number => s.plays.reduce((sum, p) => sum + p.delta, 0);

/** Fa partire i 60 secondi e pesca la prima carta. */
export function startTurn(s: GameState, now: number): GameState {
  if (s.phase !== "ready" || !s.deck.length) return s;
  return {
    ...s,
    deck: s.deck.slice(0, -1),
    cardId: s.deck[s.deck.length - 1],
    endAt: now + TURN_MS,
    plays: [],
    phase: "playing",
  };
}

/**
 * Dà un esito alla carta in mano e pesca la successiva. Il turno si chiude se il tempo
 * è già scaduto o se nel mazzo non restano altre carte.
 */
export function resolveCard(s: GameState, outcome: LiveOutcome, now: number): GameState {
  if (s.phase !== "playing" || s.cardId === null || s.endAt === null) return s;
  const play = makePlay(s, s.cardId, outcome);
  const teams = addScore(s.teams, currentTeamIndex(s), play.delta);
  const next = s.deck.length ? s.deck[s.deck.length - 1] : null;
  const timeUp = now >= s.endAt;
  // La carta passata va in fondo dopo la pesca, così non torna subito in mano.
  const rest = timeUp || next === null ? s.deck : s.deck.slice(0, -1);
  const deck = returnsToDeck(outcome) ? [s.cardId, ...rest] : rest;
  const base = { ...s, teams, deck, plays: [...s.plays, play] };
  if (timeUp || next === null) return { ...base, cardId: null, endAt: null, phase: "summary" };
  return { ...base, cardId: next };
}

/** Allo scadere la carta in mano non vale punti e torna in fondo al mazzo; si passa al riepilogo. */
export function expireTurn(s: GameState): GameState {
  if (s.phase !== "playing" || s.cardId === null) return s;
  return {
    ...s,
    deck: [s.cardId, ...s.deck],
    plays: [...s.plays, makePlay(s, s.cardId, "time")],
    cardId: null,
    endAt: null,
    phase: "summary",
  };
}

/**
 * Annulla l'ultimo esito del turno: i punti tornano com'erano, la carta torna in mano
 * al descrittore e quella che aveva pescato torna in cima al mazzo. Il tempo non si ferma.
 */
export function undoLast(s: GameState): GameState {
  if (s.phase !== "playing" || s.cardId === null || !s.plays.length) return s;
  const last = s.plays[s.plays.length - 1];
  const deck = s.deck.filter((id) => id !== last.cardId);
  return {
    ...s,
    teams: addScore(s.teams, currentTeamIndex(s), -last.delta),
    deck: [...deck, s.cardId],
    cardId: last.cardId,
    plays: s.plays.slice(0, -1),
  };
}

/** Nel riepilogo di fine turno si può correggere l'esito di una carta. */
export function changeOutcome(s: GameState, index: number, outcome: Outcome): GameState {
  const old = s.plays[index];
  if (s.phase !== "summary" || !old || old.outcome === outcome) return s;
  const play = makePlay(s, old.cardId, outcome);
  const others = s.deck.filter((id) => id !== old.cardId);
  return {
    ...s,
    teams: addScore(s.teams, currentTeamIndex(s), play.delta - old.delta),
    deck: returnsToDeck(outcome) ? [old.cardId, ...others] : others,
    plays: s.plays.map((p, i) => (i === index ? play : p)),
  };
}

export function standings(s: GameState): { max: number; leaders: Team[] } {
  const max = Math.max(...s.teams.map((t) => t.score));
  return { max, leaders: s.teams.filter((t) => t.score === max) };
}

/**
 * La partita finisce solo a giro completo (ogni squadra ha giocato lo stesso numero
 * di turni), se una sola squadra in testa ha raggiunto l'obiettivo. Con la parità si
 * gioca un altro giro. Se il mazzo è finito, la partita finisce comunque.
 */
export function isGameOver(s: GameState): boolean {
  if (!s.deck.length) return true;
  const roundDone = s.turn % s.teams.length === 0;
  const { max, leaders } = standings(s);
  return roundDone && max >= s.settings.target && leaders.length === 1;
}

/** Dal riepilogo passa al turno della squadra successiva, o chiude la partita. */
export function nextTurn(s: GameState): GameState {
  if (s.phase !== "summary") return s;
  const next: GameState = { ...s, turn: s.turn + 1, cardId: null, endAt: null, plays: [] };
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
    plays: [],
    phase: "ready",
  };
}

/** Torna alla schermata iniziale conservando le impostazioni. */
export const backToSetup = (s: GameState): GameState => newSetup(s.settings);

/**
 * Ricaricando la pagina a turno in corso, il turno riprende con il tempo che restava
 * (l'orologio non si ferma); se nel frattempo è scaduto, si passa al riepilogo.
 */
export function restoreAfterReload(s: GameState, now: number): GameState {
  if (s.phase !== "playing" || s.endAt === null) return s;
  return now < s.endAt ? s : expireTurn(s);
}

function makePlay(s: GameState, cardId: number, outcome: Outcome): Play {
  return { cardId, outcome, delta: outcomeDelta(outcome, cardById(cardId), s.settings.weighted) };
}

function addScore(teams: Team[], index: number, delta: number): Team[] {
  return teams.map((t, i) => (i === index ? { ...t, score: t.score + delta } : t));
}
