/*
 * Assistant Ébrange — chatbot autonome (100 % navigateur, sans backend ni clé API)
 * ---------------------------------------------------------------------------------
 * Ce script s'auto-suffit : il injecte son propre CSS (repris de la charte du site :
 * bleu marine, dégradés, arrondis, ombres) et son propre HTML. Il suffit donc de
 * l'inclure sur une page avec :  <script src="chatbot.js" defer></script>
 *
 * Il s'agit d'un assistant à RÉPONSES GUIDÉES : aucune IA n'est appelée, les réponses
 * sont pré-programmées à partir du contenu réel du site. C'est volontairement honnête
 * (« Assistant Ébrange », automatique) et il propose toujours un contact humain.
 *
 * ÉVOLUTION POSSIBLE — brancher une vraie IA plus tard :
 *   Le site est statique (Netlify), donc pas de clé API côté client (jamais de secret
 *   en dur dans le dépôt). Pour passer à une IA conversationnelle, créer une
 *   Netlify Function (ex. netlify/functions/chat.js) qui détient la clé API en
 *   variable d'environnement, puis remplacer/compléter la fonction repondre() ci-dessous
 *   par un fetch('/.netlify/functions/chat', { method:'POST', body: JSON.stringify({message}) }).
 *   Le reste de l'UI (bulle, fenêtre, accessibilité) est déjà en place et réutilisable.
 */
