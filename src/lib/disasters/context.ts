import { ago } from "./format";
import type { AtlasPayload, CountryStat, Metric } from "./types";
import { METRICS } from "./types";

export function buildContext(args: {
  payload: AtlasPayload;
  metric: Metric;
  countries: CountryStat[];
  selected: CountryStat | null;
  location: { lat: number; lon: number; label: string } | null;
  radiusKm: number;
  nearby: { title: string; kind: string; km: number; mag: number | null; source: string }[];
}): string {
  const metric = METRICS.find((m) => m.id === args.metric);
  const lines: string[] = [];
  lines.push(`Updated ${args.payload.fetchedAt}. Active color metric: ${args.metric}. ${metric?.blurb ?? ""}`);
  lines.push(
    "Sources: " +
      args.payload.sources
        .map((s) => `${s.label} ${s.ok ? "ok " + s.count : "FAILED " + (s.error ?? "")}`)
        .join("; "),
  );
  if (args.location) {
    lines.push(
      `User location (${args.location.label}): ${args.location.lat.toFixed(2)}, ${args.location.lon.toFixed(2)}. Alert radius ${args.radiusKm} km.`,
    );
  } else {
    lines.push("User location: not shared.");
  }
  if (args.nearby.length) {
    lines.push(
      "Inside radius: " +
        args.nearby
          .slice(0, 6)
          .map((n) => `${n.kind} ${n.mag != null ? "M" + n.mag + " " : ""}${n.title} ${Math.round(n.km)}km [${n.source}]`)
          .join(" | "),
    );
  } else if (args.location) {
    lines.push("Inside radius: no matching hazards in the current feeds.");
  }
  const top = args.countries.filter((c) => c.score > 0.05 || c.eventTotal > 0).slice(0, 10);
  lines.push(
    "Top countries: " +
      (top.length
        ? top
            .map(
              (c) =>
                `${c.name} id=${c.id} pressure=${Math.round(c.score * 100)} rain48hish=${c.precipMm.toFixed(1)}mm` +
                (c.owmRain != null ? ` owm1h=${c.owmRain.toFixed(1)}mm` : "") +
                ` floods=${c.counts.flood} quakes=${c.counts.quake} maxMag=${c.maxMag || 0} fires=${c.counts.fire} storms=${c.counts.storm} volcanoes=${c.counts.volcano}`,
            )
            .join(" || ")
        : "none"),
  );
  if (args.selected) {
    const c = args.selected;
    lines.push(
      `Selected: ${c.name} id=${c.id} ${c.continent} pressure=${Math.round(c.score * 100)} rain=${c.precipMm.toFixed(1)}mm events=${c.eventTotal}. ` +
        c.events
          .slice(0, 6)
          .map((e) => `${e.kind} ${e.mag != null ? "M" + e.mag + " " : ""}${e.title} [${e.source}] ${ago(e.time)}`)
          .join(" | "),
    );
  }
  const hottest = [...args.payload.events]
    .sort((a, b) => (b.alert === "red" ? 1 : 0) - (a.alert === "red" ? 1 : 0) || (b.mag ?? 0) - (a.mag ?? 0))
    .slice(0, 12);
  lines.push(
    "Notable events: " +
      hottest
        .map(
          (e) =>
            `${e.kind}/${e.alert} ${e.mag != null ? "M" + e.mag + " " : ""}${e.title} @${e.lat.toFixed(1)},${e.lon.toFixed(1)} [${e.source}] ${ago(e.time)}`,
        )
        .join(" | "),
  );
  if (args.payload.headlines.length) {
    lines.push(
      "Headlines: " +
        args.payload.headlines
          .slice(0, 12)
          .map((h) => `${h.title} (${h.source})`)
          .join(" | "),
    );
  }
  if (args.payload.spaceWeather.length) {
    lines.push(
      "NASA DONKI: " + args.payload.spaceWeather.map((s) => s.title).join(" | "),
    );
  }
  return lines.join("\n").slice(0, 7500);
}

export function parseLayerScores(
  text: string,
  countries: { id: string; name: string }[],
): { scores: Record<string, number>; note: string } | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;
  const body = parsed as { note?: unknown; scores?: unknown };
  const raw = body.scores;
  if (!raw || typeof raw !== "object") return null;
  const byId = new Map(countries.map((c) => [c.id.toLowerCase(), c.id]));
  const byName = new Map(countries.map((c) => [c.name.toLowerCase(), c.id]));
  const scores: Record<string, number> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    const n = typeof value === "number" ? value : Number(value);
    if (!Number.isFinite(n)) continue;
    const id = byId.get(key.toLowerCase()) ?? byName.get(key.toLowerCase());
    if (!id) continue;
    scores[id] = Math.min(100, Math.max(0, n));
  }
  if (!Object.keys(scores).length) return null;
  const note = typeof body.note === "string" ? body.note.slice(0, 400) : "";
  return { scores, note };
}
