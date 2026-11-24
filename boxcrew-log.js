/* ═══════════════════════════════════════════════════════════════════════
   BOX CREW — Journal des erreurs (logger léger, partagé par toutes les pages)
   ─────────────────────────────────────────────────────────────────────────
   But : remonter dans Firebase (system/errorLog) les erreurs JS, les coupures
   réseau et le temps de chargement, pour les consulter dans l'admin.

   RÈGLES BANDE PASSANTE (priorité du projet) :
   · Les pages ne font qu'ÉCRIRE (push). Elles ne LISENT JAMAIS le journal.
     Seul l'admin lit system/errorLog, à la demande (voir index.html).
   · Anti-spam : même message ignoré s'il a été loggé il y a < 30 s.
   · Débit limité : 1 écriture / 2,5 s max (file d'attente).
   · Ne plante jamais la page (tout en try/catch, .catch sur les writes).
   · Ne logge pas ses propres erreurs (pas de boucle).

   USAGE : définir window.LOG_PAGE='TK' (ou 'LIVE', 'ADMIN'…) AVANT d'inclure
   ce script, puis <script src="./boxcrew-log.js"></script> après firebase.
   Appel manuel possible : BClog.event('action','Heat lancé', 'zone 1').
   ═══════════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';
  try{
    var PAGE = (window.LOG_PAGE || 'PAGE');
    var _t0  = (window.__BC_T0 || (window.performance && performance.now && (performance.timeOrigin||0)) || Date.now());
    var _bootPerf = (window.performance && performance.now) ? performance.now() : 0;

    var _buffer = [];          // entrées en attente si firebase pas prêt
    var _recent = {};          // msg -> dernier timestamp (anti-doublon)
    var _lastWrite = 0;        // débit
    var _queue = [];           // file d'attente
    var _netDownSince = 0;

    function _db(){
      try{
        if(window.firebase && firebase.apps && firebase.apps.length) return firebase.database();
        if(window.firebase && firebase.database) return firebase.database();
      }catch(e){}
      return null;
    }
    function _now(){
      try{ if(typeof serverNow==='function') return serverNow(); }catch(e){}
      return Date.now();
    }
    function _trim(s, n){ s=(s==null?'':String(s)); return s.length>n ? s.slice(0,n) : s; }

    // Écrit réellement une entrée dans Firebase (ou bufferise).
    function _flushQueue(){
      var db=_db();
      if(!db){ return; } // pas encore prêt : on garde en file, flush plus tard
      var nowMs=Date.now();
      // respecter le débit
      if(nowMs - _lastWrite < 2500){
        setTimeout(_flushQueue, 2500 - (nowMs - _lastWrite));
        return;
      }
      var entry=_queue.shift();
      if(!entry) return;
      _lastWrite=nowMs;
      try{
        db.ref('system/errorLog').push(entry).catch(function(){});
      }catch(e){/* jamais planter */}
      if(_queue.length) setTimeout(_flushQueue, 2500);
    }

    function _push(lvl, type, msg, detail){
      try{
        msg=_trim(msg,200);
        // anti-doublon 30 s
        var k=type+'|'+msg;
        var t=Date.now();
        if(_recent[k] && (t-_recent[k])<30000) return;
        _recent[k]=t;
        var entry={
          t:_now(), page:PAGE, lvl:lvl, type:type,
          msg:msg, detail:_trim(detail,300),
          ua:_trim((navigator&&navigator.userAgent)||'',120)
        };
        _queue.push(entry);
        if(_queue.length>50) _queue.shift(); // sécurité mémoire
        _flushQueue();
      }catch(e){/* ne jamais planter */}
    }

    // ── API publique ──
    window.BClog={
      error:function(msg,detail){ _push('error','js',msg,detail); },
      warn: function(msg,detail){ _push('warn','js',msg,detail); },
      net:  function(msg,detail){ _push('warn','net',msg,detail); },
      load: function(msg,detail){ _push('info','load',msg,detail); },
      event:function(type,msg,detail){ _push('info', (type||'action'), msg, detail); }
    };

    // ── 1) Erreurs JS ──
    window.addEventListener('error', function(e){
      try{
        if(!e) return;
        // ignorer les erreurs de ressources (img/script manquants) peu utiles
        var m = e.message || (e.error && e.error.message) || 'Erreur JS';
        var src = (e.filename? (e.filename.split('/').pop()+':'+(e.lineno||'?')) : '');
        var stack = (e.error && e.error.stack) ? e.error.stack : src;
        _push('error','js', m, stack);
      }catch(_){}
    });
    window.addEventListener('unhandledrejection', function(e){
      try{
        var r=e && e.reason;
        var m=(r && (r.message||r)) || 'Promesse rejetée';
        var stack=(r && r.stack) ? r.stack : '';
        _push('error','js', 'Promise: '+m, stack);
      }catch(_){}
    });

    // ── 2) Réseau navigateur ──
    window.addEventListener('offline', function(){ _netDownSince=Date.now(); _push('warn','net','Navigateur hors ligne',''); });
    window.addEventListener('online',  function(){
      var dur = _netDownSince? Math.round((Date.now()-_netDownSince)/1000)+'s' : '';
      _netDownSince=0; _push('info','net','Navigateur reconnecté', dur?('coupure '+dur):'');
    });

    // ── 2bis) Connexion Firebase (.info/connected) ──
    //    On attend que firebase soit prêt, puis on surveille la connexion.
    var _fbTries=0;
    (function watchFb(){
      var db=_db();
      if(!db){
        if(_fbTries++ < 40){ setTimeout(watchFb, 500); } // ~20 s d'attente max
        return;
      }
      // flush ce qui attendait
      _flushQueue();
      var _fbDownSince=0, _first=true;
      try{
        db.ref('.info/connected').on('value', function(s){
          var up = !!(s && s.val());
          if(_first){ _first=false; if(up) return; } // 1er état "connecté" : silencieux
          if(up){
            var dur=_fbDownSince? Math.round((Date.now()-_fbDownSince)/1000)+'s':'';
            _fbDownSince=0; _push('info','net','Firebase reconnecté', dur?('coupure '+dur):'');
          }else{
            _fbDownSince=Date.now(); _push('warn','net','Firebase déconnecté','');
          }
        });
      }catch(e){}
    })();

    // ── 3) Temps de chargement ──
    function _logLoad(){
      try{
        var ms = (window.performance && performance.now) ? Math.round(performance.now()-_bootPerf) : 0;
        var nav = (performance && performance.timing) ? performance.timing : null;
        var detail='';
        if(nav && nav.domContentLoadedEventEnd && nav.navigationStart){
          detail='DOM '+(nav.domContentLoadedEventEnd-nav.navigationStart)+'ms · load '+((nav.loadEventEnd||Date.now())-nav.navigationStart)+'ms';
        }
        _push('info','load','Page chargée ('+ms+'ms)', detail);
      }catch(e){}
    }
    if(document.readyState==='complete'){ setTimeout(_logLoad, 300); }
    else window.addEventListener('load', function(){ setTimeout(_logLoad, 300); });

  }catch(outer){ /* le logger ne doit jamais casser la page */ }
})();
