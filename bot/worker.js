/* Survive Gram — bot Telegram + pagamenti Stars + MISSIONI gestibili (Cloudflare Worker).
 *
 *  PUBBLICI (CORS, usati dalla Mini App):
 *    GET  /tasks            -> elenco missioni (da KV, o default)
 *    POST /claim            -> registra un completamento (valida la firma initData di Telegram)
 *  ADMIN (header  x-admin-key: <ADMIN_KEY>):
 *    GET  /admin            -> pannello (HTML) per gestire missioni + vedere i completamenti
 *    POST /admin/tasks      -> salva l'elenco missioni
 *    GET  /admin/completions-> statistiche: quanti/quali utenti hanno completato ogni missione
 *  ALTRO:
 *    GET  /invoice?amt=N    -> invoice Stars (CHAD, in pausa)
 *    GET  /setwebhook       -> registra il webhook
 *    POST /  (webhook)      -> /start, pre_checkout_query, successful_payment
 *
 *  Secrets del Worker: BOT_TOKEN (token bot) e ADMIN_KEY (password pannello).  KV: binding TASKS.
 */

const GAME_URL  = "https://waba-byte.github.io/survive-gram/";
const INTRO_IMG = "https://waba-byte.github.io/survive-gram/bot-intro.png";
const MIN_STARS = 25, MAX_STARS = 2500, STEP = 25;   // crediti/puntata: min 25, multipli di 25

const WELCOME =
`🟪 WELCOME TO SURVIVE GRAM ⚡

Here's the deal. A 10×10 grid. You tap one cell — then a laser rips across the board. Horizontal this round, vertical the next. Keep guessing.

Dodge it and the line you survived vanishes. The grid tightens. Your multiplier claws upward — toward a brutal 96.0×. 💀

CASH OUT anytime and the winnings are yours. Stay greedy and the laser finds you: a neon cat flashes up, grinning, laughing in the dark.

Wins minus losses go on the leaderboard. It can go negative. Most nights, it does.

Pick your skin. Mind the scanlines. Tap a cell. 🐈‍⬛`;

