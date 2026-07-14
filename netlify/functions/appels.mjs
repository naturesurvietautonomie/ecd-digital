// Passerelle Airtable pour la page /appels.html
//
// Le jeton Airtable ne quitte jamais le serveur : la page publique n'en a pas
// connaissance et ne peut pas le lire. Elle envoie seulement un code d'accès,
// qui est comparé ici à la variable d'environnement APPELS_CODE.
//
// Variables à définir dans Netlify (Site settings → Environment variables) :
//   AIRTABLE_TOKEN  jeton Airtable (scopes : data.records:read + data.records:write)
//   AIRTABLE_BASE   app6P1kmkxQohVh1W
//   AIRTABLE_TABLE  tblzQE71NvfzRuVfZ
//   APPELS_CODE     le code que tu tapes sur la page (choisis-le, ne le partage pas)

const API = "https://api.airtable.com/v0";

// Ce que la page envoie  →  ce qui est écrit dans Airtable
const RESULTAT = {
  repondeur: "☎️ Pas décroché",
  parle:     "🗣️ Je lui ai parlé",
  rdv:       "🔥 Devis à envoyer",
  rappeler:  "⏰ À rappeler",
  non:       "❌ Pas intéressé",
};

// Un résultat d'appel fait aussi bouger le statut du prospect.
const STATUT = {
  repondeur: "Contacté",
  parle:     "Contacté",
  rdv:       "RDV pris",
  rappeler:  "Contacté",
  non:       "Perdu / Stop",
};

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });

export default async (req) => {
  const { AIRTABLE_TOKEN, AIRTABLE_BASE, AIRTABLE_TABLE, APPELS_CODE } = process.env;

  if (!AIRTABLE_TOKEN || !AIRTABLE_BASE || !AIRTABLE_TABLE || !APPELS_CODE) {
    return json({ error: "Configuration incomplète côté Netlify." }, 500);
  }

  // Le code d'accès est comparé à longueur constante-ish : on refuse tout ce qui
  // ne correspond pas exactement, sans dire ce qui cloche.
  const code = req.headers.get("x-ecd-code") || "";
  if (code !== APPELS_CODE) {
    return json({ error: "Code refusé." }, 401);
  }

  const at = (path, init = {}) =>
    fetch(`${API}/${AIRTABLE_BASE}/${AIRTABLE_TABLE}${path}`, {
      ...init,
      headers: {
        authorization: `Bearer ${AIRTABLE_TOKEN}`,
        "content-type": "application/json",
        ...(init.headers || {}),
      },
    });

  // ---------- lire les 23 appels ----------
  if (req.method === "GET") {
    const formule = encodeURIComponent("NOT({Jour d'appel} = BLANK())");
    const r = await at(`?filterByFormula=${formule}&pageSize=100`);
    if (!r.ok) {
      return json({ error: "Airtable a refusé la lecture.", detail: await r.text() }, 502);
    }
    const data = await r.json();

    const inverse = Object.fromEntries(
      Object.entries(RESULTAT).map(([k, v]) => [v, k])
    );

    const appels = data.records.map((rec) => {
      const f = rec.fields;
      return {
        id: rec.id,
        nom: f["Prospect"] || "",
        secteur: f["Secteur"] || "",
        ville: f["Localisation"] || "",
        tel: (f["Téléphone"] || "").replace(/[^\d+]/g, ""),
        jour: f["Jour d'appel"] || "",
        heure: f["Heure d'appel"] || "",
        resultat: inverse[f["Résultat appel"]] || null,
        sms: !!f["SMS envoyé"],
        rappel: f["Prochaine relance"] || "",
        notes: f["Notes"] || "",
      };
    });

    return json({ appels });
  }

  // ---------- écrire le résultat d'un appel ----------
  if (req.method === "POST") {
    let body;
    try {
      body = await req.json();
    } catch {
      return json({ error: "Corps de requête illisible." }, 400);
    }

    const { id, resultat, sms, rappel, notes } = body || {};
    if (!id || typeof id !== "string" || !id.startsWith("rec")) {
      return json({ error: "Identifiant de prospect manquant." }, 400);
    }

    const fields = {};

    if (resultat !== undefined) {
      if (resultat === null) {
        fields["Résultat appel"] = "☐ Pas encore appelé";
      } else if (RESULTAT[resultat]) {
        fields["Résultat appel"] = RESULTAT[resultat];
        fields["Statut"] = STATUT[resultat];
        fields["Date 1er contact"] = new Date().toISOString().slice(0, 10);
      } else {
        return json({ error: "Résultat d'appel inconnu." }, 400);
      }
    }
    if (typeof sms === "boolean") fields["SMS envoyé"] = sms;
    if (typeof rappel === "string") fields["Prochaine relance"] = rappel || null;
    if (typeof notes === "string") fields["Notes"] = notes;

    if (!Object.keys(fields).length) {
      return json({ error: "Rien à enregistrer." }, 400);
    }

    const r = await at("", {
      method: "PATCH",
      body: JSON.stringify({ records: [{ id, fields }], typecast: true }),
    });

    if (!r.ok) {
      return json({ error: "Airtable a refusé l'écriture.", detail: await r.text() }, 502);
    }
    return json({ ok: true });
  }

  return json({ error: "Méthode non autorisée." }, 405);
};

export const config = { path: "/api/appels" };
