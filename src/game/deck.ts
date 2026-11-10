import type { Card, Level } from "../data/cards";

/** Generatore di numeri casuali in [0, 1), sostituibile nei test. */
export type Rng = () => number;

/** Mescola con Fisher–Yates e restituisce un nuovo array. */
export function shuffle<T>(items: readonly T[], rng: Rng = Math.random): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Mazzo mescolato con gli id delle carte dei livelli scelti. Si pesca dalla fine. */
export function buildDeck(cards: readonly Card[], levels: readonly Level[], rng: Rng = Math.random): number[] {
  return shuffle(
    cards.filter((c) => levels.includes(c.livello)).map((c) => c.id),
    rng,
  );
}
