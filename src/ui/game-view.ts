import { CARDS, cardById, LEVEL_LABELS, LEVELS, type Level } from "../data/cards";
import { allowScreenOff, expireVibration, keepScreenOn, playEndSound, unlockAudio, warnVibration } from "../device/feedback";
import {
  backToSetup,
  cardPoints,
  currentTeamIndex,
  defaultTeamName,
  newSetup,
  nextTurn,
  normalizeTarget,
  rematch,
  resolveCard,
  restoreAfterReload,
  showCard,
  standings,
  startGame,
  TEAM_COUNTS,
  undoResult,
  type GameState,
  type Outcome,
  type Settings,
} from "../game/game";
import { loadGame, saveGame } from "../game/storage";
import { elapsedFraction, secondsLeft, TURN_MS, WARNING_SECONDS, startCountdown } from "../game/timer";
import { cardHTML } from "./card";
import { byId, esc } from "./dom";
import { isSoundOn, onSoundChange, setSound } from "./prefs";

/*
 * Sezione «Partita»: disegna la fase corrente e collega i pulsanti alla logica di gioco.
 * Ogni azione produce un nuovo stato, che viene salvato e ridisegnato.
 */

const RING = 226.2; // circonferenza dell'anello del timer (r = 36)

let state: GameState;
let stopCountdown: (() => void) | null = null;
let main: HTMLElement;
let side: HTMLElement;

export function initGameView(): void {
  main = byId("gameMain");
  side = byId("gameSide");
  const saved = loadGame();
  onSoundChange((on) => {
    const box = document.getElementById("sS") as HTMLInputElement | null;
    if (box) box.checked = on;
  });
  update(saved ? restoreAfterReload(saved) : newSetup());
}

function update(next: GameState): void {
  state = next;
  saveGame(state);
  render();
}

const team = () => state.teams[currentTeamIndex(state)];
const currentCard = () => cardById(state.cardId!);

function render(): void {
  stopCountdown?.();
  stopCountdown = null;
  switch (state.phase) {
    case "setup":
      return renderSetup();
    case "ready":
      return renderReady();
    case "playing":
      return renderPlaying();
    case "result":
      return renderResult();
    case "end":
      return renderEnd();
  }
}

function sideHTML(): string {
  return `<div class="panel"><h3>In breve</h3><ul class="mini-rules">
    <li>60 secondi per carta, un turno a testa.</li>
    <li>Niente parole vietate, parti della parola, traduzioni, rime o gesti.</li>
    <li>Un avversario controlla la carta e preme <b>Tabù!</b></li>
    <li>+1 indovinata · −1 tabù · 0 passo o tempo scaduto.</li></ul>
    <p class="note" style="margin:10px 0 0"><a href="#regole">Regolamento completo</a></p></div>`;
}

