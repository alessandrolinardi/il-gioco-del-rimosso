import { AREAS } from "../data/areas";
import { CARDS, LEVELS } from "../data/cards";
import { cardHTML } from "./card";
import { byId } from "./dom";

/** Sezione «Le 100 carte»: filtri per livello e area, ricerca. */
export function initDeckView(): void {
  const area = byId<HTMLSelectElement>("fArea");
  const query = byId<HTMLInputElement>("fq");
  const levelBoxes = LEVELS.map((l) => byId<HTMLInputElement>(`fl${l}`));

  for (const a of AREAS) {
    const o = document.createElement("option");
    o.value = a;
    o.textContent = `${a} (${CARDS.filter((c) => c.area === a).length})`;
    area.appendChild(o);
  }

  const render = () => {
    const levels = LEVELS.filter((_, i) => levelBoxes[i].checked);
    const a = area.value;
    const q = query.value.trim().toLowerCase();
    const list = CARDS.filter(
      (c) =>
        levels.includes(c.livello) &&
        (!a || c.area === a) &&
        (!q || `${c.parola} ${c.vietate.join(" ")}`.toLowerCase().includes(q)),
    );
    byId("deckCount").textContent = `${list.length} carte su ${CARDS.length}`;
    byId("deck").innerHTML =
      list.map((c) => cardHTML(c)).join("") || `<p class="note">Nessuna carta corrisponde ai filtri.</p>`;
  };

  [...levelBoxes, area, query].forEach((el) => el.addEventListener("input", render));
  render();
}
