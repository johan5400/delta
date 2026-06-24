/* ════════════════════════════════════════════════════════════
   LIVE JUDGING — ZONE K HYROX · cœur partagé
   Une seule config Firebase ici, utilisée par live.html / juge.html / admin.html
   ════════════════════════════════════════════════════════════ */
(function(){
"use strict";

/* Affiche toute erreur fatale au lieu d'un ecran noir */
function showFatal(err){
  console.error(err);
  var a=document.getElementById("app"); if(!a) return;
  a.innerHTML='<div style="max-width:560px;margin:0 auto;padding:50px 24px;font-family:DM Sans,sans-serif">'
    +'<div style="font-family:Barlow Condensed,sans-serif;font-weight:900;font-size:26px;color:#E53935">Erreur au demarrage</div>'
    +'<div style="color:#9A9AA4;font-size:13px;margin:10px 0 16px;line-height:1.6">Le live n a pas pu se lancer. Detail technique ci-dessous.</div>'
    +'<pre style="background:#141417;border:1px solid #27272E;border-radius:10px;padding:14px;color:#FF8A8A;font-size:12px;white-space:pre-wrap;word-break:break-word">'
    +String((err&&err.stack)||(err&&err.message)||err)+'</pre>'
    +'<button onclick="location.reload()" style="margin-top:14px;background:#E53935;color:#fff;border:none;border-radius:10px;padding:11px 18px;font-weight:700;cursor:pointer">Recharger</button></div>';
}

const FIREBASE_CONFIG = {
  apiKey:            "AIzaSyBl8pShKqlL9WGQvIk-yR39ZY4lzBRlZfE",
  authDomain:        "race-simulation-d5306.firebaseapp.com",
  databaseURL:       "https://race-simulation-d5306-default-rtdb.europe-west1.firebasedatabase.app",
  projectId:         "race-simulation-d5306",
  storageBucket:     "race-simulation-d5306.firebasestorage.app",
  messagingSenderId: "1090779920937",
  appId:             "1:1090779920937:web:d9f07a1ce13e2c0127ba38"
};
const RACE_ID = "zonek-live";   // un identifiant de course (change-le pour une nouvelle course)

/* Permet aussi de coller la config depuis l'admin (stockée sur l'appareil) */
const SAVED_CFG = (()=>{try{return JSON.parse(localStorage.getItem('zonek-fb-cfg')||'null')}catch(e){return null}})();
const CFG = (SAVED_CFG && SAVED_CFG.databaseURL) ? SAVED_CFG : FIREBASE_CONFIG;
const HAS_FIREBASE = !!(CFG && CFG.databaseURL);

const HYROX_STATIONS = [
  {name:"SkiErg",            target:0,   laps:0},
  {name:"Sled Push",         target:0,   laps:4},
  {name:"Sled Pull",         target:0,   laps:4},
  {name:"Burpee Broad Jump", target:80,  laps:0},
  {name:"Rowing",            target:0,   laps:0},
  {name:"Farmers Carry",     target:0,   laps:4},
  {name:"Sandbag Lunges",    target:0,   laps:4},
  {name:"Wall Balls",        target:100, laps:0}
];
/* objectif "actif" d'une station : aller-retour si défini, sinon reps */
function stTarget(s){ s=s||{}; return (s.laps>0)?s.laps:(s.target||0); }
function stUnit(s){ s=s||{}; return (s.laps>0)?"aller-retour":"reps"; }

let DB = null, app = null;

async function makeDB(){
  const base = "races/"+RACE_ID;
  if(HAS_FIREBASE){
    const { initializeApp } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js");
    const { getDatabase, ref, onValue, set, update, get, remove } =
      await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js");
    const app = initializeApp(CFG);
    const db = getDatabase(app);
    const P = p => p ? base+"/"+p : base;
    return {
      mode:"firebase",
      sub(path, cb){ return onValue(ref(db, P(path)), s=>cb(s.val())); },
      async getOnce(path){ const s = await get(ref(db, P(path))); return s.val(); },
      set(path, val){ return set(ref(db, P(path)), val); },
      update(path, obj){ return update(ref(db, P(path)), obj); },
      remove(path){ return remove(ref(db, P(path))); },
      now(){ return Date.now(); }          // horloge locale (suffit pour un chrono d'event)
    };
  }
  /* ---- MODE DÉMO : état local + synchro entre onglets via BroadcastChannel ---- */
  const KEY = "zonek-live-demo";
  let tree = load();
  const subs = [];
  const bc = ("BroadcastChannel" in window) ? new BroadcastChannel(KEY) : null;
  function load(){ try{return JSON.parse(localStorage.getItem(KEY))||{}}catch(e){return {}} }
  function persist(){ localStorage.setItem(KEY, JSON.stringify(tree)); }
  function getPath(p){ if(!p) return tree; return p.split("/").reduce((o,k)=> (o==null?undefined:o[k]), tree); }
  function setPath(p,val){
    const ks=p.split("/"); let o=tree;
    for(let i=0;i<ks.length-1;i++){ if(typeof o[ks[i]]!=="object"||o[ks[i]]==null)o[ks[i]]={}; o=o[ks[i]]; }
    if(val===null||val===undefined) delete o[ks[ks.length-1]]; else o[ks[ks.length-1]]=val;
  }
  function fire(changedPrefix){
    subs.forEach(s=>{ if(changedPrefix===null || s.path===changedPrefix || s.path.startsWith(changedPrefix) || changedPrefix.startsWith(s.path)) s.cb(getPath(s.path)); });
  }
  function broadcast(){ if(bc) bc.postMessage(Date.now()); }
  if(bc) bc.onmessage = ()=>{ tree=load(); fire(null); };
  window.addEventListener("storage", e=>{ if(e.key===KEY){ tree=load(); fire(null); } });
  return {
    mode:"demo",
    sub(path, cb){ const o={path,cb}; subs.push(o); cb(getPath(path)); return ()=>{ const i=subs.indexOf(o); if(i>=0)subs.splice(i,1); }; },
    async getOnce(path){ return getPath(path); },
    set(path, val){ setPath(path, val); persist(); broadcast(); fire(path); return Promise.resolve(); },
    update(path, obj){ Object.keys(obj).forEach(k=>setPath(path+"/"+k, obj[k])); persist(); broadcast(); fire(path); return Promise.resolve(); },
    remove(path){ setPath(path, null); persist(); broadcast(); fire(path); return Promise.resolve(); },
    now(){ return Date.now(); }
  };
}

const $ = s=>document.querySelector(s);
function qs(name){ return new URLSearchParams(location.search).get(name); }
function esc(s){ return String(s==null?"":s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c])); }
const ST_ABBR={"SkiErg":"SKI","Sled Push":"PUSH","Sled Pull":"PULL","Burpee Broad Jump":"BURP","Rowing":"ROW","Farmers Carry":"FARM","Sandbag Lunges":"LUNG","Wall Balls":"WALL","Run":"RUN"};
function stAbbr(name){ if(ST_ABBR[name]) return ST_ABBR[name]; return esc(String(name||"").replace(/[^A-Za-zÀ-ÿ0-9]/g,"").slice(0,4).toUpperCase()); }
function toast(msg){ const t=$("#toast"); t.textContent=msg; t.classList.add("show"); clearTimeout(t._h); t._h=setTimeout(()=>t.classList.remove("show"),2200); }
function fmtTime(ms){
  if(ms==null||ms<0||!isFinite(ms)) return "—";
  const s=Math.floor(ms/1000), h=Math.floor(s/3600), m=Math.floor((s%3600)/60), ss=s%60;
  const p=n=>String(n).padStart(2,"0");
  return h>0 ? h+":"+p(m)+":"+p(ss) : p(m)+":"+p(ss);
}
/* Calcule le classement à partir d'un snapshot complet de la course */
function computeBoard(race){
  race = race||{};
  const meta = race.meta||{};
  const order = meta.stationOrder||[];
  const N = order.length;
  const athletes = race.athletes ? Object.values(race.athletes) : [];
  const splits = race.splits||{};
  const live = race.live||{};
  const raceStart = meta.startedAt||0;
  const nowT = DB.now();
  const rows = athletes.map(a=>{
    const sp = splits[a.dossard]||{};
    const idxs = Object.keys(sp).map(Number);
    const done = idxs.length;
    const lastTs = idxs.length ? Math.max(...idxs.map(i=>sp[i].ts||0)) : 0;
    let curIdx=-1; for(let i=0;i<N;i++){ if(!(String(i) in sp)){curIdx=i;break;} }
    const finished = !!a.finishedAt || (N>0 && done>=N);
    const aStart = a.startedAt||raceStart||0;
    const lv = (curIdx>=0)?live[curIdx]:null;
    const liveReps = (lv && String(lv.dossard)===String(a.dossard)) ? lv.reps : null;
    const endTs = a.finishedAt ? a.finishedAt : (finished ? lastTs : nowT);
    const elapsed = aStart ? (endTs - aStart) : 0;
    return {a,done,curIdx,finished,liveReps,lastTs,aStart,elapsed,
            curStation: finished?null:(order[curIdx]||null)};
  });
  rows.sort((p,q)=>{
    if(q.done!==p.done) return q.done-p.done;
    const pe=p.lastTs?(p.lastTs-p.aStart):Infinity;
    const qe=q.lastTs?(q.lastTs-q.aStart):Infinity;
    if(pe!==qe) return pe-qe;
    return String(p.a.dossard).localeCompare(String(q.a.dossard));
  });
  return {rows, meta, order, N};
}

