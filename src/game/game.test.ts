import { describe, expect, it } from "vitest";
import { CARDS } from "../data/cards";
import {
  DEFAULT_SETTINGS,
  isGameOver,
  nextTurn,
  rematch,
  resolveCard,
  restoreAfterReload,
  showCard,
  standings,
  startGame,
  undoResult,
  UNDO_MIN_MS,
  type GameState,
  type Outcome,
  type Settings,
} from "./game";
import { TURN_MS } from "./timer";

// Carte di riferimento: 1 è facile, 31 intermedia, 71 difficile.
const EASY = 1;
const MID = 31;
const HARD = 71;
const NOW = 1_000_000;

function game(settings: Partial<Settings> = {}, deck: number[] = [EASY, EASY + 1, EASY + 2, EASY + 3, EASY + 4, EASY + 5]): GameState {
  const s = startGame({ ...DEFAULT_SETTINGS, ...settings }, CARDS);
  return { ...s, deck };
}

/** Gioca la carta in cima al mazzo con un esito e passa al turno successivo. */
function play(s: GameState, outcome: Outcome, now = NOW): GameState {
  return nextTurn(resolveCard(showCard(s, now), outcome, now));
}

/** Mette in cima al mazzo una carta precisa (si pesca dalla fine). */
const withTop = (s: GameState, id: number): GameState => ({ ...s, deck: [...s.deck, id] });

const scores = (s: GameState) => s.teams.map((t) => t.score);

describe("punteggio normale", () => {
  it.each([EASY, MID, HARD])("carta indovinata vale +1 a qualsiasi livello (carta %i)", (id) => {
    const s = resolveCard(showCard(withTop(game(), id), NOW), "ok", NOW);
    expect(scores(s)).toEqual([1, 0]);
    expect(s.last?.delta).toBe(1);
  });

  it("tabù vale −1, passo e tempo scaduto valgono 0", () => {
    const taboo = resolveCard(showCard(game(), NOW), "taboo", NOW);
    expect(scores(taboo)).toEqual([-1, 0]);
    expect(scores(resolveCard(showCard(game(), NOW), "pass", NOW))).toEqual([0, 0]);
    expect(scores(resolveCard(showCard(game(), NOW), "time", NOW))).toEqual([0, 0]);
  });

  it("i punti vanno alla squadra di turno", () => {
    let s = play(game(), "pass"); // squadra 1
    s = resolveCard(showCard(s, NOW), "ok", NOW); // squadra 2
    expect(scores(s)).toEqual([0, 1]);
  });
});

describe("punteggio pesato", () => {
  it.each([
    [EASY, 1],
    [MID, 2],
    [HARD, 3],
  ])("carta %i indovinata vale +%i", (id, points) => {
    const s = resolveCard(showCard(withTop(game({ weighted: true }), id), NOW), "ok", NOW);
    expect(scores(s)).toEqual([points, 0]);
  });

  it("la penalità del tabù resta −1 anche su una carta difficile", () => {
    const s = resolveCard(showCard(withTop(game({ weighted: true }), HARD), NOW), "taboo", NOW);
    expect(scores(s)).toEqual([-1, 0]);
  });
});

describe("fine partita solo a giro completo", () => {
  it("la prima squadra raggiunge l'obiettivo ma la seconda gioca comunque la sua carta", () => {
    let s = game({ target: 3, weighted: true });
    s = { ...s, deck: [EASY, EASY + 1, HARD] };
    s = play(s, "ok"); // squadra 1: +3, obiettivo raggiunto a metà giro
    expect(scores(s)).toEqual([3, 0]);
    expect(s.phase).toBe("ready");
    s = play(s, "pass"); // squadra 2 chiude il giro
    expect(s.phase).toBe("end");
    expect(standings(s).leaders.map((t) => t.name)).toEqual(["Es"]);
  });

  it("con tre squadre si aspetta la terza carta del giro", () => {
    let s = game({ nTeams: 3, target: 3, weighted: true }, [EASY, EASY + 1, EASY + 2, EASY + 3, HARD]);
    s = play(s, "ok");
    expect(s.phase).toBe("ready");
    s = play(s, "pass");
    expect(s.phase).toBe("ready");
    s = play(s, "pass");
    expect(s.phase).toBe("end");
  });

  it("a giro completo senza nessuno all'obiettivo si continua", () => {
    let s = game({ target: 3 });
    s = play(play(s, "ok"), "ok");
    expect(scores(s)).toEqual([1, 1]);
    expect(isGameOver(s)).toBe(false);
    expect(s.phase).toBe("ready");
  });
});

