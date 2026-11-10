import { describe, expect, it } from "vitest";
import { CARDS } from "../data/cards";
import { DEFAULT_SETTINGS, newSetup, resolveCard, showCard, startGame } from "./game";
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
  it("salva e ricarica una partita in corso", () => {
    const store = memoryStore();
    const s = resolveCard(showCard(startGame(DEFAULT_SETTINGS, CARDS), 0), "ok", 1_000);
    saveGame(s, store);
    expect(loadGame(store)).toEqual(s);
  });

  it("salva e ricarica la schermata iniziale", () => {
    const store = memoryStore();
    saveGame(newSetup(), store);
    expect(loadGame(store)?.phase).toBe("setup");
  });

  it("ignora dati rovinati o di forma sconosciuta", () => {
    const store = memoryStore();
    store.setItem("rimosso-game-v2", "{non è json");
    expect(loadGame(store)).toBeNull();
    store.setItem("rimosso-game-v2", JSON.stringify({ phase: "playing", teams: [] }));
    expect(loadGame(store)).toBeNull();
    const s = startGame(DEFAULT_SETTINGS, CARDS);
    store.setItem("rimosso-game-v2", JSON.stringify({ ...s, deck: [999] }));
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
