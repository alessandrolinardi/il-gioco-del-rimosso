import { LEVEL_LABELS, type Card } from "../data/cards";
import { cardNo, esc } from "./dom";

/** La carta come appare nel mazzo e durante il turno (`big`). */
export function cardHTML(c: Card, big = false): string {
  return `<article class="tcard l${c.livello}${big ? " big" : ""}">
    <div class="band"><span>N. ${cardNo(c.id)}</span><span>${LEVEL_LABELS[c.livello]}</span></div>
    <div class="word">${esc(c.parola)}</div>
    <ul aria-label="Parole vietate">${c.vietate.map((t) => `<li>${esc(t)}</li>`).join("")}</ul>
    <div class="area">${esc(c.area)}</div></article>`;
}
