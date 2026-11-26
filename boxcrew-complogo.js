/* ═══════════════════════════════════════════════════════════════════════
   BOX CREW — Logo de la compétition dans les EN-TÊTES (co-branding)
   ─────────────────────────────────────────────────────────────────────────
   But : afficher le logo custom déposé par l'organisateur JUSTE À CÔTÉ du
   logo BOX CREW dans l'en-tête de chaque page. Co-branding :
       [logo compét] + [BOX CREW]
   Si AUCUN logo déposé (system/compLogo absent) → on n'insère RIEN, seul le
   logo BOX CREW reste (comportement actuel inchangé).

   RÈGLES BANDE PASSANTE (priorité absolue du projet) :
   · On lit D'ABORD system/compLogo/v (une petite valeur). Si cette version
     == celle en localStorage ET que le dataURL est déjà en cache localStorage
     → on réutilise le cache, on NE RE-télécharge PAS le gros /data.
     On ne lit /data que si la version a changé (ou pas de cache).
   · MÊMES clés localStorage que live.html ('bc_complogo_v' / 'bc_complogo_data')
     → le cache est PARTAGÉ entre toutes les pages : le gros dataURL n'est
     téléchargé qu'UNE fois par appareil, tant que l'organisateur ne change pas
     son logo. Une page spectateur avec cache valide ne lit QUE /v.
   · Lecture SEULE : aucune écriture Firebase n'est faite ici.
   · Ne plante JAMAIS la page (tout en try/catch). Si Firebase pas prêt, retry
     quelques fois ; si échec → on n'insère rien (juste BOX CREW).

   USAGE (dans chaque page, APRÈS firebase + init de db) :
     <script src="./boxcrew-complogo.js"></script>
     puis, une fois le DOM prêt :
       BCCompLogo.mount({ anchorSelector:'.brand-ico', position:'before', gap:8 });

   OPTIONS mount(opts) :
     anchorSelector : sélecteur CSS du logo BOX CREW (ou)
     anchorEl       : l'élément DOM du logo BOX CREW directement
     position       : 'before' (défaut) ou 'after' le logo BOX CREW
     size           : taille en px (défaut : offsetHeight de l'ancre, sinon 34)
     gap            : espace en px entre les deux logos (défaut 8)
     separator      : true/false — fine barre verticale translucide (défaut true)
     maxWidth       : largeur max en px pour un logo large/bannière (défaut 140)
   ═══════════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';

  var LS_V = 'bc_complogo_v';      // MÊMES clés que live.html (cache partagé)
  var LS_D = 'bc_complogo_data';

  function lsGet(k){ try{ return localStorage.getItem(k); }catch(e){ return null; } }
  function lsSet(k,val){ try{ localStorage.setItem(k,val); }catch(e){} }
  function lsDel(k){ try{ localStorage.removeItem(k); }catch(e){} }

  // Récupère une ref Firebase Database, quelle que soit la façon dont la page
  // a initialisé firebase (chaque page a son propre `db`, mais firebase.database()
  // partagé reste joignable une fois l'app initialisée).
  function getDb(){
    try{
      if(typeof firebase === 'undefined' || !firebase) return null;
      if(firebase.apps && firebase.apps.length){ return firebase.database(); }
      // app pas encore initialisée : on n'initialise PAS nous-mêmes (on laisse
      // la page gérer son databaseURL) ; on retentera au prochain tick.
    }catch(e){}
    return null;
  }

  // Attend (quelques essais) que firebase soit prêt, puis exécute cb(db).
  function whenDb(cb){
    var tries = 0, MAX = 40, STEP = 150; // ~6 s max
    (function attempt(){
      var db = getDb();
      if(db){ try{ cb(db); }catch(e){} return; }
      if(++tries >= MAX){ return; } // abandon silencieux → juste BOX CREW
      setTimeout(attempt, STEP);
    })();
  }

  // Insère réellement le <img> du logo compét à côté de l'ancre.
  function insertLogo(anchor, dataUrl, opts){
    try{
      if(!anchor || !dataUrl || !anchor.parentNode) return;
      // éviter les doublons (si mount appelé 2x, ou script inclus 2x)
      if(anchor.parentNode.querySelector('img.bc-complogo')) return;

      var position = (opts.position === 'after') ? 'after' : 'before';
      var gap = (typeof opts.gap === 'number') ? opts.gap : 8;
      var wantSep = (opts.separator !== false);
      var maxW = (typeof opts.maxWidth === 'number') ? opts.maxWidth : 140;

      // Si le conteneur flex utilise déjà `gap` (column-gap), c'est LUI qui
      // espace les enfants : on ne rajoute PAS notre marge (sinon double espace,
      // rendu hétérogène). On laisse le gap du parent faire le travail.
      var parentHasGap = false;
      try{
        var pcs = getComputedStyle(anchor.parentNode);
        var cg = parseFloat(pcs.columnGap || pcs.gap || '0');
        var isFlex = (pcs.display === 'flex' || pcs.display === 'inline-flex');
        parentHasGap = isFlex && cg > 0;
        if(parentHasGap){ gap = cg; } // le séparateur suit le même rythme visuel
      }catch(e){}

      // Taille : prioriser opts.size, sinon la hauteur rendue de l'ancre,
      // sinon une valeur sûre.
      var size = opts.size;
      if(typeof size !== 'number' || size <= 0){
        var oh = anchor.offsetHeight || 0;
        if(oh > 0){ size = oh; }
        else{
          // ancre pas encore mesurable : tenter la hauteur CSS, sinon défaut
          var csH = 0;
          try{ csH = parseFloat(getComputedStyle(anchor).height) || 0; }catch(e){}
          size = (csH > 0) ? csH : 34;
        }
      }

      var img = document.createElement('img');
      img.className = 'bc-complogo';
      img.src = dataUrl;
      img.alt = 'Logo compétition';
      img.setAttribute('aria-label','Logo compétition');
      // Rendu homogène : même hauteur que le logo BOX CREW, largeur auto bornée.
      img.style.height = size + 'px';
      img.style.width = 'auto';
      img.style.maxWidth = maxW + 'px';     // borne les bannières larges
      img.style.objectFit = 'contain';
      img.style.display = 'block';
      img.style.flexShrink = '0';
      img.style.verticalAlign = 'middle';
      // Espace vers le logo BOX CREW (marge du bon côté selon la position).
      // Si le parent gère déjà l'espacement via `gap`, on n'ajoute pas de marge.
      if(!parentHasGap){
        if(position === 'before'){ img.style.marginRight = gap + 'px'; }
        else{ img.style.marginLeft = gap + 'px'; }
      }

      // Séparateur discret optionnel : fine barre verticale translucide.
      var sep = null;
      if(wantSep){
        sep = document.createElement('span');
        sep.className = 'bc-complogo-sep';
        sep.setAttribute('aria-hidden','true');
        sep.style.display = 'inline-block';
        sep.style.width = '1px';
        sep.style.height = Math.max(12, Math.round(size * 0.6)) + 'px';
        sep.style.background = 'currentColor';
        sep.style.opacity = '0.22';
        sep.style.flexShrink = '0';
        sep.style.alignSelf = 'center';
        if(!parentHasGap){
          if(position === 'before'){ sep.style.marginRight = gap + 'px'; }
          else{ sep.style.marginLeft = gap + 'px'; }
        }
      }

      // Insertion dans le flux flex, du bon côté de l'ancre.
      // Ordre visuel voulu (position 'before') :  [logo compét] [sep] [BOX CREW]
      var parent = anchor.parentNode;
      if(position === 'before'){
        parent.insertBefore(img, anchor);
        if(sep){ parent.insertBefore(sep, anchor); }
      }else{
        // [BOX CREW] [sep] [logo compét]
        var next = anchor.nextSibling;
        if(sep){ parent.insertBefore(sep, next); }
        parent.insertBefore(img, next); // insertBefore(x, null) === append
      }
    }catch(e){ /* ne jamais planter l'en-tête */ }
  }

  // Charge le logo (cache versionné partagé) puis insère si présent.
  function loadAndInsert(anchor, opts){
    whenDb(function(db){
      try{
        // 1) lire UNIQUEMENT la version (petit) pour décider d'un gros download
        db.ref('system/compLogo/v').once('value').then(function(vs){
          var v = vs && vs.val();
          if(v === null || typeof v === 'undefined'){
            // pas de logo custom → BOX CREW seul ; purge un cache périmé
            lsDel(LS_V); lsDel(LS_D);
            return;
          }
          var vStr = String(v);
          var cachedV = lsGet(LS_V), cachedD = lsGet(LS_D);
          if(cachedV === vStr && cachedD){
            // 2a) version identique + data en cache → AUCUN téléchargement /data
            insertLogo(anchor, cachedD, opts);
            return;
          }
          // 2b) version nouvelle (ou pas de cache) → lire /data UNE fois puis cache
          db.ref('system/compLogo/data').once('value').then(function(ds){
            var data = ds && ds.val();
            if(data && typeof data === 'string'){
              insertLogo(anchor, data, opts);
              lsSet(LS_V, vStr); lsSet(LS_D, data);
            }else{
              lsDel(LS_V); lsDel(LS_D);
            }
          }).catch(function(){ /* offline/erreur → juste BOX CREW */ });
        }).catch(function(){ /* offline/erreur → juste BOX CREW */ });
      }catch(e){ /* juste BOX CREW */ }
    });
  }

  // Résout l'ancre (élément du logo BOX CREW) à partir des options.
  function resolveAnchor(opts){
    try{
      if(opts.anchorEl && opts.anchorEl.nodeType === 1){ return opts.anchorEl; }
      if(opts.anchorSelector){ return document.querySelector(opts.anchorSelector); }
    }catch(e){}
    return null;
  }

  // API publique.
  var BCCompLogo = {
    mount: function(opts){
      opts = opts || {};
      var run = function(){
        try{
          var anchor = resolveAnchor(opts);
          if(!anchor){
            // ancre pas encore là : un court retry (en-tête injecté tardivement)
            var tries = 0;
            var iv = setInterval(function(){
              var a = resolveAnchor(opts);
              if(a){ clearInterval(iv); loadAndInsert(a, opts); }
              else if(++tries >= 20){ clearInterval(iv); } // ~3 s, puis abandon
            }, 150);
            return;
          }
          loadAndInsert(anchor, opts);
        }catch(e){ /* ne jamais planter */ }
      };
      // Exécuter une fois le DOM prêt (l'ancre doit exister / être mesurable).
      if(document.readyState === 'loading'){
        document.addEventListener('DOMContentLoaded', run, { once:true });
      }else{
        run();
      }
    }
  };

  try{ window.BCCompLogo = BCCompLogo; }catch(e){}
})();
