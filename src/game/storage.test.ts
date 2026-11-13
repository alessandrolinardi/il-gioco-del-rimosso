import { describe, expect, it } from "vitest";
import { CARDS } from "../data/cards";
import { DEFAULT_SETTINGS, expireTurn, newSetup, resolveCard, startGame, startTurn } from "./game";
import { loadGame, loadPref, saveGame } from "./storage";

function memoryStore() {
  const data = new Map<string, string>();
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    data,
  };
}

describe("salvataggio", () => {
  it("salva e ricarica un turno in corso e il riepilogo di fine turno", () => {
    const store = memoryStore();
    const playing = resolveCard(startTurn(startGame(DEFAULT_SETTINGS, CARDS), 0), "ok", 1_000);
    saveGame(playing, store);
    expect(loadGame(store)).toEqual(playing);
    const summary = expireTurn(playing);
    saveGame(summary, store);
    expect(loadGame(store)).toEqual(summary);
  });

  it("salva e ricarica la schermata iniziale", () => {
    const store = memoryStore();
    saveGame(newSetup(), store);
    expect(loadGame(store)?.phase).toBe("setup");
  });

  it("ignora dati rovinati o di forma sconosciuta", () => {
    const store = memoryStore();
    store.setItem("rimosso-game-v3", "{non è json");
    expect(loadGame(store)).toBeNull();
    store.setItem("rimosso-game-v3", JSON.stringify({ phase: "playing", teams: [] }));
    expect(loadGame(store)).toBeNull();
    const s = startGame(DEFAULT_SETTINGS, CARDS);
    store.setItem("rimosso-game-v3", JSON.stringify({ ...s, deck: [999] }));
    expect(loadGame(store)).toBeNull();
    store.setItem("rimosso-game-v3", JSON.stringify({ ...s, plays: [{ cardId: 1, outcome: "boh", delta: 0 }] }));
    expect(loadGame(store)).toBeNull();
  });

  it("funziona anche con il salvataggio bloccato dal browser", () => {
    const blocked = {
      getItem: (): string | null => {
        throw new DOMException("bloccato", "SecurityError");
      },
      setItem: (): void => {
        throw new DOMException("pieno", "QuotaExceededError");
      },
    };
    expect(loadGame(blocked)).toBeNull();
    expect(() => saveGame(newSetup(), blocked)).not.toThrow();
  });

  it("le preferenze accettano solo valori ammessi", () => {
    const store = memoryStore();
    expect(loadPref("tema", ["auto", "light", "dark"], "auto", store)).toBe("auto");
    store.setItem("tema", "dark");
    expect(loadPref("tema", ["auto", "light", "dark"], "auto", store)).toBe("dark");
    store.setItem("tema", "viola");
    expect(loadPref("tema", ["auto", "light", "dark"], "auto", store)).toBe("auto");
  });
});
