import { CARDS, cardById, LEVEL_LABELS, LEVELS, type Level } from "../data/cards";
import { allowScreenOff, expireVibration, keepScreenOn, playEndSound, unlockAudio, warnVibration } from "../device/feedback";
import {
  backToSetup,
  cardPoints,
  changeOutcome,
  currentTeamIndex,
  DEFAULT_TARGET,
  defaultTeamName,
  expireTurn,
  MIN_TARGET,
  newSetup,
  nextTurn,
  normalizeTarget,
  PASS_PENALTY,
  rematch,
  resolveCard,
  restoreAfterReload,
  standings,
  startGame,
  startTurn,
  TABOO_PENALTY,
  TEAM_COUNTS,
  turnTotal,
  undoLast,
  type GameState,
  type LiveOutcome,
  type Outcome,
  type Play,
  type Settings,
} from "../game/game";
import { loadGame, saveGame } from "../game/storage";
import { elapsedFraction, remainingMs, secondsLeft, WARNING_SECONDS, startCountdown } from "../game/timer";
import { cardHTML } from "./card";
import { byId, esc } from "./dom";
import { isSoundOn, onSoundChange, setSound } from "./prefs";

/*
 * Sezione «Partita»: disegna la fase corrente e collega i pulsanti alla logica di gioco.
 * Ogni azione produce un nuovo stato, che viene salvato e ridisegnato.
 */

const RING = 226.2; // circonferenza dell'anello del timer (r = 36)
/** Dopo ogni carta i pulsanti ignorano i tocchi per un attimo: un doppio tocco non brucia la carta nuova. */
const TAP_GUARD_MS = 400;

const OUTCOME_LABELS: Record<Outcome, string> = {
  ok: "Indovinata",
  taboo: "Tabù",
  pass: "Passo",
  time: "Tempo scaduto",
};

let state: GameState;
let stopCountdown: (() => void) | null = null;
let main: HTMLElement;
let side: HTMLElement;
let tapGuardUntil = 0;

export function initGameView(): void {
  main = byId("gameMain");
  side = byId("gameSide");
  const saved = loadGame();
  onSoundChange((on) => {
    const box = document.getElementById("sS") as HTMLInputElement | null;
    if (box) box.checked = on;
  });
  const restored = saved ? restoreAfterReload(saved, Date.now()) : newSetup();
  if (restored.phase === "playing") keepScreenOn();
  update(restored);
}

function update(next: GameState): void {
  state = next;
  saveGame(state);
  render();
}

const team = () => state.teams[currentTeamIndex(state)];

/** Punteggio con il meno tipografico: −3, 0, 12. */
const num = (n: number): string => (n < 0 ? `−${-n}` : String(n));

/** Punti con il segno: +2, −1, 0. */
const signed = (n: number): string => (n > 0 ? `+${n}` : num(n));

function render(): void {
  stopCountdown?.();
  stopCountdown = null;
  main.dataset.phase = state.phase;
  switch (state.phase) {
    case "setup":
      return renderSetup();
    case "ready":
      return renderReady();
    case "playing":
      return renderPlaying();
    case "summary":
      return renderSummary();
    case "end":
      return renderEnd();
  }
}

function sideHTML(): string {
  return `<div class="panel"><h3>In breve</h3><ul class="mini-rules">
    <li>60 secondi a squadra: indovinate più carte possibile, poi il turno passa.</li>
    <li>Niente parole vietate, parti della parola, traduzioni, rime, gesti, titoli di opere, casi clinici o date.</li>
    <li>Vale solo la parola esatta della carta.</li>
    <li>Un avversario controlla la carta e preme <b>Tabù!</b></li>
    <li>+1 indovinata · ${signed(TABOO_PENALTY)} tabù · ${signed(PASS_PENALTY)} passo.</li></ul>
    <p class="note" style="margin:10px 0 0"><a href="#regole">Regolamento completo</a></p></div>`;
}

function scoresHTML(): string {
  const on = currentTeamIndex(state);
  return `<div class="scores">${state.teams
    .map(
      (t, i) =>
        `<div class="score${i === on && state.phase !== "end" ? " on" : ""}"><span>${esc(t.name)}</span><b>${num(t.score)}</b></div>`,
    )
    .join("")}</div>`;
}

