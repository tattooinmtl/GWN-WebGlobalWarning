/**
 * Cyber attacks layer for the 2D map. Entries come from the daily scan file
 * `public/data/x-markers.json` (schema: public/data/X-MARKERS.md) with `type: "cyber"`;
 * lat/lon is the targeted organization's or country's location.
 */

/** Electric magenta: kept apart from the lilac snow and pink freezing-rain radar colors. */
export const CYBER_COLOR = "#d000ff";

export const CYBER_URL = "/data/x-markers.json";

export type CyberLevel = "green" | "yellow" | "orange" | "red";

export type CyberMarker = {
  id: string;
  title: string;
  lat: number;
  lon: number;
  level: CyberLevel;
  source_url: string;
  time: string;
};

const LEVELS = new Set(["green", "yellow", "orange", "red"]);

/** Keep only valid `type: "cyber"` rows; bad rows are skipped, never thrown. */
export function parseCyber(json: unknown): CyberMarker[] {
  const rows = Array.isArray(json)
    ? json
    : json && typeof json === "object" && Array.isArray((json as { markers?: unknown }).markers)
      ? (json as { markers: unknown[] }).markers
      : [];
  const out: CyberMarker[] = [];
  for (const raw of rows) {
    if (!raw || typeof raw !== "object") continue;
    const r = raw as Record<string, unknown>;
    if (String(r.type ?? "").toLowerCase() !== "cyber") continue;
    const lat = Number(r.lat);
    const lon = Number(r.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) continue;
    if (typeof r.id !== "string" || typeof r.title !== "string") continue;
    const level = String(r.level ?? "").toLowerCase();
    out.push({
      id: r.id,
      title: r.title.slice(0, 200),
      lat,
      lon,
      level: LEVELS.has(level) ? (level as CyberLevel) : "yellow",
      source_url: typeof r.source_url === "string" && /^https?:\/\//.test(r.source_url) ? r.source_url : "",
      time: typeof r.time === "string" && !Number.isNaN(Date.parse(r.time)) ? r.time : "",
    });
  }
  return out;
}

export async function loadCyber(): Promise<CyberMarker[]> {
  const res = await fetch(`${CYBER_URL}?t=${Math.floor(Date.now() / 300_000)}`);
  if (!res.ok) return [];
  return parseCyber(await res.json());
}
