// Cette fonction tourne sur le serveur de Vercel, jamais dans le navigateur.
// Elle seule connaît la clé API secrète (SNCB_API_KEY) : le site public ne la voit jamais.

export default async function handler(req, res) {
  const apiKey = process.env.SNCB_API_KEY;

  if (!apiKey) {
    return res.status(500).json({
      error: "Clé API manquante côté serveur (variable SNCB_API_KEY non configurée sur Vercel)."
    });
  }

  try {
    const response = await fetch(
      "https://api-management-opendata-production.azure-api.net/api/gtfs/feed/nmbssncb/rt/trip-update/",
      {
        headers: {
          "bmc-partner-key": apiKey,
          "Cache-Control": "no-cache"
        }
      }
    );

    if (!response.ok) {
      return res.status(response.status).json({
        error: `L'API SNCB a répondu avec une erreur (${response.status}).`
      });
    }

    const data = await response.json();

    // On autorise le navigateur à mettre en cache 20 secondes pour éviter
    // de spammer l'API SNCB à chaque rechargement de page.
    res.setHeader("Cache-Control", "s-maxage=20, stale-while-revalidate");
    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ error: "Impossible de contacter l'API SNCB.", details: String(err) });
  }
}