// ---------- Impostazioni ----------

function renderSetup(): void {
  const s = state.settings;
  main.innerHTML = `<div class="panel setup">
      <div><h2>Nuova partita</h2><p class="lead" style="margin:0">Scegli squadre e livelli, poi passa il dispositivo al primo descrittore.</p></div>
      <label class="field" style="max-width:200px">Numero di squadre<select id="sN">${TEAM_COUNTS.map((n) => `<option ${n === s.nTeams ? "selected" : ""}>${n}</option>`).join("")}</select></label>
      <div class="teams">${Array.from({ length: s.nTeams }, (_, i) => `<label class="field">Squadra ${i + 1}<input type="text" id="sT${i}" value="${esc(s.names[i] || defaultTeamName(i))}" maxlength="24"></label>`).join("")}</div>
      <div><div class="field" style="margin-bottom:6px">Livelli nel mazzo</div><div class="row">
        ${LEVELS.map((l) => `<label class="chip l${l}"><input type="checkbox" id="sL${l}" ${s.levels.includes(l) ? "checked" : ""}> ${LEVEL_LABELS[l]} <span class="note">(${CARDS.filter((c) => c.livello === l).length})</span></label>`).join("")}</div></div>
      <div class="row" style="align-items:end">
        <label class="field" style="width:160px">Punti per vincere<input type="number" id="sP" min="${MIN_TARGET}" max="200" value="${s.target}" placeholder="${DEFAULT_TARGET}"></label>
        <label class="chip"><input type="checkbox" id="sW" ${s.weighted ? "checked" : ""}> Punteggio pesato (1 · 2 · 3)</label>
        <label class="chip"><input type="checkbox" id="sS" ${isSoundOn() ? "checked" : ""}> Suono a fine tempo</label>
      </div>
      <p class="note" id="sErr" hidden>Seleziona almeno un livello di difficoltà.</p>
      <div><button class="btn-primary btn-big" id="sGo">Inizia la partita</button></div>
    </div>`;
  side.innerHTML = cardHTML(CARDS[1], true) + sideHTML();

  byId<HTMLSelectElement>("sN").onchange = (e) => {
    const nTeams = Number((e.target as HTMLSelectElement).value);
    update({ ...state, settings: { ...readSetupForm(), nTeams } });
  };
  byId<HTMLInputElement>("sS").onchange = (e) => setSound((e.target as HTMLInputElement).checked);
  byId("sGo").onclick = () => {
    const settings = readSetupForm();
    if (!settings.levels.length) {
      byId("sErr").hidden = false;
      return;
    }
    update(startGame(settings, CARDS));
  };
}

/** Legge il modulo; un nome lasciato vuoto conserva quello precedente. */
function readSetupForm(): Settings {
  const s = state.settings;
  const names = s.names.map((n, i) => {
    const el = document.getElementById(`sT${i}`) as HTMLInputElement | null;
    return el ? el.value.trim() || n : n;
  });
  const levels = LEVELS.filter((l) => byId<HTMLInputElement>(`sL${l}`).checked) as Level[];
  return {
    nTeams: s.nTeams,
    names,
    levels,
    target: normalizeTarget(Number(byId<HTMLInputElement>("sP").value)),
    weighted: byId<HTMLInputElement>("sW").checked,
  };
}

// ---------- Prima del turno ----------

