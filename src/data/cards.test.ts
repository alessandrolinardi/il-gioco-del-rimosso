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

  it("tra le parole vietate c'è sempre l'autore del concetto (tranne nelle carte su persone, istituzioni o concetti senza autore)", () => {
    const AUTHORS = [
      "Freud", "Anna Freud", "Jones", "Breuer", "Charcot", "Ferenczi", "Heimann", "Zetzel", "Greenson",
      "Klein", "Isaacs", "Bion", "Winnicott", "Bowlby", "Ainsworth", "Kohut", "Lacan", "Jung", "Hartmann",
      "Kernberg", "Erikson", "Willi", "Torok", "Jacobs", "Ogden", "Bick", "Blos",
    ];
    const PERSON_CARDS = [27, 28, 29, 30, 59, 61, 62, 63, 64];
    const INSTITUTION_CARDS = [25];
    // Drop-out, Seduttività, Adolescenza, Psicoterapia, Insight, Diagnosi, Narcisismo del terapeuta, Self-disclosure
    const NO_AUTHOR_CARDS = [7, 12, 21, 40, 42, 54, 83, 91];
    const exempt = [...PERSON_CARDS, ...INSTITUTION_CARDS, ...NO_AUTHOR_CARDS];
    const missing = CARDS.filter(
      (c) => !exempt.includes(c.id) && !c.vietate.some((v) => AUTHORS.includes(v)),
    ).map((c) => `${c.id} ${c.parola}`);
    expect(missing).toEqual([]);
  });

  it("usa tutte e otto le aree", () => {
    expect(new Set(CARDS.map((c) => c.area))).toEqual(new Set(AREAS));
  });

  it("i rimandi interni («carta 39», «carta 77»…) puntano alle carte giuste", () => {
    const refs: Record<number, string> = {
      13: "Acting out",
      25: "Area G",
      39: "Borderline",
      77: "Holding",
      92: "Rêverie",
    };
    for (const [id, parola] of Object.entries(refs)) expect(cardById(Number(id)).parola).toBe(parola);
    const cited = new Set(CARDS.flatMap((c) => [...c.spiegazione.matchAll(/carta (\d+)/g)].map((m) => Number(m[1]))));
    expect([...cited].sort((a, b) => a - b)).toEqual(Object.keys(refs).map(Number));
  });
});
