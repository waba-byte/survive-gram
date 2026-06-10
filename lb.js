/* Classifica condivisa tra le pagine (gioco + classifica.html).
   Netto = vincite - perdite (anche negativo). Persistita in localStorage
   e, dentro Telegram, anche in CloudStorage (sync cross-device per utente). */
(function(){
  "use strict";
  const TG=(window.Telegram&&window.Telegram.WebApp)?window.Telegram.WebApp:null;
  function tgv(v){ try{ return !!(TG&&TG.isVersionAtLeast&&TG.isVersionAtLeast(v)); }catch(e){ return false; } }
  const TG_CLOUD=!!(TG&&TG.CloudStorage&&tgv("6.9"));
  const KEY="laserdeath_lb_v1";

  let lb=null, curName="TU";
  function def(){
    return {current:"TU", players:{
      "ZKULL":2050,"NEKO_666":1840,"V01D":920,"PHANTOM":315,
      "TU":0,"LARA":-120,"GHOST":-430,"N00B":-880
    }};
  }
  function save(){
    try{ localStorage.setItem(KEY,JSON.stringify(lb)); }catch(e){}
    if(TG_CLOUD){ try{ TG.CloudStorage.setItem(KEY,JSON.stringify(lb)); }catch(e){} }
  }
  function setPlayer(name){
    name=(name||"").trim().toUpperCase().slice(0,12)||"TU";
    curName=name; lb.current=name;
    if(!(name in lb.players)) lb.players[name]=0;
    save();
  }
  function load(){
    try{ lb=JSON.parse(localStorage.getItem(KEY)); }catch(e){ lb=null; }
    if(!lb||!lb.players) lb=def();
    curName=lb.current||"TU";
    if(!(curName in lb.players)) lb.players[curName]=0;
    // dentro Telegram l'identita' e' l'utente reale
    if(TG){ const u=TG.initDataUnsafe&&TG.initDataUnsafe.user; if(u) setPlayer(u.username||u.first_name||curName); }
    save();
  }
  function cloudLoad(cb){
    if(!TG_CLOUD){ if(cb)cb(); return; }
    try{ TG.CloudStorage.getItem(KEY,function(err,val){
      if(!err&&val){ try{ const d=JSON.parse(val);
        if(d&&d.players){ lb=d; if(!(curName in lb.players)) lb.players[curName]=0; lb.current=curName; }
      }catch(e){} }
      if(cb)cb();
    }); }catch(e){ if(cb)cb(); }
  }
  function addScore(delta){ if(!lb)load(); lb.players[curName]=(lb.players[curName]||0)+delta; save(); }
  function rows(){ if(!lb)load(); return Object.keys(lb.players).map(n=>({name:n,score:lb.players[n]})).sort((a,b)=>b.score-a.score); }

  window.LB={ load, cloudLoad, setPlayer, addScore, rows,
    name:()=>curName,
    isTelegramUser:()=>!!(TG&&TG.initDataUnsafe&&TG.initDataUnsafe.user) };
})();
