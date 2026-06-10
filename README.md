# Survive Gram 🎯

Mini-gioco crash/risk in stile arcade: scegli una cella, schiva il **laser** (alterna riga/colonna), il moltiplicatore sale e la griglia si stringe da 10×10 fino a 1×1 (max **96.0×**). Se il laser ti colpisce → 🟣 game over con, in modo casuale, **gatto demoniaco** o **faccia neon di Durov** e risata malefica. Incassa col **CASH OUT**.

- **Zero dipendenze, zero backend**: art in **SVG/CSS coded** + audio sintetizzato via Web Audio. Uniche immagini: due piccole icone neon (logo header in blu + faccia game over in viola, ~30KB totali, sfondo trasparente).
- **Telegram Mini App ready**: integra `telegram-web-app.js` (haptics, tema, nome utente automatico, persistenza CloudStorage). Funziona identico anche fuori da Telegram.
- **Classifica** col netto (vincite − perdite, anche negativo), salvata in `localStorage` + CloudStorage.
- **Multilingua** (IT / EN / ES / FR / DE / PT / RU): si adatta alla lingua del dispositivo/Telegram, con selettore 🌐 poco invasivo nella schermata di gioco.
- Tema **viola morte** + **blu Telegram**, effetto **CRT** (scanline/vignetta/flicker), responsive mobile.

## File
- `index.html` — il gioco (griglia a tutto schermo).
- `classifica.html` — pagina classifica dedicata.
- `lb.js` — logica classifica condivisa tra le pagine (localStorage + Telegram CloudStorage).
- `i18n.js` — traduzioni e selettore lingua (7 lingue), rilevamento automatico.
- `durov-cartoon.svg` — avatar (usato come favicon; utile come icona del bot).
- `durov-neon-blue.png` — faccia neon blu (logo affianco al nome nell'header).
- `durov-neon-purple.png` — faccia neon viola (game over, alternata al gatto demoniaco).

## Avvio locale
```bash
python3 -m http.server 8777
# apri http://localhost:8777/
```

## Deploy su GitHub Pages
1. Push del repo su GitHub (vedi sotto).
2. Repo → **Settings → Pages** → *Build and deployment* → **Deploy from a branch** → Branch: `main` / `/ (root)` → **Save**.
3. Dopo ~1 min il gioco è online a:
   ```
   https://<utente>.github.io/<repo>/
   ```
   (es. `https://waba-byte.github.io/killed-gram/`)

## Collega il bot Telegram (BotFather) — Mini App, niente codice server
1. Su [@BotFather](https://t.me/BotFather): `/newbot` → scegli nome e username (se non l'hai già).
2. **Imposta la Web App come pulsante menu** (modo più semplice):
   - `/mybots` → seleziona il bot → **Bot Settings → Menu Button → Configure menu button**
   - Inserisci l'**URL di GitHub Pages** e l'etichetta (es. `Gioca`).
3. (Opzionale) Per un link diretto `t.me/<bot>/<app>`: `/newapp` → seleziona il bot → titolo, descrizione, **icona** (puoi caricare un PNG ricavato da `durov-cartoon.svg`, 640×360) e incolla l'URL di Pages.
4. Apri il bot su Telegram → tocca il pulsante menu → il gioco parte a tutto schermo. 🎮

## Note
- L'URL della Web App **deve essere HTTPS** → GitHub Pages lo fornisce di default.
- La classifica è **per-utente** (CloudStorage sincronizza tra i dispositivi del singolo utente). Per una **classifica condivisa** tra utenti diversi serve un piccolo backend (es. funzione serverless + DB) oppure la *Telegram Gaming API* (`setGameScore`): si può aggiungere in seguito.