window._seedDemo = async function(auto,stay){
  const stations = HYROX_STATIONS.slice();
  const names = [["12","Léa","Bernard","Pro F"],["7","Marc","Dubois","Pro H"],["23","Inès","Moreau","Open F"],
    ["4","Hugo","Lefèvre","Open H"],["31","Sarah","Petit","Open F"],["18","Thomas","Roux","Pro H"],
    ["9","Camille","Girard","Open F"],["27","Lucas","Fontaine","Open H"]];
  const athletes={}; names.forEach((n,i)=>{
    const day = i<5?"1":"2";
    const wave = ["09:00","09:00","09:30","09:30","10:00","09:00","09:30","10:00"][i];
    athletes[n[0]]={dossard:n[0],prenom:n[1],nom:n[2],name:n[1]+" "+n[2],category:n[3],raceDay:day,wave:wave,startedAt:null};
  });
  const start = DB.now();
  await DB.set("meta",{name:"HYROX Race Simulation",stationOrder:stations.map(s=>s.name),status:"running",startedAt:start,createdAt:start});
  await DB.set("stations", stations);
  await DB.set("athletes", athletes);
  await DB.set("config",{categories:["Pro H","Pro F","Open H","Open F"],
    waveDefs:[{day:"1",time:"09:00",label:"Pro"},{day:"1",time:"09:30",label:"Open"},{day:"1",time:"10:00",label:"Open"},{day:"2",time:"10:00",label:"Open"}]});
  await DB.remove("splits"); await DB.remove("live"); await DB.remove("waves");
  // démarre les athlètes (chrono par athlète) pour une démo vivante
  const startUp={}; Object.keys(athletes).forEach((dn,i)=>{ startUp[dn+"/startedAt"]=start-(i*1500); });
  await DB.update("athletes",startUp);
  // pré-remplit une progression réaliste
  const splits={}; const live={};
  names.forEach((n,i)=>{
    const dn=n[0]; const done=Math.max(0, 5-Math.floor(i*0.7)); splits[dn]={};
    let t=start+8000+i*1500;
    for(let k=0;k<done;k++){ t+=120000+Math.random()*40000; splits[dn][k]={reps:stations[k].target||0,ts:t,durationMs:90000}; }
    if(done<stations.length){ live[done]=live[done]||{}; }
  });
  // un juge "en cours" sur la station du leader
  live["5"]={dossard:"7",reps:42,target:0,updatedAt:start};
  await DB.set("splits",splits);
  await DB.set("live",live);
  toast("✅ Course de démo chargée");
  if(auto){ window._startAutoSim(); toast("▶️ Simulation auto lancée"); }
  if(!stay) setTimeout(function(){ location.href="live.html"; }, 700);
};
window._startAutoSim = function(){
  if(window._simTimer) return;
  window._simTimer = setInterval(async ()=>{
    const race = await DB.getOnce("");
    if(!race||!race.athletes) return;
    const order=(race.meta&&race.meta.stationOrder)||[];
    const stations=race.stations||[];
    const splits=race.splits||{}; const live=race.live||{};
    const dossards=Object.keys(race.athletes);
    const dn=dossards[Math.floor(Math.random()*dossards.length)];
    const sp=splits[dn]||{}; let cur=-1;
    for(let i=0;i<order.length;i++){ if(!(String(i) in sp)){cur=i;break;} }
    if(cur<0) return;
    const tgt=stTarget(stations[cur]);
    const lk=String(cur); const cl=live[lk];
    if(!cl||String(cl.dossard)!==String(dn)){ await DB.set("live/"+lk,{dossard:dn,reps:0,target:tgt,updatedAt:DB.now()}); return; }
    const nr=(cl.reps||0)+Math.ceil(Math.random()*6);
    if(tgt>0 && nr>=tgt){ await DB.set("splits/"+dn+"/"+cur,{reps:tgt,ts:DB.now(),durationMs:90000}); await DB.remove("live/"+lk); }
    else if(tgt===0 && Math.random()<0.25){ await DB.set("splits/"+dn+"/"+cur,{reps:nr,ts:DB.now(),durationMs:90000}); await DB.remove("live/"+lk); }
    else { await DB.set("live/"+lk+"/reps",nr); await DB.set("live/"+lk+"/updatedAt",DB.now()); }
  }, 900);
};

/* ════════════════════════════════════════════════════════════
   ÉCRAN PUBLIC
   ════════════════════════════════════════════════════════════ */

function renderScreen(){
  app.innerHTML = `
  <div class="screen">
    <div class="scr-top">
      <div class="scr-klogo">K</div>
      <div>
        <div class="scr-title">ZONE K · HYROX</div>
        <div class="scr-sub">RACE SIMULATION · LIVE</div>
      </div>
      <div style="margin-left:18px"><span class="scr-status"><span class="dot" id="scr-dot"></span><span id="scr-state">EN ATTENTE</span></span></div>
      <div class="scr-clock">
        <div class="big mono" id="scr-clock">00:00</div>
        <div class="lbl">Temps de course</div>
      </div>
    </div>
    <div class="board" id="board"></div>
    <div class="scr-foot">
      <span id="scr-count">0 athlètes</span>
      <span>·</span>
      <span id="scr-mode">${DB.mode==='firebase'?'TEMPS RÉEL':'DÉMO'}</span>
      <div class="legend">
        <span><span class="lg-sw" style="background:var(--green)"></span>Station faite</span>
        <span><span class="lg-sw" style="background:var(--orange)"></span>En cours (+ reps)</span>
        <span><span class="lg-sw" style="background:var(--panel2);opacity:.4"></span>A venir</span>
      </div>
    </div>
  </div>`;

  let lastRace=null;
  DB.sub("", race=>{ lastRace=race; paint(race); });
  // re-paint régulier pour faire avancer chronos / reps live
  setInterval(()=>paint(lastRace), 1000);

  const LANE_H=72, GAP=10;
  function paint(race){
    const {rows, meta, N} = computeBoard(race);
    const board=$("#board"); if(!board) return;
    const running = meta.status==="running";
    $("#scr-dot").className = "dot"+(running?" live":"");
    $("#scr-state").textContent = meta.status==="done"?"TERMINÉ":(running?"EN DIRECT":"EN ATTENTE");
    $("#scr-clock").textContent = meta.startedAt? fmtTime(DB.now()-meta.startedAt) : "00:00";
    $("#scr-count").textContent = rows.length+" athlète"+(rows.length>1?"s":"");

    if(!rows.length){
      board.innerHTML = `<div class="scr-empty"><div class="ic">🏁</div>
        <div style="font-family:var(--head);font-weight:800;font-size:24px;color:var(--txt2)">Aucun athlète en piste</div>
        <div style="font-size:13px">Configure la course dans la console admin, puis lance le départ.</div></div>`;
      return;
    }
    // hauteur de couloir adaptative
    const avail = board.clientHeight;
    const lh = Math.max(70, Math.min(104, (avail-(rows.length-1)*GAP)/rows.length));
    const order = (race.meta&&race.meta.stationOrder)|| (race.stations||[]).map(s=>s.name) || [];
    rows.forEach((r,i)=>{
      const dn=r.a.dossard, id="lane-"+dn;
      let el=document.getElementById(id);
      if(!el){
        el=document.createElement("div"); el.id=id; el.className="lane";
        el.innerHTML=`<div class="rk"></div><div class="bib"></div>
          <div class="who"><div class="aname"></div><div class="prog"></div></div>
          <div class="time mono"></div>`;
        board.appendChild(el);
      }
      el.style.height=lh+"px";
      el.style.transform="translateY("+(i*(lh+GAP))+"px)";
      el.className="lane"+(r.finished?" fin":(i===0?" leader":(i<3?" podium":"")));
      el.querySelector(".rk").textContent=i+1;
      el.querySelector(".bib").textContent="#"+dn;
      el.querySelector(".aname").innerHTML=`${esc(r.a.name||(r.a.prenom+" "+r.a.nom))}`
        + (r.a.category?`<span class="acat-inline">${esc(r.a.category)}</span>`:"");
      // barre d'avancement par station : 🟢 fini · 🟠 en cours (+reps) · à venir estompé
      const tgt = stTarget(race.stations&&race.stations[r.curIdx]);
      let segs="";
      for(let k=0;k<N;k++){
        const name=order[k]||("S"+(k+1));
        if(r.finished || k<r.done){ segs+=`<div class="seg done" title="${esc(name)}">${stAbbr(name)}</div>`; }
        else if(k===r.curIdx){
          const repsTxt = (r.liveReps!=null) ? `<span class="seg-reps">${r.liveReps}${tgt?'/'+tgt:''}</span>` : "";
          segs+=`<div class="seg cur" title="${esc(name)}">${stAbbr(name)}${repsTxt}</div>`;
        }
        else { segs+=`<div class="seg up">${stAbbr(name)}</div>`; }
      }
      el.querySelector(".prog").innerHTML=segs;
      el.querySelector(".time").textContent=r.aStart?fmtTime(r.elapsed):"—";
    });
    // retire les couloirs d'athlètes disparus
    Array.from(board.querySelectorAll(".lane")).forEach(el=>{
      const dn=el.id.replace("lane-",""); if(!rows.some(r=>String(r.a.dossard)===dn)) el.remove();
    });
  }
}