describe("pareggio", () => {
  it("se due squadre sono in testa a pari merito a fine giro si gioca un altro giro", () => {
    let s = game({ target: 3, weighted: true }, [EASY, EASY + 1, EASY + 2, HARD, HARD + 1]);
    s = play(s, "ok"); // squadra 1: 3
    s = play(s, "ok"); // squadra 2: 3 → parità all'obiettivo
    expect(scores(s)).toEqual([3, 3]);
    expect(s.phase).toBe("ready");
    s = play(s, "ok"); // squadra 1: facile, +1
    s = play(s, "pass"); // squadra 2: 0
    expect(s.phase).toBe("end");
    expect(standings(s).leaders.map((t) => t.name)).toEqual(["Es"]);
  });

  it("se il mazzo finisce in parità la partita si chiude con un pareggio", () => {
    let s = game({ target: 15 }, [EASY + 1, EASY]);
    s = play(s, "ok");
    s = play(s, "ok");
    expect(s.deck).toEqual([]);
    expect(s.phase).toBe("end");
    expect(standings(s).leaders).toHaveLength(2);
  });

  it("se il mazzo finisce a metà giro la partita si chiude e vince chi ha più punti", () => {
    let s = game({ target: 15 }, [EASY]);
    s = play(s, "ok");
    expect(s.phase).toBe("end");
    expect(standings(s).leaders.map((t) => t.name)).toEqual(["Es"]);
  });
});

describe("annullamento dell'esito", () => {
  it("toglie i punti assegnati e riprende il turno con il tempo che restava", () => {
    let s = showCard(withTop(game({ weighted: true }), MID), NOW);
    s = resolveCard(s, "ok", NOW + 20_000); // restano 40 s
    expect(scores(s)).toEqual([2, 0]);
    const later = NOW + 25_000;
    s = undoResult(s, later);
    expect(scores(s)).toEqual([0, 0]);
    expect(s.phase).toBe("playing");
    expect(s.endAt).toBe(later + 40_000);
    expect(s.cardId).toBe(MID);
    expect(s.turn).toBe(0);
  });

  it("annullare un tabù restituisce il punto tolto", () => {
    let s = resolveCard(showCard(game(), NOW), "taboo", NOW);
    expect(scores(s)).toEqual([-1, 0]);
    s = undoResult(s, NOW);
    expect(scores(s)).toEqual([0, 0]);
  });

  it("dopo un tempo scaduto concede almeno 5 secondi", () => {
    let s = resolveCard(showCard(game(), NOW), "time", NOW + TURN_MS);
    s = undoResult(s, NOW + 70_000);
    expect(s.endAt).toBe(NOW + 70_000 + UNDO_MIN_MS);
  });

  it("dopo l'annullamento si può dare un esito diverso", () => {
    let s = resolveCard(showCard(game(), NOW), "taboo", NOW);
    s = resolveCard(undoResult(s, NOW), "ok", NOW);
    expect(scores(s)).toEqual([1, 0]);
  });

  it("non fa nulla fuori dalla schermata dell'esito", () => {
    const s = showCard(game(), NOW);
    expect(undoResult(s, NOW)).toBe(s);
  });
});

describe("mazzo e turni", () => {
  it("il mazzo contiene solo i livelli scelti", () => {
    const s = startGame({ ...DEFAULT_SETTINGS, levels: [2] }, CARDS);
    expect(s.deck).toHaveLength(40);
    expect(new Set(s.deck.map((id) => CARDS[id - 1].livello))).toEqual(new Set([2]));
  });

  it("serve almeno un livello", () => {
    expect(() => startGame({ ...DEFAULT_SETTINGS, levels: [] }, CARDS)).toThrow();
  });

  it("le squadre senza nome ricevono un nome di default", () => {
    const s = startGame({ ...DEFAULT_SETTINGS, nTeams: 3, names: ["A", ""] }, CARDS);
    expect(s.teams.map((t) => t.name)).toEqual(["A", "Squadra 2", "Squadra 3"]);
  });

  it("ricaricando la pagina durante un turno la carta torna in fondo al mazzo", () => {
    const before = game();
    const playing = showCard(before, NOW);
    const restored = restoreAfterReload(playing);
    expect(restored.phase).toBe("ready");
    expect(restored.deck).toHaveLength(before.deck.length);
    expect(restored.deck[0]).toBe(playing.cardId);
  });

  it("la rivincita azzera i punteggi e rifà il mazzo", () => {
    let s = play(play(game({}, [EASY, EASY + 1]), "ok"), "ok");
    expect(s.phase).toBe("end");
    s = rematch(s, CARDS);
    expect(scores(s)).toEqual([0, 0]);
    expect(s.deck).toHaveLength(100);
    expect(s.turn).toBe(0);
    expect(s.phase).toBe("ready");
  });
});
