import {
  dayStamp,
  featureInfoUrl,
  isCmemsUrl,
  LAYER_BY_ID,
  layerTime,
  legendUrl,
  type CmemsLayer,
  type LayerSettings,
} from "./layers";
import type { LegendInfo, PointReport, SeriesPoint } from "./types";

const UA = "GWNAtlas/0.2 (educational live hazard map)";

async function getJson<T>(url: string, ms = 12000): Promise<T> {
  const res = await fetch(url, {
    signal: AbortSignal.timeout(ms),
    headers: { "User-Agent": UA, Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as T;
}

function message(err: unknown): string {
  if (err instanceof Error) return err.name === "TimeoutError" ? "timed out" : err.message.slice(0, 120);
  return "failed";
}

// Legends rarely change; keep them for an hour per style.
const legendCache = new Map<string, { at: number; value: LegendInfo }>();

type LegendJson = {
  continuous?: { valueMin: number; valueMax: number; units: string; cmap?: { colorMap?: number[][] } };
};

export async function loadLegend(layerId: string, settings: LayerSettings): Promise<LegendInfo> {
  const layer = LAYER_BY_ID.get(layerId);
  if (!layer) throw new Error("Unknown layer");
  const url = legendUrl(layer, settings);
  const hit = legendCache.get(url);
  if (hit && Date.now() - hit.at < 3_600_000) return hit.value;
  const json = await getJson<LegendJson>(url);
  const scale = json.continuous;
  if (!scale) throw new Error("No legend");
  const colors = scale.cmap?.colorMap ?? [];
  // 12 evenly spaced stops are plenty for a CSS gradient.
  const stops = Array.from({ length: 12 }, (_, i) => colors[Math.round((i / 11) * (colors.length - 1))]).filter(Boolean);
  const value: LegendInfo = {
    min: scale.valueMin,
    max: scale.valueMax,
    units: scale.units,
    gradient: stops.map(([r, g, b]) => `rgb(${r},${g},${b})`),
  };
  legendCache.set(url, { at: Date.now(), value });
  return value;
}

type FeatureInfo = { features?: { properties?: { value?: number | null } }[] };

async function cmemsValue(layer: CmemsLayer, lon: number, lat: number, day: string, depth: number): Promise<number | null> {
  const url = featureInfoUrl(layer.layer, lon, lat, layerTime(layer, day), layer.depth ? depth : undefined);
  const json = await getJson<FeatureInfo>(url, 15000);
  const value = json.features?.[0]?.properties?.value;
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/** One value per day for a layer at a point (land or missing days come back null). */
async function cmemsSeries(layer: CmemsLayer, lon: number, lat: number, offsets: number[], depth: number): Promise<SeriesPoint[]> {
  return Promise.all(
    offsets.map(async (offset) => {
      const day = dayStamp(offset);
      try {
        return { t: day, v: await cmemsValue(layer, lon, lat, day, depth) };
      } catch {
        return { t: day, v: null };
      }
    }),
  );
}

type MeteoHourly = { hourly?: Record<string, (number | null)[]> & { time?: string[] }; daily?: Record<string, (number | null)[]> & { time?: string[] } };

function series(times: string[] | undefined, values: (number | null)[] | undefined, every = 1): SeriesPoint[] {
  if (!times || !values) return [];
  return times.filter((_, i) => i % every === 0).map((t, k) => ({ t, v: values[k * every] ?? null }));
}

/** Sum hourly values into 3-hour bins (ECMWF publishes 3-hourly; hours inside a bin repeat). */
function threeHourly(times: string[] | undefined, values: (number | null)[] | undefined): SeriesPoint[] {
  if (!times || !values) return [];
  const out: SeriesPoint[] = [];
  for (let i = 0; i < times.length; i += 3) {
    const bin = values.slice(i, i + 3);
    out.push({ t: times[i], v: bin.every((v) => v === null) ? null : bin.reduce<number>((sum, v) => sum + (v ?? 0), 0) });
  }
  return out;
}

export async function loadPoint(lat: number, lon: number, layerIds: string[], depth: number): Promise<PointReport> {
  const errors: string[] = [];
  const today = dayStamp(0);
  const at = `${lat.toFixed(3)},${lon.toFixed(3)}`;
  const layers = layerIds.map((id) => LAYER_BY_ID.get(id)).filter((layer): layer is CmemsLayer => Boolean(layer));

  const ocean = Promise.all(
    layers.map(async (layer) => {
      try {
        return { id: layer.id, value: await cmemsValue(layer, lon, lat, today, depth) };
      } catch (err) {
        errors.push(`${layer.label}: ${message(err)}`);
        return { id: layer.id, value: null };
      }
    }),
  );
  const sstLayer = LAYER_BY_ID.get("sst")!;
  const waveLayer = LAYER_BY_ID.get("wave-height")!;
  const forecastDays = [-3, -2, -1, 0, 1, 2, 3, 4, 5, 6, 7, 8];
  const sst = cmemsSeries(sstLayer, lon, lat, forecastDays, depth);
  const waves = cmemsSeries(waveLayer, lon, lat, forecastDays, depth);

  const rain = getJson<MeteoHourly>(
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&models=ecmwf_ifs025&hourly=precipitation,snowfall&daily=precipitation_sum,snowfall_sum&forecast_days=7&timezone=UTC`,
  ).catch((err) => {
    errors.push(`Rain (ECMWF): ${message(err)}`);
    return null;
  });
  const air = getJson<MeteoHourly>(
    `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&hourly=pm2_5,ozone,dust,uv_index&forecast_days=4&timezone=UTC`,
  ).catch((err) => {
    errors.push(`Air quality (CAMS): ${message(err)}`);
    return null;
  });
  const flood = getJson<MeteoHourly>(
    `https://flood-api.open-meteo.com/v1/flood?latitude=${lat}&longitude=${lon}&daily=river_discharge,river_discharge_mean,river_discharge_max&past_days=7&forecast_days=30`,
  ).catch(() => null); // Open ocean has no river: not an error worth showing.

  const [oceanValues, sstSeries, waveSeries, rainJson, airJson, floodJson] = await Promise.all([ocean, sst, waves, rain, air, flood]);

  const dischargeSeries = series(floodJson?.daily?.time, floodJson?.daily?.river_discharge);
  return {
    at,
    lat,
    lon,
    day: today,
    ocean: oceanValues,
    sst: sstSeries.some((p) => p.v !== null) ? sstSeries : [],
    waves: waveSeries.some((p) => p.v !== null) ? waveSeries : [],
    rain: rainJson
      ? {
          bins: threeHourly(rainJson.hourly?.time, rainJson.hourly?.precipitation),
          daily: series(rainJson.daily?.time, rainJson.daily?.precipitation_sum),
          snowDaily: series(rainJson.daily?.time, rainJson.daily?.snowfall_sum),
        }
      : null,
    air: airJson
      ? {
          pm25: series(airJson.hourly?.time, airJson.hourly?.pm2_5, 3),
          ozone: series(airJson.hourly?.time, airJson.hourly?.ozone, 3),
          dust: series(airJson.hourly?.time, airJson.hourly?.dust, 3),
          uv: series(airJson.hourly?.time, airJson.hourly?.uv_index, 3),
        }
      : null,
    river: dischargeSeries.some((p) => (p.v ?? 0) > 0)
      ? {
          discharge: dischargeSeries,
          mean: series(floodJson?.daily?.time, floodJson?.daily?.river_discharge_mean),
          max: series(floodJson?.daily?.time, floodJson?.daily?.river_discharge_max),
        }
      : null,
    errors,
  };
}

/** Fetch one Copernicus WMTS tile for browsers that block the cross-origin request. */
export async function proxyTile(url: string): Promise<Response> {
  if (!isCmemsUrl(url)) return new Response("Forbidden", { status: 403 });
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(20000), headers: { "User-Agent": UA } });
    return new Response(res.body, {
      status: res.status,
      headers: {
        "content-type": res.headers.get("content-type") ?? "image/png",
        "cache-control": "public, max-age=1800, s-maxage=3600",
      },
    });
  } catch (err) {
    return new Response(message(err), { status: 502 });
  }
}
