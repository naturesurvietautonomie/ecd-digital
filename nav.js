/*
 * Menu mobile Ébrange — bouton hamburger accessible, injecté sur toutes les pages.
 * ------------------------------------------------------------------------------
 * Autonome : injecte son propre CSS + le bouton burger, puis gère l'ouverture/
 * fermeture des liens de navigation sous 640 px (aucun backend). Il suffit d'inclure
 * <script src="nav.js" defer></script> sur la page. Compatible avec le <nav id="nav">
 * déjà présent (le script de scroll inline continue de fonctionner).
 */
(function () {
  "use strict";
  if (window.__ebrangeNav) return;
  window.__ebrangeNav = true;

  var nav = document.getElementById("nav");
  if (!nav) return;
  var wrap = nav.querySelector(".wrap");
  var links = nav.querySelector(".links");
  if (!wrap || !links) return;

  /* CSS — repris de la charte (bleu marine, cyan) */
  var css = "\
  .nav-burger{display:none;background:transparent;border:none;cursor:pointer;width:44px;height:44px;border-radius:10px;flex-direction:column;align-items:center;justify-content:center;gap:5px;padding:0}\
  .nav-burger span{display:block;width:24px;height:2px;border-radius:2px;background:#fff;transition:transform .25s,opacity .2s,background .3s}\
  .nav.scrolled .nav-burger span,.nav.nav-open .nav-burger span{background:#0b2545}\
  .nav.nav-open .nav-burger span:nth-child(1){transform:translateY(7px) rotate(45deg)}\
  .nav.nav-open .nav-burger span:nth-child(2){opacity:0}\
  .nav.nav-open .nav-burger span:nth-child(3){transform:translateY(-7px) rotate(-45deg)}\
  .nav-burger:focus-visible{outline:2px solid #38bdf8;outline-offset:2px}\
  @media(max-width:640px){\
    .nav-burger{display:flex}\
    .nav .wrap{flex-wrap:wrap}\
    .nav.nav-open{background:rgba(255,255,255,.97);backdrop-filter:blur(10px);box-shadow:0 6px 24px rgba(15,42,74,.1)}\
    .nav.nav-open .brand{color:#0b2545}\
    .nav .links{display:none!important;flex-basis:100%;flex-direction:column;gap:4px;margin:10px 0 6px}\
    .nav.nav-open .links{display:flex!important}\
    .nav .links a{color:#0b2545;font-size:15px;padding:12px 14px;border-radius:10px}\
    .nav .links a::after{display:none}\
    .nav .links a:hover{background:#eef4fb}\
    .nav .links .cta-mini{color:#fff!important;text-align:center;justify-content:center}\
  }\
  @media (prefers-reduced-motion:reduce){.nav-burger span{transition:none}}\
  ";
  var st = document.createElement("style");
  st.setAttribute("data-ebrange-nav", "");
  st.textContent = css;
  document.head.appendChild(st);

  /* Bouton burger */
  if (!links.id) links.id = "ecb-nav-links";
  var burger = document.createElement("button");
  burger.type = "button";
  burger.className = "nav-burger";
  burger.setAttribute("aria-label", "Ouvrir le menu");
  burger.setAttribute("aria-expanded", "false");
  burger.setAttribute("aria-controls", links.id);
  burger.innerHTML = '<span></span><span></span><span></span>';
  wrap.insertBefore(burger, links);

  function open() {
    nav.classList.add("nav-open");
    burger.setAttribute("aria-expanded", "true");
    burger.setAttribute("aria-label", "Fermer le menu");
  }
  function close() {
    nav.classList.remove("nav-open");
    burger.setAttribute("aria-expanded", "false");
    burger.setAttribute("aria-label", "Ouvrir le menu");
  }
  function toggle() { nav.classList.contains("nav-open") ? close() : open(); }

  burger.addEventListener("click", toggle);
  links.addEventListener("click", function (e) { if (e.target.closest("a")) close(); });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && nav.classList.contains("nav-open")) { close(); burger.focus(); }
  });
})();
