import { describe, expect, it } from "vitest";
import { CARDS } from "../data/cards";
import {
  changeOutcome,
  DEFAULT_SETTINGS,
  expireTurn,
  isGameOver,
  nextTurn,
  PASS_PENALTY,
  rematch,
  resolveCard,
  restoreAfterReload,
  standings,
  startGame,
  startTurn,
  TABOO_PENALTY,
  turnTotal,
  undoLast,
  type GameState,
  type LiveOutcome,
  type Settings,
} from "./game";
import { TURN_MS } from "./timer";

// Carte di riferimento: 1–30 facili, 31–70 intermedie, 71–100 difficili.
const EASY = 1;
const MID = 31;
const HARD = 71;
const NOW = 1_000_000;
const DURING = NOW + 10_000;
const AFTER = NOW + TURN_MS;

/** Partita con un mazzo preciso: si pesca dalla fine, quindi l'ultima carta esce per prima. */
function game(settings: Partial<Settings> = {}, deck: number[] = [6, 5, 4, 3, 2, 1]): GameState {
  return { ...startGame({ ...DEFAULT_SETTINGS, ...settings }, CARDS), deck };
}

/** Gioca un turno intero: gli esiti in ordine, poi lo scadere del tempo e il passaggio di turno. */
function turn(s: GameState, outcomes: LiveOutcome[]): GameState {
  let t = startTurn(s, NOW);
  for (const o of outcomes) t = resolveCard(t, o, DURING);
  if (t.phase === "playing") t = expireTurn(t);
  return nextTurn(t);
}

const scores = (s: GameState) => s.teams.map((t) => t.score);

describe("un turno da 60 secondi con più carte", () => {
  it("il turno pesca la prima carta e fa partire il tempo", () => {
    const s = startTurn(game(), NOW);
    expect(s.phase).toBe("playing");
    expect(s.cardId).toBe(1);
    expect(s.endAt).toBe(NOW + TURN_MS);
    expect(s.deck).toEqual([6, 5, 4, 3, 2]);
  });

  it("dopo un esito arriva subito la carta successiva, senza cambiare squadra", () => {
    let s = startTurn(game(), NOW);
    s = resolveCard(s, "ok", DURING);
    s = resolveCard(s, "ok", DURING);
    expect(s.phase).toBe("playing");
    expect(s.cardId).toBe(3);
    expect(s.turn).toBe(0);
    expect(scores(s)).toEqual([2, 0]);
    expect(s.plays.map((p) => p.cardId)).toEqual([1, 2]);
    expect(turnTotal(s)).toBe(2);
  });

  it("allo scadere la carta in mano vale 0, torna in fondo al mazzo e si passa al riepilogo", () => {
    let s = startTurn(game(), NOW);
    s = resolveCard(s, "ok", DURING);
    s = expireTurn(s);
    expect(s.phase).toBe("summary");
    expect(s.cardId).toBeNull();
    expect(s.plays.at(-1)).toEqual({ cardId: 2, outcome: "time", delta: 0 });
    expect(s.deck).toEqual([2, 6, 5, 4, 3]);
    expect(scores(s)).toEqual([1, 0]);
  });

  it("un esito dato quando il tempo è già finito conta, ma chiude il turno", () => {
    let s = startTurn(game(), NOW);
    s = resolveCard(s, "ok", AFTER);
    expect(s.phase).toBe("summary");
    expect(scores(s)).toEqual([1, 0]);
    expect(s.deck).toEqual([6, 5, 4, 3, 2]);
  });

  it("se il mazzo finisce durante il turno, il turno si chiude", () => {
    let s = startTurn(game({}, [2, 1]), NOW);
    s = resolveCard(s, "ok", DURING);
    s = resolveCard(s, "ok", DURING);
    expect(s.phase).toBe("summary");
    expect(s.deck).toEqual([]);
    expect(nextTurn(s).phase).toBe("end");
  });

  it("finito il riepilogo il turno passa alla squadra successiva", () => {
    const s = turn(game(), ["ok", "ok", "ok"]);
    expect(s.phase).toBe("ready");
    expect(s.turn).toBe(1);
    expect(s.plays).toEqual([]);
    const t = startTurn(s, NOW);
    expect(resolveCard(t, "ok", DURING).teams.map((x) => x.score)).toEqual([3, 1]);
  });
});

