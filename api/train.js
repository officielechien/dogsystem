// Récupère l'horaire théorique complet d'un train donné (par son numéro),
// à partir des données Static (trips.txt + stop_times.txt).
// Utile quand un train est à l'heure et n'apparaît donc pas dans le flux
// "Trip Updates" (qui ne liste que les trains ayant un retard signalé).

import JSZip from "jszip";

let staticZipCache = { zip: null, timestamp: 0 };
const CACHE_TTL_MS = 1000 * 60 * 60 * 6; // 6 heures

async function getStaticZip(apiKey) {
  const now = Date.now();
  if (staticZipCache.zip && now - staticZipCache.timestamp < CACHE_TTL_MS) {
    return staticZipCache.zip;
  }
  const response = await fetch(
    "https://api-management-opendata-production.azure-api.net/api/gtfs/feed/nmbssncb/static/",
    { headers: { "bmc-partner-key": apiKey } }
  );
  if (!response.ok) throw new Error(`Erreur API Static (${response.status}).`);
  const buffer = Buffer.from(await response.arrayBuffer());
  const zip = await JSZip.loadAsync(buffer);
  staticZipCache = { zip, timestamp: now };
  return zip;
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

export default async function handler(req, res) {
  const apiKey = process.env.SNCB_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "Clé API manquante côté serveur (SNCB_API_KEY)." });
  }

  const trainNumber = String(req.query.number || "").trim();
  if (!trainNumber) {
    return res.status(400).json({ error: "Paramètre 'number' manquant." });
  }

  try {
    const zip = await getStaticZip(apiKey);

    // 1) Trouver le(s) trip_id correspondant à ce numéro de train.
    const tripsFile = zip.file("trips.txt");
    if (!tripsFile) return res.status(500).json({ error: "trips.txt introuvable dans l'archive." });

    const tripsText = await tripsFile.async("string");
    const tripsLines = tripsText.split(/\r?\n/).filter(Boolean);
    const tripsHeaders = parseCsvLine(tripsLines[0]);
    const tripIdIdx = tripsHeaders.indexOf("trip_id");
    const shortNameIdx = tripsHeaders.indexOf("trip_short_name");

    if (tripIdIdx === -1 || shortNameIdx === -1) {
      return res.status(500).json({ error: "Colonnes attendues introuvables dans trips.txt." });
    }

    const todayStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const candidateTripIds = [];
    for (let i = 1; i < tripsLines.length; i++) {
      const cols = parseCsvLine(tripsLines[i]);
      if (cols[shortNameIdx] === trainNumber) {
        candidateTripIds.push(cols[tripIdIdx]);
      }
    }

    if (candidateTripIds.length === 0) {
      return res.status(404).json({ error: `Aucun train "${trainNumber}" trouvé dans les horaires.` });
    }

    const chosenTripId = candidateTripIds.find(id => id.includes(todayStr)) || candidateTripIds[0];

    // 2) Récupérer tous les arrêts prévus pour ce trip_id précis dans stop_times.txt.
    const stopTimesFile = zip.file("stop_times.txt");
    if (!stopTimesFile) return res.status(500).json({ error: "stop_times.txt introuvable dans l'archive." });

    const stopTimesText = await stopTimesFile.async("string");
    const lines = stopTimesText.split(/\r?\n/);
    const headers = parseCsvLine(lines[0]);
    const stTripIdIdx = headers.indexOf("trip_id");
    const stopIdIdx = headers.indexOf("stop_id");
    const seqIdx = headers.indexOf("stop_sequence");
    const arrIdx = headers.indexOf("arrival_time");
    const depIdx = headers.indexOf("departure_time");

    const stops = [];
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      if (!line || line.indexOf(chosenTripId) === -1) continue; // filtre rapide avant le vrai parsing
      const cols = parseCsvLine(line);
      if (cols[stTripIdIdx] !== chosenTripId) continue;
      stops.push({
        stopId: cols[stopIdIdx],
        seq: parseInt(cols[seqIdx], 10) || 0,
        arrivalTime: cols[arrIdx],
        departureTime: cols[depIdx]
      });
    }

    stops.sort((a, b) => a.seq - b.seq);

    if (stops.length === 0) {
      return res.status(404).json({ error: `Horaire introuvable pour le train "${trainNumber}".` });
    }

    return res.status(200).json({ tripId: chosenTripId, trainNumber, stops });
  } catch (err) {
    return res.status(500).json({ error: "Impossible de charger l'horaire.", details: String(err) });
  }
}
