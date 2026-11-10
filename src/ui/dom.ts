const ESCAPES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" };

/** Rende sicuro un testo da inserire nell'HTML. */
export const esc = (s: unknown): string => String(s).replace(/[&<>"]/g, (m) => ESCAPES[m]);

/** Numero della carta a tre cifre: 7 → «007». */
export const cardNo = (n: number): string => String(n).padStart(3, "0");

export function byId<T extends HTMLElement = HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Elemento #${id} mancante`);
  return el as T;
}
