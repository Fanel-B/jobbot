// JobBot est en pause : ce proxy ne contacte plus l'API Anthropic.
// Aucun en-tete CORS n'est renvoye, y compris sur les requetes OPTIONS,
// pour que l'endpoint ne soit plus appelable depuis un autre domaine.
export default function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  return res.status(410).json({ error: "JobBot est en pause." });
}