function renderReady(): void {
  main.innerHTML =
    scoresHTML() +
    `<div class="stage">
      <div class="turnline"><div><div class="eyebrow">Turno ${state.turn + 1} · tocca a</div><strong>${esc(team().name)}</strong></div><span class="note">${state.deck.length} carte nel mazzo</span></div>
      <div class="cover"><h3>Passa il dispositivo al descrittore</h3>
        <p>Accanto a lui un controllore della squadra avversaria. Avete 60 secondi per indovinare più carte possibile: il tempo parte appena compare la prima.</p>
        <button class="btn-primary btn-big" id="gShow">Inizia il turno · 60 s</button></div>
      <div class="row"><button id="gReset">Nuova partita</button></div></div>`;
  side.innerHTML = sideHTML();
  byId("gShow").onclick = () => {
    unlockAudio(); // dentro il clic: poi il suono di fine tempo potrà partire da solo
    keepScreenOn();
    tapGuardUntil = performance.now() + TAP_GUARD_MS;
    update(startTurn(state, Date.now()));
    // Porta in vista punteggi, timer, carta e pulsanti: durante il turno non c'è tempo per scorrere.
    main.scrollIntoView({ block: "start", behavior: "instant" });
  };
  byId("gReset").onclick = confirmReset;
}

// ---------- Turno in corso ----------

function renderPlaying(): void {
  const c = cardById(state.cardId!);
  const weighted = state.settings.weighted;
  const total = turnTotal(state);
  const last = state.plays[state.plays.length - 1];
  const left = remainingMs(state.endAt!, Date.now());
  main.innerHTML =
    scoresHTML() +
    `<div class="stage">
      <div class="turnline"><div><div class="eyebrow">Descrive</div><strong>${esc(team().name)}</strong></div>
        <div class="tally${total < 0 ? " neg" : ""}" aria-live="polite"><span class="eyebrow">Questo turno</span><b>${signed(total)}</b></div>
        <div class="timer" id="tm"><svg viewBox="0 0 84 84"><circle class="ring-bg" cx="42" cy="42" r="36"/><circle class="ring" id="ring" cx="42" cy="42" r="36" stroke-dasharray="${RING}" stroke-dashoffset="${(RING * elapsedFraction(left)).toFixed(1)}"/></svg><span class="num" id="tnum">${secondsLeft(left)}</span></div></div>
      ${cardHTML(c, true)}
      <div class="actions">
        <button class="btn-ok btn-big" data-r="ok">Indovinata <small>${signed(cardPoints(c, weighted))}</small></button>
        <button class="btn-bad btn-big" data-r="taboo">Tabù! <small>${signed(TABOO_PENALTY)}</small></button>
        <button class="btn-big" data-r="pass">Passo${PASS_PENALTY ? ` <small>${signed(PASS_PENALTY)}</small>` : ""}</button>
      </div>
      <div class="lastplay">
        <button id="gUndo" ${last ? "" : "disabled"}>Annulla l'ultima</button>
        <span class="note">${last ? `${playBadge(last)} ${esc(cardById(last.cardId).parola)}` : "Nessuna carta ancora giocata in questo turno."}</span>
      </div></div>`;
  side.innerHTML = turnListHTML() + sideHTML();
  main.querySelectorAll<HTMLButtonElement>("[data-r]").forEach((b) => (b.onclick = () => resolve(b.dataset.r as LiveOutcome)));
  byId("gUndo").onclick = () => {
    if (performance.now() < tapGuardUntil) return;
    tapGuardUntil = performance.now() + TAP_GUARD_MS;
    update(undoLast(state));
  };

  const numEl = byId("tnum");
  const ring = byId("ring");
  const box = byId("tm");
  stopCountdown = startCountdown(state.endAt!, {
    onTick: (ms) => {
      const s = secondsLeft(ms);
      numEl.textContent = String(s);
      ring.setAttribute("stroke-dashoffset", (RING * elapsedFraction(ms)).toFixed(1));
      box.classList.toggle("low", s <= WARNING_SECONDS);
    },
    onWarning: warnVibration,
    onExpire: () => {
      expireVibration();
      if (isSoundOn()) playEndSound();
      allowScreenOff();
      update(expireTurn(state));
    },
  });
}

function resolve(outcome: LiveOutcome): void {
  if (state.phase !== "playing" || performance.now() < tapGuardUntil) return;
  tapGuardUntil = performance.now() + TAP_GUARD_MS;
  const next = resolveCard(state, outcome, Date.now());
  if (next.phase !== "playing") allowScreenOff();
  update(next);
}