/* Missioni di default (finché l'admin non salva la sua versione su KV). */
const DEFAULT_TASKS = [
  { id:"play5",   type:"stat", icon:"🎮", stat:"games",    goal:5,  reward:100, enabled:true,
    title:{it:"Gioca 5 partite", en:"Play 5 games", es:"Juega 5 partidas", fr:"Joue 5 parties", de:"Spiele 5 Runden", pt:"Jogue 5 partidas", ru:"Сыграй 5 игр"},
    desc: {it:"Avvia e gioca 5 partite.", en:"Start and play 5 games.", es:"Inicia y juega 5 partidas.", fr:"Lance et joue 5 parties.", de:"Starte und spiele 5 Runden.", pt:"Inicie e jogue 5 partidas.", ru:"Начни и сыграй 5 игр."} },
  { id:"dodge25", type:"stat", icon:"🛡", stat:"dodges",   goal:25, reward:150, enabled:true,
    title:{it:"Schiva 25 laser", en:"Dodge 25 lasers", es:"Esquiva 25 láseres", fr:"Esquive 25 lasers", de:"Weiche 25 Lasern aus", pt:"Desvie de 25 lasers", ru:"Уклонись от 25 лазеров"},
    desc: {it:"Schiva 25 laser in totale.", en:"Dodge 25 lasers in total.", es:"Esquiva 25 láseres en total.", fr:"Esquive 25 lasers au total.", de:"Weiche insgesamt 25 Lasern aus.", pt:"Desvie de 25 lasers no total.", ru:"Уклонись от 25 лазеров всего."} },
  { id:"cash3",   type:"stat", icon:"💰", stat:"cashouts", goal:3,  reward:200, enabled:true,
    title:{it:"Incassa 3 volte", en:"Cash out 3 times", es:"Retira 3 veces", fr:"Encaisse 3 fois", de:"3-mal auszahlen", pt:"Saque 3 vezes", ru:"Забери выигрыш 3 раза"},
    desc: {it:"Fai CASH OUT 3 volte.", en:"Cash out 3 times.", es:"Haz CASH OUT 3 veces.", fr:"Fais CASH OUT 3 fois.", de:"Mach 3-mal CASH OUT.", pt:"Faça CASH OUT 3 vezes.", ru:"Сделай CASH OUT 3 раза."} },
  { id:"reach10", type:"stat", icon:"🚀", stat:"bestMult", goal:10, reward:250, enabled:true,
    title:{it:"Raggiungi 10x", en:"Reach 10x", es:"Alcanza 10x", fr:"Atteins 10x", de:"Erreiche 10x", pt:"Alcance 10x", ru:"Достигни 10x"},
    desc: {it:"Arriva a 10x in una partita.", en:"Hit a 10x multiplier in one run.", es:"Llega a 10x en una partida.", fr:"Atteins 10x dans une partie.", de:"Erreiche 10x in einer Runde.", pt:"Chegue a 10x numa partida.", ru:"Достигни 10x за одну игру."} },
  { id:"channel", type:"link", icon:"📣", url:"", reward:300, enabled:true,
    title:{it:"Entra nel canale", en:"Join the channel", es:"Únete al canal", fr:"Rejoins la chaîne", de:"Tritt dem Kanal bei", pt:"Entre no canal", ru:"Подпишись на канал"},
    desc: {it:"Iscriviti al canale Telegram.", en:"Join our Telegram channel.", es:"Únete a nuestro canal de Telegram.", fr:"Rejoins notre chaîne Telegram.", de:"Tritt unserem Telegram-Kanal bei.", pt:"Entre no nosso canal do Telegram.", ru:"Подпишись на наш канал Telegram."} },
  { id:"share",   type:"link", icon:"📤", url:GAME_URL, share:true, reward:300, enabled:true,
    title:{it:"Invita un amico", en:"Invite a friend", es:"Invita a un amigo", fr:"Invite un ami", de:"Lade einen Freund ein", pt:"Convide um amigo", ru:"Пригласи друга"},
    desc: {it:"Condividi Survive Gram.", en:"Share Survive Gram.", es:"Comparte Survive Gram.", fr:"Partage Survive Gram.", de:"Teile Survive Gram.", pt:"Compartilhe Survive Gram.", ru:"Поделись Survive Gram."} }
];

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, "") || "/";
    const method = request.method;

    if (method === "OPTIONS") return cors(new Response(null, { status: 204 }));

    /* ---------- MISSIONI (pubblici) ---------- */
    if (path === "/tasks" && method === "GET") {
      return cors(json({ ok: true, tasks: await kvTasks(env) }));
    }

    if (path === "/claim" && method === "POST") {
      if (!env.BOT_TOKEN) return cors(json({ ok: false, error: "missing BOT_TOKEN" }, 500));
      if (!env.TASKS)     return cors(json({ ok: false, error: "missing KV" }, 500));
      let body; try { body = await request.json(); } catch (e) { return cors(json({ ok: false, error: "bad json" }, 400)); }
      const user = await checkInitData(body && body.initData, env.BOT_TOKEN);
      if (!user || !user.id) return cors(json({ ok: false, error: "auth" }, 401));
      const taskId = String((body && body.taskId) || "").slice(0, 40);
      if (!taskId) return cors(json({ ok: false, error: "taskId" }, 400));
      const _tk = (await kvTasks(env)).filter(x => x.id === taskId)[0];
      const rev = (_tk && _tk.rev) || 1;                 // i completamenti sono contati per revisione
      const doneKey = "done:" + taskId + ":" + rev + ":" + user.id;
      if (!(await env.TASKS.get(doneKey))) {
        await env.TASKS.put(doneKey, "1");
        const aggKey = "agg:" + taskId + ":" + rev;
        let agg = null; try { agg = JSON.parse(await env.TASKS.get(aggKey)); } catch (e) {}
        if (!agg || typeof agg !== "object") agg = { count: 0, recent: [] };
        agg.count = (agg.count || 0) + 1;
        const name = user.username ? ("@" + user.username) : (user.first_name || ("id" + user.id));
        (agg.recent = agg.recent || []).unshift({ n: name, t: Date.now() });
        if (agg.recent.length > 50) agg.recent.length = 50;
        await env.TASKS.put(aggKey, JSON.stringify(agg));
      }
      return cors(json({ ok: true }));
    }

    /* ---------- ADMIN ---------- */
    if (path === "/admin" && method === "GET") {
      return new Response(ADMIN_HTML, { headers: { "content-type": "text/html; charset=utf-8" } });
    }

    if (path === "/admin/tasks" && method === "POST") {
      if (!adminOk(request, env)) return cors(json({ ok: false, error: "unauthorized" }, 401));
      if (!env.TASKS) return cors(json({ ok: false, error: "missing KV" }, 500));
      let body; try { body = await request.json(); } catch (e) { return cors(json({ ok: false, error: "bad json" }, 400)); }
      const arr = body && body.tasks;
      if (!Array.isArray(arr)) return cors(json({ ok: false, error: "tasks must be array" }, 400));
      const clean = arr.slice(0, 100).map(sanitizeTask).filter(Boolean);
      await env.TASKS.put("tasks", JSON.stringify(clean));
      return cors(json({ ok: true, count: clean.length }));
    }

    if (path === "/admin/completions" && method === "GET") {
      if (!adminOk(request, env)) return cors(json({ ok: false, error: "unauthorized" }, 401));
      if (!env.TASKS) return cors(json({ ok: false, error: "missing KV" }, 500));
      const tasks = await kvTasks(env), out = [];
      for (const t of tasks) {
        const rev = (t.rev) || 1;
        let agg = null; try { agg = JSON.parse(await env.TASKS.get("agg:" + t.id + ":" + rev)); } catch (e) {}
        out.push({ id: t.id, rev, title: (t.title && (t.title.it || t.title.en)) || t.id, count: (agg && agg.count) || 0, recent: (agg && agg.recent) || [] });
      }
      return cors(json({ ok: true, tasks: out }));
    }

    /* ---------- /invoice : pagamento Stars (CHAD, in pausa) ---------- */
    if (path === "/invoice") {
      if (!env.BOT_TOKEN) return cors(json({ ok: false, error: "missing BOT_TOKEN" }, 500));
      const amt = parseInt(url.searchParams.get("amt") || "0", 10);
      if (!(amt >= MIN_STARS && amt <= MAX_STARS && amt % STEP === 0))
        return cors(json({ ok: false, error: "amt deve essere multiplo di " + STEP + " (" + MIN_STARS + ".." + MAX_STARS + ")" }, 400));
      const r = await tg(env.BOT_TOKEN, "createInvoiceLink", {
        title: "Survive Gram — CHAD", description: amt + " crediti per giocare in modalità CHAD ⭐",
        payload: "chad_credits_" + amt + "_" + Date.now(), provider_token: "", currency: "XTR",
        prices: [{ label: amt + " crediti", amount: amt }]
      });
      const data = await r.json();
      if (!data.ok) return cors(json({ ok: false, error: data.description || "invoice error" }, 502));
      return cors(json({ ok: true, link: data.result, amount: amt }));
    }

    /* ---------- /setwebhook ---------- */
    if (path === "/setwebhook") {
      if (!env.BOT_TOKEN) return json({ ok: false, error: "missing BOT_TOKEN" }, 500);
      const set = await (await tg(env.BOT_TOKEN, "setWebhook", { url: url.origin, allowed_updates: ["message", "pre_checkout_query"] })).json();
      const info = await (await tg(env.BOT_TOKEN, "getWebhookInfo", {})).json();
      return json({ setWebhook: set, info: info.result });
    }

    /* ---------- /me : username del bot (serve per i link startapp) ---------- */
    if (path === "/me" && method === "GET") {
      if (!env.BOT_TOKEN) return cors(json({ ok: false, error: "missing BOT_TOKEN" }, 500));
      const r = await (await tg(env.BOT_TOKEN, "getMe", {})).json();
      const mb = await (await tg(env.BOT_TOKEN, "getChatMenuButton", {})).json();
      return cors(json({ ok: !!r.ok, username: r.result && r.result.username, name: r.result && r.result.first_name, menuButton: mb.result }));
    }

    /* ---------- health check (GET) ---------- */
    if (method !== "POST")
      return new Response("Survive Gram bot is alive. ⚡", { headers: { "content-type": "text/plain; charset=utf-8" } });

    /* ---------- webhook Telegram (POST /) ---------- */
    if (!env.BOT_TOKEN) return new Response("missing BOT_TOKEN", { status: 500 });
    let update; try { update = await request.json(); } catch (e) { return new Response("ok"); }

    if (update.pre_checkout_query) {
      await tg(env.BOT_TOKEN, "answerPreCheckoutQuery", { pre_checkout_query_id: update.pre_checkout_query.id, ok: true });
      return new Response("ok");
    }
    const msg = update.message;
    if (msg && msg.successful_payment) {
      const sp = msg.successful_payment;
      await tg(env.BOT_TOKEN, "sendMessage", { chat_id: msg.chat.id, text: "✅ Pagamento ricevuto: " + sp.total_amount + " ⭐ → " + sp.total_amount + " crediti CHAD accreditati. Buona fortuna! 🐈‍⬛" });
      return new Response("ok");
    }
    if (msg && typeof msg.text === "string" && msg.text.startsWith("/start")) {
      await tg(env.BOT_TOKEN, "sendPhoto", { chat_id: msg.chat.id, photo: INTRO_IMG, caption: WELCOME,
        reply_markup: { inline_keyboard: [[{ text: "🎮 PLAY SURVIVE GRAM", web_app: { url: GAME_URL } }]] } });
      return new Response("ok");
    }
    return new Response("ok");
  }
};