function renderJuge(){
  app.innerHTML = `
  <div class="juge">
    <div class="j-head">
      <div><div class="j-st-ey" id="j-ey">STATION</div><div class="j-st-name" id="j-stname">—</div></div>
      <div class="j-conn"><span class="dot" id="j-dot"></span><span id="j-mode">${DB.mode==='firebase'?'EN LIGNE':'DÉMO'}</span></div>
    </div>
    <div class="j-body" id="j-body"><div class="j-hint">Chargement…</div></div>
  </div>`;

  let race={}, myStation=null, myStationIdx=-1, curDossard=null, curAthlete=null, reps=0, pushTimer=null, stationStartTs=null, _doneBuzzed=false;

  DB.sub("", r=>{ race=r||{}; if(myStationIdx<0) initStationPicker(); else { syncFromRace(); } });
  setInterval(()=>{ if(curAthlete && race.athletes) curAthlete=race.athletes[curDossard]||curAthlete; tickChrono(); }, 1000);

  function stations(){ return (race.stations)|| (race.meta&&race.meta.stationOrder||[]).map(n=>({name:n,target:0})); }

  function initStationPicker(){
    const urlSt = qs("station");
    const sts = stations();
    if(!sts.length){ $("#j-body").innerHTML=`<div class="j-hint">Aucune course active.<br>Demande à l'admin de configurer puis lancer la course.</div>`; return; }
    if(urlSt!=null && sts[+urlSt]){ selectStation(+urlSt); return; }
    $("#j-ey").textContent="CHOISIS TA STATION";
    $("#j-stname").textContent="—";
    $("#j-body").innerHTML = `<div class="j-sel">
        <label>Quelle station juges-tu ?</label>
        <select class="field" id="pick-st">
          <option value="">— Sélectionner —</option>
          ${sts.map((s,i)=>`<option value="${i}">${i+1}. ${esc(s.name)}${s.target?` (objectif ${s.target})`:''}</option>`).join("")}
        </select>
      </div>
      <div class="j-hint">Tu pourras changer d'athlète à chaque passage.<br>Compte les <b>reps valides</b> uniquement.</div>`;
    $("#pick-st").onchange=e=>{ if(e.target.value!=="") selectStation(+e.target.value); };
  }

  function selectStation(idx){
    myStationIdx=idx; const s=stations()[idx]; myStation=s;
    $("#j-ey").textContent="STATION "+(idx+1)+" / "+stations().length;
    $("#j-stname").textContent=s.name;
    renderJudgeBody();
  }

  function renderJudgeBody(){
    const tgt = stTarget(myStation); const unit = stUnit(myStation);
    const addLabel = myStation.laps>0 ? "+1 ALLER-RETOUR" : "+1 REP";
    $("#j-body").innerHTML = `
      <div class="j-sel" id="j-pick">
        <label>Équipe sur le floor à <b>${esc(myStation.name)}</b> <span id="floor-count" style="color:var(--red-bright)"></span></label>
        <input class="field" id="ath-search" inputmode="search" placeholder="🔍 Filtrer par dossard ou nom…" style="margin:8px 0 12px">
        <div id="ath-cards" class="ath-cards"></div>
        <div id="ath-empty" class="hide" style="color:var(--txt3);font-size:13px;text-align:center;padding:18px 8px;line-height:1.6">Personne sur le floor pour l'instant.<br>Dès qu'une vague est lancée au départ, les équipes apparaissent ici.</div>
      </div>
      <div id="judge-active" class="hide" style="display:flex;flex-direction:column;flex:1">
        <button id="btn-back" style="align-self:flex-start;background:var(--panel2);border:1px solid var(--line);color:var(--txt2);border-radius:8px;padding:6px 12px;font-size:13px;font-weight:600;margin-bottom:6px">← changer d'équipe</button>
        <div class="j-current">
          <span class="j-cur-bib" id="ja-bib">#—</span>
          <div class="j-cur-name" id="ja-name">—</div>
          <div class="mono" id="ja-chrono" style="font-size:22px;font-weight:700;color:var(--red-bright);margin-top:4px">00:00</div>
        </div>
        <div id="ja-done" class="hide" style="background:var(--green);color:#06281A;border-radius:12px;padding:12px;text-align:center;font-family:var(--head);font-weight:900;font-size:20px;letter-spacing:1px;margin-bottom:10px">✅ STATION TERMINÉE — VALIDE</div>
        <div class="counter">
          <div class="ring">
            <svg width="230" height="230" viewBox="0 0 230 230">
              <circle cx="115" cy="115" r="100" stroke="var(--line)" stroke-width="14" fill="none"/>
              <circle id="ring-prog" cx="115" cy="115" r="100" stroke="var(--red)" stroke-width="14" fill="none"
                stroke-linecap="round" stroke-dasharray="628" stroke-dashoffset="628"/>
            </svg>
            <div class="ring-num"><div class="ring-reps" id="ring-reps">0</div>
              <div class="ring-target" id="ring-target">${tgt?('/ '+tgt+' '+unit):(unit+' comptés')}</div></div>
          </div>
        </div>
        <div class="tap">
          <button class="tap-add" id="btn-add">${addLabel}</button>
          <div class="tap-row">
            <button class="tap-minus" id="btn-minus">−1</button>
            <button class="tap-valid" id="btn-valid">✓ VALIDER LA STATION</button>
          </div>
        </div>
      </div>
      <div id="judge-idle" class="hide"></div>`;

    fillAthletes();
    $("#ath-search").oninput = ()=>fillAthletes();
    $("#btn-back").onclick = ()=>backToPick();
    $("#btn-add").onclick=()=>bump(+1);
    $("#btn-minus").onclick=()=>bump(-1);
    $("#btn-valid").onclick=validate;
  }

  function backToPick(){
    if(curDossard!=null) DB.remove("live/"+myStationIdx);   // libère la station
    curDossard=null; curAthlete=null; reps=0;
    $("#judge-active").classList.add("hide");
    $("#j-pick").classList.remove("hide");
    fillAthletes();
  }

  function fillAthletes(){
    const wrap=$("#ath-cards"); if(!wrap) return;
    const q=($("#ath-search")?$("#ath-search").value:"").trim().toLowerCase();
    const aths = race.athletes? Object.values(race.athletes):[];
    const order=(race.meta&&race.meta.stationOrder)||[]; const splits=race.splits||{};
    const live=race.live||{}; const now=DB.now();
    const liveHere = live[myStationIdx]||live[String(myStationIdx)];
    const tagged = aths.map(a=>{
      const sp=splits[a.dossard]||{};
      let cur=-1; for(let i=0;i<order.length;i++){ if(!(String(i) in sp)){cur=i;break;} }
      const finished = cur<0;
      const onFloor = !!a.startedAt && !finished && !a.finishedAt;
      const idxs=Object.keys(sp).map(Number);
      const lastTs = idxs.length? Math.max.apply(null,idxs.map(i=>sp[i].ts||0)) : (a.startedAt||0);
      const elapsed = a.startedAt? (now-a.startedAt):0;
      const prevName = (cur-1)>=0 ? (order[cur-1]||"") : "Départ";
      return {a, atMine: cur===myStationIdx, curIdx:cur, finished, onFloor, elapsed, lastTs, prevName, sinceMs: now-lastTs};
    }).filter(t=>t.onFloor);
    const filtered = q? tagged.filter(t=> String(t.a.dossard).toLowerCase().includes(q) || String(t.a.name||"").toLowerCase().includes(q)) : tagged;
    const fc=$("#floor-count"); if(fc) fc.textContent = tagged.length? "· "+tagged.length+" sur le floor" : "";
    const empty=$("#ath-empty");
    if(!filtered.length){ wrap.innerHTML=""; if(empty){ empty.classList.remove("hide"); empty.textContent = q? "Aucun dossard ne correspond à « "+q+" »." : "Personne sur le floor. Dès qu'une vague est lancée au départ, les équipes apparaissent ici."; } return; }
    if(empty) empty.classList.add("hide");

    // ➡️ Celles dont LA PROCHAINE station est la tienne = elles arrivent chez toi.
    //    Triées par ordre où elles ont fini la station précédente (la 1re sortie arrive en 1er).
    const mine = filtered.filter(t=>t.atMine).sort((x,y)=> x.lastTs - y.lastTs);
    const others = filtered.filter(t=>!t.atMine).sort((x,y)=> y.elapsed - x.elapsed);

    function sinceTxt(ms){ const sec=Math.max(0,Math.round(ms/1000)); if(sec<60) return "il y a "+sec+" s"; return "il y a "+Math.floor(sec/60)+" min"; }
    function card(t, big){
      const isLive = liveHere && String(liveHere.dossard)===String(t.a.dossard);
      if(big){
        return `<button class="ath-card here" data-dn="${esc(t.a.dossard)}" style="border:2px solid var(--red);background:rgba(229,57,53,.09);padding:13px 12px;margin-bottom:8px">
          <span class="ac-bib" style="font-size:23px">#${esc(t.a.dossard)}</span>
          <span class="ac-info"><span class="ac-name" style="font-size:16px">${esc(t.a.name||t.a.prenom||'')}</span>
            <span class="ac-sub">${isLive?'🟠 en cours · ':'sort de <b>'+esc(t.prevName)+'</b> · '}${isLive?'':sinceTxt(t.sinceMs)}</span></span>
          <span class="ac-time mono">${fmtTime(t.elapsed)}</span>
        </button>`;
      }
      const stName=order[t.curIdx]||"";
      return `<button class="ath-card" data-dn="${esc(t.a.dossard)}" style="opacity:.8;margin-bottom:6px">
        <span class="ac-bib">#${esc(t.a.dossard)}</span>
        <span class="ac-info"><span class="ac-name">${esc(t.a.name||t.a.prenom||'')}</span>
          <span class="ac-sub">→ ${esc(stName)}</span></span>
        <span class="ac-time mono">${fmtTime(t.elapsed)}</span>
      </button>`;
    }

    let html="";
    if(mine.length){
      html += `<div style="font-size:12px;font-weight:800;color:var(--red-bright);text-transform:uppercase;letter-spacing:1px;margin:2px 0 9px">\u27a1\ufe0f Arrive \u00e0 ta station (${mine.length})</div>`;
      html += mine.map(t=>card(t,true)).join("");
    } else {
      html += `<div style="font-size:12px;color:var(--txt3);padding:6px 0 10px">Aucune \u00e9quipe en approche de ta station pour l'instant.</div>`;
    }
    if(others.length){
      html += `<div style="font-size:11px;font-weight:700;color:var(--txt3);text-transform:uppercase;letter-spacing:.5px;margin:14px 0 7px">Ailleurs sur le floor \u00b7 toucher pour corriger</div>`;
      html += others.map(t=>card(t,false)).join("");
    }
    wrap.innerHTML=html;
    Array.from(wrap.querySelectorAll(".ath-card")).forEach(b=>{ b.onclick=()=>pickAthlete(b.getAttribute("data-dn")); });
  }

  function pickAthlete(dn){
    curDossard=dn; const a=(race.athletes||{})[dn]||{dossard:dn,name:dn};
    curAthlete=a;
    const lv=(race.live||{})[String(myStationIdx)];
    reps = (lv && String(lv.dossard)===String(dn)) ? (lv.reps||0) : 0;
    stationStartTs = DB.now();
    $("#j-pick").classList.add("hide");
    $("#judge-active").classList.remove("hide");
    $("#ja-bib").textContent="#"+dn;
    $("#ja-name").textContent=a.name||(a.prenom+" "+a.nom);
    tickChrono();
    pushLive(true);
    drawRing();
  }
  function tickChrono(){
    const el=$("#ja-chrono"); if(!el||!curAthlete) return;
    el.textContent = curAthlete.startedAt? fmtTime(DB.now()-curAthlete.startedAt) : "non parti";
  }

  function bump(d){
    reps=Math.max(0,reps+d); drawRing();
    if(navigator.vibrate) navigator.vibrate(d>0?12:6);
    pushLive();
  }

  function drawRing(){
    const tgt=stTarget(myStation);
    $("#ring-reps").textContent=reps;
    const prog = tgt>0 ? Math.min(1,reps/tgt) : 0;
    const ring=$("#ring-prog"); if(ring){ ring.style.strokeDashoffset = 628*(1-prog); }
    const done = tgt>0 && reps>=tgt;
    if(ring) ring.setAttribute("stroke", done?"var(--green)":"var(--red)");
    const banner=$("#ja-done"); if(banner) banner.classList.toggle("hide", !done);
    const vb=$("#btn-valid"); if(vb){ vb.disabled=false; vb.style.animation = done?"segblink 1s infinite":""; }
    if(done && !_doneBuzzed){ _doneBuzzed=true; if(navigator.vibrate) navigator.vibrate([40,60,40,60,120]); }
    if(!done) _doneBuzzed=false;
  }

  function pushLive(immediate){
    if(curDossard==null||myStationIdx<0) return;
    const send=()=>DB.set("live/"+myStationIdx,{dossard:curDossard,reps:reps,target:stTarget(myStation),unit:stUnit(myStation),updatedAt:DB.now()});
    if(immediate){ send(); return; }
    clearTimeout(pushTimer); pushTimer=setTimeout(send,300);  // debounce léger
  }

  async function validate(){
    if(curDossard==null) return;
    const dur = stationStartTs? (DB.now()-stationStartTs):0;
    await DB.set("splits/"+curDossard+"/"+myStationIdx,{reps:reps,ts:DB.now(),durationMs:dur});
    await DB.remove("live/"+myStationIdx);
    if(navigator.vibrate) navigator.vibrate([20,40,20]);
    toast("✓ #"+curDossard+" validé · "+reps+" "+stUnit(myStation));
    curDossard=null; curAthlete=null; reps=0;
    $("#judge-active").classList.add("hide");
    $("#j-pick").classList.remove("hide");
    const sb=$("#ath-search"); if(sb) sb.value="";
    fillAthletes();
  }

  function syncFromRace(){
    // rafraîchit la liste des cartes si on est en mode sélection
    if($("#j-pick") && !$("#j-pick").classList.contains("hide")) fillAthletes();
  }
}

