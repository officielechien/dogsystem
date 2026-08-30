// Cette fonction est déclenchée automatiquement une fois par jour (voir vercel.json).
// Elle regarde les trains actuellement en circulation, récupère leur composition
// (numéros de voitures), et enregistre le résultat dans le stockage permanent.
// Au fil des semaines, cet historique permettra de repérer des cycles récurrents
// (quelle voiture revient sur quel type de trajet).

import { kv } from "@vercel/kv";
import JSZip from "jszip";

const USER_AGENT = "DOGSYSTEM/1.0 (dogsystem.vercel.app)";
const PREFIXES_TO_TRY = ["IC", "S", "L", "P", "EXTRA", "ICE", "THA", "EUR", "IZY", "ICT", "CR"];

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

async function getTrainNumberMap(apiKey) {
  const response = await fetch(
    "https://api-management-opendata-production.azure-api.net/api/gtfs/feed/nmbssncb/static/",
    { headers: { "bmc-partner-key": apiKey } }
  );
  if (!response.ok) throw new Error(`Erreur API Static (${response.status}).`);
  const buffer = Buffer.from(await response.arrayBuffer());
  const zip = await JSZip.loadAsync(buffer);
  const tripsFile = zip.file("trips.txt");
  const tripsText = await tripsFile.async("string");
  const lines = tripsText.split(/\r?\n/).filter(Boolean);
  const headers = parseCsvLine(lines[0]);
  const tripIdIdx = headers.indexOf("trip_id");
  const shortNameIdx = headers.indexOf("trip_short_name");

  const exact = {};
  const byPrefix = {};
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i]);
    const tripId = cols[tripIdIdx];
    const shortName = cols[shortNameIdx];
    if (!tripId || !shortName) continue;
    exact[tripId] = shortName;
    const lastColon = tripId.lastIndexOf(':');
    if (lastColon > -1) byPrefix[tripId.substring(0, lastColon)] = shortName;
  }
  return { exact, byPrefix };
}

async function getActiveTrainNumbers(apiKey) {
  const res = await fetch(
    "https://api-management-opendata-production.azure-api.net/api/gtfs/feed/nmbssncb/rt/trip-update/",
    { headers: { "bmc-partner-key": apiKey } }
  );
  if (!res.ok) throw new Error(`Erreur API Trip Updates (${res.status}).`);
  const data = await res.json();
  const { exact, byPrefix } = await getTrainNumberMap(apiKey);

  const numbers = new Set();
  (data.entity || []).forEach(e => {
    const tu = e.trip_update || e.tripUpdate;
    if (!tu) return;
    const trip = tu.trip || {};
    const rawTripId = trip.trip_id || trip.tripId;
    if (!rawTripId) return;
    const match = exact[rawTripId] || byPrefix[rawTripId];
    if (match) numbers.add(match);
  });
  return Array.from(numbers);
}

async function fetchComposition(trainNumber) {
  for (const prefix of PREFIXES_TO_TRY) {
    const vehicleId = prefix + trainNumber;
    try {
      const compRes = await fetch(
        `https://api.irail.be/composition/?id=${encodeURIComponent(vehicleId)}&format=json&lang=fr`,
        { headers: { "User-Agent": USER_AGENT } }
      );
      if (!compRes.ok) continue;
      const compData = await compRes.json();
      const segments = compData?.composition?.segments?.segment || [];
      const materialNumbers = [];
      segments.forEach(seg => {
        const units = seg?.composition?.units?.unit || [];
        units.forEach(u => { if (u.materialNumber) materialNumbers.push(u.materialNumber); });
      });
      if (materialNumbers.length > 0) return materialNumbers;
    } catch (err) {
      continue;
    }
  }
  return null;
}

export default async function handler(req, res) {
  const apiKey = process.env.SNCB_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "Clé API manquante (SNCB_API_KEY)." });

  try {
    const trainNumbers = await getActiveTrainNumbers(apiKey);
    const today = new Date().toISOString().slice(0, 10);
    const records = [];

    for (const number of trainNumbers) {
      const units = await fetchComposition(number);
      if (units) records.push({ trainNumber: number, units, time: Date.now() });
    }

    const key = `compositions:${today}`;
    const existing = (await kv.get(key)) || [];
    await kv.set(key, [...existing, ...records]);

    return res.status(200).json({ date: today, trainsChecked: trainNumbers.length, recorded: records.length });
  } catch (err) {
    return res.status(500).json({ error: "Erreur lors de l'enregistrement.", details: String(err) });
  }
}
