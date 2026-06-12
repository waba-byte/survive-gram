/* Missioni / Task condivise (gioco + task.html).
   Il gioco aggiorna le statistiche con TASKS.bump(...). La pagina task.html mostra le
   missioni, il progresso e permette di riscattare i punti GRAM (punteggio di progressione,
   SENZA valore reale / nessun pagamento). Persistito in localStorage e, dentro Telegram,
   anche in CloudStorage (sync cross-device per utente). */
(function(){
  "use strict";
  const TG=(window.Telegram&&window.Telegram.WebApp)?window.Telegram.WebApp:null;
  function tgv(v){ try{ return !!(TG&&TG.isVersionAtLeast&&TG.isVersionAtLeast(v)); }catch(e){ return false; } }
  const TG_CLOUD=!!(TG&&TG.CloudStorage&&tgv("6.9"));
  const KEY="sg_tasks_v1";

  /* ====== LINK ESTERNI — riempi quando li hai ======
     Lascia "" per NASCONDERE la relativa missione finché non c'è il link. */
  const CHANNEL_URL = "";                                            // es. "https://t.me/survivegram"
  const SHARE_URL   = "https://waba-byte.github.io/survive-gram/";   // link condiviso dagli utenti
  const WORKER      = "https://survive-gram-bot.waba.workers.dev";   // backend: elenco missioni + registro completamenti

  /* ====== ELENCO MISSIONI (facile da modificare / aggiungere) ======
     type "stat": automatica; completata quando la statistica raggiunge `goal`.
        stat: "games" | "dodges" | "cashouts" | "bestMult"
     type "link": apri un link, poi diventa riscattabile (honor system).
     title/desc: testi per lingua (fallback "en").  reward: punti GRAM. */
  const DEFS=[
    { id:"play5",   type:"stat", icon:"🎮", stat:"games",    goal:5,  reward:100,
      title:{it:"Gioca 5 partite", en:"Play 5 games", es:"Juega 5 partidas", fr:"Joue 5 parties", de:"Spiele 5 Runden", pt:"Jogue 5 partidas", ru:"Сыграй 5 игр"},
      desc: {it:"Avvia e gioca 5 partite.", en:"Start and play 5 games.", es:"Inicia y juega 5 partidas.", fr:"Lance et joue 5 parties.", de:"Starte und spiele 5 Runden.", pt:"Inicie e jogue 5 partidas.", ru:"Начни и сыграй 5 игр."} },
    { id:"dodge25", type:"stat", icon:"🛡", stat:"dodges",   goal:25, reward:150,
      title:{it:"Schiva 25 laser", en:"Dodge 25 lasers", es:"Esquiva 25 láseres", fr:"Esquive 25 lasers", de:"Weiche 25 Lasern aus", pt:"Desvie de 25 lasers", ru:"Уклонись от 25 лазеров"},
      desc: {it:"Schiva 25 laser in totale.", en:"Dodge 25 lasers in total.", es:"Esquiva 25 láseres en total.", fr:"Esquive 25 lasers au total.", de:"Weiche insgesamt 25 Lasern aus.", pt:"Desvie de 25 lasers no total.", ru:"Уклонись от 25 лазеров всего."} },
    { id:"cash3",   type:"stat", icon:"💰", stat:"cashouts", goal:3,  reward:200,
      title:{it:"Incassa 3 volte", en:"Cash out 3 times", es:"Retira 3 veces", fr:"Encaisse 3 fois", de:"3-mal auszahlen", pt:"Saque 3 vezes", ru:"Забери выигрыш 3 раза"},
      desc: {it:"Fai CASH OUT 3 volte.", en:"Cash out 3 times.", es:"Haz CASH OUT 3 veces.", fr:"Fais CASH OUT 3 fois.", de:"Mach 3-mal CASH OUT.", pt:"Faça CASH OUT 3 vezes.", ru:"Сделай CASH OUT 3 раза."} },
    { id:"reach10", type:"stat", icon:"🚀", stat:"bestMult", goal:10, reward:250,
      title:{it:"Raggiungi 10x", en:"Reach 10x", es:"Alcanza 10x", fr:"Atteins 10x", de:"Erreiche 10x", pt:"Alcance 10x", ru:"Достигни 10x"},
      desc: {it:"Arriva a 10x in una partita.", en:"Hit a 10x multiplier in one run.", es:"Llega a 10x en una partida.", fr:"Atteins 10x dans une partie.", de:"Erreiche 10x in einer Runde.", pt:"Chegue a 10x numa partida.", ru:"Достигни 10x за одну игру."} },
    { id:"channel", type:"link", icon:"📣", url:CHANNEL_URL, reward:300,
      title:{it:"Entra nel canale", en:"Join the channel", es:"Únete al canal", fr:"Rejoins la chaîne", de:"Tritt dem Kanal bei", pt:"Entre no canal", ru:"Подпишись на канал"},
      desc: {it:"Iscriviti al canale Telegram.", en:"Join our Telegram channel.", es:"Únete a nuestro canal de Telegram.", fr:"Rejoins notre chaîne Telegram.", de:"Tritt unserem Telegram-Kanal bei.", pt:"Entre no nosso canal do Telegram.", ru:"Подпишись на наш канал Telegram."} },
    { id:"share",   type:"link", icon:"📤", url:SHARE_URL, share:true, reward:300,
      title:{it:"Invita un amico", en:"Invite a friend", es:"Invita a un amigo", fr:"Invite un ami", de:"Lade einen Freund ein", pt:"Convide um amigo", ru:"Пригласи друга"},
      desc: {it:"Condividi Survive Gram.", en:"Share Survive Gram.", es:"Comparte Survive Gram.", fr:"Partage Survive Gram.", de:"Teile Survive Gram.", pt:"Compartilhe Survive Gram.", ru:"Поделись Survive Gram."} }
  ];

  /* missioni ATTIVE: dal server (con cache localStorage), altrimenti i DEFS qui sopra. */
  let ACTIVE=DEFS;
  try{ const _c=JSON.parse(localStorage.getItem("sg_tasks_defs")); if(Array.isArray(_c)&&_c.length) ACTIVE=_c; }catch(e){}

  let data=null;
  function def(){ return { stats:{games:0,dodges:0,cashouts:0,bestMult:0}, opened:{}, claimed:{}, gram:0 }; }
  function normalize(o){
    const d=def();
    if(!o||typeof o!=="object") return d;
    o.stats=o.stats||{}; for(const k in d.stats) if(typeof o.stats[k]!=="number") o.stats[k]=d.stats[k];
    o.opened=o.opened||{}; o.claimed=o.claimed||{}; if(typeof o.gram!=="number") o.gram=0;
    return o;
  }
  function save(){
    try{ localStorage.setItem(KEY,JSON.stringify(data)); }catch(e){}
    if(TG_CLOUD){ try{ TG.CloudStorage.setItem(KEY,JSON.stringify(data)); }catch(e){} }
  }
  function load(){ let o=null; try{ o=JSON.parse(localStorage.getItem(KEY)); }catch(e){} data=normalize(o); return data; }
  function cloudLoad(cb){
    if(!TG_CLOUD){ if(cb)cb(); return; }
    try{ TG.CloudStorage.getItem(KEY,function(err,val){
      if(!err&&val){ try{ const o=JSON.parse(val); if(o&&o.stats){ data=normalize(o); save(); } }catch(e){} }
      if(cb)cb();
    }); }catch(e){ if(cb)cb(); }
  }

  /* aggiorna una statistica: mode "max" tiene il massimo, altrimenti somma (default +1). */
  function bump(stat,val,mode){
    if(!data) load();
    if(!(stat in data.stats)) return;
    if(mode==="max") data.stats[stat]=Math.max(data.stats[stat], val||0);
    else             data.stats[stat]=data.stats[stat]+(val==null?1:val);
    save();
  }

  function find(id){ return ACTIVE.filter(t=>t.id===id)[0]||null; }
  function trev(t){ return (t&&t.rev)||1; }   // revisione missione: se il pannello la incrementa, torna disponibile per chi l'aveva completata
  /* scarica l'elenco missioni dal server (con cache di riserva); poi chiama cb. */
  function fetchDefs(cb){
    let done=false; const finish=function(){ if(done) return; done=true; if(cb) cb(); };
    try{
      fetch(WORKER+"/tasks",{cache:"no-store"}).then(function(r){return r.json();}).then(function(d){
        if(d&&d.ok&&Array.isArray(d.tasks)&&d.tasks.length){ ACTIVE=d.tasks; try{ localStorage.setItem("sg_tasks_defs", JSON.stringify(d.tasks)); }catch(e){} }
        finish();
      }).catch(finish);
    }catch(e){ finish(); }
    setTimeout(finish, 4000);   // non bloccare la UI se il server tarda
  }
  /* segnala al server un completamento (con identità Telegram verificata lato Worker). */
  function report(taskId){
    try{ if(TG&&TG.initData){
      fetch(WORKER+"/claim",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({initData:TG.initData,taskId:taskId})}).catch(function(){});
    } }catch(e){}
  }
  function statValue(t){ if(!data) load(); return data.stats[t.stat]||0; }
  function complete(t){
    if(!t) return false;
    if(t.type==="stat") return statValue(t) >= t.goal;
    if(t.type==="link") return !!(data&&data.opened[t.id]===trev(t));
    return false;
  }
  function prog(t){ if(!t||t.type!=="stat") return null; return { raw:statValue(t), goal:t.goal }; }

  /* apre il link della missione (canale / condivisione) e la segna come "aperta". */
  function openTask(id){
    if(!data) load();
    const t=find(id); if(!t||t.type!=="link") return;
    try{
      if(t.share){
        const txt=(window.I18N&&I18N.t("tsk_share_text"))||"Survive Gram";
        const link="https://t.me/share/url?url="+encodeURIComponent(t.url||SHARE_URL)+"&text="+encodeURIComponent(txt);
        if(TG&&TG.openTelegramLink) TG.openTelegramLink(link); else window.open(link,"_blank");
      } else if(t.url){
        if(/^https?:\/\/t\.me\//.test(t.url)&&TG&&TG.openTelegramLink) TG.openTelegramLink(t.url);
        else if(TG&&TG.openLink) TG.openLink(t.url);
        else window.open(t.url,"_blank");
      }
    }catch(e){ try{ window.open(t.url||SHARE_URL,"_blank"); }catch(_){} }
    data.opened[id]=trev(t); save();
  }

  /* riscatta i punti GRAM di una missione completata (una sola volta). */
  function claim(id){
    if(!data) load();
    const t=find(id); if(!t) return false;
    if(data.claimed[id]===trev(t)) return false;   // già riscattata a questa revisione
    if(!complete(t)) return false;
    data.claimed[id]=trev(t); data.gram=(data.gram||0)+(t.reward||0); save();
    report(id);   // notifica il server (pannello admin) — solo dentro Telegram
    return true;
  }

  function text(obj){ if(!obj) return ""; const c=(window.I18N&&I18N.cur)||"en"; if(obj[c]) return obj[c]; if(obj.en) return obj.en; for(const k in obj) if(obj[k]) return obj[k]; return ""; }
  /* missioni visibili: attive e (se "link") con URL impostato. */
  function list(){ return ACTIVE.filter(t=> t.enabled!==false && (t.type!=="link" || (t.url&&t.url.length>4)) ); }

  window.TASKS={
    load, cloudLoad, fetchDefs, save, bump, claim, openTask, list, prog, complete, text,
    isClaimed:id=>{ const t=find(id); return !!(data&&data.claimed[id]===trev(t)); },
    isOpened :id=>{ const t=find(id); return !!(data&&data.opened[id]===trev(t)); },
    gram:()=>(data?data.gram:0)|0
  };
})();
