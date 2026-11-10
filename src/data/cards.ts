import raw from "./cards.json";

export type Level = 1 | 2 | 3;

export interface Card {
  id: number;
  parola: string;
  vietate: string[];
  livello: Level;
  area: string;
  spiegazione: string;
}

export const CARDS: readonly Card[] = raw as Card[];

export const LEVELS: readonly Level[] = [1, 2, 3];

export const LEVEL_LABELS: Record<Level, string> = {
  1: "Facile",
  2: "Intermedio",
  3: "Difficile",
};

const byId = new Map(CARDS.map((c) => [c.id, c]));

export function cardById(id: number): Card {
  const card = byId.get(id);
  if (!card) throw new Error(`Carta ${id} inesistente`);
  return card;
}