(function () {
  "use strict";
  if (window.__ebrangeChatbot) return; // évite un double chargement
  window.__ebrangeChatbot = true;

  var TEL = "06 76 68 34 93";
  var TEL_LINK = "tel:+33676683493";
  var MAIL = "contact@ecd-digital.com";
  var MAIL_LINK = "mailto:contact@ecd-digital.com?subject=Question%20depuis%20le%20site";

  /* Préfixe des liens internes : les pages du blog sont dans /blog/, il leur faut "../" */
  var BASE = /(^|\/)blog\/[^\/]*$/.test(window.location.pathname) ? "../" : "";

  /* ---------- 1. CSS (charte Ébrange) ---------- */
  var css = "\
  .ecb-launch{position:fixed;bottom:22px;right:22px;z-index:9998;width:60px;height:60px;border:none;border-radius:50%;cursor:pointer;\
    background:linear-gradient(135deg,#4f46e5,#2f7bd6 45%,#06b6d4);color:#fff;font-size:26px;line-height:1;\
    box-shadow:0 12px 30px rgba(47,123,214,.45);transition:transform .2s,box-shadow .2s;display:flex;align-items:center;justify-content:center}\
  .ecb-launch:hover{transform:translateY(-3px) scale(1.05);box-shadow:0 16px 38px rgba(47,123,214,.55)}\
  .ecb-launch:focus-visible{outline:3px solid #38bdf8;outline-offset:3px}\
  .ecb-launch .ecb-dot{position:absolute;top:6px;right:6px;width:12px;height:12px;border-radius:50%;background:#f97316;border:2px solid #fff}\
  .ecb-panel{position:fixed;bottom:94px;right:22px;z-index:9999;width:360px;max-width:calc(100vw - 32px);height:520px;max-height:calc(100vh - 130px);\
    background:#fff;border-radius:20px;box-shadow:0 24px 60px rgba(11,37,69,.28);display:flex;flex-direction:column;overflow:hidden;\
    font-family:'Inter',system-ui,Arial,sans-serif;opacity:0;transform:translateY(16px) scale(.98);pointer-events:none;transition:opacity .22s,transform .22s}\
  .ecb-panel.ecb-open{opacity:1;transform:none;pointer-events:auto}\
  .ecb-head{background:#0b2545;background-image:radial-gradient(500px 200px at 15% 0%,rgba(79,70,229,.55),transparent 60%),radial-gradient(400px 220px at 100% 0%,rgba(6,182,212,.45),transparent 60%);\
    color:#fff;padding:16px 18px;display:flex;align-items:center;gap:12px}\
  .ecb-head .ecb-av{width:40px;height:40px;border-radius:12px;background:linear-gradient(135deg,#4f46e5,#06b6d4);display:flex;align-items:center;justify-content:center;font-size:20px;flex:none}\
  .ecb-head h3{margin:0;font-family:'Poppins',sans-serif;font-size:15.5px;font-weight:700;line-height:1.2}\
  .ecb-head p{margin:2px 0 0;font-size:11.5px;color:#9fb6d6;display:flex;align-items:center;gap:5px}\
  .ecb-head p::before{content:'';width:7px;height:7px;border-radius:50%;background:#22c55e;display:inline-block}\
  .ecb-close{margin-left:auto;background:transparent;border:none;color:#c4d4ea;font-size:22px;line-height:1;cursor:pointer;padding:4px 6px;border-radius:8px}\
  .ecb-close:hover{background:rgba(255,255,255,.12);color:#fff}\
  .ecb-close:focus-visible{outline:2px solid #38bdf8;outline-offset:2px}\
  .ecb-body{flex:1;overflow-y:auto;padding:18px 16px;background:linear-gradient(180deg,#f5f8fd,#eef4fb);display:flex;flex-direction:column;gap:12px}\
  .ecb-msg{max-width:85%;padding:11px 14px;border-radius:14px;font-size:14px;line-height:1.55;white-space:normal;word-wrap:break-word}\
  .ecb-bot{align-self:flex-start;background:#fff;color:#1a2537;border:1px solid #e7eef7;border-bottom-left-radius:5px;box-shadow:0 6px 16px rgba(15,42,74,.06)}\
  .ecb-user{align-self:flex-end;background:linear-gradient(135deg,#4f46e5,#2f7bd6 45%,#06b6d4);color:#fff;border-bottom-right-radius:5px}\
  .ecb-msg a{color:#2f7bd6;font-weight:600}\
  .ecb-user a{color:#fff;text-decoration:underline}\
  .ecb-msg .ecb-link{display:inline-block;margin-top:8px;font-family:'Poppins',sans-serif;font-weight:600;font-size:13px;color:#2f7bd6}\
  .ecb-msg .ecb-link::after{content:' \\2192'}\
  .ecb-chips{display:flex;flex-wrap:wrap;gap:8px;padding:12px 16px;border-top:1px solid #e7eef7;background:#fff}\
  .ecb-chip{background:#eef4fb;border:1px solid #dbe7f5;color:#0b2545;font-family:'Poppins',sans-serif;font-weight:600;font-size:12.5px;\
    padding:8px 13px;border-radius:100px;cursor:pointer;transition:background .18s,border-color .18s,transform .15s}\
  .ecb-chip:hover{background:#e2edfb;border-color:#2f7bd6;transform:translateY(-2px)}\
  .ecb-chip:focus-visible{outline:2px solid #2f7bd6;outline-offset:2px}\
  .ecb-foot{padding:8px 16px 12px;background:#fff;font-size:10.5px;color:#8494ac;text-align:center;line-height:1.4}\
  @media(max-width:640px){\
    .ecb-panel{right:10px;left:10px;bottom:88px;width:auto;max-width:none;height:calc(100vh - 110px)}\
    .ecb-launch{bottom:16px;right:16px}\
  }\
  @media (prefers-reduced-motion:reduce){.ecb-panel,.ecb-launch{transition:none}}\
  ";

  var style = document.createElement("style");
  style.setAttribute("data-ebrange-chatbot", "");
  style.textContent = css;
  document.head.appendChild(style);

  /* ---------- 2. HTML ---------- */
  var launch = document.createElement("button");
  launch.className = "ecb-launch";
  launch.type = "button";
  launch.setAttribute("aria-label", "Ouvrir l'assistant Ébrange");
  launch.setAttribute("aria-expanded", "false");
  launch.innerHTML = '<span aria-hidden="true">💬</span><span class="ecb-dot" aria-hidden="true"></span>';

  var panel = document.createElement("div");
  panel.className = "ecb-panel";
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-label", "Assistant Ébrange");
  panel.setAttribute("aria-hidden", "true");
  panel.innerHTML =
    '<div class="ecb-head">' +
      '<div class="ecb-av" aria-hidden="true">🤖</div>' +
      '<div><h3>Assistant Ébrange</h3><p>Assistant automatique</p></div>' +
      '<button class="ecb-close" type="button" aria-label="Fermer l\'assistant">×</button>' +
    '</div>' +
    '<div class="ecb-body" id="ecb-body" role="log" aria-live="polite"></div>' +
    '<div class="ecb-chips" id="ecb-chips" role="group" aria-label="Suggestions de questions"></div>' +
    '<div class="ecb-foot">Réponses automatiques. Pour une réponse personnalisée, contactez-nous : <a href="' + MAIL_LINK + '">' + MAIL + '</a></div>';

  document.body.appendChild(launch);
  document.body.appendChild(panel);

  var body = panel.querySelector("#ecb-body");
  var chipsBox = panel.querySelector("#ecb-chips");
  var closeBtn = panel.querySelector(".ecb-close");

  /* ---------- 3. Contenu des réponses (tiré du site réel) ---------- */
  var CONTACT_HTML =
    'Avec plaisir&nbsp;! Le devis et le cadrage sont toujours gratuits et sans engagement.<br><br>' +
    '☎️ <a href="' + TEL_LINK + '">' + TEL + '</a><br>' +
    '✉️ <a href="' + MAIL_LINK + '">' + MAIL + '</a><br><br>' +
    'Une vraie personne vous répondra — je ne suis qu\'un assistant automatique.';

  var reponses = {
    site: 'Nous créons des sites pros pour les commerçants, artisans et indépendants 🌐<br><br>' +
          '• <strong>Essentiel</strong> : <strong>dès 632&nbsp;€</strong> avec le code <strong>LANCEMENT20</strong> <em>(au lieu de 790&nbsp;€, −20&nbsp;% sur les 3 formules site)</em><br>' +
          '• Formules <strong>Commerce &amp; Artisan</strong> et <strong>Premium</strong> pour aller plus loin<br>' +
          '• Hébergement &amp; maintenance <strong>dès 19&nbsp;€/mois</strong><br><br>' +
          'Vous validez toujours la maquette avant la mise en ligne.' +
          '<br><a class="ecb-link" href="' + BASE + 'sites.html">Découvrir la création de sites</a>',

    tarifs: 'Voici nos repères de prix 💰<br><br>' +
          '• <strong>Site web</strong> : <strong>dès 632&nbsp;€</strong> avec le code LANCEMENT20 (au lieu de 790&nbsp;€, −20&nbsp;% sur la création)<br>' +
          '• <strong>Hébergement &amp; maintenance</strong> : dès 19&nbsp;€/mois<br>' +
          '• <strong>Guides PDF</strong> : 27&nbsp;€ l\'unité<br>' +
          '• <strong>Agents IA sur mesure</strong> : dès 690&nbsp;€<br>' +
          '• <strong>Automatisations sur mesure</strong> : dès 690&nbsp;€<br><br>' +
          'La grille complète (options, marketing, maintenance) est sur la page Offres.' +
          '<br><a class="ecb-link" href="' + BASE + 'offres.html">Voir toutes les offres &amp; tarifs</a>',

    guides: 'Nos guides pratiques au format PDF, à 27&nbsp;€ 📚 — paiement unique, accès immédiat.<br><br>' +
          '• <strong>Visible en Ligne</strong> : devenir en 30 jours le commerce qu\'on trouve en premier sur Google <em>(disponible)</em><br>' +
          '• <strong>Avis 5 Étoiles</strong> <em>(bientôt)</em><br>' +
          '• <strong>Ta Fiche Google au Top</strong> <em>(bientôt)</em>' +
          '<br><a class="ecb-link" href="' + BASE + 'guides.html">Voir les guides</a>',

    agents: 'Les <strong>Agents IA sur mesure</strong> 🤖 : votre équipe d\'assistants IA, conçue pour votre métier et disponible 24h/24 (SAV, rendez-vous, rédaction, veille…).<br><br>' +
          '• Assistant unique clé en main : <strong>dès 690&nbsp;€</strong><br>' +
          '• Petite équipe IA (2-4 agents) : dès 1&nbsp;490&nbsp;€<br>' +
          '• Système complet : sur devis, dès 2&nbsp;900&nbsp;€<br><br>' +
          'Cadrage gratuit et sans engagement.' +
          '<br><a class="ecb-link" href="' + BASE + 'agents-ia.html">Découvrir les Agents IA</a>',

    automatisations: 'Les <strong>Automatisations sur mesure</strong> ⚙️ : vos tâches répétitives tournent toutes seules. Fichier client, relances de devis, rappels de rendez-vous et demandes d\'avis — vos outils se parlent enfin et travaillent pour vous.<br><br>' +
          '• Pack Essentiel : <strong>dès 690&nbsp;€</strong><br>' +
          '• Pack Pro (relances, avis, rappels) : dès 1&nbsp;490&nbsp;€<br>' +
          '• Pack Tout connecté (site, fichier, e-mail, facturation reliés) : sur devis, dès 2&nbsp;900&nbsp;€<br><br>' +
          'Mini-diagnostic gratuit et sans engagement.' +
          '<br><a class="ecb-link" href="' + BASE + 'automatisations.html">Découvrir les Automatisations</a>',

    contact: CONTACT_HTML
  };

  var CHIPS = [
    { label: "Créer un site", key: "site" },
    { label: "Tarifs", key: "tarifs" },
    { label: "Les guides à 27 €", key: "guides" },
    { label: "Agents IA", key: "agents" },
    { label: "Automatisations", key: "automatisations" },
    { label: "Nous contacter", key: "contact" }
  ];

  /* ---------- 4. Rendu ---------- */
  function scrollBottom() { body.scrollTop = body.scrollHeight; }

  function addMsg(html, who) {
    var m = document.createElement("div");
    m.className = "ecb-msg " + (who === "user" ? "ecb-user" : "ecb-bot");
    m.innerHTML = html;
    body.appendChild(m);
    scrollBottom();
    return m;
  }

  function renderChips() {
    chipsBox.innerHTML = "";
    CHIPS.forEach(function (c) {
      var b = document.createElement("button");
      b.className = "ecb-chip";
      b.type = "button";
      b.textContent = c.label;
      b.addEventListener("click", function () { repondre(c); });
      chipsBox.appendChild(b);
    });
  }

  // Fonction de réponse — point d'extension pour brancher une vraie IA plus tard.
  function repondre(chip) {
    addMsg(chip.label, "user");
    var html = reponses[chip.key] || CONTACT_HTML;
    setTimeout(function () { addMsg(html, "bot"); }, 260);
  }

  var greeted = false;
  function greet() {
    if (greeted) return;
    greeted = true;
    addMsg("Bonjour 👋 je suis l’<strong>Assistant Ébrange</strong>, un assistant automatique. Je peux vous orienter en quelques clics — sur quoi puis-je vous aider&nbsp;?", "bot");
    renderChips();
  }

  /* ---------- 5. Ouverture / fermeture ---------- */
  var isOpen = false;
  function openPanel() {
    isOpen = true;
    panel.classList.add("ecb-open");
    panel.setAttribute("aria-hidden", "false");
    launch.setAttribute("aria-expanded", "true");
    launch.setAttribute("aria-label", "Fermer l'assistant Ébrange");
    greet();
    closeBtn.focus();
  }
  function closePanel() {
    isOpen = false;
    panel.classList.remove("ecb-open");
    panel.setAttribute("aria-hidden", "true");
    launch.setAttribute("aria-expanded", "false");
    launch.setAttribute("aria-label", "Ouvrir l'assistant Ébrange");
    launch.focus();
  }
  function toggle() { isOpen ? closePanel() : openPanel(); }

  launch.addEventListener("click", toggle);
  closeBtn.addEventListener("click", closePanel);
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && isOpen) closePanel();
  });
})();