function scoresHTML(): string {
  const on = currentTeamIndex(state);
  return `<div class="scores">${state.teams
    .map(
      (t, i) =>
        `<div class="score${i === on && state.phase !== "end" ? " on" : ""}"><span>${esc(t.name)}</span><b>${t.score}</b></div>`,
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
        <label class="field" style="width:160px">Punti per vincere<input type="number" id="sP" min="3" max="60" value="${s.target}"></label>
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

// ---------- Prima della carta ----------

function renderReady(): void {
  main.innerHTML =
    scoresHTML() +
    `<div class="stage">
      <div class="turnline"><div><div class="eyebrow">Turno ${state.turn + 1} · tocca a</div><strong>${esc(team().name)}</strong></div><span class="note">${state.deck.length} carte nel mazzo</span></div>
      <div class="cover"><h3>Passa il dispositivo al descrittore</h3>
        <p>Guardano la carta solo il descrittore e il controllore della squadra avversaria. Il tempo parte appena la carta compare.</p>
        <button class="btn-primary btn-big" id="gShow">Mostra la carta · 60 s</button></div>
      <div class="row"><button id="gReset">Nuova partita</button></div></div>`;
  side.innerHTML = sideHTML();
  byId("gShow").onclick = () => {
    unlockAudio(); // dentro il clic: poi il suono di fine tempo potrà partire da solo
    keepScreenOn();
    update(showCard(state, Date.now()));
    // Sul telefono porta in vista punteggi, timer, carta e pulsanti.
    if (matchMedia("(max-width: 820px)").matches) main.scrollIntoView({ block: "start", behavior: "instant" });
  };
  byId("gReset").onclick = confirmReset;
}

// ---------- Turno in corso ----------

function renderPlaying(): void {
  const c = currentCard();
  main.innerHTML =
    scoresHTML() +
    `<div class="stage">
      <div class="turnline"><div><div class="eyebrow">Descrive</div><strong>${esc(team().name)}</strong></div>
        <div class="timer" id="tm"><svg viewBox="0 0 84 84"><circle class="ring-bg" cx="42" cy="42" r="36"/><circle class="ring" id="ring" cx="42" cy="42" r="36" stroke-dasharray="${RING}" stroke-dashoffset="0"/></svg><span class="num" id="tnum">${TURN_MS / 1000}</span></div></div>
      ${cardHTML(c, true)}
      <div class="actions">
        <button class="btn-ok btn-big" data-r="ok">Indovinata</button>
        <button class="btn-bad btn-big" data-r="taboo">Tabù!</button>
        <button class="btn-big" data-r="pass">Passo</button>
      </div></div>`;
  side.innerHTML =
    `<div class="panel"><h3>Valore della carta</h3><p class="note" style="margin:0">Indovinata: <b>+${cardPoints(c, state.settings.weighted)}</b> · Tabù: <b>−1</b> · Passo o tempo scaduto: <b>0</b></p></div>` +
    sideHTML();
  main.querySelectorAll<HTMLButtonElement>("[data-r]").forEach((b) => (b.onclick = () => resolve(b.dataset.r as Outcome)));

  const num = byId("tnum");
  const ring = byId("ring");
  const box = byId("tm");
  stopCountdown = startCountdown(state.endAt!, {
    onTick: (ms) => {
      const s = secondsLeft(ms);
      num.textContent = String(s);
      ring.setAttribute("stroke-dashoffset", (RING * elapsedFraction(ms)).toFixed(1));
      box.classList.toggle("low", s <= WARNING_SECONDS);
    },
    onWarning: warnVibration,
    onExpire: () => {
      expireVibration();
      if (isSoundOn()) playEndSound();
      resolve("time");
    },
  });
}

function resolve(outcome: Outcome): void {
  if (state.phase !== "playing") return;
  allowScreenOff();
  update(resolveCard(state, outcome, Date.now()));
}

// ---------- Esito ----------

function renderResult(): void {
  const c = currentCard();
  const r = state.last!;
  const name = esc(state.teams[r.teamIndex].name);
  const verdict: Record<Outcome, [string, string]> = {
    ok: ["ok", `Indovinata! +${r.delta} a ${name}`],
    taboo: ["bad", `Tabù! −1 a ${name}`],
    pass: ["neutral", "Passo: nessun punto"],
    time: ["neutral", "Tempo scaduto: nessun punto"],
  };
  const [kind, text] = verdict[r.outcome];
  main.innerHTML =
    scoresHTML() +
    `<div class="stage">
      <div class="verdict ${kind}">${text}</div>
      <div class="explain"><div class="eyebrow">Per approfondire · carta ${c.id} · ${esc(c.area)}</div><h3 style="font-family:var(--f-display);font-weight:400;font-size:1.5rem;margin:4px 0 0">${esc(c.parola)}</h3><p>${esc(c.spiegazione)}</p></div>
      <div class="row"><button class="btn-primary btn-big" id="gNext">Turno successivo</button><button id="gUndo">Annulla esito</button></div></div>`;
  side.innerHTML = cardHTML(c) + sideHTML();
  byId("gNext").onclick = () => update(nextTurn(state));
  byId("gUndo").onclick = () => {
    keepScreenOn();
    update(undoResult(state, Date.now()));
  };
}

// ---------- Fine partita ----------

function renderEnd(): void {
  const { max, leaders } = standings(state);
  const tie = leaders.length > 1;
  main.innerHTML =
    scoresHTML() +
    `<div class="panel winner"><div class="eyebrow">Fine partita · ${state.turn} carte giocate</div>
      <strong>${tie ? "Pareggio" : "Vince " + esc(leaders[0].name)}</strong>
      <p class="note">${tie ? leaders.map((t) => esc(t.name)).join(" e ") + " a " + max + " punti" : max + " punti"}</p>
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
