# Messaggio su /start — webhook del bot (Cloudflare Worker, gratis)

Il messaggio di benvenuto su `/start` **non** è un campo di BotFather: lo deve inviare il bot.
Questo Worker lo fa, senza server da mantenere. ~5 minuti, gratis.

## 1) Crea il Worker
1. Vai su https://dash.cloudflare.com → **Workers & Pages** → **Create application** → **Create Worker**.
2. Dagli un nome (es. `survive-gram-bot`) → **Deploy**.
3. **Edit code** → cancella tutto e incolla il contenuto di [`worker.js`](worker.js) → **Deploy**.
4. Segnati l'URL del Worker, tipo: `https://survive-gram-bot.TUONOME.workers.dev`

## 2) Imposta il token del bot (segreto)
1. Nel Worker → **Settings** → **Variables and Secrets**.
2. **Add** → nome **`BOT_TOKEN`** → valore = il token che ti ha dato @BotFather (es. `123456:ABC-...`) → salva.
   - Usa "Encrypt"/Secret se disponibile. **Non** mettere il token dentro `worker.js`.
3. Re-deploy se richiesto.

## 3) Collega il webhook a Telegram
Apri questo indirizzo nel browser (sostituendo `<TOKEN>` e `<WORKER_URL>`):

```
https://api.telegram.org/bot<TOKEN>/setWebhook?url=<WORKER_URL>
```

Esempio:
```
https://api.telegram.org/bot123456:ABC-DEF/setWebhook?url=https://survive-gram-bot.tuonome.workers.dev
```
Deve rispondere `{"ok":true, ... "description":"Webhook was set"}`.

## 4) (consigliato) Pulsante menu = apri il gioco
Su @BotFather: `/mybots` → bot → **Bot Settings → Menu Button** → imposta l'URL:
```
https://waba-byte.github.io/survive-gram/
```

## 5) Prova
Apri il bot su Telegram → premi **START** (o invia `/start`):
ricevi il messaggio di benvenuto con il pulsante **🎮 PLAY SURVIVE GRAM** che apre il gioco.

---

### Modificare il messaggio
Edita la costante `WELCOME` in `worker.js` e ri-deploya il Worker.

### Verifica / problemi
- Stato webhook: `https://api.telegram.org/bot<TOKEN>/getWebhookInfo`
- Aprendo l'URL del Worker nel browser deve dire "Survive Gram bot is alive."
- Se non risponde: controlla che `BOT_TOKEN` sia impostato e che `setWebhook` abbia dato `ok:true`.

### Nota sicurezza
Se il token è mai finito in chiaro da qualche parte, rigeneralo con @BotFather (`/revoke`) e riaggiorna `BOT_TOKEN` + `setWebhook`.
