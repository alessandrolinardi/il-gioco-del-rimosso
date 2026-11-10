/** Durata di un turno. */
export const TURN_MS = 60_000;

/** Sotto questa soglia (in secondi) il timer diventa rosso e scatta l'avviso. */
export const WARNING_SECONDS = 10;

export const remainingMs = (endAt: number, now: number): number => Math.max(0, endAt - now);

export const secondsLeft = (ms: number): number => Math.ceil(ms / 1000);

/** Frazione di tempo già trascorsa, da 0 a 1 (per l'anello del timer). */
export const elapsedFraction = (ms: number): number => Math.min(1, Math.max(0, 1 - ms / TURN_MS));

export interface CountdownHandlers {
  onTick(ms: number): void;
  /** Una sola volta, quando il tempo scende a 10 secondi. */
  onWarning?(): void;
  /** Una sola volta, allo scadere. */
  onExpire(): void;
}

export interface CountdownOptions {
  now?: () => number;
  intervalMs?: number;
}

/**
 * Avvia il conto alla rovescia verso `endAt` e restituisce la funzione che lo ferma.
 * Il tempo si ricalcola ogni volta dall'orologio, così resta giusto anche se il browser
 * rallenta i timer quando la pagina è in secondo piano.
 */
export function startCountdown(endAt: number, handlers: CountdownHandlers, options: CountdownOptions = {}): () => void {
  const now = options.now ?? Date.now;
  let stopped = false;
  let interval: ReturnType<typeof setInterval> | undefined;
  // Se si riparte già sotto la soglia (es. dopo un annullamento) l'avviso non si ripete.
  let warned = secondsLeft(remainingMs(endAt, now())) <= WARNING_SECONDS;

  const stop = () => {
    stopped = true;
    if (interval !== undefined) clearInterval(interval);
  };

  const step = () => {
    if (stopped) return;
    const ms = remainingMs(endAt, now());
    handlers.onTick(ms);
    if (ms <= 0) {
      stop();
      handlers.onExpire();
      return;
    }
    if (!warned && secondsLeft(ms) <= WARNING_SECONDS) {
      warned = true;
      handlers.onWarning?.();
    }
  };

  step();
  if (!stopped) interval = setInterval(step, options.intervalMs ?? 200);
  return stop;
}
