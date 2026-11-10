/*
 * Segnali al giocatore: vibrazione, suono di fine tempo e schermo sempre acceso.
 * Tutto è facoltativo: se il dispositivo non supporta una funzione, non succede nulla.
 */

// ---------- Vibrazione ----------

function vibrate(pattern: number | number[]): void {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    /* non supportata */
  }
}

/** Mancano 10 secondi. */
export const warnVibration = (): void => vibrate(150);

/** Tempo scaduto. */
export const expireVibration = (): void => vibrate([250, 120, 250]);

// ---------- Suono (generato dal browser, nessun file audio) ----------

let audio: AudioContext | null = null;

/**
 * I browser permettono l'audio solo dopo un gesto dell'utente: va chiamata dentro
 * un clic (es. «Mostra la carta»), così il suono di fine tempo potrà partire da solo.
 */
export function unlockAudio(): void {
  try {
    const Ctx: typeof AudioContext | undefined =
      window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    audio ??= new Ctx();
    if (audio.state === "suspended") void audio.resume();
  } catch {
    audio = null;
  }
}

function tone(ctx: AudioContext, freq: number, start: number, duration: number, volume: number): void {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "triangle";
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(volume, start + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  osc.connect(gain).connect(ctx.destination);
  osc.start(start);
  osc.stop(start + duration + 0.05);
}

/** Tre colpi brevi e uno lungo, più grave. */
export function playEndSound(): void {
  if (!audio) return;
  try {
    if (audio.state === "suspended") void audio.resume();
    const t = audio.currentTime + 0.05;
    [0, 0.22, 0.44].forEach((d) => tone(audio!, 784, t + d, 0.16, 0.3));
    tone(audio, 523, t + 0.7, 0.7, 0.35);
  } catch {
    /* audio non disponibile */
  }
}

/** Breve conferma quando si attiva il suono. */
export function playPreview(): void {
  if (!audio) return;
  try {
    tone(audio, 784, audio.currentTime + 0.03, 0.15, 0.2);
  } catch {
    /* audio non disponibile */
  }
}

// ---------- Schermo acceso (Wake Lock) ----------

let sentinel: WakeLockSentinel | null = null;
let pending = false;
let wanted = false;

async function acquire(): Promise<void> {
  if (!("wakeLock" in navigator) || sentinel || pending || document.visibilityState !== "visible") return;
  pending = true;
  try {
    const s = await navigator.wakeLock.request("screen");
    s.addEventListener("release", () => {
      if (sentinel === s) sentinel = null;
    });
    if (wanted) sentinel = s;
    else void s.release();
  } catch {
    /* rifiutato (batteria scarica, permessi…): il gioco continua */
  } finally {
    pending = false;
  }
}

/** Tiene acceso lo schermo durante il turno. */
export function keepScreenOn(): void {
  wanted = true;
  void acquire();
}

export function allowScreenOff(): void {
  wanted = false;
  const s = sentinel;
  sentinel = null;
  if (s) void s.release().catch(() => {});
}

// Il browser rilascia il blocco quando la pagina va in secondo piano: al ritorno lo si richiede.
document.addEventListener("visibilitychange", () => {
  if (wanted && document.visibilityState === "visible") void acquire();
});