function renderAdmin(){
  let race={};
  app.innerHTML = `
  <div class="admin">
    <div class="a-h">⚙️ Console course</div>
    <div class="a-sub">Configure les athlètes et les stations, lance le départ, distribue les liens juges.</div>

    <div class="sec">
      <div class="sec-t">🔌 Connexion <span class="status-pill ${HAS_FIREBASE?'ok':'warn'}" id="cfg-status">${HAS_FIREBASE?'Firebase actif':'Mode démo (local)'}</span></div>
      <div class="sec-d">${HAS_FIREBASE
        ? 'Les données sont synchronisées en temps réel via Firebase. Tous les juges et le grand écran partagent la même course.'
        : 'Pour le vrai temps réel multi-téléphones, colle ta config Firebase ci-dessous (clé web, non secrète). Sans ça, tout reste local à cet appareil (les onglets se synchronisent quand même pour tester).'}</div>
      <details ${HAS_FIREBASE?'':'open'}>
        <summary style="cursor:pointer;color:var(--red);font-weight:600;font-size:13px;margin-bottom:10px">Coller / modifier la config Firebase</summary>
        <textarea class="a-field" id="fb-cfg" placeholder='{
  "apiKey":"...","authDomain":"...",
  "databaseURL":"https://...firebasedatabase.app",
  "projectId":"...","appId":"..."
}'>${SAVED_CFG?esc(JSON.stringify(SAVED_CFG,null,2)):''}</textarea>
        <div class="a-row">
          <button class="btn" onclick="window._saveCfg()">💾 Enregistrer & recharger</button>
          <button class="btn dark" onclick="window._clearCfg()">Effacer</button>
        </div>
        <div class="sec-d" style="margin-top:10px;margin-bottom:0">Règles RTDB conseillées pour l'event (à coller dans Firebase → Realtime Database → Règles) :
        <br><code style="font-family:var(--mono);font-size:11px;color:var(--gold)">{ "rules": { "races": { ".read": true, ".write": true } } }</code></div>
      </details>
    </div>

    <div class="sec">
      <div class="sec-t">🏃 Athlètes <span style="font-size:12px;color:var(--txt2);font-weight:400">· la saisie des équipes/vagues se fait dans la console (onglet Catégorie d'index.html)</span></div>
      <div class="sec-d">Affichage des équipes synchronisées depuis la console. Pour ajouter/modifier une équipe ou sa vague, utilise l'onglet <b>Catégorie</b> de la console (index.html).</div>
      <div id="ath-waves"></div>
    </div>

    <div class="sec">
      <div class="sec-t">🏋️ Stations · aller-retour &amp; reps</div>
      <div class="sec-d"><b>A/R</b> = nombre d'aller-retour à faire (Sled, Farmers, Lunges…). <b>Reps</b> = nombre de reps cible (Wall Balls, Burpees…). Si A/R &gt; 0 le juge compte les aller-retour, sinon les reps. <b>0/0</b> = comptage libre. Dès que l'athlète atteint l'objectif, l'appli juge prévient le juge.</div>
      <div id="st-list"></div>
      <button class="btn dark" onclick="window._resetStations()" style="margin-top:8px">↺ Stations HYROX par défaut</button>
    </div>

    <div class="sec">
      <div class="sec-t">🚦 Course</div>
      <div class="sec-d">Statut : <b id="race-state" class="mono">—</b></div>
      <div class="a-row">
        <button class="btn lg" onclick="window._startRace()">▶️ Donner le départ</button>
        <button class="btn dark" onclick="window._stopRace()">⏹ Terminer</button>
        <button class="btn dark" onclick="window._resetRace()">🗑 Réinitialiser</button></div>
      <div class="a-row" style="margin-top:10px">
        <button class="btn dark" onclick="window._seedDemo(false,true)">🎬 Charger démo</button>
        <button class="btn dark" onclick="window._seedDemo(true,true)">▶️ Démo auto-animée</button>
      </div>
    </div>

    <div class="sec">
      <div class="sec-t">🔗 Liens & QR</div>
      <div class="sec-d">Ouvre l'écran sur la TV, et donne à chaque juge le QR de sa station. Quand un juge scanne, il arrive direct sur le compteur de sa station.</div>
      <div class="link-box">
        <div class="lbl">🌐 Lien public de base — ce que les juges scannent</div>
        <input id="pub-base" class="a-field" style="margin-bottom:6px" placeholder="">
        <div class="link-row"><button class="btn" onclick="window._setBase()">Enregistrer</button>
          <span style="font-size:11px;color:var(--txt2)">⚠️ Indispensable si tu génères les QR ailleurs que sur l'URL déployée. Vide = adresse actuelle.</span></div>
      </div>
      <div class="link-box">
        <div class="lbl">📺 Écran public</div>
        <div class="url" id="link-screen"></div>
        <div class="link-row"><button class="btn dark" onclick="window._copy('link-screen')">Copier</button>
          <button class="btn" onclick="window.open(document.getElementById('link-screen').textContent,'_blank')">Ouvrir</button></div>
      </div>
      <div class="link-box">
        <div class="lbl">📱 Lien juge générique</div>
        <div class="url" id="link-juge"></div>
        <div class="link-row"><button class="btn dark" onclick="window._copy('link-juge')">Copier</button></div>
      </div>
      <div style="font-family:var(--head);font-weight:700;font-size:14px;letter-spacing:.5px;margin:14px 0 4px">QR par station</div>
      <div class="qr-grid" id="qr-grid"></div>
    </div>
  </div>`;

  DB.sub("", r=>{ race=r||{}; refreshAdmin(race); });

  function refreshAdmin(race){
    // athlètes
    const aths = race.athletes? Object.values(race.athletes):[];
    const groups={};
    aths.forEach(a=>{ const day=a.raceDay||"1", wave=a.wave||"--:--"; const k=day+"@"+wave; (groups[k]=groups[k]||{day,wave,teams:[]}).teams.push(a); });
    const gl=Object.values(groups).sort((x,y)=> x.day===y.day ? (x.wave<y.wave?-1:x.wave>y.wave?1:0) : (x.day<y.day?-1:1));
    const wbox=$("#ath-waves");
    if(wbox) wbox.innerHTML = gl.length? gl.map(g=>`
      <div style="border:1px solid var(--line);border-radius:12px;padding:10px 12px;margin-bottom:10px">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;flex-wrap:wrap">
          <span style="font-family:var(--head);font-weight:900;font-size:16px">🚦 ${dayLabel(g.day)} · ${esc(g.wave)}</span>
          <span style="font-size:12px;color:var(--txt2)">${g.teams.length} équipe${g.teams.length>1?'s':''}</span>
          <span style="margin-left:auto;font-size:10px;color:var(--txt3)">depuis la console</span>
        </div>
        ${g.teams.sort((p,q)=>String(p.dossard).localeCompare(String(q.dossard),undefined,{numeric:true})).map(a=>
          `<span class="chip"><b>#${esc(a.dossard)}</b> ${esc(a.name||a.prenom||'')}${a.category?` <span style="color:var(--txt3)">· ${esc(a.category)}</span>`:''} <button onclick="window._delAth('${esc(a.dossard)}')">×</button></span>`).join("")}
      </div>`).join("")
      : `<span style="color:var(--txt3);font-size:13px">Aucune équipe. Choisis un jour + une heure de vague ci-dessus, puis ajoute.</span>`;
    // stations
    const sts = race.stations || HYROX_STATIONS;
    $("#st-list").innerHTML = sts.map((s,i)=>
      `<div class="st-row"><span class="st-idx">${i+1}</span>
        <span class="st-nm">${esc(s.name)}</span>
        <label style="font-size:10px;color:var(--txt3);font-family:var(--head);font-weight:700">A/R<input class="st-tg mono" style="width:58px;margin-left:4px" type="number" min="0" value="${s.laps||0}" onchange="window._setLaps(${i},this.value)" title="Aller-retour (0 = aucun)"></label>
        <label style="font-size:10px;color:var(--txt3);font-family:var(--head);font-weight:700">REPS<input class="st-tg mono" style="width:62px;margin-left:4px" type="number" min="0" value="${s.target||0}" onchange="window._setTarget(${i},this.value)" title="Objectif reps (0 = libre)"></label>
      </div>`).join("");
    // statut
    const st=(race.meta&&race.meta.status)||"non démarré";
    $("#race-state").textContent = st.toUpperCase()+((race.meta&&race.meta.startedAt)?(" · départ "+new Date(race.meta.startedAt).toLocaleTimeString("fr-FR",{hour:"2-digit",minute:"2-digit"})):"");
    // liens — base publique configurable (sinon adresse actuelle)
    const curDir = location.href.replace(/[^/]*$/,"");
    let base = (localStorage.getItem('zonek-pub-base')||"").trim() || curDir;
    if(!base.endsWith("/")) base += "/";
    const inp=$("#pub-base");
    if(inp){ inp.placeholder=curDir; if(document.activeElement!==inp) inp.value=(localStorage.getItem('zonek-pub-base')||"").trim(); }
    $("#link-screen").textContent = base+"live.html";
    $("#link-juge").textContent = base+"juge.html";
    // QR par station -> ouvre juge.html?station=i (page de judging de la station)
    const grid=$("#qr-grid");
    grid.innerHTML = sts.map((s,i)=>{
      const u = base+"juge.html?station="+i;
      const q = "https://api.qrserver.com/v1/create-qr-code/?size=200x200&margin=10&data="+encodeURIComponent(u);
      return `<div class="qr-card"><img src="${q}" alt="QR ${esc(s.name)}"><div class="qn">${i+1}. ${esc(s.name)}</div></div>`;
    }).join("");
  }

  window._setBase=function(){
    const v=$("#pub-base").value.trim();
    if(v){ localStorage.setItem('zonek-pub-base', v); toast("🌐 Lien de base enregistré"); }
    else { localStorage.removeItem('zonek-pub-base'); toast("Lien de base réinitialisé"); }
    refreshAdmin(race);
  };

  // actions admin (exposées globalement)
  window._saveCfg=function(){ try{ const o=JSON.parse($("#fb-cfg").value); localStorage.setItem('zonek-fb-cfg',JSON.stringify(o)); toast("✅ Config enregistrée, rechargement…"); setTimeout(()=>location.reload(),700);}catch(e){ toast("❌ JSON invalide"); } };
  window._clearCfg=function(){ localStorage.removeItem('zonek-fb-cfg'); toast("Config effacée"); setTimeout(()=>location.reload(),600); };
  window._addAth=function(){ toast("La saisie des équipes se fait dans la console (onglet Catégorie d'index.html)."); };
  window._pasteAth=function(){ toast("La saisie des équipes se fait dans la console (onglet Catégorie d'index.html)."); };
  window._delAth=async function(d){ await DB.remove("athletes/"+d); await DB.remove("splits/"+d); };
  window._setTarget=async function(i,v){ const sts=(race.stations||HYROX_STATIONS).slice(); if(!sts[i])return; sts[i]={...sts[i],target:parseInt(v)||0}; await DB.set("stations",sts); await DB.set("meta/stationOrder",sts.map(s=>s.name)); };
  window._setLaps=async function(i,v){ const sts=(race.stations||HYROX_STATIONS).slice(); if(!sts[i])return; sts[i]={...sts[i],laps:parseInt(v)||0}; await DB.set("stations",sts); await DB.set("meta/stationOrder",sts.map(s=>s.name)); };
  window._resetStations=async function(){ await DB.set("stations",HYROX_STATIONS.slice()); await DB.set("meta/stationOrder",HYROX_STATIONS.map(s=>s.name)); toast("Stations réinitialisées"); };
  window._startRace=async function(){
    const sts=race.stations||HYROX_STATIONS;
    if(!race.athletes||!Object.keys(race.athletes).length){ toast("Ajoute des athlètes d'abord"); return; }
    await DB.update("meta",{name:(race.meta&&race.meta.name)||"HYROX Race Simulation",stationOrder:sts.map(s=>s.name),status:"running",startedAt:DB.now(),createdAt:(race.meta&&race.meta.createdAt)||DB.now()});
    if(!race.stations) await DB.set("stations",sts);
    toast("▶️ Départ donné !");
  };
  window._stopRace=async function(){ await DB.set("meta/status","done"); toast("⏹ Course terminée"); };
  window._resetRace=async function(){ if(!confirm("Réinitialiser splits, live et chrono ? (les athlètes et stations restent)"))return; await DB.remove("splits"); await DB.remove("live"); await DB.update("meta",{status:"idle",startedAt:null}); toast("🗑 Course réinitialisée"); };
  window._copy=function(id){ const t=document.getElementById(id).textContent; navigator.clipboard.writeText(t).then(()=>toast("📋 Copié")); };
}

/* ════════════════════════════════════════════════════════════
   APPLI DÉPART — le chef lance les vagues
   Une vague = toutes les équipes partageant (jour + heure).
   Lancer => startedAt=now sur chaque équipe de la vague.
   ════════════════════════════════════════════════════════════ */
function dayLabel(d){ return d==="2"?"Jour 2":(d==="12"?"Jours 1&2":"Jour 1"); }
function waveKey(a){ return (a.raceDay||"1")+"@"+(a.wave||"--:--"); }
function buildWaves(race){
  const aths = race.athletes? Object.values(race.athletes):[];
  const map={};
  aths.forEach(a=>{ const k=waveKey(a); (map[k]=map[k]||{key:k,day:a.raceDay||"1",time:a.wave||"--:--",teams:[],cats:{}}).teams.push(a);
    const c=a.category||"—"; map[k].cats[c]=(map[k].cats[c]||0)+1; });
  const wavesMeta = race.waves||{};
  const list = Object.values(map).map(w=>{ const wm=wavesMeta[w.key]||{}; w.startedAt=wm.startedAt||null;
    w.started=w.teams.some(t=>t.startedAt)|| !!wm.startedAt; return w; });
  list.sort((a,b)=> (a.day===b.day? (a.time<b.time?-1:a.time>b.time?1:0) : (a.day<b.day?-1:1)) );
  return list;
}
function renderDepart(){
  app.innerHTML = `
  <div class="juge" style="max-width:620px">
    <div class="j-head">
      <div><div class="j-st-ey">CHEF · DÉPART & ARRIVÉE</div><div class="j-st-name">Chrono des vagues</div></div>
      <div class="j-conn"><span class="dot" id="d-dot"></span><span>${DB.mode==='firebase'?'EN LIGNE':'DÉMO'}</span></div>
    </div>
    <div style="display:flex;gap:6px;padding:10px 14px 0" id="d-days"></div>
    <div class="j-body" id="d-body" style="padding:14px"><div class="j-hint">Chargement…</div></div>
  </div>`;
  let race={}, selDay=null;
  DB.sub("", r=>{ race=r||{}; paint(); });
  setInterval(paint, 250);

  function teamElapsed(t, wStart, now){
    const st = t.startedAt || wStart || 0;
    if(!st) return null;
    return (t.finishedAt || now) - st;
  }

  function paint(){
    const body=$("#d-body"); if(!body) return;
    const waves=buildWaves(race);
    if(!waves.length){ body.innerHTML=`<div class="j-hint">Aucune équipe enregistrée.<br>Ajoute les équipes et leurs heures de départ dans la console.</div>`; $("#d-days").innerHTML=""; return; }
    // sélecteur de jour
    const days=[...new Set(waves.map(w=>w.day))].sort();
    if(selDay==null) selDay = days[0];
    $("#d-days").innerHTML = days.map(d=>`<button onclick="window._dDay('${d}')" style="border:none;border-radius:9px;padding:8px 16px;font-weight:800;font-size:13px;cursor:pointer;font-family:inherit;${d===selDay?'background:var(--red);color:#fff':'background:var(--panel2);color:var(--txt2)'}">${dayLabel(d)}</button>`).join("")
      + `<div style="margin-left:auto;align-self:center;font-size:11px;color:var(--txt3)">${waves.filter(w=>w.day===selDay).length} vague(s)</div>`;

    const now=DB.now();
    const dayWaves=waves.filter(w=>w.day===selDay);
    const N=(race.meta&&race.meta.stationOrder?race.meta.stationOrder.length:8);
    body.innerHTML = dayWaves.map((w,wi)=>{
      const catTxt=Object.entries(w.cats).map(([c,n])=>`${esc(c)} (${n})`).join(" · ");
      const idx=wi+1;
      if(!w.started){
        return `<div class="st-row" style="align-items:center;padding:14px;margin-bottom:10px">
          <div style="flex:1">
            <div style="font-family:var(--head);font-weight:900;font-size:22px;line-height:1"><span style="color:var(--txt3);font-size:14px">Vague ${idx} ·</span> ${esc(w.time)}</div>
            <div style="font-size:12px;color:var(--txt2);margin-top:3px">${w.teams.length} équipe${w.teams.length>1?'s':''} · ${catTxt}</div>
          </div>
          <button class="tap-add" style="padding:16px 20px;font-size:20px;border-radius:14px" onclick="window._launchWave('${w.key}')">🚦 DÉPART</button>
        </div>`;
      }
      // vague lancée : entête + chrono vague + liste équipes avec Arrivée
      const teams=w.teams.slice().sort((a,b)=>{
        const ea=teamElapsed(a,w.startedAt,now), eb=teamElapsed(b,w.startedAt,now);
        const fa=!!a.finishedAt, fb=!!b.finishedAt;
        if(fa&&fb) return (a.finishedAt-a.startedAt)-(b.finishedAt-b.startedAt);
        if(fa) return -1; if(fb) return 1;
        return String(a.dossard).localeCompare(String(b.dossard));
      });
      const allDone=w.teams.every(t=>!!t.finishedAt);
      const rows=teams.map((t,ri)=>{
        const el=teamElapsed(t,w.startedAt,now);
        const done=!!t.finishedAt;
        const right = done
          ? `<span class="mono" style="font-size:20px;font-weight:700;color:var(--green-bright,#2ecc71)">${fmtTime(el)}</span><button class="btn dark" style="font-size:10px;padding:5px 8px;margin-left:8px" onclick="window._unarrive('${t.dossard}')">↺</button>`
          : `<button class="tap-add" style="padding:11px 18px;font-size:15px;border-radius:11px" onclick="window._arrive('${t.dossard}')">🏁 ARRIVÉE</button>`;
        return `<div class="st-row" style="align-items:center;padding:10px 12px;margin-bottom:7px;${done?'opacity:.85':''}">
          <span class="st-idx" style="background:${done?'#1d8a4e':'var(--panel2)'};color:${done?'#fff':'var(--txt2)'}">${done?'#'+(ri+1):'·'}</span>
          <span class="st-nm" style="flex:1;font-size:14px;font-weight:700">#${esc(t.dossard)} ${esc(t.name||'')} <span style="color:var(--txt3);font-size:11px;font-weight:400">${esc(t.category||'')}</span></span>
          ${done?'':`<span class="mono" style="font-size:16px;color:var(--red-bright);margin-right:10px">${fmtTime(el)}</span>`}
          ${right}
        </div>`;
      }).join("");
      return `<div style="border:1px solid ${allDone?'var(--line)':'var(--red)'};border-radius:16px;padding:12px;margin-bottom:14px;background:${allDone?'transparent':'rgba(229,57,53,.05)'}">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">
          <div style="flex:1">
            <div style="font-family:var(--head);font-weight:900;font-size:20px;line-height:1"><span style="color:var(--txt3);font-size:13px">Vague ${idx} ·</span> ${esc(w.time)}</div>
            <div style="font-size:11px;color:var(--txt2)">${w.teams.filter(t=>t.finishedAt).length}/${w.teams.length} arrivées · ${catTxt}</div>
          </div>
          <div style="text-align:right">
            <div class="mono" style="font-size:26px;font-weight:700;color:${allDone?'var(--txt2)':'var(--red-bright)'}">${fmtTime(now-w.startedAt)}</div>
            <button class="btn dark" style="font-size:10px;padding:5px 9px;margin-top:2px" onclick="window._resetWave('${w.key}')">Annuler la vague</button>
          </div>
        </div>
        ${rows}
      </div>`;
    }).join("");
  }

  window._dDay=function(d){ selDay=d; paint(); };

  window._launchWave=async function(key){
    const waves=buildWaves(race); const w=waves.find(x=>x.key===key); if(!w)return;
    const now=DB.now(); const up={};
    w.teams.forEach(t=>{ up[t.dossard+"/startedAt"]=now; up[t.dossard+"/finishedAt"]=null; });
    await DB.update("athletes",up);
    await DB.set("waves/"+key,{startedAt:now,day:w.day,time:w.time});
    if((race.meta&&race.meta.status)!=="running"){ await DB.update("meta",{status:"running",startedAt:(race.meta&&race.meta.startedAt)||now,stationOrder:(race.meta&&race.meta.stationOrder)||(race.stations||HYROX_STATIONS).map(s=>s.name)}); }
    if(navigator.vibrate)navigator.vibrate([30,50,30]);
    toast("🚦 Vague "+w.time+" lancée ("+w.teams.length+")");
  };
  window._arrive=async function(dossard){
    const now=DB.now(); const a=(race.athletes||{})[dossard]; if(!a||!a.startedAt){ toast("Lance d'abord le départ"); return; }
    await DB.update("athletes",{[dossard+"/finishedAt"]:now});
    if(navigator.vibrate)navigator.vibrate(40);
    toast("🏁 #"+dossard+" · "+fmtTime(now-a.startedAt));
  };
  window._unarrive=async function(dossard){
    await DB.update("athletes",{[dossard+"/finishedAt"]:null});
    toast("Arrivée annulée");
  };
  window._resetWave=async function(key){
    if(!confirm("Annuler le départ de cette vague ? Les chronos et arrivées repartent à zéro."))return;
    const waves=buildWaves(race); const w=waves.find(x=>x.key===key); if(!w)return;
    const up={}; w.teams.forEach(t=>{ up[t.dossard+"/startedAt"]=null; up[t.dossard+"/finishedAt"]=null; });
    await DB.update("athletes",up); await DB.remove("waves/"+key);
    toast("Vague annulée");
  };
}

/* ════════════════════════════════════════════════════════════
   TIME KEEPER — la régie : l'œil de la compétition
   chrono global · stats · quelle station juge quel dossard (+reps live)
   · lancement des vagues · qui est sur le floor
   ════════════════════════════════════════════════════════════ */
function renderTimekeeper(){
  app.innerHTML = `
  <div class="admin" style="max-width:940px">
    <div class="tk-head">
      <div class="scr-klogo" style="width:46px;height:46px;font-size:34px">K</div>
      <div><div class="a-h" style="margin:0">👁️ Time Keeper</div><div class="a-sub" style="margin:0">L'œil de la compétition · Zone K</div></div>
      <div style="margin-left:auto;text-align:right">
        <div class="mono" id="tk-clock" style="font-size:36px;font-weight:700;line-height:1">00:00</div>
        <div style="font-size:11px;color:var(--txt2)"><span id="tk-status">—</span> · <span id="tk-mode">${DB.mode==='firebase'?'temps réel':'démo'}</span></div>
      </div>
    </div>
    <div class="tk-stats" id="tk-stats"></div>
    <div class="sec"><div class="sec-t">🏋️ Stations · qui juge quoi <span style="font-size:12px;color:var(--txt2);font-weight:400">(reps saisis en direct)</span></div>
      <div class="tk-grid" id="tk-stations"></div></div>
    <div class="sec"><div class="sec-t">🚦 Vagues de départ <span style="font-size:12px;color:var(--txt2);font-weight:400">(lancer le départ ici)</span></div>
      <div id="tk-daysel" style="display:flex;gap:6px;margin:6px 0 10px"></div>
      <div id="tk-waves"></div></div>
    <div class="sec"><div class="sec-t">🏃 Sur le floor</div>
      <div id="tk-floor"></div></div>
  </div>`;
  let race={}, tkDay=null;
  DB.sub("", r=>{ race=r||{}; paint(); });
  setInterval(paint, 1000);
  window._tkDay=function(d){ tkDay=d; paint(); };

  function paint(){
    if(!$("#tk-stats")) return;
    const {rows,meta,N}=computeBoard(race);
    const order=(meta.stationOrder)||(race.stations||[]).map(s=>s.name)||[];
    const stations=race.stations||[]; const live=race.live||{}; const now=DB.now();
    let firstStart=meta.startedAt||0;
    rows.forEach(r=>{ if(r.aStart && (!firstStart || r.aStart<firstStart)) firstStart=r.aStart; });
    $("#tk-clock").textContent = firstStart? fmtTime(now-firstStart):"00:00";
    $("#tk-status").textContent = (meta.status==="done"?"Terminé":(meta.status==="running"?"● EN DIRECT":"En attente"));
    const total=rows.length, started=rows.filter(r=>r.aStart).length, finished=rows.filter(r=>r.finished).length, floor=rows.filter(r=>r.aStart&&!r.finished).length;
    $("#tk-stats").innerHTML = [["Équipes",total],["Parties",started],["Sur le floor",floor],["Finies",finished]].map(s=>
      `<div class="tk-kpi"><div class="tk-kpi-n">${s[1]}</div><div class="tk-kpi-l">${s[0]}</div></div>`).join("");
    // stations · qui juge quoi
    $("#tk-stations").innerHTML = order.map((name,idx)=>{
      const s=stations[idx]||{name}; const tgt=stTarget(s); const unit=stUnit(s);
      const lv=live[idx]||live[String(idx)]; const act=lv&&lv.dossard!=null;
      let body;
      if(act){ const a=(race.athletes||{})[lv.dossard]||{name:""};
        body=`<div class="tk-st-judge">🟠 EN COURS</div><div class="tk-st-ath">#${esc(lv.dossard)} · ${esc(a.name||"")}</div>
          <div class="tk-st-reps mono">${lv.reps}${(lv.target||tgt)?(' / '+(lv.target||tgt)):''} <span style="color:var(--txt3);font-size:12px">${esc(lv.unit||unit)}</span></div>`;
      } else {
        body=`<div class="tk-st-judge idle">— libre —</div><div class="tk-st-ath" style="color:var(--txt3)">aucun athlète</div>
          <div class="tk-st-reps mono" style="color:var(--txt3);font-size:13px">obj. ${tgt||'libre'}${tgt?(' '+esc(unit)):''}</div>`;
      }
      return `<div class="tk-st${act?' active':''}"><div class="tk-st-h"><span class="tk-st-i">${idx+1}</span>${esc(name)}</div>${body}</div>`;
    }).join("");
    // sélecteur de jour
    const allWaves=buildWaves(race);
    const days=[...new Set(allWaves.map(w=>w.day))].sort();
    if(tkDay==null && days.length) tkDay=days[0];
    const dsel=$("#tk-daysel");
    if(dsel) dsel.innerHTML = days.map(d=>`<button onclick="window._tkDay('${d}')" style="border:none;border-radius:8px;padding:7px 14px;font-weight:800;font-size:12px;cursor:pointer;font-family:inherit;${d===tkDay?'background:var(--red);color:#fff':'background:var(--panel2);color:var(--txt2)'}">${dayLabel(d)}</button>`).join("");
    // vagues du jour (numérotées par index)
    const waves=allWaves.filter(w=>tkDay==null||w.day===tkDay);
    $("#tk-waves").innerHTML = waves.length? waves.map((w,wi)=>{
      const cats=Object.entries(w.cats).map(([c,n])=>esc(c)+" ("+n+")").join(" · ");
      const arrived=w.teams.filter(t=>t.finishedAt).length;
      const finishedAll=w.started && arrived>=w.teams.length;
      let right;
      if(finishedAll) right=`<span class="fin-badge" style="font-size:13px">✓ FINI</span>`;
      else if(w.started) right=`<span style="font-size:11px;color:var(--txt2);margin-right:8px">${arrived}/${w.teams.length} arr.</span><span class="mono" style="color:var(--red-bright);font-weight:700;margin-right:8px">${fmtTime(now-w.startedAt)}</span><button class="btn dark" style="font-size:11px;padding:5px 9px" onclick="window._launchReset('${w.key}')">↺</button>`;
      else right=`<button class="btn" onclick="window._launchGo('${w.key}')">DÉPART</button>`;
      return `<div class="st-row"><span class="st-idx" style="font-family:var(--mono);font-size:14px">V${wi+1}</span><span class="st-nm" style="font-size:14px">${esc(w.time)} · ${w.teams.length} éq. · <span style="color:var(--txt2);font-weight:400;font-size:12px">${cats}</span></span>${right}</div>`;
    }).join("") : `<div style="color:var(--txt3);font-size:13px">Aucune vague ce jour.</div>`;
    // floor (du jour) avec bouton Arrivée + arrivées récentes
    const dayDoss = new Set(allWaves.filter(w=>tkDay==null||w.day===tkDay).flatMap(w=>w.teams.map(t=>String(t.dossard))));
    const fl=rows.filter(r=>r.aStart&&!r.finished&&dayDoss.has(String(r.a.dossard)));
    const fin=rows.filter(r=>r.finished&&dayDoss.has(String(r.a.dossard))).sort((a,b)=>a.elapsed-b.elapsed);
    let fh='';
    fh += fl.length? fl.map((r,i)=>
      `<div class="st-row"><span class="st-idx">${i+1}</span><span class="st-nm" style="flex:1;font-size:14px">#${esc(r.a.dossard)} ${esc(r.a.name||"")} <span style="color:var(--txt3);font-size:12px;font-weight:400">· ${esc(r.curStation||"")}${r.liveReps!=null?(' · '+r.liveReps+' reps'):''}</span></span><span class="mono" style="color:var(--red-bright);margin-right:10px">${fmtTime(r.elapsed)}</span><button class="btn" style="font-size:12px;padding:6px 12px" onclick="window._tkArrive('${r.a.dossard}')">🏁 Arrivée</button></div>`).join("")
      : `<div style="color:var(--txt3);font-size:13px">Personne sur le floor.</div>`;
    if(fin.length){
      fh += `<div style="margin:12px 0 6px;font-size:12px;font-weight:800;color:var(--txt2);text-transform:uppercase;letter-spacing:1px">🏁 Arrivées · temps réel</div>`
        + fin.map((r,i)=>`<div class="st-row"><span class="st-idx" style="background:#1d8a4e;color:#fff">#${i+1}</span><span class="st-nm" style="flex:1;font-size:14px">#${esc(r.a.dossard)} ${esc(r.a.name||"")}</span><span class="mono" style="font-weight:700;color:#2ecc71;margin-right:8px">${fmtTime(r.elapsed)}</span><button class="btn dark" style="font-size:10px;padding:5px 8px" onclick="window._tkUnarrive('${r.a.dossard}')">↺</button></div>`).join("");
    }
    $("#tk-floor").innerHTML = fh;
  }

  window._launchGo=async function(key){
    const w=buildWaves(race).find(x=>x.key===key); if(!w)return; const now=DB.now(); const up={};
    w.teams.forEach(t=>{ up[t.dossard+"/startedAt"]=now; });
    await DB.update("athletes",up); await DB.set("waves/"+key,{startedAt:now,day:w.day,time:w.time});
    if((race.meta&&race.meta.status)!=="running"){ await DB.update("meta",{status:"running",startedAt:(race.meta&&race.meta.startedAt)||now,stationOrder:(race.meta&&race.meta.stationOrder)||(race.stations||HYROX_STATIONS).map(s=>s.name)}); }
    toast("🚀 Vague "+w.time+" lancée ("+w.teams.length+")");
  };
  window._launchReset=async function(key){
    if(!confirm("Annuler le départ de cette vague ?"))return;
    const w=buildWaves(race).find(x=>x.key===key); if(!w)return; const up={};
    w.teams.forEach(t=>{ up[t.dossard+"/startedAt"]=null; up[t.dossard+"/finishedAt"]=null; });
    await DB.update("athletes",up); await DB.remove("waves/"+key); toast("Vague annulée");
  };
  window._tkArrive=async function(dossard){
    const now=DB.now(); const a=(race.athletes||{})[dossard]; if(!a||!a.startedAt){ toast("Pas encore parti"); return; }
    await DB.update("athletes",{[dossard+"/finishedAt"]:now});
    toast("🏁 #"+dossard+" · "+fmtTime(now-a.startedAt));
  };
  window._tkUnarrive=async function(dossard){
    await DB.update("athletes",{[dossard+"/finishedAt"]:null}); toast("Arrivée annulée");
  };
}

async function boot(mode){
  window.addEventListener("error", function(e){ showFatal(e.error||e.message); });
  window.addEventListener("unhandledrejection", function(e){ showFatal(e.reason||e); });
  try{
    app = $("#app");
    DB = await makeDB();
    if(mode==="screen") renderScreen();
    else if(mode==="juge") renderJuge();
    else if(mode==="admin") renderAdmin();
    else if(mode==="depart") renderDepart();
    else if(mode==="timekeeper") renderTimekeeper();
    else showFatal("Mode inconnu: "+mode);
  }catch(e){ showFatal(e); }
}

/* API données réutilisable (ex: onglet Catégorie de index.html) */
const API = {
  boot: boot,
  seedDemo: function(a,s){ return window._seedDemo(a,s); },
  mode: function(){ return DB && DB.mode; },
  hasFirebase: HAS_FIREBASE,
  async connect(){ if(!DB) DB = await makeDB(); return DB; },
  async sub(p,cb){ await API.connect(); return DB.sub(p,cb); },
  async set(p,v){ await API.connect(); return DB.set(p,v); },
  async update(p,o){ await API.connect(); return DB.update(p,o); },
  async remove(p){ await API.connect(); return DB.remove(p); },
  async get(p){ await API.connect(); return DB.getOnce(p); },
  now(){ return DB?DB.now():Date.now(); }
};
window.ZK = API;
})();
