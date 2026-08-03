/* =============================================================================
   bg3d.js — le fond 3D d'ambiance de l'accueil, porté sur les pages intérieures.

   CE QUI EST REPRIS DE L'ACCUEIL : les cubes qui flottent, la palette (bleu,
   turquoise, cyan, or), le verre translucide, le brouillard, la dérive lente,
   la parallaxe à la souris, l'assemblage au démarrage.
   CE QUI N'EST PAS REPRIS : la grille des 9 offres. Elle est la navigation de
   l'accueil ; la répéter partout n'a pas de sens et doublerait le coût.

   OÙ : dans l'en-tête sombre (<header class="head">) et nulle part ailleurs.
   Le corps des pages reste blanc, le texte de lecture n'est jamais posé sur la
   3D. C'est aussi ce qui borne le coût : le canvas fait ~380 px de haut, il
   sort de l'écran au premier défilement et la boucle s'arrête.

   COÛT (mesuré, Lighthouse mobile, médiane sur 5 passages) : voir le tableau
   livré avec ce fichier. En résumé : sur mobile la 3D est COUPÉE par défaut
   (MOBILE_3D = false) et remplacée par un dégradé qui rappelle l'ambiance.
   Sur un téléphone, Three.js coûte plus cher à analyser que la page entière.

   POUR CHANGER D'AVIS : MOBILE_3D ci-dessous, ou ?bg3d=on / ?bg3d=off dans
   l'URL pour comparer sans toucher au fichier.

   GARDE-FOUS (les mêmes que l'accueil) : sonde WebGL avant tout téléchargement,
   démarrage après le chargement de la page, arrêt hors écran et onglet caché,
   perte de contexte WebGL, exception dans la boucle, machine trop lente.
   Dans tous ces cas : le dégradé statique reprend la main, rien ne casse.
   ============================================================================= */
