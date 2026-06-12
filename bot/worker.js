/* Survive Gram — bot Telegram + pagamenti Telegram Stars (Cloudflare Worker, gratis).
 *
 *  GET  /invoice?amt=N   -> crea un invoice in Stars (N = crediti, multipli di 25) e ritorna il link
 *                          (chiamato dalla Mini App, con CORS). La Mini App apre il pagamento con
 *                          Telegram.WebApp.openInvoice(link).
 *  POST  (webhook)       -> /start (foto+PLAY), pre_checkout_query (ok), successful_payment (conferma).
 *
 * Il token del bot NON va nel codice: si imposta come secret "BOT_TOKEN" del Worker. Setup in bot/SETUP.md
 */

const GAME_URL  = "https://waba-byte.github.io/survive-gram/";
const INTRO_IMG = "https://waba-byte.github.io/survive-gram/bot-intro.png";
const MIN_STARS = 25, MAX_STARS = 2500, STEP = 25;   // puntata/crediti: min 25, multipli di 25

const WELCOME =
`🟪 WELCOME TO SURVIVE GRAM ⚡

Here's the deal. A 10×10 grid. You tap one cell — then a laser rips across the board. Horizontal this round, vertical the next. Keep guessing.

Dodge it and the line you survived vanishes. The grid tightens. Your multiplier claws upward — toward a brutal 96.0×. 💀

CASH OUT anytime and the winnings are yours. Stay greedy and the laser finds you: a neon cat flashes up, grinning, laughing in the dark.

Wins minus losses go on the leaderboard. It can go negative. Most nights, it does.

Pick your skin. Mind the scanlines. Tap a cell. 🐈‍⬛`;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // ---- CORS preflight (per la fetch cross-origin dalla Mini App) ----
    if (request.method === "OPTIONS") return cors(new Response(null, { status: 204 }));

    // ---- /invoice : crea il link di pagamento in Stars (chiamato dalla Mini App) ----
    if (url.pathname.replace(/\/$/, "") === "/invoice") {
      if (!env.BOT_TOKEN) return cors(json({ ok: false, error: "missing BOT_TOKEN" }, 500));
      const amt = parseInt(url.searchParams.get("amt") || "0", 10);
      if (!(amt >= MIN_STARS && amt <= MAX_STARS && amt % STEP === 0))
        return cors(json({ ok: false, error: "amt deve essere multiplo di " + STEP + " (" + MIN_STARS + ".." + MAX_STARS + ")" }, 400));
      const r = await tg(env.BOT_TOKEN, "createInvoiceLink", {
        title: "Survive Gram — CHAD",
        description: amt + " crediti per giocare in modalità CHAD ⭐",
        payload: "chad_credits_" + amt + "_" + Date.now(),
        provider_token: "",            // vuoto = pagamento in Telegram Stars
        currency: "XTR",
        prices: [{ label: amt + " crediti", amount: amt }]
      });
      const data = await r.json();
      if (!data.ok) return cors(json({ ok: false, error: data.description || "invoice error" }, 502));
      return cors(json({ ok: true, link: data.result, amount: amt }));
    }

    // ---- /setwebhook : registra il webhook del bot su questo Worker (usa BOT_TOKEN gia' presente) ----
    if (url.pathname.replace(/\/$/, "") === "/setwebhook") {
      if (!env.BOT_TOKEN) return json({ ok: false, error: "missing BOT_TOKEN" }, 500);
      const set = await (await tg(env.BOT_TOKEN, "setWebhook", { url: url.origin, allowed_updates: ["message", "pre_checkout_query"] })).json();
      const info = await (await tg(env.BOT_TOKEN, "getWebhookInfo", {})).json();
      return json({ setWebhook: set, info: info.result });
    }

    // ---- health check (GET nel browser) ----
    if (request.method !== "POST")
      return new Response("Survive Gram bot is alive. ⚡", { headers: { "content-type": "text/plain; charset=utf-8" } });

    // ---- webhook Telegram (POST) ----
    if (!env.BOT_TOKEN) return new Response("missing BOT_TOKEN", { status: 500 });
    let update; try { update = await request.json(); } catch (e) { return new Response("ok"); }

    // 1) pre-checkout: va confermato entro pochi secondi, altrimenti il pagamento fallisce
    if (update.pre_checkout_query) {
      await tg(env.BOT_TOKEN, "answerPreCheckoutQuery", { pre_checkout_query_id: update.pre_checkout_query.id, ok: true });
      return new Response("ok");
    }

    const msg = update.message;

    // 2) pagamento riuscito -> conferma in chat (i crediti vengono accreditati nella Mini App)
    if (msg && msg.successful_payment) {
      const sp = msg.successful_payment;
      await tg(env.BOT_TOKEN, "sendMessage", {
        chat_id: msg.chat.id,
        text: "✅ Pagamento ricevuto: " + sp.total_amount + " ⭐ → " + sp.total_amount + " crediti CHAD accreditati. Buona fortuna! 🐈‍⬛"
      });
      return new Response("ok");
    }

    // 3) /start
    if (msg && typeof msg.text === "string" && msg.text.startsWith("/start")) {
      await tg(env.BOT_TOKEN, "sendPhoto", {
        chat_id: msg.chat.id, photo: INTRO_IMG, caption: WELCOME,
        reply_markup: { inline_keyboard: [[ { text: "🎮 PLAY SURVIVE GRAM", web_app: { url: GAME_URL } } ]] }
      });
      return new Response("ok");
    }

    return new Response("ok");
  }
};

function cors(resp) {
  resp.headers.set("Access-Control-Allow-Origin", "*");
  resp.headers.set("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  resp.headers.set("Access-Control-Allow-Headers", "content-type");
  return resp;
}
function json(obj, status) {
  return new Response(JSON.stringify(obj), { status: status || 200, headers: { "content-type": "application/json" } });
}
async function tg(token, method, body) {
  return fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body)
  });
}
