import { clamp } from "./format";
import { EMPTY_COUNTS, locateCountry, strongerAlert, type PrepCountry } from "./geo";
import type {
  AlertLevel,
  AssignedEvent,
  CountryStat,
  DisasterEvent,
  HazardKind,
  Metric,
} from "./types";

function emptyStat(c: PrepCountry, precipMm: number, owmRain: number | null): CountryStat {
  return {
    id: c.id,
    name: c.name,
    iso2: c.iso2,
    continent: c.continent,
    pop: c.pop,
    lon: c.lon,
    lat: c.lat,
    precipMm,
    owmRain,
    counts: EMPTY_COUNTS(),
    maxMag: 0,
    maxFloodAlert: "info",
    score: 0,
    eventTotal: 0,
    events: [],
  };
}

function floodScore(c: CountryStat): number {
  const rain = clamp(c.precipMm / 80, 0, 1);
  const owm = c.owmRain == null ? 0 : clamp(c.owmRain / 12, 0, 1);
  const alert = c.maxFloodAlert === "red" ? 0.5 : c.maxFloodAlert === "orange" ? 0.32 : c.maxFloodAlert === "green" ? 0.14 : 0;
  const hits = clamp(c.counts.flood * 0.18 + alert, 0, 1);
  return clamp(Math.max(rain, owm) * 0.72 + hits * 0.62, 0, 1);
}

function quakeScore(c: CountryStat): number {
  if (c.counts.quake === 0) return 0;
  const magPart = clamp((c.maxMag - 3.1) / 4.4, 0, 1);
  const countPart = clamp(c.counts.quake / 10, 0, 1);
  return clamp(magPart * 0.86 + countPart * 0.22, 0, 1);
}

function countScore(n: number, div: number): number {
  return clamp(n / div, 0, 1);
}

export function scoreCountry(c: CountryStat, metric: Metric): number {
  const flood = floodScore(c);
  const quake = quakeScore(c);
  const fire = countScore(c.counts.fire, 3);
  const storm = clamp(c.counts.storm * 0.42, 0, 1);
  const volcano = clamp(c.counts.volcano * 0.55, 0, 1);
  if (metric === "flood") return flood;
  if (metric === "quake") return quake;
  if (metric === "fire") return fire;
  if (metric === "storm") return storm;
  const parts = [flood, quake, fire, storm, volcano].sort((a, b) => b - a);
  return clamp(parts[0] * 0.84 + parts[1] * 0.26, 0, 1);
}

function eventRank(e: DisasterEvent): number {
  const alert = e.alert === "red" ? 300 : e.alert === "orange" ? 200 : e.alert === "green" ? 90 : 30;
  return alert + (e.mag ?? 0) * 18;
}

export function buildAtlasModel(
  prep: PrepCountry[],
  events: DisasterEvent[],
  precip: { id: string; mm: number }[],
  metric: Metric,
  owm: Record<string, number>,
  ai: { metric: Metric; values: Record<string, number> } | null,
): { countries: CountryStat[]; events: AssignedEvent[] } {
  const rain = new Map(precip.map((p) => [p.id, p.mm]));
  const byId = new Map<string, CountryStat>();
  const byIso = new Map<string, CountryStat>();
  for (const c of prep) {
    const stat = emptyStat(c, rain.get(c.id) ?? 0, owm[c.id] ?? null);
    byId.set(c.id, stat);
    byIso.set(c.iso2.toUpperCase(), stat);
    byIso.set(c.id.toUpperCase(), stat);
  }

  const assigned: AssignedEvent[] = [];
  for (const event of events) {
    const hinted = event.isoHint ? byIso.get(event.isoHint.toUpperCase()) : undefined;
    const found = hinted ?? locateCountry(prep, event.lon, event.lat);
    const countryId = found?.id ?? "";
    const countryName = found?.name ?? "";
    const row: AssignedEvent = { ...event, countryId, countryName };
    assigned.push(row);
    if (!found) continue;
    const stat = byId.get(found.id);
    if (!stat) continue;
    stat.counts[event.kind] += 1;
    stat.eventTotal += 1;
    if (event.kind === "quake" && (event.mag ?? 0) > stat.maxMag) stat.maxMag = event.mag ?? 0;
    if (event.kind === "flood") stat.maxFloodAlert = strongerAlert(stat.maxFloodAlert, event.alert);
    stat.events.push(row);
  }

  const countries: CountryStat[] = [];
  for (const stat of byId.values()) {
    stat.events.sort((a, b) => eventRank(b) - eventRank(a) || b.time.localeCompare(a.time));
    stat.events = stat.events.slice(0, 14);
    let score = scoreCountry(stat, metric);
    if (ai && ai.metric === metric) {
      const adj = ai.values[stat.id] ?? ai.values[stat.name];
      if (typeof adj === "number") score = clamp(score * 0.6 + (adj / 100) * 0.4, 0, 1);
    }
    stat.score = score;
    countries.push(stat);
  }
  countries.sort((a, b) => b.score - a.score || b.eventTotal - a.eventTotal || a.name.localeCompare(b.name));
  return { countries, events: assigned };
}

export function topCountries(countries: CountryStat[], limit = 18): CountryStat[] {
  return countries.filter((c) => c.score > 0.04 || c.eventTotal > 0).slice(0, limit);
}

export const ALERT_LABEL: Record<AlertLevel, string> = {
  red: "Red",
  orange: "Orange",
  green: "Green",
  info: "Info",
};

export function kindWeight(kind: HazardKind, mag: number | null, alert: AlertLevel): number {
  if (kind === "quake") return Math.max(2.4, mag ?? 2.4);
  if (alert === "red") return 7;
  if (alert === "orange") return 5.5;
  return 4.2;
}
