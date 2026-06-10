/* i18n condiviso (gioco + classifica). Lingua: preferenza salvata -> Telegram/dispositivo -> EN.
   t(key,params) sostituisce {placeholder}. apply(root) traduce gli elementi [data-i18n].
   I18N.set(lang) cambia lingua, salva, ri-applica ed emette l'evento 'i18n:change'. */
(function(){
  "use strict";
  const LANGS=["it","en","es","fr","de","pt","ru"];
  const NAMES={it:"Italiano",en:"English",es:"Español",fr:"Français",de:"Deutsch",pt:"Português",ru:"Русский"};
  const FLAGS={it:"🇮🇹",en:"🇬🇧",es:"🇪🇸",fr:"🇫🇷",de:"🇩🇪",pt:"🇵🇹",ru:"🇷🇺"};
  const KEY="sg_lang";

  const DICT={
    it:{
      hud_balance:"Saldo", hud_bet:"Puntata", hud_mult:"Moltipl.", hud_win:"Vincita",
      btn_leaderboard:"🏆 CLASSIFICA",
      axis_h:"orizzontale", axis_v:"verticale",
      msg_intro:"Premi START, poi clicca una cella per schivare il laser.",
      msg_pick:"Clicca una cella per schivare il laser {axis}.",
      msg_charging:"Laser {axis} in carica...",
      msg_dodged:"Schivato! {mult}x — clicca per il laser {axis} o CASH OUT.",
      msg_max:"🏆 MAX {mult}x! Premi CASH OUT.",
      msg_hit:"☠ COLPITO! Persi {bet}. Premi START.",
      msg_cashed:"💰 Incassato {win} ({mult}x)! Premi START.",
      err_bet:"Puntata non valida.", err_balance:"Saldo insufficiente.",
      cls_title:"🏆 CLASSIFICA", cls_yourname:"Il tuo nome",
      cls_hint:"netto = vincite − perdite (può essere negativo)",
      cls_tg_hint:"sei identificato dal tuo profilo Telegram",
      cls_tg_name_title:"Nome preso dal tuo profilo Telegram",
      btn_play:"▶ GIOCA"
    },
    en:{
      hud_balance:"Balance", hud_bet:"Bet", hud_mult:"Multip.", hud_win:"Win",
      btn_leaderboard:"🏆 LEADERBOARD",
      axis_h:"horizontal", axis_v:"vertical",
      msg_intro:"Press START, then tap a cell to dodge the laser.",
      msg_pick:"Tap a cell to dodge the {axis} laser.",
      msg_charging:"{axis} laser charging...",
      msg_dodged:"Dodged! {mult}x — tap for the {axis} laser or CASH OUT.",
      msg_max:"🏆 MAX {mult}x! Press CASH OUT.",
      msg_hit:"☠ HIT! Lost {bet}. Press START.",
      msg_cashed:"💰 Cashed out {win} ({mult}x)! Press START.",
      err_bet:"Invalid bet.", err_balance:"Insufficient balance.",
      cls_title:"🏆 LEADERBOARD", cls_yourname:"Your name",
      cls_hint:"net = wins − losses (can be negative)",
      cls_tg_hint:"you're identified by your Telegram profile",
      cls_tg_name_title:"Name from your Telegram profile",
      btn_play:"▶ PLAY"
    },
    es:{
      hud_balance:"Saldo", hud_bet:"Apuesta", hud_mult:"Multipl.", hud_win:"Ganancia",
      btn_leaderboard:"🏆 CLASIFICACIÓN",
      axis_h:"horizontal", axis_v:"vertical",
      msg_intro:"Pulsa START y luego toca una casilla para esquivar el láser.",
      msg_pick:"Toca una casilla para esquivar el láser {axis}.",
      msg_charging:"Láser {axis} cargando...",
      msg_dodged:"¡Esquivado! {mult}x — toca para el láser {axis} o CASH OUT.",
      msg_max:"🏆 ¡MÁX {mult}x! Pulsa CASH OUT.",
      msg_hit:"☠ ¡ALCANZADO! Perdiste {bet}. Pulsa START.",
      msg_cashed:"💰 ¡Retirado {win} ({mult}x)! Pulsa START.",
      err_bet:"Apuesta no válida.", err_balance:"Saldo insuficiente.",
      cls_title:"🏆 CLASIFICACIÓN", cls_yourname:"Tu nombre",
      cls_hint:"neto = ganancias − pérdidas (puede ser negativo)",
      cls_tg_hint:"te identifica tu perfil de Telegram",
      cls_tg_name_title:"Nombre de tu perfil de Telegram",
      btn_play:"▶ JUGAR"
    },
    fr:{
      hud_balance:"Solde", hud_bet:"Mise", hud_mult:"Multipl.", hud_win:"Gain",
      btn_leaderboard:"🏆 CLASSEMENT",
      axis_h:"horizontal", axis_v:"vertical",
      msg_intro:"Appuie sur START, puis touche une case pour esquiver le laser.",
      msg_pick:"Touche une case pour esquiver le laser {axis}.",
      msg_charging:"Laser {axis} en charge...",
      msg_dodged:"Esquivé ! {mult}x — touche pour le laser {axis} ou CASH OUT.",
      msg_max:"🏆 MAX {mult}x ! Appuie sur CASH OUT.",
      msg_hit:"☠ TOUCHÉ ! Perdu {bet}. Appuie sur START.",
      msg_cashed:"💰 Encaissé {win} ({mult}x) ! Appuie sur START.",
      err_bet:"Mise invalide.", err_balance:"Solde insuffisant.",
      cls_title:"🏆 CLASSEMENT", cls_yourname:"Ton nom",
      cls_hint:"net = gains − pertes (peut être négatif)",
      cls_tg_hint:"tu es identifié par ton profil Telegram",
      cls_tg_name_title:"Nom depuis ton profil Telegram",
      btn_play:"▶ JOUER"
    },
    de:{
      hud_balance:"Guthaben", hud_bet:"Einsatz", hud_mult:"Multipl.", hud_win:"Gewinn",
      btn_leaderboard:"🏆 RANGLISTE",
      axis_h:"horizontal", axis_v:"vertikal",
      msg_intro:"Drücke START und tippe dann auf eine Zelle, um dem Laser auszuweichen.",
      msg_pick:"Tippe auf eine Zelle, um dem Laser ({axis}) auszuweichen.",
      msg_charging:"Laser ({axis}) lädt...",
      msg_dodged:"Ausgewichen! {mult}x — tippe für den Laser ({axis}) oder CASH OUT.",
      msg_max:"🏆 MAX {mult}x! Drücke CASH OUT.",
      msg_hit:"☠ GETROFFEN! {bet} verloren. Drücke START.",
      msg_cashed:"💰 {win} ({mult}x) ausgezahlt! Drücke START.",
      err_bet:"Ungültiger Einsatz.", err_balance:"Unzureichendes Guthaben.",
      cls_title:"🏆 RANGLISTE", cls_yourname:"Dein Name",
      cls_hint:"netto = Gewinne − Verluste (kann negativ sein)",
      cls_tg_hint:"du wirst über dein Telegram-Profil identifiziert",
      cls_tg_name_title:"Name aus deinem Telegram-Profil",
      btn_play:"▶ SPIELEN"
    },
    pt:{
      hud_balance:"Saldo", hud_bet:"Aposta", hud_mult:"Multipl.", hud_win:"Ganho",
      btn_leaderboard:"🏆 CLASSIFICAÇÃO",
      axis_h:"horizontal", axis_v:"vertical",
      msg_intro:"Pressione START e toque numa célula para desviar do laser.",
      msg_pick:"Toque numa célula para desviar do laser {axis}.",
      msg_charging:"Laser {axis} carregando...",
      msg_dodged:"Desviou! {mult}x — toque para o laser {axis} ou CASH OUT.",
      msg_max:"🏆 MÁX {mult}x! Pressione CASH OUT.",
      msg_hit:"☠ ATINGIDO! Perdeu {bet}. Pressione START.",
      msg_cashed:"💰 Sacou {win} ({mult}x)! Pressione START.",
      err_bet:"Aposta inválida.", err_balance:"Saldo insuficiente.",
      cls_title:"🏆 CLASSIFICAÇÃO", cls_yourname:"Seu nome",
      cls_hint:"líquido = ganhos − perdas (pode ser negativo)",
      cls_tg_hint:"você é identificado pelo seu perfil do Telegram",
      cls_tg_name_title:"Nome do seu perfil do Telegram",
      btn_play:"▶ JOGAR"
    },
    ru:{
      hud_balance:"Баланс", hud_bet:"Ставка", hud_mult:"Множ.", hud_win:"Выигрыш",
      btn_leaderboard:"🏆 РЕЙТИНГ",
      axis_h:"горизонтальный", axis_v:"вертикальный",
      msg_intro:"Нажми START, затем нажми на клетку, чтобы увернуться от лазера.",
      msg_pick:"Нажми на клетку, чтобы увернуться от лазера ({axis}).",
      msg_charging:"Лазер ({axis}) заряжается...",
      msg_dodged:"Уклонился! {mult}x — нажми для лазера ({axis}) или CASH OUT.",
      msg_max:"🏆 МАКС {mult}x! Нажми CASH OUT.",
      msg_hit:"☠ ПОПАЛ! Потеряно {bet}. Нажми START.",
      msg_cashed:"💰 Выведено {win} ({mult}x)! Нажми START.",
      err_bet:"Неверная ставка.", err_balance:"Недостаточно средств.",
      cls_title:"🏆 РЕЙТИНГ", cls_yourname:"Твоё имя",
      cls_hint:"нетто = выигрыши − проигрыши (может быть отрицательным)",
      cls_tg_hint:"ты определяешься по профилю Telegram",
      cls_tg_name_title:"Имя из профиля Telegram",
      btn_play:"▶ ИГРАТЬ"
    }
  };

  function detect(){
    try{ const s=localStorage.getItem(KEY); if(s&&LANGS.indexOf(s)>=0) return s; }catch(e){}
    let dev=null;
    try{ const TG=window.Telegram&&window.Telegram.WebApp; const u=TG&&TG.initDataUnsafe&&TG.initDataUnsafe.user; if(u&&u.language_code) dev=u.language_code; }catch(e){}
    if(!dev){ try{ dev=navigator.language||navigator.userLanguage; }catch(e){} }
    dev=(dev||"en").slice(0,2).toLowerCase();
    return LANGS.indexOf(dev)>=0?dev:"en";
  }

  let cur=detect();

  function t(key,params){
    const d=DICT[cur]||DICT.en;
    let s=(d[key]!=null)?d[key]:((DICT.en[key]!=null)?DICT.en[key]:key);
    if(params) s=s.replace(/\{(\w+)\}/g,function(m,k){ return (k in params)?params[k]:m; });
    return s;
  }
  function apply(root){
    (root||document).querySelectorAll("[data-i18n]").forEach(function(el){ el.textContent=t(el.getAttribute("data-i18n")); });
    try{ document.documentElement.lang=cur; }catch(e){}
  }
  function set(lang){
    if(LANGS.indexOf(lang)<0) return;
    cur=lang;
    try{ localStorage.setItem(KEY,lang); }catch(e){}
    apply(document);
    try{ window.dispatchEvent(new Event("i18n:change")); }catch(e){}
  }

  window.I18N={ LANGS:LANGS, NAMES:NAMES, FLAGS:FLAGS, t:t, apply:apply, set:set, get cur(){return cur;} };
})();
