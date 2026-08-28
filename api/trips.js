// Récupère, depuis les données Static, la correspondance officielle entre
// l'identifiant technique d'un trajet (trip_id) et le vrai numéro de train
// affiché en gare (trip_short_name). Même logique de cache que stations.js.

import JSZip from "jszip";

let cache = { data: null, timestamp: 0 };
const CACHE_TTL_MS = 1000 * 60 * 60 * 6; // 6 heures

export default async function handler(req, res) {
  const apiKey = process.env.SNCB_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: "Clé API manquante côté serveur (SNCB_API_KEY)." });
  }

  const now = Date.now();
  if (cache.data && now - cache.timestamp < CACHE_TTL_MS) {
    res.setHeader("Cache-Control", "s-maxage=3600, stale-while-revalidate");
    return res.status(200).json(cache.data);
  }

  try {
    const response = await fetch(
      "https://api-management-opendata-production.azure-api.net/api/gtfs/feed/nmbssncb/static/",
      { headers: { "bmc-partner-key": apiKey } }
    );

    if (!response.ok) {
      return res.status(response.status).json({ error: `Erreur API Static (${response.status}).` });
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    const zip = await JSZip.loadAsync(buffer);
    const tripsFile = zip.file("trips.txt");

    if (!tripsFile) {
      return res.status(500).json({ error: "Fichier trips.txt introuvable dans l'archive." });
    }

    const csvText = await tripsFile.async("string");
    const trips = parseTripsCsv(csvText);

    cache = { data: trips, timestamp: now };

    res.setHeader("Cache-Control", "s-maxage=3600, stale-while-revalidate");
    return res.status(200).json(trips);
  } catch (err) {
    return res.status(500).json({ error: "Impossible de charger les données Static (trips).", details: String(err) });
  }
}

function parseTripsCsv(csvText) {
  const lines = csvText.split(/\r?\n/).filter(Boolean);
  const headers = parseCsvLine(lines[0]);
  const tripIdIdx = headers.indexOf("trip_id");
  const shortNameIdx = headers.indexOf("trip_short_name");

  const trips = {};
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i]);
    const tripId = cols[tripIdIdx];
    const shortName = shortNameIdx >= 0 ? cols[shortNameIdx] : null;
    if (!tripId || !shortName) continue;
    trips[tripId] = shortName;
  }
  return trips;
}

function parseCsvLine(line) {
  const result = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQuotes) {
      if (c === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++; }
        else inQuotes = false;
      } else cur += c;
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ',') { result.push(cur); cur = ""; }
      else cur += c;
    }
  }
  result.push(cur);
  return result;
}
