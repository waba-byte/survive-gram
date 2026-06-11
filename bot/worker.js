/* Survive Gram — webhook del bot Telegram (Cloudflare Worker, gratis, nessun server).
 *
 * Risponde a /start con il messaggio di benvenuto + un pulsante che apre la Mini App.
 * Il token del bot NON va nel codice: si imposta come variabile/segreto "BOT_TOKEN" del Worker.
 *
 * Setup completo in bot/SETUP.md
 */

const GAME_URL = "https://waba-byte.github.io/survive-gram/";
const INTRO_IMG = "https://waba-byte.github.io/survive-gram/bot-intro.png";

const WELCOME =
`🟪 WELCOME TO SURVIVE GRAM ⚡

Here's the deal. A 10×10 grid. You tap one cell — then a laser rips across the board. Horizontal this round, vertical the next. Keep guessing.

Dodge it and the line you survived vanishes. The grid tightens. Your multiplier claws upward — toward a brutal 96.0×. 💀

CASH OUT anytime and the winnings are yours. Stay greedy and the laser finds you: a neon cat flashes up, grinning, laughing in the dark.

Wins minus losses go on the leaderboard. It can go negative. Most nights, it does.

Pick your skin. Mind the scanlines. Tap a cell. 🐈‍⬛`;

export default {
  async fetch(request, env) {
    // GET nel browser -> health check; Telegram chiama in POST.
    if (request.method !== "POST") {
      return new Response("Survive Gram bot is alive. ⚡", { headers: { "content-type": "text/plain; charset=utf-8" } });
    }
    if (!env.BOT_TOKEN) return new Response("missing BOT_TOKEN", { status: 500 });

    let update;
    try { update = await request.json(); } catch (e) { return new Response("ok"); }

    const msg = update.message;
    if (msg && typeof msg.text === "string" && msg.text.startsWith("/start")) {
      await tg(env.BOT_TOKEN, "sendPhoto", {
        chat_id: msg.chat.id,
        photo: INTRO_IMG,
        caption: WELCOME,
        reply_markup: {
          inline_keyboard: [[ { text: "🎮 PLAY SURVIVE GRAM", web_app: { url: GAME_URL } } ]]
        }
      });
    }
    return new Response("ok");
  }
};

async function tg(token, method, body) {
  return fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
}