/* ===================== helper ===================== */
function cors(resp) {
  resp.headers.set("Access-Control-Allow-Origin", "*");
  resp.headers.set("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  resp.headers.set("Access-Control-Allow-Headers", "content-type,x-admin-key");
  return resp;
}
function json(obj, status) {
  return new Response(JSON.stringify(obj), { status: status || 200, headers: { "content-type": "application/json" } });
}
async function tg(token, method, body) {
  return fetch(`https://api.telegram.org/bot${token}/${method}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
}
function adminOk(req, env) {
  const k = req.headers.get("x-admin-key");
  return !!(env.ADMIN_KEY && k && k === env.ADMIN_KEY);
}
async function kvTasks(env) {
  if (env.TASKS) { try { const raw = await env.TASKS.get("tasks"); if (raw) { const a = JSON.parse(raw); if (Array.isArray(a)) return a; } } catch (e) {} }
  return DEFAULT_TASKS;
}
function clampInt(v, min, max) { v = parseInt(v, 10); if (isNaN(v)) v = min; return Math.max(min, Math.min(max, v)); }
function pickLangs(obj) {
  const out = {}, L = ["it", "en", "es", "fr", "de", "pt", "ru"];
  if (obj && typeof obj === "object") for (const k of L) if (typeof obj[k] === "string" && obj[k]) out[k] = obj[k].slice(0, 200);
  return out;
}
function sanitizeTask(t) {
  if (!t || typeof t !== "object") return null;
  const id = String(t.id || "").trim().slice(0, 40); if (!id) return null;
  const type = (t.type === "link") ? "link" : "stat";
  const o = { id, type, icon: String(t.icon || "⭐").slice(0, 4), reward: clampInt(t.reward, 0, 100000),
    enabled: t.enabled !== false, rev: clampInt(t.rev, 1, 1000000), title: pickLangs(t.title), desc: pickLangs(t.desc) };
  if (type === "stat") {
    o.stat = ["games", "dodges", "cashouts", "bestMult"].indexOf(t.stat) >= 0 ? t.stat : "games";
    o.goal = clampInt(t.goal, 1, 1000000);
  } else {
    o.url = String(t.url || "").slice(0, 300);
    if (t.share) o.share = true;
  }
  return o;
}
/* validazione firma initData (Telegram WebApp): conferma che l'utente è autentico. */
async function hmacSign(keyBytes, msgBytes) {
  const k = await crypto.subtle.importKey("raw", keyBytes, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", k, msgBytes));
}
async function checkInitData(initData, botToken) {
  try {
    if (!initData || typeof initData !== "string") return null;
    const p = new URLSearchParams(initData);
    const hash = p.get("hash"); if (!hash) return null;
    p.delete("hash");
    const pairs = []; for (const [k, v] of p) pairs.push(k + "=" + v);
    pairs.sort();
    const enc = new TextEncoder();
    const secret = await hmacSign(enc.encode("WebAppData"), enc.encode(botToken));
    const sig = await hmacSign(secret, enc.encode(pairs.join("\n")));
    const hex = Array.from(sig).map(b => b.toString(16).padStart(2, "0")).join("");
    if (hex !== hash) return null;
    const u = p.get("user"); return u ? JSON.parse(u) : null;
  } catch (e) { return null; }
}

/* ===================== pannello admin (HTML) ===================== */
const ADMIN_HTML = `<!DOCTYPE html>
<html lang="it"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Admin — Survive Gram</title>
<style>
 :root{--bg:#070310;--panel:#0c0816;--green:#2aabee;--red:#b026ff;--txt:#cfcfcf;--dim:#8a7a9a}
 *{box-sizing:border-box;margin:0;padding:0}
 body{background:var(--bg);color:var(--txt);font-family:ui-monospace,"Courier New",monospace;padding:18px;max-width:780px;margin:0 auto}
 h1{color:var(--green);letter-spacing:2px;font-size:19px;margin-bottom:16px}
 h2{color:var(--green);font-size:15px;letter-spacing:1px;margin:24px 0 10px}
 input,select,button{font-family:inherit;font-size:14px}
 input,select{background:#0a0712;border:1px solid #2c0a40;color:var(--green);padding:7px;border-radius:5px;width:100%}
 label{font-size:10px;color:var(--dim);text-transform:uppercase;letter-spacing:1px;display:block;margin-bottom:3px}
 button{cursor:pointer;border:none;border-radius:6px;padding:9px 15px;font-weight:700;letter-spacing:1px}
 button:active{transform:scale(.96)}
 .b-prim{background:var(--green);color:#042033}
 .b-ghost{background:#15102a;color:var(--green);padding:8px 11px}
 .b-del{background:#2c0a40;color:#f3a6ff;padding:7px 10px}
 .b-pub{background:#0c3a55;color:#7fd3ff}
 .card{background:var(--panel);border:1px solid #1c1030;border-radius:8px;padding:12px;margin-bottom:10px}
 .row{display:flex;gap:8px;flex-wrap:wrap;align-items:flex-end;margin-bottom:8px}
 .f{display:flex;flex-direction:column}
 .f.grow{flex:1;min-width:130px}
 .muted{color:var(--dim);font-size:12px}
 table{width:100%;border-collapse:collapse;font-size:13px}
 th,td{text-align:left;padding:7px 8px;border-bottom:1px solid #1c1030;vertical-align:top}
 th{color:var(--dim);font-weight:400;text-transform:uppercase;font-size:10px}
 .top{display:flex;justify-content:space-between;align-items:flex-end;gap:10px;flex-wrap:wrap;margin-bottom:14px}
 .chk{display:flex;align-items:center;gap:6px}
 .chk input{width:18px;height:18px}
 #note{position:fixed;left:50%;bottom:18px;transform:translateX(-50%);background:#15102a;border:1px solid var(--green);color:var(--green);padding:10px 18px;border-radius:8px;opacity:0;transition:opacity .2s;pointer-events:none;z-index:9}
 #note.show{opacity:1}
 #note.bad{border-color:var(--red);color:#f3a6ff}
</style></head>
<body>
 <h1>⚙️ SURVIVE GRAM · ADMIN MISSIONI</h1>
 <div id="login">
   <label>Password admin</label>
   <div class="row"><div class="f grow"><input id="pw" type="password" placeholder="password"></div><button class="b-prim" id="enter">Entra</button></div>
   <div class="muted" id="err"></div>
 </div>
 <div id="app" style="display:none">
   <div class="top">
     <div class="f" style="min-width:150px"><label>Lingua di modifica testi</label><select id="lang"></select></div>
     <div style="display:flex;gap:8px"><button class="b-ghost" id="add">+ Missione</button><button class="b-prim" id="save">💾 Salva</button></div>
   </div>
   <div id="list"></div>
   <h2>📊 Completamenti</h2>
   <button class="b-ghost" id="refresh" style="margin-bottom:10px">↻ Aggiorna</button>
   <table><thead><tr><th>Missione</th><th>Completata</th><th>Ultimi utenti</th></tr></thead><tbody id="comp"></tbody></table>
   <p class="muted" style="margin:18px 0 30px">Le modifiche sono immediate: gli utenti le ricevono alla prossima apertura della pagina Missioni (nessun nuovo rilascio).</p>
 </div>
<script>
 var KEY="sg_admin_key";
 var LANGS=["it","en","es","fr","de","pt","ru"];
 var STATS=["games","dodges","cashouts","bestMult"];
 var tasks=[], lang="it";
 function el(i){return document.getElementById(i);}
 function key(){return localStorage.getItem(KEY)||"";}
 function hdr(){return {"content-type":"application/json","x-admin-key":key()};}
 function note(m,bad){var n=el("note");n.textContent=m;n.className="show"+(bad?" bad":"");setTimeout(function(){n.className="";},2300);}
 function esc(s){s=(s==null?"":""+s);return s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");}

 function enter(){
   localStorage.setItem(KEY, el("pw").value.trim());
   fetch("/admin/completions",{headers:hdr()}).then(function(r){
     if(r.status===401){ el("err").textContent="Password errata."; localStorage.removeItem(KEY); return; }
     return r.json().then(function(d){
       el("login").style.display="none"; el("app").style.display="block";
       buildLang(); renderComp((d&&d.tasks)||[]);
       fetch("/tasks").then(function(x){return x.json();}).then(function(t){ tasks=(t&&t.tasks)||[]; render(); });
     });
   }).catch(function(){ el("err").textContent="Errore di rete."; });
 }
 function buildLang(){ var s=el("lang"); s.innerHTML=""; LANGS.forEach(function(l){ var o=document.createElement("option"); o.value=l; o.textContent=l.toUpperCase(); s.appendChild(o); }); s.value=lang; s.onchange=function(){ lang=s.value; render(); }; }

 function mkInput(val,on,type,ph){ var e=document.createElement("input"); e.type=type||"text"; if(ph)e.placeholder=ph; e.value=(val==null?"":val); e.addEventListener("input",function(){on(e.value);}); return e; }
 function field(lbl,node,grow){ var f=document.createElement("div"); f.className="f"+(grow?" grow":""); var l=document.createElement("label"); l.textContent=lbl; f.appendChild(l); f.appendChild(node); return f; }
 function btn(cls,txt,on){ var b=document.createElement("button"); b.className=cls; b.textContent=txt; b.onclick=on; return b; }

 function render(){
   var box=el("list"); box.innerHTML="";
   tasks.forEach(function(t,i){
     t.title=t.title||{}; t.desc=t.desc||{};
     var c=document.createElement("div"); c.className="card";
     var r1=document.createElement("div"); r1.className="row";
     var ck=document.createElement("div"); ck.className="f"; var ckl=document.createElement("label"); ckl.textContent="Attiva"; var cb=document.createElement("input"); cb.type="checkbox"; cb.style.width="20px"; cb.checked=t.enabled!==false; cb.addEventListener("change",function(){t.enabled=cb.checked;}); ck.appendChild(ckl); ck.appendChild(cb); r1.appendChild(ck);
     var fi=field("Icona", mkInput(t.icon,function(v){t.icon=v;},"text","⭐")); fi.style.maxWidth="64px"; r1.appendChild(fi);
     var fid=field("ID", mkInput(t.id,function(v){t.id=v;},"text","id")); fid.style.maxWidth="140px"; r1.appendChild(fid);
     var ts=document.createElement("select"); [["stat","Automatica"],["link","Link"]].forEach(function(p){var o=document.createElement("option");o.value=p[0];o.textContent=p[1];if(t.type===p[0])o.selected=true;ts.appendChild(o);}); ts.addEventListener("change",function(){t.type=ts.value;render();}); var fts=field("Tipo",ts); fts.style.maxWidth="130px"; r1.appendChild(fts);
     var rv=document.createElement("span"); rv.className="muted"; rv.style.alignSelf="center"; rv.textContent="rev "+((t.rev)||1); r1.appendChild(rv);
     var sp=document.createElement("div"); sp.style.flex="1"; r1.appendChild(sp);
     r1.appendChild(btn("b-ghost","↑",function(){ if(i>0){var x=tasks[i-1];tasks[i-1]=tasks[i];tasks[i]=x;render();} }));
     r1.appendChild(btn("b-ghost","↓",function(){ if(i<tasks.length-1){var x=tasks[i+1];tasks[i+1]=tasks[i];tasks[i]=x;render();} }));
     r1.appendChild(btn("b-pub","🔄 Ripubblica",function(){ republish(i); }));
     r1.appendChild(btn("b-del","🗑",function(){ tasks.splice(i,1); render(); }));
     c.appendChild(r1);

     var r2=document.createElement("div"); r2.className="row";
     if(t.type==="stat"){
       var st=document.createElement("select"); STATS.forEach(function(s){var o=document.createElement("option");o.value=s;o.textContent=s;if(t.stat===s)o.selected=true;st.appendChild(o);}); st.addEventListener("change",function(){t.stat=st.value;}); r2.appendChild(field("Statistica",st));
       r2.appendChild(field("Obiettivo", mkInput(t.goal,function(v){t.goal=parseInt(v,10)||0;},"number")));
     } else {
       r2.appendChild(field("URL (lascia vuoto = nascosta)", mkInput(t.url,function(v){t.url=v;},"text","https://t.me/..."),true));
       var sh=document.createElement("div"); sh.className="f"; var shl=document.createElement("label"); shl.textContent="Condividi"; var shc=document.createElement("input"); shc.type="checkbox"; shc.style.width="20px"; shc.checked=!!t.share; shc.addEventListener("change",function(){t.share=shc.checked;}); sh.appendChild(shl); sh.appendChild(shc); r2.appendChild(sh);
     }
     var fr=field("Punti GRAM", mkInput(t.reward,function(v){t.reward=parseInt(v,10)||0;},"number")); fr.style.maxWidth="120px"; r2.appendChild(fr);
     c.appendChild(r2);

     var r3=document.createElement("div"); r3.className="row"; r3.appendChild(field("Titolo ("+lang.toUpperCase()+")", mkInput(t.title[lang],function(v){t.title[lang]=v;},"text"),true)); c.appendChild(r3);
     var r4=document.createElement("div"); r4.className="row"; r4.appendChild(field("Descrizione ("+lang.toUpperCase()+")", mkInput(t.desc[lang],function(v){t.desc[lang]=v;},"text"),true)); c.appendChild(r4);
     box.appendChild(c);
   });
 }

 function addTask(){ tasks.push({id:"task"+Date.now(), type:"stat", icon:"⭐", stat:"games", goal:5, reward:100, enabled:true, rev:1, title:{}, desc:{}}); render(); }
 function save(msg){
   fetch("/admin/tasks",{method:"POST",headers:hdr(),body:JSON.stringify({tasks:tasks})}).then(function(r){return r.json();})
    .then(function(d){ if(d&&d.ok){ note(msg||("Salvato ✓ ("+d.count+" missioni)")); render(); loadComp(); } else { note("Errore: "+((d&&d.error)||"?"),true); } })
    .catch(function(){ note("Errore di rete",true); });
 }
 /* RIPUBBLICA una singola missione: incrementa la revisione -> torna disponibile anche a chi l'aveva completata. */
 function republish(i){
   var nm=(tasks[i].title&&(tasks[i].title[lang]||tasks[i].title.it||tasks[i].title.en))||tasks[i].id;
   if(!confirm("Riproporre «"+nm+"» a TUTTI gli utenti?\\nChi l'aveva già completata la rivedrà come disponibile. Verranno salvate anche le altre modifiche in sospeso.")) return;
   tasks[i].rev=((tasks[i].rev)||1)+1;
   save("🔄 Ripubblicata ✓ — di nuovo disponibile (rev "+tasks[i].rev+")");
 }
 function loadComp(){ fetch("/admin/completions",{headers:hdr()}).then(function(r){return r.json();}).then(function(d){ renderComp((d&&d.tasks)||[]); }); }
 function renderComp(rows){
   var b=el("comp"); b.innerHTML="";
   if(!rows.length){ b.innerHTML="<tr><td colspan='3' class='muted'>Nessun dato.</td></tr>"; return; }
   rows.forEach(function(t){
     var names=(t.recent||[]).map(function(x){return x.n;}).slice(0,12).join(", ");
     var tr=document.createElement("tr");
     tr.innerHTML="<td>"+esc(t.title)+"<br><span class='muted'>"+esc(t.id)+"</span></td><td>"+(t.count||0)+"</td><td class='muted'>"+esc(names)+"</td>";
     b.appendChild(tr);
   });
 }

 el("enter").onclick=enter;
 el("pw").addEventListener("keydown",function(e){ if(e.key==="Enter") enter(); });
 el("add").onclick=addTask;
 el("save").onclick=function(){ save(); };
 el("refresh").onclick=loadComp;
 var n0=document.createElement("div"); n0.id="note"; document.body.appendChild(n0);
 if(key()) enter();
</script>
</body></html>`;