describe("punteggio", () => {
  it.each([EASY, MID, HARD])("carta indovinata vale +1 a qualsiasi livello (carta %i)", (id) => {
    const s = resolveCard(startTurn(game({}, [id]), NOW), "ok", DURING);
    expect(scores(s)).toEqual([1, 0]);
  });

  it.each([
    [EASY, 1],
    [MID, 2],
    [HARD, 3],
  ])("con il punteggio pesato la carta %i vale +%i", (id, points) => {
    const s = resolveCard(startTurn(game({ weighted: true }, [id]), NOW), "ok", DURING);
    expect(scores(s)).toEqual([points, 0]);
  });

  it("il tabù costa 1 punto e la carta esce dal gioco", () => {
    const s = resolveCard(startTurn(game(), NOW), "taboo", DURING);
    expect(TABOO_PENALTY).toBe(-1);
    expect(scores(s)).toEqual([-1, 0]);
    expect(s.deck).not.toContain(1);
  });

  it("il passo non costa punti e la carta torna in fondo al mazzo", () => {
    const s = resolveCard(startTurn(game(), NOW), "pass", DURING);
    expect(PASS_PENALTY).toBe(0);
    expect(scores(s)).toEqual([0, 0]);
    expect(s.cardId).toBe(2);
    expect(s.deck).toEqual([1, 6, 5, 4, 3]);
  });

  it("le penalità restano uguali anche con il punteggio pesato e su una carta difficile", () => {
    let s = startTurn(game({ weighted: true }, [HARD + 1, HARD]), NOW);
    s = resolveCard(s, "taboo", DURING);
    s = resolveCard(s, "pass", DURING);
    expect(scores(s)).toEqual([-1, 0]);
  });

  it("se si passa l'ultima carta del mazzo il turno si chiude e la carta resta per la squadra dopo", () => {
    const s = resolveCard(startTurn(game({}, [1]), NOW), "pass", DURING);
    expect(s.phase).toBe("summary");
    expect(s.deck).toEqual([1]);
    expect(nextTurn(s).phase).toBe("ready");
  });
});

describe("annullare l'ultimo esito durante il turno", () => {
  it("toglie i punti e rimette in mano la carta precedente; quella pescata torna in cima", () => {
    let s = startTurn(game({ weighted: true }, [3, 2, MID]), NOW);
    s = resolveCard(s, "ok", DURING);
    expect(scores(s)).toEqual([2, 0]);
    s = undoLast(s);
    expect(scores(s)).toEqual([0, 0]);
    expect(s.cardId).toBe(MID);
    expect(s.deck).toEqual([3, 2]);
    expect(s.plays).toEqual([]);
    expect(s.endAt).toBe(NOW + TURN_MS);
  });

  it("annullare un passo rimette in mano la carta e la toglie dal fondo del mazzo", () => {
    let s = resolveCard(startTurn(game(), NOW), "pass", DURING);
    s = undoLast(s);
    expect(scores(s)).toEqual([0, 0]);
    expect(s.cardId).toBe(1);
    expect(s.deck).toEqual([6, 5, 4, 3, 2]);
  });

  it("annullare un tabù restituisce il punto e permette un esito diverso", () => {
    let s = resolveCard(startTurn(game(), NOW), "taboo", DURING);
    expect(scores(undoLast(s))).toEqual([0, 0]);
    s = resolveCard(undoLast(s), "ok", DURING);
    expect(scores(s)).toEqual([1, 0]);
  });

  it("senza carte già giocate non fa nulla", () => {
    const s = startTurn(game(), NOW);
    expect(undoLast(s)).toBe(s);
  });
});

describe("correzioni nel riepilogo", () => {
  it("cambiare un esito ricalcola i punti della squadra di turno", () => {
    let s = startTurn(game(), NOW);
    s = resolveCard(s, "taboo", DURING);
    s = resolveCard(s, "ok", DURING);
    s = expireTurn(s);
    expect(scores(s)).toEqual([0, 0]);
    s = changeOutcome(s, 0, "ok");
    expect(scores(s)).toEqual([2, 0]);
    expect(turnTotal(s)).toBe(2);
  });

  it("la carta rimasta in mano allo scadere può diventare indovinata ed esce dal mazzo", () => {
    let s = expireTurn(startTurn(game(), NOW));
    expect(s.deck[0]).toBe(1);
    s = changeOutcome(s, 0, "ok");
    expect(scores(s)).toEqual([1, 0]);
    expect(s.deck).toEqual([6, 5, 4, 3, 2]);
  });

  it("una carta indovinata trasformata in passo torna in fondo al mazzo", () => {
    let s = startTurn(game(), NOW);
    s = expireTurn(resolveCard(s, "ok", DURING));
    s = changeOutcome(s, 0, "pass");
    expect(scores(s)).toEqual([0, 0]);
    expect(s.deck.slice(0, 2).sort()).toEqual([1, 2]);
  });

  it("si può correggere solo nel riepilogo", () => {
    const s = resolveCard(startTurn(game(), NOW), "ok", DURING);
    expect(changeOutcome(s, 0, "taboo")).toBe(s);
  });
});

