// Réception du formulaire de contact du site ecd-digital.com
//
// Pourquoi cette fonction plutôt que Netlify Forms :
// la détection de formulaire est désactivée par défaut sur les projets récents,
// donc les soumissions tombaient dans le vide (0 lead capté). Ici le lead ne
// dépend plus d'aucun réglage du dashboard : il passe par du code.
//
// Le lead est TOUJOURS écrit dans les logs de la fonction (console.log), même si
// l'email échoue : aucun lead ne peut être perdu silencieusement.
//
// Variables à définir dans Netlify (Site settings -> Environment variables) :
//   RESEND_API_KEY   clé API Resend (obligatoire pour l'envoi email)
//   CONTACT_TO       destinataire (défaut : contact@ecd-digital.com)
//   CONTACT_FROM     expéditeur, sur un domaine vérifié dans Resend
//                    (défaut : "Site Ébrange <contact@ecd-digital.com>")

const TO_DEFAULT   = "contact@ecd-digital.com";
const FROM_DEFAULT = "Site Ébrange <contact@ecd-digital.com>";

const esc = (s) =>
  String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

// Réponse selon le contexte : requête AJAX -> JSON ; soumission classique
// (navigateur sans JS) -> redirection vers la section contact avec un drapeau.
const reply = (req, { ok, status, message }) => {
  const accept = req.headers.get("accept") || "";
  const wantsJson =
    accept.includes("application/json") ||
    (req.headers.get("x-requested-with") || "").toLowerCase() === "fetch";

  if (wantsJson) {
    return new Response(JSON.stringify({ ok, message }), {
      status,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "no-store",
      },
    });
  }

  // Sans JS : on renvoie l'internaute vers la page avec un état lisible.
  const flag = ok ? "envoye=1" : "erreur=1";
  return new Response(null, {
    status: 303,
    headers: { location: `/index.html?${flag}#contact`, "cache-control": "no-store" },
  });
};

async function parseBody(req) {
  const type = (req.headers.get("content-type") || "").toLowerCase();
  if (type.includes("application/json")) {
    try {
      return await req.json();
    } catch {
      return {};
    }
  }
  // Par défaut : application/x-www-form-urlencoded (ce qu'envoie le formulaire)
  const params = new URLSearchParams(await req.text());
  return Object.fromEntries(params.entries());
}

export default async (req) => {
  if (req.method !== "POST") {
    return reply(req, { ok: false, status: 405, message: "Méthode non autorisée." });
  }

  const data = await parseBody(req);

  // Piège à robots : si le champ caché est rempli, c'est un bot.
  // On répond "ok" pour ne pas l'aider, mais on n'envoie rien.
  if (data["bot-field"]) {
    return reply(req, { ok: true, status: 200, message: "Merci." });
  }

  const nom       = (data.nom || "").toString().trim();
  const telephone = (data.telephone || "").toString().trim();
  const email     = (data.email || "").toString().trim();
  const besoin    = (data.besoin || "").toString().trim();

  if (!nom || !telephone || !besoin) {
    return reply(req, { ok: false, status: 400, message: "Merci de remplir le nom, le téléphone et votre besoin." });
  }

  // Le lead est tracé dès maintenant : même si l'email échoue ensuite,
  // il reste récupérable dans les logs Netlify de la fonction.
  const recu = new Date().toISOString();
  console.log("LEAD CONTACT ecd-digital.com", JSON.stringify({ recu, nom, telephone, email, besoin }));

  const { RESEND_API_KEY } = process.env;
  const to   = process.env.CONTACT_TO   || TO_DEFAULT;
  const from = process.env.CONTACT_FROM || FROM_DEFAULT;

  if (!RESEND_API_KEY) {
    // Configuration incomplète : on le signale franchement (5xx) au lieu de
    // faire croire à un succès. Le lead est déjà dans les logs ci-dessus.
    console.error("CONFIG MANQUANTE : RESEND_API_KEY absent — lead non envoyé par email, voir le log LEAD CONTACT ci-dessus.");
    return reply(req, { ok: false, status: 500, message: "Envoi indisponible pour le moment." });
  }

  const html = `<!DOCTYPE html><html lang="fr"><body style="font-family:Arial,Helvetica,sans-serif;color:#222;line-height:1.6">
    <h2 style="margin:0 0 12px">Nouvelle demande depuis ecd-digital.com</h2>
    <p><strong>Nom :</strong> ${esc(nom)}</p>
    <p><strong>Téléphone :</strong> <a href="tel:${esc(telephone.replace(/[^\d+]/g, ""))}">${esc(telephone)}</a></p>
    <p><strong>Email :</strong> ${email ? `<a href="mailto:${esc(email)}">${esc(email)}</a>` : "non renseigné"}</p>
    <p><strong>Besoin :</strong><br>${esc(besoin).replace(/\n/g, "<br>")}</p>
    <hr style="border:none;border-top:1px solid #eee;margin:20px 0">
    <p style="color:#888;font-size:13px">Reçu le ${esc(recu)} · formulaire de contact du site.</p>
  </body></html>`;

  const text =
    `Nouvelle demande depuis ecd-digital.com\n\n` +
    `Nom : ${nom}\nTéléphone : ${telephone}\nEmail : ${email || "non renseigné"}\n\n` +
    `Besoin :\n${besoin}\n\nReçu le ${recu}`;

  const payload = {
    from,
    to: [to],
    subject: `Nouveau lead — ${nom}`,
    html,
    text,
  };
  // Si le prospect a laissé un email, une réponse part directement chez lui.
  if (email) payload.reply_to = email;

  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        authorization: `Bearer ${RESEND_API_KEY}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!r.ok) {
      const detail = await r.text();
      // 5xx volontaire : le front affiche alors le repli téléphone/email.
      console.error("RESEND a refusé l'envoi", r.status, detail, "— lead dans le log LEAD CONTACT ci-dessus.");
      return reply(req, { ok: false, status: 502, message: "Envoi impossible pour le moment." });
    }
  } catch (e) {
    console.error("RESEND injoignable :", e && e.message, "— lead dans le log LEAD CONTACT ci-dessus.");
    return reply(req, { ok: false, status: 502, message: "Envoi impossible pour le moment." });
  }

  return reply(req, { ok: true, status: 200, message: "Merci, votre demande est bien partie." });
};

export const config = { path: "/api/contact" };
