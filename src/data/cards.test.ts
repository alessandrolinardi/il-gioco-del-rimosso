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

  it("ogni carta ha parola, quattro parole vietate, un'area nota e una spiegazione", () => {
    for (const c of CARDS) {
      expect(c.parola.trim()).not.toBe("");
      expect(c.vietate).toHaveLength(4);
      c.vietate.forEach((v) => expect(v.trim()).not.toBe(""));
      expect(AREAS).toContain(c.area);
      expect(c.spiegazione.length).toBeGreaterThan(40);
    }
  });

  it("usa tutte e otto le aree", () => {
    expect(new Set(CARDS.map((c) => c.area))).toEqual(new Set(AREAS));
  });

  it("i rimandi interni («carta 43», «carta 77») puntano alle carte giuste", () => {
    expect(cardById(43).parola).toBe("Diniego");
    expect(cardById(77).parola).toBe("Holding");
  });
});
