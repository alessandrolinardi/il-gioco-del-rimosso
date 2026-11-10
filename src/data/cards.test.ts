import { describe, expect, it } from "vitest";
import { AREAS } from "./areas";
import { CARDS, cardById } from "./cards";

describe("cards.json", () => {
  it("contiene 100 carte: 30 facili, 40 intermedie, 30 difficili", () => {
    expect(CARDS).toHaveLength(100);
    expect(CARDS.filter((c) => c.livello === 1)).toHaveLength(30);
    expect(CARDS.filter((c) => c.livello === 2)).toHaveLength(40);
    expect(CARDS.filter((c) => c.livello === 3)).toHaveLength(30);
  });

  it("ha id da 1 a 100 in ordine, con i livelli nelle fasce 1–30, 31–70, 71–100", () => {
    CARDS.forEach((c, i) => {
      expect(c.id).toBe(i + 1);
      expect(c.livello).toBe(c.id <= 30 ? 1 : c.id <= 70 ? 2 : 3);
    });
  });

  it("ogni carta ha parola, 4 o 5 parole vietate diverse, un'area nota e una spiegazione", () => {
    for (const c of CARDS) {
      expect(c.parola.trim()).not.toBe("");
      expect(c.vietate.length).toBeGreaterThanOrEqual(4);
      expect(c.vietate.length).toBeLessThanOrEqual(5);
      expect(new Set(c.vietate).size).toBe(c.vietate.length);
      c.vietate.forEach((v) => expect(v.trim()).not.toBe(""));
      expect(AREAS).toContain(c.area);
      expect(c.spiegazione.length).toBeGreaterThan(40);
    }
  });

  it("tra le parole vietate c'è sempre l'autore del concetto (tranne nelle carte che sono autori)", () => {
    const AUTHORS = [
      "Freud", "Anna Freud", "Jones", "Breuer", "Charcot", "Ferenczi", "Heimann", "Zetzel", "Greenson",
      "Klein", "Isaacs", "Bion", "Winnicott", "Bowlby", "Ainsworth", "Kohut", "Lacan", "Jung", "Hartmann",
    ];
    const PERSON_CARDS = [27, 28, 29, 30, 59, 60, 61, 62, 63, 64];
    const missing = CARDS.filter(
      (c) => !PERSON_CARDS.includes(c.id) && !c.vietate.some((v) => AUTHORS.includes(v)),
    ).map((c) => `${c.id} ${c.parola}`);
    expect(missing).toEqual([]);
  });

  it("usa tutte e otto le aree", () => {
    expect(new Set(CARDS.map((c) => c.area))).toEqual(new Set(AREAS));
  });

  it("i rimandi interni («carta 43», «carta 77») puntano alle carte giuste", () => {
    expect(cardById(43).parola).toBe("Diniego");
    expect(cardById(77).parola).toBe("Holding");
  });
});