function playBadge(p: Play): string {
  const kind = p.delta > 0 ? "ok" : p.delta < 0 ? "bad" : "neutral";
  return `<span class="badge ${kind}">${OUTCOME_LABELS[p.outcome]} ${signed(p.delta)}</span>`;
}

/** Elenco delle carte già giocate nel turno, per la colonna laterale. */
function turnListHTML(): string {
  if (!state.plays.length) return "";
  return `<div class="panel"><h3>Carte di questo turno</h3><ol class="turnlist">${state.plays
    .map((p) => `<li><span>${esc(cardById(p.cardId).parola)}</span>${playBadge(p)}</li>`)
    .join("")}</ol></div>`;
}

// ---------- Riepilogo del turno ----------

function renderSummary(): void {
  const total = turnTotal(state);
  const name = esc(team().name);
  const guessed = state.plays.filter((p) => p.outcome === "ok").length;
  const kind = total > 0 ? "ok" : total < 0 ? "bad" : "neutral";
  main.innerHTML =
    scoresHTML() +
    `<div class="stage">
      <div class="verdict ${kind}"><div class="eyebrow">Fine del turno</div>${name}: ${signed(total)} ${Math.abs(total) === 1 ? "punto" : "punti"} · ${guessed} ${guessed === 1 ? "carta indovinata" : "carte indovinate"}</div>
      <ol class="plays">${state.plays.map(playRowHTML).join("")}</ol>
      <p class="note" style="margin:0">Un esito è sbagliato? Correggetelo qui prima di passare il turno. Le carte passate o rimaste in mano allo scadere tornano in fondo al mazzo.</p>
      <div class="row"><button class="btn-primary btn-big" id="gNext">Turno successivo</button></div></div>`;
  side.innerHTML = sideHTML();
  main.querySelectorAll<HTMLSelectElement>("select[data-i]").forEach(
    (sel) => (sel.onchange = () => update(changeOutcome(state, Number(sel.dataset.i), sel.value as Outcome))),
  );
  byId("gNext").onclick = () => update(nextTurn(state));
}

function playRowHTML(p: Play, i: number): string {
  const c = cardById(p.cardId);
  const options = (Object.keys(OUTCOME_LABELS) as Outcome[])
    .map((o) => `<option value="${o}" ${o === p.outcome ? "selected" : ""}>${OUTCOME_LABELS[o]}</option>`)
    .join("");
  return `<li class="play l${c.livello} ${p.outcome}">
    <div class="play-head"><span class="dot"></span><strong>${esc(c.parola)}</strong><b class="pts">${signed(p.delta)}</b></div>
    <label class="play-outcome"><span class="sr-only">Esito di «${esc(c.parola)}»</span><select data-i="${i}">${options}</select></label>
    <details><summary>Per approfondire · vietate: ${c.vietate.map(esc).join(" – ")}</summary><p>${esc(c.spiegazione)}</p></details>
  </li>`;
}

// ---------- Fine partita ----------

function renderEnd(): void {
  const { max, leaders } = standings(state);
  const tie = leaders.length > 1;
  main.innerHTML =
    scoresHTML() +
    `<div class="panel winner"><div class="eyebrow">Fine partita · ${state.turn} ${state.turn === 1 ? "turno giocato" : "turni giocati"}</div>
      <strong>${tie ? "Pareggio" : "Vince " + esc(leaders[0].name)}</strong>
      <p class="note">${tie ? leaders.map((t) => esc(t.name)).join(" e ") + " a " + num(max) + " punti" : num(max) + " punti"}</p>
      <div class="row" style="justify-content:center;margin-top:14px"><button class="btn-primary btn-big" id="gAgain">Rivincita</button><button id="gReset">Cambia impostazioni</button></div></div>`;
  side.innerHTML = sideHTML();
  byId("gAgain").onclick = () => update(rematch(state, CARDS));
  byId("gReset").onclick = () => update(backToSetup(state));
}

/** «Nuova partita» a gioco iniziato chiede conferma: un tocco sbagliato non cancella i punteggi. */
function confirmReset(): void {
  if (state.turn > 0 && !confirm("Interrompere la partita in corso? I punteggi andranno persi.")) return;
  update(backToSetup(state));
}