describe("fine partita solo a giro completo", () => {
  it("la prima squadra raggiunge l'obiettivo ma la seconda gioca comunque il suo turno", () => {
    let s = game({ target: 5 }, Array.from({ length: 20 }, (_, i) => i + 1));
    s = turn(s, ["ok", "ok", "ok", "ok", "ok"]);
    expect(scores(s)).toEqual([5, 0]);
    expect(s.phase).toBe("ready");
    s = turn(s, ["ok"]);
    expect(s.phase).toBe("end");
    expect(standings(s).leaders.map((t) => t.name)).toEqual(["Es"]);
  });

  it("con tre squadre si aspetta il terzo turno del giro", () => {
    let s = game({ nTeams: 3, target: 5 }, Array.from({ length: 20 }, (_, i) => i + 1));
    s = turn(s, ["ok", "ok", "ok", "ok", "ok"]);
    s = turn(s, []);
    expect(s.phase).toBe("ready");
    s = turn(s, []);
    expect(s.phase).toBe("end");
  });

  it("a giro completo senza nessuno all'obiettivo si continua", () => {
    let s = game({ target: 5 }, Array.from({ length: 20 }, (_, i) => i + 1));
    s = turn(turn(s, ["ok", "ok"]), ["ok", "ok", "ok"]);
    expect(scores(s)).toEqual([2, 3]);
    expect(isGameOver(s)).toBe(false);
    expect(s.phase).toBe("ready");
  });

  it("con due squadre in testa a pari merito si gioca un altro giro", () => {
    let s = game({ target: 5 }, Array.from({ length: 30 }, (_, i) => i + 1));
    s = turn(s, ["ok", "ok", "ok", "ok", "ok"]);
    s = turn(s, ["ok", "ok", "ok", "ok", "ok"]);
    expect(scores(s)).toEqual([5, 5]);
    expect(s.phase).toBe("ready");
    s = turn(s, ["ok"]);
    s = turn(s, ["pass"]);
    expect(s.phase).toBe("end");
    expect(standings(s).leaders.map((t) => t.name)).toEqual(["Es"]);
  });

  it("se il mazzo finisce la partita si chiude, anche a metà giro", () => {
    let s = game({ target: 25 }, [2, 1]);
    s = turn(s, ["ok", "ok"]);
    expect(s.phase).toBe("end");
    expect(standings(s).leaders.map((t) => t.name)).toEqual(["Es"]);

    let t = game({ target: 25 }, [3, 2, 1]);
    t = turn(t, ["ok"]); // la carta 2 resta in mano allo scadere e torna nel mazzo
    t = turn(t, ["ok", "ok"]);
    expect(scores(t)).toEqual([1, 2]);
    expect(t.phase).toBe("end");
  });
});

describe("mazzo, ricaricamento e rivincita", () => {
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

  it("ricaricando la pagina a turno in corso il turno riprende con il tempo che restava", () => {
    const s = resolveCard(startTurn(game(), NOW), "ok", DURING);
    expect(restoreAfterReload(s, DURING + 5_000)).toBe(s);
  });

  it("se il tempo è scaduto durante il ricaricamento si passa al riepilogo", () => {
    const s = resolveCard(startTurn(game(), NOW), "ok", DURING);
    const restored = restoreAfterReload(s, AFTER + 1);
    expect(restored.phase).toBe("summary");
    expect(restored.plays.map((p) => p.outcome)).toEqual(["ok", "time"]);
    expect(scores(restored)).toEqual([1, 0]);
  });

  it("la rivincita azzera i punteggi e rifà il mazzo", () => {
    let s = turn(game({}, [2, 1]), ["ok", "ok"]);
    expect(s.phase).toBe("end");
    s = rematch(s, CARDS);
    expect(scores(s)).toEqual([0, 0]);
    expect(s.deck).toHaveLength(100);
    expect(s.turn).toBe(0);
    expect(s.phase).toBe("ready");
  });
});