(function () {
  'use strict';

  var CFG = {
    /* Le seul interrupteur qui compte. false = pas une ligne de Three.js
       téléchargée sur téléphone. */
    MOBILE_3D: false,
    CUBES: 12,            /* cubes d'ambiance sur ordinateur (l'accueil : 9 + 12) */
    CUBES_MOBILE: 6,
    DPR_MAX: 1.35,
    DPR_MAX_MOBILE: 1.0,
    FOV: 42,
    CAM_Z: 13,
    THREE_URL: 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.min.js'
  };

  var head = document.querySelector('header.head');
  var canvas = head && head.querySelector('canvas.bg3d');
  if (!head || !canvas) return;

  var root = document.documentElement;
  var reduce = false;
  try { reduce = window.matchMedia('(prefers-reduced-motion:reduce)').matches; } catch (e) {}
  var small = false;
  try { small = window.matchMedia('(max-width:820px)').matches; } catch (e) {}

  /* Réglage par l'URL, pour comparer les deux options sans modifier le fichier. */
  var force = null;
  try { force = new URLSearchParams(location.search).get('bg3d'); } catch (e) {}
  if (force) force = force.toLowerCase();

  /* Le fond retombe sur le dégradé CSS : c'est l'état par défaut du HTML, il
     n'y a rien à construire. On retire seulement le canvas. */
  function statique(raison) {
    root.classList.add('bg3d-static');
    if (canvas && canvas.parentNode) canvas.parentNode.removeChild(canvas);
    canvas = null;
    if (raison) { try { console.info('Fond 3D : dégradé statique (' + raison + ').'); } catch (e) {} }
  }

  if (force === 'off' || reduce) { statique(reduce ? 'animations réduites' : 'coupé par l’URL'); return; }
  if (small && force !== 'on' && !CFG.MOBILE_3D) { statique('mobile'); return; }

  /* --- Sonde WebGL : on ne télécharge pas 166 Ko pour découvrir ensuite que la
     machine ne sait pas les afficher. Le contexte de test est relâché tout de
     suite (certains pilotes n'en tolèrent que 8 à 16 sur la page). --- */
  function webglOk() {
    try {
      var c = document.createElement('canvas');
      var gl = c.getContext('webgl2') || c.getContext('webgl') || c.getContext('experimental-webgl');
      if (!gl) return false;
      var ext = gl.getExtension('WEBGL_lose_context');
      if (ext) ext.loseContext();
      return true;
    } catch (e) { return false; }
  }
  if (!webglOk()) { statique('WebGL indisponible'); return; }

  /* --- Quand démarrer : après le chargement complet, après deux images, puis
     dans un temps mort. Le texte de la page ne doit rien attendre. --- */
  function auRepos(fn) {
    var go = function () {
      if (window.requestIdleCallback) window.requestIdleCallback(fn, { timeout: 2500 });
      else setTimeout(fn, 120);
    };
    requestAnimationFrame(function () { requestAnimationFrame(go); });
  }
  function apresChargement(fn) {
    if (document.readyState === 'complete') auRepos(fn);
    else window.addEventListener('load', function () { auRepos(fn); }, { once: true });
  }

  /* --- Et seulement si l'en-tête est réellement à l'écran : arriver sur une
     ancre en bas de page ne doit rien déclencher. --- */
  function quandVisible(fn) {
    if (!('IntersectionObserver' in window)) { fn(); return; }
    var io = new IntersectionObserver(function (ents) {
      for (var i = 0; i < ents.length; i++) {
        if (ents[i].isIntersecting) { io.disconnect(); fn(); return; }
      }
    }, { rootMargin: '120px' });
    io.observe(head);
  }

  apresChargement(function () {
    quandVisible(function () {
      /* DNS + TLS lancés à la décision, pas à la découverte du module. */
      try {
        var pre = document.createElement('link');
        pre.rel = 'preconnect'; pre.href = 'https://cdn.jsdelivr.net'; pre.crossOrigin = '';
        document.head.appendChild(pre);
      } catch (e) {}
      construire().catch(function (err) {
        try { console.warn('Fond 3D indisponible :', err); } catch (e) {}
        statique('échec du chargement');
      });
    });
  });

  /* ====================== LA SCÈNE ====================== */
  async function construire() {
    var THREE = await import(CFG.THREE_URL);
    /* Rendre la main juste après l'évaluation du module : sans cette coupure,
       l'analyse de Three.js et la construction de la scène tombent dans la même
       tâche longue. */
    await pause();
    if (!canvas) return;

    var mob = small;
    var renderer = new THREE.WebGLRenderer({
      canvas: canvas, antialias: !mob, alpha: true, powerPreference: 'low-power'
    });
    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, mob ? CFG.DPR_MAX_MOBILE : CFG.DPR_MAX));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.25;
    renderer.outputColorSpace = THREE.SRGBColorSpace;

    var scene = new THREE.Scene();
    /* Brouillard plus léger que l'accueil : l'en-tête est bas de plafond, les
       cubes y sont plus proches et se noyaient dans le navy. */
    scene.fog = new THREE.FogExp2(fondNavy(), 0.024);

    var camera = new THREE.PerspectiveCamera(CFG.FOV, 1, 0.1, 120);
    camera.position.set(0, 0, CFG.CAM_Z);

    /* Environnement : un dégradé 64×32 en projection équirectangulaire. C'est
       lui qui donne le reflet « verre » des cubes.
       PAS de PMREM ici, et c'est une décision mesurée : le préfiltrage coûtait
       370 ms de blocage et 14 points de performance sur ordinateur (69→84 sur
       offres.html, médiane sur 4 passages). Il sert à filtrer un environnement
       détaillé selon la rugosité ; le nôtre est un dégradé flou de 64×32, le
       préfiltrer ne change rien à l'œil. L'accueil, lui, le garde : sa grille
       d'offres est au premier plan et joue sur le reflet. */
    var envTex = null;
    function faireEnv() {
      var cv = document.createElement('canvas'); cv.width = 64; cv.height = 32;
      var g = cv.getContext('2d');
      var grd = g.createLinearGradient(0, 0, 0, 32);
      grd.addColorStop(0, '#e8f4ff'); grd.addColorStop(0.45, '#8ba9cd');
      grd.addColorStop(0.62, '#2b4568'); grd.addColorStop(1, '#0a1526');
      g.fillStyle = grd; g.fillRect(0, 0, 64, 32);
      envTex = new THREE.CanvasTexture(cv);
      envTex.mapping = THREE.EquirectangularReflectionMapping;
      envTex.colorSpace = THREE.SRGBColorSpace;
      scene.environment = envTex;
    }
    faireEnv();

    scene.add(new THREE.HemisphereLight(0xcfe6ff, 0x0b1a30, 0.55));
    var key = new THREE.DirectionalLight(0xffffff, 1.15); key.position.set(4, 6, 7); scene.add(key);
    var rim = new THREE.DirectionalLight(0x38bdf8, 1.10); rim.position.set(-6, -2, 3); scene.add(rim);

    await pause();
    if (!canvas) return;

    /* --- Les cubes : UN InstancedMesh (une géométrie, un appel de dessin).
       Pas de RoundedBoxGeometry : c'est une requête CDN en série de plus, et à
       cette taille à l'écran le congé de 0,26 ne se voit pas. --- */
    var N = mob ? CFG.CUBES_MOBILE : CFG.CUBES;
    var geo = new THREE.BoxGeometry(1, 1, 1);
    var mat = new THREE.MeshStandardMaterial({
      color: 0xffffff, metalness: 0.0, roughness: 0.44, envMapIntensity: 0.95,
      emissive: new THREE.Color(0x2f7bd6), emissiveIntensity: 0.26,
      transparent: true, opacity: 0.64
    });
    var mesh = new THREE.InstancedMesh(geo, mat, N);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.frustumCulled = false;

    var TINTS = [0x2f7bd6, 0x1FC7A9, 0x38bdf8, 0xC9A24B]; /* bleu, turquoise, cyan, or */
    var _m4 = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(),
        _v3 = new THREE.Vector3(), _sc = new THREE.Vector3(), _col = new THREE.Color();

    var cubes = [];
    for (var i = 0; i < N; i++) {
      var cote = (i % 2 === 0) ? 1 : -1;
      cubes.push({
        /* Position en repère écran (−1..1) puis convertie en monde à chaque
           redimensionnement : l'en-tête est très large et très bas, un placement
           en dur sortait du cadre dès qu'on changeait de format. */
        nx: cote * (0.30 + Math.random() * 0.78),
        ny: (Math.random() * 2 - 1) * 0.92,
        z: -3 - Math.random() * 12,
        s: 0.55 + Math.random() * 0.95,
        rx: Math.random() * Math.PI, ry: Math.random() * Math.PI,
        rs: 0.07 + Math.random() * 0.15,
        derive: 0.18 + Math.random() * 0.34,
        phase: Math.random() * Math.PI * 2,
        depart: 6 + Math.random() * 10          /* d'où il arrive à l'assemblage */
      });
      mesh.setColorAt(i, _col.setHex(TINTS[i % TINTS.length]));
    }
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    scene.add(mesh);

    await pause();
    if (!canvas) return;

    /* ---- Cadrage ---- */
    var HALF = Math.tan(CFG.FOV * Math.PI / 360);
    var aspect = 1;
    function demiH(z) { return HALF * (camera.position.z - z); }
    function taille() {
      var w = Math.max(1, head.clientWidth), h = Math.max(1, head.clientHeight);
      renderer.setSize(w, h, false);
      aspect = w / h;
      camera.aspect = aspect; camera.updateProjectionMatrix();
    }
    taille();
    window.addEventListener('resize', taille, { passive: true });
    if (window.ResizeObserver) { try { new ResizeObserver(taille).observe(head); } catch (e) {} }

    /* ---- Parallaxe douce (rien sur téléphone : pas de pointeur) ---- */
    var px = 0, py = 0;
    if (!mob) {
      window.addEventListener('pointermove', function (e) {
        px = (e.clientX / Math.max(1, window.innerWidth) - 0.5);
        py = (e.clientY / Math.max(1, window.innerHeight) - 0.5);
      }, { passive: true });
    }

    /* ---- Boucle : une seule, qui s'arrête dès que l'en-tête n'est plus là ---- */
    var actif = true, vivant = true, tourne = false, t0 = 0, frames = 0;
    var horloge = { t: 0 };
    var ASSEMBLAGE = 1.8;

    function visibleMaintenant() {
      var r = head.getBoundingClientRect();
      return r.bottom > 0 && r.top < (window.innerHeight || 0);
    }
    if ('IntersectionObserver' in window) {
      try {
        new IntersectionObserver(function (ents) {
          actif = ents[0].isIntersecting;
          if (actif) relance();
        }, { rootMargin: '80px' }).observe(head);
      } catch (e) {}
    } else {
      window.addEventListener('scroll', function () {
        actif = visibleMaintenant(); if (actif) relance();
      }, { passive: true });
    }
    document.addEventListener('visibilitychange', function () { if (!document.hidden) relance(); });

    function relance() { if (vivant && !tourne && !document.hidden && actif) { tourne = true; requestAnimationFrame(boucle); } }

    function easeOutBack(x) { var c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); }

    function image(now) {
      if (!t0) t0 = now;
      var t = (now - t0) / 1000;
      horloge.t = t;
      var p = Math.min(1, t / ASSEMBLAGE), eb = Math.max(0, easeOutBack(p));

      for (var i = 0; i < mesh.count; i++) {
        var c = cubes[i];
        c.rx += c.rs * 0.016; c.ry += c.rs * 0.013;
        var hz = demiH(c.z), hw = hz * aspect;
        var y = c.ny * hz + Math.sin(t * 0.30 + c.phase) * c.derive;
        var x = c.nx * hw;
        /* Assemblage : les cubes viennent de plus loin et se posent. */
        var z = c.z - c.depart * (1 - eb);
        _e.set(c.rx, c.ry, 0); _q.setFromEuler(_e);
        _v3.set(x, y, z);
        var s = c.s * (0.25 + 0.75 * eb);
        _sc.set(s, s, s);
        mesh.setMatrixAt(i, _m4.compose(_v3, _q, _sc));
      }
      mesh.instanceMatrix.needsUpdate = true;

      mat.emissiveIntensity = 0.25 + Math.sin(t * 0.7) * 0.05;
      camera.position.x += (px * 1.5 - camera.position.x) * 0.03;
      camera.position.y += (-py * 0.9 - camera.position.y) * 0.03;
      mesh.rotation.y = Math.sin(t * 0.10) * 0.10 + px * 0.08;

      renderer.render(scene, camera);
      frames++;
      if (!canvas.classList.contains('on')) canvas.classList.add('on');
    }

    function boucle(now) {
      tourne = false;
      if (!vivant) return;
      if (document.hidden || !actif) return;      /* on ne redemande pas d'image */
      try { image(now); }
      catch (err) {
        vivant = false;
        try { console.warn('Fond 3D arrêté (erreur dans la boucle) :', err); } catch (e) {}
        nettoyer(); statique('erreur dans la boucle'); return;
      }
      tourne = true; requestAnimationFrame(boucle);
    }
    relance();

    /* ---- Perte du contexte WebGL : on attend 2 s une reprise, sinon dégradé ---- */
    var perte = 0;
    canvas.addEventListener('webglcontextlost', function (e) {
      e.preventDefault(); vivant = false; tourne = false;
      clearTimeout(perte);
      perte = setTimeout(function () { nettoyer(); statique('contexte WebGL perdu'); }, 2000);
    }, false);
    canvas.addEventListener('webglcontextrestored', function () {
      clearTimeout(perte); perte = 0;
      try { faireEnv(); } catch (e) {}
      vivant = true; t0 = 0; taille(); relance();
    }, false);

    /* ---- Battement de cœur : la boucle peut se figer sans lever d'exception
       (pilote qui décroche, GPU logiciel). Si le compteur n'avance plus alors
       que l'en-tête est visible et l'onglet au premier plan, on coupe. ---- */
    var derniere = -1;
    var pouls = setInterval(function () {
      if (!vivant) { clearInterval(pouls); return; }
      if (document.hidden || !actif) { derniere = -1; return; }
      if (derniere === frames) { clearInterval(pouls); nettoyer(); statique('boucle figée'); return; }
      derniere = frames;
    }, 3000);

    /* ---- Santé : si la machine ne suit pas, on allège puis on coupe ---- */
    setTimeout(function mesure() {
      if (!vivant || !actif || document.hidden) { setTimeout(mesure, 2500); return; }
      var d0 = frames, h0 = performance.now();
      setTimeout(function () {
        if (!vivant) return;
        var fps = (frames - d0) / ((performance.now() - h0) / 1000);
        if (fps >= 12 || fps <= 0) return;
        if (fps >= 6) {
          renderer.setPixelRatio(Math.min(1, (window.devicePixelRatio || 1) * 0.6));
          mesh.count = Math.max(3, Math.floor(N / 2));
          taille();
          try { console.info('Fond 3D allégé (' + fps.toFixed(1) + ' img/s).'); } catch (e) {}
        } else {
          nettoyer(); statique('machine trop lente (' + fps.toFixed(1) + ' img/s)');
        }
      }, 2500);
    }, 2500);

    function nettoyer() {
      vivant = false; tourne = false;
      try { geo.dispose(); mat.dispose(); if (envTex) envTex.dispose(); renderer.dispose(); } catch (e) {}
    }

    function fondNavy() {
      try {
        var v = getComputedStyle(head).getPropertyValue('--bg3d-fog').trim();
        if (/^#[0-9a-f]{6}$/i.test(v)) return parseInt(v.slice(1), 16);
      } catch (e) {}
      return 0x0b2545;
    }
  }

  /* Rendre la main au navigateur entre deux morceaux de construction : trois
     tâches courtes bloquent bien moins qu'une seule longue. */
  function pause() {
    return new Promise(function (r) {
      if (window.requestIdleCallback) window.requestIdleCallback(function () { r(); }, { timeout: 400 });
      else setTimeout(r, 0);
    });
  }
})();
