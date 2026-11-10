# Il Gioco del Rimosso

Il gioco delle parole proibite della psicoanalisi: 100 carte su concetti, autori e meccanismi di difesa, con partita a squadre
e timer da 60 secondi, regolamento e soluzioni commentate. È una webapp statica, senza login né
backend. Si installa sul telefono come app (PWA) e funziona anche offline.

## Requisiti

- Node.js 22.12 o successivo, con npm

## Avviare l'app in locale

```bash
npm install
```

```bash
npm run dev
```

Apri l'indirizzo che compare nel terminale (di solito http://localhost:5173). Le modifiche al codice
si vedono subito.

Per provare la versione di produzione, con il service worker e il funzionamento offline:

```bash
npm run build
```

```bash
npm run preview
```

## Lanciare i test

```bash
npm test
```

I test (Vitest) coprono la logica di gioco: punteggio normale e pesato, fine partita solo a giro
completo, pareggio, annullamento dell'esito, timer, salvataggio e i conteggi del mazzo (100 carte:
30 facili, 40 intermedie, 30 difficili). Con `npm run test:watch` i test ripartono a ogni modifica.

## Pubblicare su GitHub Pages

La pubblicazione è automatica: a ogni push sul branch `main` la GitHub Action
[`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) lancia i test, costruisce l'app e la
pubblica. Se un test fallisce, non pubblica nulla.

La prima volta:

1. Crea un repository vuoto su GitHub, per esempio `il-gioco-del-rimosso`.
2. Collega questa cartella al repository e invia il codice:

   ```bash
   git remote add origin https://github.com/<utente>/il-gioco-del-rimosso.git
   ```

   ```bash
   git push -u origin main
   ```

3. Su GitHub, in **Settings → Pages**, alla voce **Source** scegli **GitHub Actions**.
4. Se la prima pubblicazione era partita prima di questa impostazione ed è fallita, rilanciala da
   **Actions → Pubblica su GitHub Pages → Run workflow**.

L'app sarà su `https://<utente>.github.io/<nome-repo>/`. Il percorso viene ricavato dal nome del
repository, quindi rinominarlo non richiede modifiche al codice. Fa eccezione il sito personale
(`<utente>.github.io`), servito dalla radice: in quel caso, in `deploy.yml`, imposta `BASE_PATH: /`.

## Struttura

```
index.html               intestazione, schede e Regolamento
public/icon.svg          icona (una carta stilizzata): da qui la build genera tutte le icone PNG
src/
  main.ts                avvio dell'app
  data/
    cards.json           le 100 carte: id, parola, vietate, livello (1–3), area, spiegazione
    cards.ts, areas.ts   tipi, etichette dei livelli, ordine delle aree
  game/                  logica pura, senza accesso alla pagina (testata)
    deck.ts              mazzo e mescolamento
    game.ts              turni, punteggio, fine partita, pareggio, annullamento
    timer.ts             conto alla rovescia, avviso a 10 secondi
    storage.ts           salvataggio nel browser
  ui/                    disegno delle quattro sezioni, tema, preferenze
  device/feedback.ts     vibrazione, suono di fine tempo, schermo acceso
  styles/                CSS originale (main.css), aggiunte (app.css), font locali
vite.config.ts           build, PWA (manifest e service worker), test
pwa-assets.config.ts     icone generate
```

### Modificare le carte

Le carte sono in [`src/data/cards.json`](src/data/cards.json). Dopo una modifica lancia `npm test`:
un test controlla che ci siano 100 carte con la divisione 30/40/30, quattro o cinque parole vietate
per carta e solo le otto aree previste. Controlla anche una regola del gioco: tra le parole vietate
c'è sempre l'autore del concetto (Freud, Klein, Winnicott…), tranne nelle carte che sono esse stesse
autori. Se cambi apposta la composizione del mazzo, aggiorna anche quel test
([`src/data/cards.test.ts`](src/data/cards.test.ts)).

## Sul telefono

- **Installazione.** Android (Chrome): menu ⋮ → *Installa app*. iPhone (Safari): *Condividi →
  Aggiungi alla schermata Home*. Dopo la prima apertura il gioco funziona anche senza connessione.
- **Vibrazione** breve a 10 secondi dalla fine e allo scadere del tempo, sui dispositivi che la
  supportano (Android sì, iPhone no).
- **Suono di fine tempo**: si attiva e disattiva con l'icona dell'altoparlante in alto a destra,
  oppure dalla schermata «Nuova partita». Su iPhone con la suoneria in silenzioso non si sente.
- **Schermo acceso** durante il turno (Wake Lock), dove il browser lo consente.
- **Tema** automatico, chiaro o scuro: si cambia con l'icona in alto a destra.
- **Salvataggio**: la partita in corso resta nel browser di quel dispositivo. Se si ricarica la
  pagina durante un turno, la carta torna in fondo al mazzo e si riparte da «Mostra la carta».
- **Aggiornamenti**: dopo una nuova pubblicazione, l'app installata si aggiorna da sola e mostra la
  nuova versione all'apertura successiva.

## Licenza

© 2026 Alessandro Linardi. Il Gioco del Rimosso (codice, carte e testi) è distribuito con licenza
[Creative Commons Attribuzione – Non commerciale – Condividi allo stesso modo 4.0 Internazionale](https://creativecommons.org/licenses/by-nc-sa/4.0/deed.it)
(CC BY-NC-SA 4.0); il testo completo è in [LICENSE](LICENSE).

In breve: chiunque può usare, copiare e modificare il gioco **senza scopi commerciali**, a patto di
citare l'autore e di distribuire le versioni modificate con la stessa licenza. Ogni uso commerciale
richiede il permesso dell'autore.

I font Gloock, Instrument Sans e JetBrains Mono non rientrano in questa licenza: sono inclusi tramite
i pacchetti `@fontsource` (licenza SIL Open Font License) e serviti dall'app stessa, non da Google
Fonts.
