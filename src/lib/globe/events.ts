import type { DisasterEvent } from "@/lib/disasters/types";

/** Warning level used by every globe marker (pulse speed, size and color follow it). */
export type WarnLevel = "green" | "yellow" | "orange" | "red";

export const LEVELS: WarnLevel[] = ["green", "yellow", "orange", "red"];

export const LEVEL_STYLE: Record<WarnLevel, { color: string; label: string; size: number; pulseHz: number; rank: number }> = {
  green: { color: "#3ddc84", label: "Advisory", size: 0.012, pulseHz: 0.35, rank: 0 },
  yellow: { color: "#f5c518", label: "Watch", size: 0.015, pulseHz: 0.6, rank: 1 },
  orange: { color: "#ff8a2a", label: "Warning", size: 0.019, pulseHz: 0.95, rank: 2 },
  red: { color: "#e23b4a", label: "Emergency", size: 0.024, pulseHz: 1.5, rank: 3 },
};

/**
 * One marker on the globe. Same shape as `public/data/x-markers.json` entries (see public/data/X-MARKERS.md),
 * plus the source label used in the feed.
 */
export type GlobeMarker = {
  id: string;
  title: string;
  lat: number;
  lon: number;
  level: WarnLevel;
  type: string;
  source_url: string;
  /** ISO 8601 UTC */
  time: string;
  source: string;
  detail?: string;
};

export const TYPE_GLYPH: Record<string, string> = {
  quake: "≋",
  flood: "≈",
  fire: "▲",
  storm: "@",
  volcano: "▲",
  drought: "☼",
  landslide: "◣",
  x: "𝕏",
  other: "!",
};

export const TYPE_EMOJI: Record<string, string> = {
  quake: "🌐",
  flood: "🌊",
  fire: "🔥",
  storm: "🌀",
  volcano: "🌋",
  drought: "☀️",
  landslide: "⛰️",
  x: "𝕏",
  other: "⚠️",
};

export function quakeLevel(mag: number): WarnLevel {
  if (mag >= 6.5) return "red";
  if (mag >= 5.5) return "orange";
  if (mag >= 4.5) return "yellow";
  return "green";
}

function maxLevel(a: WarnLevel, b: WarnLevel): WarnLevel {
  return LEVEL_STYLE[a].rank >= LEVEL_STYLE[b].rank ? a : b;
}

/** Source alert (GDACS/NWS/ECCC colors) → globe level; quakes also go by magnitude. */
export function eventLevel(e: Pick<DisasterEvent, "alert" | "kind" | "mag">): WarnLevel {
  const fromAlert: WarnLevel =
    e.alert === "red" ? "red" : e.alert === "orange" ? "orange" : e.alert === "green" ? "yellow" : "green";
  if (e.kind === "quake" && e.mag != null) return maxLevel(quakeLevel(e.mag), e.alert === "green" ? "green" : fromAlert);
  return fromAlert;
}

export function fromDisaster(e: DisasterEvent): GlobeMarker {
  return {
    id: e.id,
    title: e.title,
    lat: e.lat,
    lon: e.lon,
    level: eventLevel(e),
    type: e.kind,
    source_url: e.url,
    time: e.time,
    source: e.source,
    detail: [e.place, e.detail].filter(Boolean).join(" · "),
  };
}

const LEVEL_SET = new Set<string>(LEVELS);

/** Validate entries of the static X markers file; bad rows are skipped, never thrown. */
export function parseXMarkers(json: unknown): GlobeMarker[] {
  const rows = Array.isArray(json)
    ? json
    : json && typeof json === "object" && Array.isArray((json as { markers?: unknown }).markers)
      ? (json as { markers: unknown[] }).markers
      : [];
  const out: GlobeMarker[] = [];
  for (const raw of rows) {
    if (!raw || typeof raw !== "object") continue;
    const r = raw as Record<string, unknown>;
    const lat = Number(r.lat);
    const lon = Number(r.lon);
    const level = String(r.level ?? "").toLowerCase();
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) continue;
    if (typeof r.id !== "string" || typeof r.title !== "string") continue;
    const time = typeof r.time === "string" && !Number.isNaN(Date.parse(r.time)) ? r.time : new Date().toISOString();
    out.push({
      id: `x:${r.id}`,
      title: r.title.slice(0, 200),
      lat,
      lon,
      level: LEVEL_SET.has(level) ? (level as WarnLevel) : "yellow",
      type: typeof r.type === "string" && r.type ? r.type.slice(0, 24) : "x",
      source_url: typeof r.source_url === "string" && /^https?:\/\//.test(r.source_url) ? r.source_url : "",
      time,
      source: "X scan",
    });
  }
  return out;
}

export const WINDOWS = [
  { id: "1h", label: "Last hour", ms: 3600_000 },
  { id: "6h", label: "6 h", ms: 6 * 3600_000 },
  { id: "24h", label: "24 h", ms: 24 * 3600_000 },
  { id: "all", label: "All open", ms: Number.POSITIVE_INFINITY },
] as const;

export type WindowId = (typeof WINDOWS)[number]["id"];
