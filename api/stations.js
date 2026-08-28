// Cette fonction récupère la liste officielle des gares (données "Static" GTFS,
// fournie sous forme de fichier zip) et la transforme en liste utilisable par le site.
// Comme cette liste change très rarement, on la garde en mémoire quelques heures
// pour ne pas la re-télécharger à chaque visite.

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
    const stopsFile = zip.file("stops.txt");

    if (!stopsFile) {
      return res.status(500).json({ error: "Fichier stops.txt introuvable dans l'archive." });
    }

    const csvText = await stopsFile.async("string");
    const stations = parseStopsCsv(csvText);

    cache = { data: stations, timestamp: now };

    res.setHeader("Cache-Control", "s-maxage=3600, stale-while-revalidate");
    return res.status(200).json(stations);
  } catch (err) {
    return res.status(500).json({ error: "Impossible de charger les données Static.", details: String(err) });
  }
}

function parseStopsCsv(csvText) {
  const lines = csvText.split(/\r?\n/).filter(Boolean);
  const headers = parseCsvLine(lines[0]);
  const idIdx = headers.indexOf("stop_id");
  const nameIdx = headers.indexOf("stop_name");

  const stations = {};
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i]);
    const id = cols[idIdx];
    const name = cols[nameIdx];
    if (!id || !name) continue;
    stations[id] = name;
  }
  return stations;
}

// Petit lecteur de CSV qui gère les champs entre guillemets (les noms de gares
// peuvent contenir des virgules, ex: "Bruxelles, Central" dans certains exports).
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
