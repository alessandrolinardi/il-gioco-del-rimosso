import { CARDS, LEVEL_LABELS, LEVELS } from "../data/cards";
import { byId, cardNo, esc } from "./dom";

/** Sezione «Soluzioni»: una scheda per carta, raggruppate per livello. */
export function renderSolutions(): void {
  byId("sols").innerHTML = LEVELS.map((l) => {
    const cards = CARDS.filter((c) => c.livello === l);
    const range = `${cards[0].id}–${cards[cards.length - 1].id}`;
    return (
      `<div class="sol-group l${l}"><h3><span class="dot"></span>${LEVEL_LABELS[l]} · carte ${range}</h3>` +
      cards
        .map(
          (c) =>
            `<div class="sol l${c.livello}"><span class="no">${cardNo(c.id)}</span><div><h4>${esc(c.parola)}</h4><div class="meta">${esc(c.area)} · vietate: ${c.vietate.map(esc).join(" – ")}</div><p>${esc(c.spiegazione)}</p></div></div>`,
        )
        .join("") +
      `</div>`
    );
  }).join("");
}
