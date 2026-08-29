// Récupère la composition physique d'un train (numéros de voitures, type de matériel)
// via l'API publique iRail (api.irail.be), une source différente de l'API SNCB officielle,
// spécialisée dans ce type d'information détaillée sur le matériel roulant.
//
// iRail identifie les trains avec un préfixe de catégorie + le numéro (ex: "IC537", "S51507").
// Comme on ne connaît que le numéro nu, on essaie les préfixes les plus courants un par un.

const PREFIXES_TO_TRY = ["IC", "S", "L", "P", "EXTRA", "ICE", "THA", "EUR"];
const USER_AGENT = "DOGSYSTEM/1.0 (dogsystem.vercel.app)";

export default async function handler(req, res) {
  const trainNumber = String(req.query.number || "").trim();
  if (!trainNumber) {
    return res.status(400).json({ error: "Paramètre 'number' manquant." });
  }

  for (const prefix of PREFIXES_TO_TRY) {
    const vehicleId = prefix + trainNumber;
    try {
      // 1) Vérifie que ce train existe bien sous cet identifiant.
      const vehicleRes = await fetch(
        `https://api.irail.be/vehicle/?id=${encodeURIComponent(vehicleId)}&format=json&lang=fr`,
        { headers: { "User-Agent": USER_AGENT } }
      );
      if (!vehicleRes.ok) continue;
      const vehicleData = await vehicleRes.json();
      if (!vehicleData || vehicleData.error) continue;

      // 2) Récupère la composition physique pour ce même identifiant.
      const compRes = await fetch(
        `https://api.irail.be/composition/?id=${encodeURIComponent(vehicleId)}&format=json&lang=fr`,
        { headers: { "User-Agent": USER_AGENT } }
      );
      if (!compRes.ok) continue;
      const compData = await compRes.json();

      const segments = compData?.composition?.segments?.segment || [];
      const units = [];
      segments.forEach(seg => {
        const segUnits = seg?.composition?.units?.unit || [];
        segUnits.forEach(u => {
          units.push({
            materialNumber: u.materialNumber,
            type: u.materialType?.parent_type || null,
            hasBikeSection: u.hasBikeSection === "1",
            hasToilets: u.hasToilets === "1",
            seatsFirstClass: parseInt(u.seatsFirstClass, 10) || 0,
            seatsSecondClass: parseInt(u.seatsSecondClass, 10) || 0
          });
        });
      });

      if (units.length > 0) {
        res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate");
        return res.status(200).json({ vehicleId, units });
      }
    } catch (err) {
      continue; // on essaie le préfixe suivant
    }
  }

  return res.status(404).json({
    error: `Composition introuvable pour le train ${trainNumber} (essayé avec les préfixes ${PREFIXES_TO_TRY.join(", ")}).`
  });
}
